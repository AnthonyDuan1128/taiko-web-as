/**
 * ChunkedLoader - HTTP Range-based parallel chunk downloader for audio files
 * Features:
 * - Parallel chunk downloading using HTTP Range requests
 * - Request deduplication (prevents duplicate requests for same URL)
 * - In-memory caching (avoids re-downloading same file)
 * - Graceful fallback for servers without Range support
 * - Progress callbacks for UI feedback
 */
class ChunkedLoader {
    constructor() {
        // Cache of loaded audio buffers: url -> ArrayBuffer
        this.cache = new Map()
        // In-flight requests: url -> Promise
        this.pending = new Map()
        // Default chunk count if network test hasn't run
        this.defaultChunks = 4
        // Maximum file size for chunked loading (50MB)
        this.maxChunkedSize = 50 * 1024 * 1024
        // Minimum file size for chunked loading (100KB)
        this.minChunkedSize = 100 * 1024
    }

    /**
     * Load an audio file, using chunked loading if appropriate
     * @param {string} url - URL of the audio file
     * @param {function} onProgress - Optional progress callback (loaded, total)
     * @returns {Promise<ArrayBuffer>} - The loaded audio data
     */
    load(url, onProgress) {
        // Normalize URL for cache key
        var cacheKey = this._normalizeUrl(url)

        // Return cached result if available
        if (this.cache.has(cacheKey)) {
            var cached = this.cache.get(cacheKey)
            if (onProgress) onProgress(cached.byteLength, cached.byteLength)
            return Promise.resolve(cached)
        }

        // Return existing pending request (deduplication)
        if (this.pending.has(cacheKey)) {
            return this.pending.get(cacheKey).then(buffer => {
                if (onProgress) onProgress(buffer.byteLength, buffer.byteLength)
                return buffer
            })
        }

        // Determine chunk count
        var numChunks = this.defaultChunks
        if (typeof networkTest !== 'undefined' && networkTest.getResult()) {
            numChunks = networkTest.getRecommendedChunks()
        }

        // Start the load and store the promise
        var loadPromise = this._loadWithChunks(url, numChunks, onProgress)
            .then(buffer => {
                // Cache the result
                this.cache.set(cacheKey, buffer)
                // Remove from pending
                this.pending.delete(cacheKey)
                return buffer
            })
            .catch(error => {
                // Remove from pending on error
                this.pending.delete(cacheKey)
                throw error
            })

        this.pending.set(cacheKey, loadPromise)
        return loadPromise
    }

    /**
     * Abort any pending request for a URL
     * @param {string} url - URL to abort
     */
    abort(url) {
        var cacheKey = this._normalizeUrl(url)
        var pending = this.pending.get(cacheKey)
        if (pending && pending.abortController) {
            pending.abortController.abort()
            this.pending.delete(cacheKey)
        }
    }

    /**
     * Clear cache for a specific URL or all URLs
     * @param {string} url - Optional URL to clear
     */
    clearCache(url) {
        if (url) {
            this.cache.delete(this._normalizeUrl(url))
        } else {
            this.cache.clear()
        }
    }

    /**
     * Internal: Load with chunked strategy
     */
    _loadWithChunks(url, numChunks, onProgress) {
        var self = this
        var abortController = new AbortController()

        // First, do a HEAD request to get file size and check Range support
        return fetch(url, {
            method: 'HEAD',
            signal: abortController.signal
        }).then(response => {
            if (!response.ok) {
                throw new Error('HEAD request failed: ' + response.status)
            }

            var contentLength = parseInt(response.headers.get('Content-Length'), 10)
            var acceptRanges = response.headers.get('Accept-Ranges')

            // Check if chunked loading is appropriate
            if (!contentLength ||
                !acceptRanges ||
                acceptRanges === 'none' ||
                contentLength < self.minChunkedSize ||
                contentLength > self.maxChunkedSize) {
                // Fall back to standard loading
                console.log('[ChunkedLoader] Falling back to standard loading for:', url)
                return self._standardLoad(url, abortController.signal, onProgress)
            }

            // Calculate chunk ranges
            var chunkSize = Math.ceil(contentLength / numChunks)
            var ranges = []
            for (var i = 0; i < numChunks; i++) {
                var start = i * chunkSize
                var end = Math.min(start + chunkSize - 1, contentLength - 1)
                ranges.push({ start: start, end: end, index: i })
            }

            console.log('[ChunkedLoader] Loading', url, 'in', numChunks, 'chunks of ~', Math.round(chunkSize / 1024), 'KB each')

            // Track progress
            var loadedBytes = 0
            var totalBytes = contentLength

            // Fetch all chunks in parallel
            var chunkPromises = ranges.map(function (range) {
                return fetch(url, {
                    method: 'GET',
                    headers: {
                        'Range': 'bytes=' + range.start + '-' + range.end
                    },
                    signal: abortController.signal
                }).then(function (resp) {
                    if (!resp.ok && resp.status !== 206) {
                        throw new Error('Chunk fetch failed: ' + resp.status)
                    }
                    return resp.arrayBuffer()
                }).then(function (buffer) {
                    loadedBytes += buffer.byteLength
                    if (onProgress) onProgress(loadedBytes, totalBytes)
                    return { index: range.index, buffer: buffer }
                })
            })

            return Promise.all(chunkPromises).then(function (chunks) {
                // Sort chunks by index
                chunks.sort(function (a, b) { return a.index - b.index })

                // Concatenate chunks
                var totalLength = chunks.reduce(function (sum, c) { return sum + c.buffer.byteLength }, 0)
                var result = new Uint8Array(totalLength)
                var offset = 0

                chunks.forEach(function (chunk) {
                    result.set(new Uint8Array(chunk.buffer), offset)
                    offset += chunk.buffer.byteLength
                })

                return result.buffer
            })
        }).catch(function (error) {
            if (error.name === 'AbortError') {
                console.log('[ChunkedLoader] Request aborted:', url)
                throw error
            }

            // If HEAD fails or Range not supported, fall back to standard load
            console.warn('[ChunkedLoader] Chunked load failed, falling back:', error)
            return self._standardLoad(url, null, onProgress)
        })
    }

    /**
     * Standard single-request loading (fallback)
     */
    _standardLoad(url, signal, onProgress) {
        return fetch(url, { signal: signal }).then(function (response) {
            if (!response.ok) {
                throw new Error('Fetch failed: ' + response.status)
            }

            var contentLength = parseInt(response.headers.get('Content-Length'), 10) || 0

            // If we can track progress
            if (response.body && contentLength) {
                var reader = response.body.getReader()
                var chunks = []
                var loadedBytes = 0

                return new Promise(function (resolve, reject) {
                    function read() {
                        reader.read().then(function (result) {
                            if (result.done) {
                                // Concatenate all chunks
                                var totalLength = chunks.reduce(function (sum, c) { return sum + c.length }, 0)
                                var data = new Uint8Array(totalLength)
                                var offset = 0
                                chunks.forEach(function (chunk) {
                                    data.set(chunk, offset)
                                    offset += chunk.length
                                })
                                resolve(data.buffer)
                                return
                            }

                            chunks.push(result.value)
                            loadedBytes += result.value.length
                            if (onProgress) onProgress(loadedBytes, contentLength)
                            read()
                        }).catch(reject)
                    }
                    read()
                })
            }

            return response.arrayBuffer().then(function (buffer) {
                if (onProgress) onProgress(buffer.byteLength, buffer.byteLength)
                return buffer
            })
        })
    }

    /**
     * Normalize URL for cache key
     */
    _normalizeUrl(url) {
        // Remove query string for caching (except for cache busting)
        try {
            var parsed = new URL(url, location.href)
            // Keep the base URL without timestamp-based cache busting
            return parsed.origin + parsed.pathname
        } catch (e) {
            return url
        }
    }

    /**
     * Check if a URL is cached
     */
    isCached(url) {
        return this.cache.has(this._normalizeUrl(url))
    }

    /**
     * Check if a URL is currently loading
     */
    isLoading(url) {
        return this.pending.has(this._normalizeUrl(url))
    }

    /**
     * Get cached buffer without triggering a load
     */
    getCached(url) {
        return this.cache.get(this._normalizeUrl(url))
    }
}

// Global singleton
var chunkedLoader = new ChunkedLoader()
