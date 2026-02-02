#!/usr/bin/env bash
set -Eeuo pipefail

if [ "${EUID}" -ne 0 ]; then echo "需要 root 权限"; exit 1; fi

SRC_DIR=$(cd "$(dirname "$0")" && pwd)
DEST_DIR=/srv/taiko-web

systemctl stop taiko-web || true

mkdir -p "$DEST_DIR"
# 使用 rsync 同步代码，但排除用户数据目录和配置文件
# --delete 会删除目标目录中源目录没有的文件，但 --exclude 的文件除外
rsync -a --delete \
  --exclude '.git' \
  --exclude '.venv' \
  --exclude 'public/songs' \
  --exclude 'config.py' \
  "$SRC_DIR/" "$DEST_DIR/"

# 如果配置文件不存在，则从示例复制（首次运行或误删时）
if [ ! -f "$DEST_DIR/config.py" ] && [ -f "$DEST_DIR/config.example.py" ]; then
  cp "$DEST_DIR/config.example.py" "$DEST_DIR/config.py"
fi

# 更新依赖
if [ -x "$DEST_DIR/.venv/bin/pip" ]; then
  "$DEST_DIR/.venv/bin/pip" install -U pip
  "$DEST_DIR/.venv/bin/pip" install -r "$DEST_DIR/requirements.txt"
fi

chown -R www-data:www-data "$DEST_DIR"

systemctl daemon-reload || true
systemctl restart taiko-web || systemctl start taiko-web || true

systemctl is-active --quiet taiko-web