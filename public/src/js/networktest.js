/**
 * NetworkTest - Lightweight network speed test module
 * Runs once when entering song selection to determine optimal chunk count
 */
class NetworkTest {
    constructor() {
        this.result = null
        this.testPromise = null
        this.testFileUrl = null
        this.testFileSize = 300 * 1024 // 300KB target
    }

    /**
     * Check if a test has already been run (persists across sessions)
     */
    hasRunTest() {
        if (this.result) return true

        // Check localStorage for cached result (persists across sessions)
        try {
            var cached = localStorage.getItem('networkTestResult')
            if (cached) {
                this.result = JSON.parse(cached)
                // Expire after 7 days
                if (Date.now() - this.result.timestamp < 7 * 24 * 60 * 60 * 1000) {
                    return true
                }
                this.result = null
            }
        } catch (e) {
            // localStorage not available
        }
        return false
    }

    /**
     * Run the network speed test
     * Returns a promise that resolves with { bandwidth, recommendedChunks, timestamp }
     */
    run() {
        // Return cached result if available
        if (this.hasRunTest()) {
            return Promise.resolve(this.result)
        }

        // Return existing promise if test is in progress
        if (this.testPromise) {
            return this.testPromise
        }

        // Determine test file URL - use a known asset file
        // We'll use the loader.gif or similar asset that's reasonably sized
        this.testFileUrl = (gameConfig.assets_baseurl || '/assets/') + 'img/dancing-don.gif'

        this.testPromise = this._runTest()
        return this.testPromise
    }

    _runTest() {
        var startTime = performance.now()

        return fetch(this.testFileUrl + '?_t=' + Date.now(), {
            method: 'GET',
            cache: 'no-store'
        }).then(response => {
            if (!response.ok) {
                throw new Error('Network test failed: ' + response.status)
            }
            return response.arrayBuffer()
        }).then(buffer => {
            var endTime = performance.now()
            var durationMs = endTime - startTime
            var durationSec = durationMs / 1000
            var bytes = buffer.byteLength
            var bits = bytes * 8
            var bandwidth = (bits / durationSec) / 1000000 // Mbps

            this.result = {
                bandwidth: bandwidth,
                recommendedChunks: this._getRecommendedChunks(bandwidth),
                fileSize: bytes,
                durationMs: durationMs,
                timestamp: Date.now()
            }

            // Cache result in localStorage (persists across sessions)
            try {
                localStorage.setItem('networkTestResult', JSON.stringify(this.result))
            } catch (e) {
                // localStorage not available
            }

            console.log('[NetworkTest] Bandwidth:', bandwidth.toFixed(2), 'Mbps, Recommended chunks:', this.result.recommendedChunks)

            this.testPromise = null
            return this.result
        }).catch(error => {
            console.warn('[NetworkTest] Test failed, using default:', error)
            // Default to moderate settings on failure
            this.result = {
                bandwidth: 10,
                recommendedChunks: 4,
                timestamp: Date.now(),
                error: error.message
            }
            this.testPromise = null
            return this.result
        })
    }

    /**
     * Map bandwidth to recommended chunk count
     * @param {number} bandwidth - Bandwidth in Mbps
     */
    _getRecommendedChunks(bandwidth) {
        if (bandwidth < 5) return 2
        if (bandwidth < 20) return 4
        if (bandwidth < 50) return 6
        return 8
    }

    /**
     * Get the test result
     */
    getResult() {
        return this.result
    }

    /**
     * Get recommended chunk count (shorthand)
     */
    getRecommendedChunks() {
        if (!this.result) return 4 // Default
        return this.result.recommendedChunks
    }
}

// Global singleton
var networkTest = new NetworkTest()
