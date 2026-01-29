I will implement the requested changes to remove the delete functionality and redirect the upload interface while keeping the upload API intact.

### 1. Frontend: Song Selection Menu (`public/src/js/songselect.js`)
*   **Remove Delete Button**: I will remove the "Delete" (削除) button configuration from the `difficultyMenu` buttons array (around lines 313-319). This removes the option from the UI.
*   **Redirect Upload Action**: I will modify the handler for the "upload" action (around lines 954-958). Instead of redirecting to the local `/upload/` page, it will redirect to `https://zizhipu.taiko.asia`.

### 2. Backend: API Security (`app.py`)
*   **Disable Delete API**: I will modify the `/api/delete` route to return a 403 Forbidden error (or simply pass), ensuring that songs cannot be deleted even if someone calls the API directly.
*   **Keep Upload API**: The `/api/upload` route will remain unchanged, preserving the ability to upload songs via API as requested.
