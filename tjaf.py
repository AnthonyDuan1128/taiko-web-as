import os
import re
from typing import Dict, Optional, List, Any

class Tja:
    def __init__(self, text: str):
        self.text = text
        self.title: Optional[str] = None
        self.subtitle: Optional[str] = None
        self.title_ja: Optional[str] = None
        self.subtitle_ja: Optional[str] = None
        self.wave: Optional[str] = None
        self.offset: Optional[float] = None
        self.courses: Dict[str, Dict[str, Any]] = {}
        self._parse()

    def _parse(self) -> None:
        lines = self.text.split("\n")
        current_course: Optional[str] = None
        current_exams: List[Dict[str, Any]] = []
        current_songs: List[Dict[str, Any]] = []
        in_song_section = False
        
        for raw in lines:
            line = raw.strip()
            if not line:
                continue
            
            # Handle #NEXTSONG directive (for Dan-i Dojo)
            if line.upper().startswith("#NEXTSONG"):
                # Format: #NEXTSONG title,artist,genre,wave,offset,scoreInit
                parts = line[9:].strip().split(",")
                if len(parts) >= 4:
                    song_info = {
                        "title": parts[0].strip() if len(parts) > 0 else "",
                        "artist": parts[1].strip() if len(parts) > 1 else "",
                        "genre": parts[2].strip() if len(parts) > 2 else "",
                        "wave": parts[3].strip() if len(parts) > 3 else "",
                        "offset": float(parts[4].strip()) if len(parts) > 4 and parts[4].strip() else 0,
                        "scoreInit": int(parts[5].strip()) if len(parts) > 5 and parts[5].strip() else 0,
                    }
                    current_songs.append(song_info)
                continue
            
            # Handle #START and #END markers
            if line.upper().startswith("#START"):
                in_song_section = True
                continue
            if line.upper().startswith("#END"):
                in_song_section = False
                continue
                
            if ":" in line:
                k, v = line.split(":", 1)
                key = k.strip().upper()
                val = v.strip()
                
                if key == "TITLE":
                    self.title = val or None
                elif key == "TITLEJA":
                    self.title_ja = val or None
                elif key == "SUBTITLE":
                    self.subtitle = val or None
                elif key == "SUBTITLEJA":
                    self.subtitle_ja = val or None
                elif key == "WAVE":
                    self.wave = val or None
                elif key == "OFFSET":
                    try:
                        self.offset = float(val)
                    except ValueError:
                        self.offset = None
                elif key == "COURSE":
                    # Save previous course data if exists
                    if current_course and current_course in self.courses:
                        if current_exams:
                            self.courses[current_course]["exams"] = current_exams.copy()
                        if current_songs:
                            self.courses[current_course]["songs"] = current_songs.copy()
                    
                    course_map = {
                        "EASY": "easy",
                        "NORMAL": "normal",
                        "HARD": "hard",
                        "ONI": "oni",
                        "EDIT": "ura",
                        "URA": "ura",
                        "DAN": "dan",
                        "TOWER": "tower",
                    }
                    current_course = course_map.get(val.strip().upper())
                    if current_course and current_course not in self.courses:
                        self.courses[current_course] = {"stars": None, "branch": False}
                    # Reset exams and songs for new course
                    current_exams = []
                    current_songs = []
                    
                elif key == "LEVEL" and current_course:
                    try:
                        stars = int(re.split(r"\s+", val)[0])
                    except ValueError:
                        stars = None
                    self.courses[current_course]["stars"] = stars
                    
                # EXAM1-EXAM4 parsing for Dan-i Dojo
                elif key in ("EXAM1", "EXAM2", "EXAM3", "EXAM4") and current_course:
                    # Format: EXAM1:type,red_pass,gold_pass,scope
                    # type: g=good, ok=ok, ng=bad, jp=drumroll_total, jb=bad_total, etc.
                    # scope: m=per_measure, l=total
                    exam_parts = val.split(",")
                    if len(exam_parts) >= 3:
                        exam_type = exam_parts[0].strip().lower()
                        try:
                            red_pass = int(exam_parts[1].strip()) if exam_parts[1].strip() else 0
                            gold_pass = int(exam_parts[2].strip()) if exam_parts[2].strip() else 0
                        except ValueError:
                            red_pass = 0
                            gold_pass = 0
                        scope = exam_parts[3].strip().lower() if len(exam_parts) > 3 else "l"
                        
                        exam_data = {
                            "id": int(key[-1]),  # 1, 2, 3, or 4
                            "type": exam_type,
                            "red_pass": red_pass,
                            "gold_pass": gold_pass,
                            "scope": scope,
                        }
                        current_exams.append(exam_data)
            else:
                if current_course and (line.startswith("BRANCHSTART") or line.startswith("#BRANCHSTART")):
                    self.courses[current_course]["branch"] = True
        
        # Save final course data
        if current_course and current_course in self.courses:
            if current_exams:
                self.courses[current_course]["exams"] = current_exams
            if current_songs:
                self.courses[current_course]["songs"] = current_songs

    def to_mongo(self, song_id: str, created_ns: int) -> Dict:
        ext = None
        if self.wave:
            base = os.path.basename(self.wave)
            _, e = os.path.splitext(base)
            if e:
                ext = e.lstrip(".").lower()
        if not ext:
            ext = "mp3"
        
        courses_out: Dict[str, Optional[Dict[str, Any]]] = {}
        for name in ["easy", "normal", "hard", "oni", "ura", "dan", "tower"]:
            course_data = self.courses.get(name)
            if course_data:
                courses_out[name] = course_data.copy()
            else:
                courses_out[name] = None
        
        return {
            "id": song_id,
            "type": "tja",
            "title": self.title,
            "subtitle": self.subtitle,
            "title_lang": {
                "ja": self.title_ja or self.title,
                "en": None,
                "cn": self.title_ja or None,
                "tw": None,
                "ko": None,
            },
            "subtitle_lang": {
                "ja": self.subtitle_ja or self.subtitle,
                "en": None,
                "cn": self.subtitle_ja or None,
                "tw": None,
                "ko": None,
            },
            "courses": courses_out,
            "enabled": False,
            "category_id": None,
            "music_type": ext,
            # DB 的 offset 是"额外偏移"，TJA 自身的 OFFSET 会在前端解析时应用
            # 为避免双重偏移，这里固定为 0
            "offset": 0,
            "skin_id": None,
            "preview": 0,
            "volume": 1.0,
            "maker_id": None,
            "hash": None,
            "order": song_id,
            "created_ns": created_ns,
        }