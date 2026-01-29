I will optimize the loading process by implementing a **Multi-Threaded Worker Loader**. This involves creating a pool of Web Workers to fetch assets (JavaScript, Audio, Images, Views) in parallel, offloading the network initiation and handling from the main thread.

### Plan:
1.  **Create `public/src/js/loader-worker.js`**:
    *   This worker will handle `fetch` requests for different resource types (`text`, `blob`, `arraybuffer`).
    *   It will transfer the data back to the main thread (using zero-copy transfer for `ArrayBuffer`).

2.  **Modify `public/src/js/loader.js`**:
    *   **Initialize Worker Pool**: Create a pool of workers (defaulting to 4) in the `Loader` class.
    *   **Implement `workerFetch(url, type)`**: A method to distribute fetch tasks to the worker pool.
    *   **Override `ajax(url, ...)`**: Intercept requests for static assets (`src/`, `assets/`, etc.) and route them through `workerFetch`. Keep API calls (`api/`) on the main thread to ensure session stability.
    *   **Update `loadScript(url)`**: Change it to fetch the script content via `workerFetch` and inject it using a `<script>` tag with inline content. This ensures JS files are also loaded via the "multi-process" mechanism.
    *   **Update `loadSound` and `RemoteFile` logic**: Since `RemoteFile` uses `loader.ajax`, routing `ajax` to workers will automatically parallelize audio loading.

### Technical Details:
*   **Concurrency**: 4 Workers will be used to maximize throughput without overloading the browser's connection limit per domain.
*   **Resource Types**:
    *   **JS/Views**: Fetched as `text`.
    *   **Images**: Fetched as `blob` -> `URL.createObjectURL`.
    *   **Audio**: Fetched as `arraybuffer` -> `AudioContext.decodeAudioData`.
