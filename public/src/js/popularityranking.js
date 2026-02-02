class PopularityRanking {
    constructor() {
        this.visible = false
        this.data = null
    }

    async show() {
        this.visible = true
        this.data = null

        // Create overlay
        this.overlay = document.createElement("div")
        this.overlay.id = "popularity-ranking-overlay"
        this.overlay.innerHTML = `
			<div class="popularity-container">
				<div class="popularity-header">
					<button class="popularity-back">${strings.back}</button>
					<h2 class="popularity-title">${strings.popularityRankingTitle}</h2>
				</div>
				<div class="popularity-content">
					<div class="popularity-loading">${strings.loading}</div>
				</div>
			</div>
		`
        document.body.appendChild(this.overlay)

        // Add styles
        this.addStyles()

        // Bind events - any click/touch/keypress closes the ranking
        this.clickHandler = (e) => {
            // Only close if clicking on the overlay background or back button
            if (e.target === this.overlay || e.target.classList.contains("popularity-back")) {
                this.hide()
            }
        }
        this.keyHandler = (e) => {
            if (this.visible) {
                this.hide()
            }
        }
        this.overlay.addEventListener("click", this.clickHandler)
        this.overlay.addEventListener("touchend", this.clickHandler)
        document.addEventListener("keydown", this.keyHandler)

        // Fetch data
        await this.fetchData()
    }

    async fetchData() {
        try {
            const url = `api/popularity/ranking?limit=50`
            const response = await fetch(url)
            const data = await response.json()

            if (data.status === "ok") {
                this.data = data.ranking
                this.render()
            }
        } catch (e) {
            console.error("Failed to fetch popularity ranking:", e)
            this.renderError()
        }
    }

    render() {
        const content = this.overlay.querySelector(".popularity-content")

        if (!this.data || this.data.length === 0) {
            content.innerHTML = `<div class="popularity-empty">${strings.noScores}</div>`
            return
        }

        let html = '<ul class="popularity-list">'
        for (let i = 0; i < this.data.length; i++) {
            const entry = this.data[i]
            const rank = i + 1
            const rankClass = rank <= 3 ? `rank-${rank}` : ""
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : ""
            html += `
				<li class="popularity-item ${rankClass}">
					<span class="popularity-rank">${medal ? medal : rank + "."}</span>
					<span class="popularity-title-text">${this.escapeHtml(entry.title)}</span>
					<span class="popularity-count">
						<span class="popularity-fire">🔥</span>
						${entry.play_count.toLocaleString()} ${strings.plays}
					</span>
				</li>
			`
        }
        html += '</ul>'
        content.innerHTML = html
    }

    renderError() {
        const content = this.overlay.querySelector(".popularity-content")
        content.innerHTML = `<div class="popularity-error">${strings.errorOccured}</div>`
    }

    escapeHtml(str) {
        if (!str) return ""
        return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
    }

    hide() {
        if (this.overlay) {
            this.overlay.remove()
            this.overlay = null
        }
        if (this.keyHandler) {
            document.removeEventListener("keydown", this.keyHandler)
            this.keyHandler = null
        }
        this.visible = false
    }

    addStyles() {
        if (document.getElementById("popularity-ranking-styles")) return

        const style = document.createElement("style")
        style.id = "popularity-ranking-styles"
        style.textContent = `
			#popularity-ranking-overlay {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.75);
				display: flex;
				justify-content: center;
				align-items: center;
				z-index: 1000;
				animation: fadeIn 0.3s ease;
			}
			@keyframes fadeIn {
				from { opacity: 0; }
				to { opacity: 1; }
			}
			.popularity-container {
				background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
				border-radius: 20px;
				box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 107, 107, 0.3);
				width: 90%;
				max-width: 750px;
				max-height: 85vh;
				overflow: hidden;
				display: flex;
				flex-direction: column;
				border: 2px solid rgba(255, 255, 255, 0.1);
			}
			.popularity-header {
				background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 50%, #ffd93d 100%);
				padding: 18px 25px;
				display: flex;
				align-items: center;
				gap: 20px;
				position: relative;
				overflow: hidden;
			}
			.popularity-header::before {
				content: "🔥";
				position: absolute;
				right: 30px;
				top: 50%;
				transform: translateY(-50%);
				font-size: 2.5em;
				opacity: 0.3;
			}
			.popularity-back {
				background: rgba(255, 255, 255, 0.95);
				border: none;
				padding: 10px 20px;
				border-radius: 25px;
				cursor: pointer;
				font-weight: bold;
				color: #ff6b6b;
				transition: all 0.2s ease;
				box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
				font-size: 1em;
			}
			.popularity-back:hover {
				transform: scale(1.05);
				background: #fff;
				box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
			}
			.popularity-title {
				color: #fff;
				font-size: 1.5em;
				margin: 0;
				text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.4);
				flex: 1;
				letter-spacing: 1px;
			}
			.popularity-content {
				padding: 25px;
				overflow-y: auto;
				flex: 1;
				background: linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.05) 100%);
			}
			.popularity-list {
				list-style: none;
				padding: 0;
				margin: 0;
			}
			.popularity-item {
				display: flex;
				align-items: center;
				padding: 14px 18px;
				margin: 8px 0;
				background: rgba(255, 255, 255, 0.08);
				border-radius: 12px;
				border-left: 4px solid rgba(255, 255, 255, 0.2);
				transition: all 0.2s ease;
				backdrop-filter: blur(5px);
			}
			.popularity-item:hover {
				transform: translateX(8px);
				background: rgba(255, 255, 255, 0.12);
				box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
			}
			.popularity-item.rank-1 {
				background: linear-gradient(90deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 255, 255, 0.08) 40%);
				border-left-color: #ffd700;
				box-shadow: 0 0 20px rgba(255, 215, 0, 0.2);
			}
			.popularity-item.rank-2 {
				background: linear-gradient(90deg, rgba(192, 192, 192, 0.4) 0%, rgba(255, 255, 255, 0.08) 40%);
				border-left-color: #c0c0c0;
				box-shadow: 0 0 15px rgba(192, 192, 192, 0.15);
			}
			.popularity-item.rank-3 {
				background: linear-gradient(90deg, rgba(205, 127, 50, 0.4) 0%, rgba(255, 255, 255, 0.08) 40%);
				border-left-color: #cd7f32;
				box-shadow: 0 0 15px rgba(205, 127, 50, 0.15);
			}
			.popularity-rank {
				font-weight: bold;
				font-size: 1.3em;
				width: 55px;
				color: #fff;
				text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
			}
			.popularity-title-text {
				flex: 1;
				color: #e0e0e0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				font-size: 1.05em;
				padding-right: 15px;
			}
			.popularity-count {
				font-weight: bold;
				color: #ff8e53;
				font-size: 1.1em;
				display: flex;
				align-items: center;
				gap: 5px;
				text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
			}
			.popularity-fire {
				font-size: 1.2em;
			}
			.popularity-empty, .popularity-loading, .popularity-error {
				text-align: center;
				padding: 50px;
				color: rgba(255, 255, 255, 0.7);
				font-size: 1.3em;
			}
			.popularity-loading::after {
				content: "";
				display: inline-block;
				animation: dots 1.5s infinite;
			}
			@keyframes dots {
				0%, 20% { content: "."; }
				40% { content: ".."; }
				60%, 100% { content: "..."; }
			}
		`
        document.head.appendChild(style)
    }
}

var popularityRanking = new PopularityRanking()
