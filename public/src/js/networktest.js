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

        // Check if user is on mobile data - skip test to save data
        if (this._isCellularConnection()) {
            console.log('[NetworkTest] Cellular connection detected, skipping test to save data')
            this.result = {
                bandwidth: 10,
                recommendedChunks: 4,
                timestamp: Date.now(),
                skipped: 'cellular',
                connectionType: this._getConnectionType()
            }
            return Promise.resolve(this.result)
        }

        // Check if user is in China region - skip test due to Cloudflare connectivity issues
        if (this._isChinaRegion()) {
            console.log('[NetworkTest] China region detected, skipping Cloudflare speed test')
            this.result = {
                bandwidth: 10,
                recommendedChunks: 4,
                timestamp: Date.now(),
                skipped: 'china_region'
            }
            return Promise.resolve(this.result)
        }

        // Determine test file URL - use a known asset file
        // We'll use the loader.gif or similar asset that's reasonably sized
        this.testFileUrl = (gameConfig.assets_baseurl || '/assets/') + 'img/dancing-don.gif'

        this.testPromise = this._runTest()
        return this.testPromise
    }

    /**
     * Check if user is on a cellular/mobile data connection
     */
    _isCellularConnection() {
        var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
        if (!connection) {
            return false // Cannot detect, assume WiFi
        }
        var type = connection.type || connection.effectiveType
        // Cellular connection types
        return type === 'cellular' || type === '2g' || type === '3g' || type === '4g' || type === 'slow-2g'
    }

    /**
     * Get connection type for logging
     */
    _getConnectionType() {
        var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
        if (!connection) return 'unknown'
        return connection.type || connection.effectiveType || 'unknown'
    }

    /**
     * Check if user is likely in China region based on timezone and language
     * Used to skip Cloudflare-based speed test due to connectivity issues
     */
    _isChinaRegion() {
        try {
            // Check timezone
            var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
            var chinaTimezones = ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Urumqi', 'Asia/Hong_Kong', 'Asia/Macau']
            if (chinaTimezones.indexOf(timezone) !== -1) {
                // Further verify with language to avoid false positives for other UTC+8 regions
                var lang = navigator.language || navigator.userLanguage || ''
                if (lang.toLowerCase().startsWith('zh')) {
                    return true
                }
            }
        } catch (e) {
            // Timezone detection not supported
        }
        return false
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
