# ChexClear

## Current State
Fully client-side React app. All data (clients, letters, notes) is stored via `window.storage` (Caffeine's key-value storage). If `window.storage` is unavailable, saves fail silently with a toast error. The backend canister (`main.mo`) is empty. `backend.d.ts` has no exported functions.

## Requested Changes (Diff)

### Add
- Motoko backend with stable variables storing clients, letters, and notes as individual records keyed by unique ID
- Backend CRUD functions: createClient, getClients, updateClient, deleteClient, createLetter, getLettersByClient, updateLetter, deleteLetter, updateNotes, getNotesByClient
- Frontend wires all data operations to backend actor calls instead of window.storage
- One-time toast notice if window.storage is unavailable (limited storage fallback notice)

### Modify
- `saveClients` / `loadClients` / `initStorage` replaced by backend actor calls
- On app load, fetch all clients from backend; letters and notes fetched per-client on detail view
- All create/update/delete operations call the corresponding backend function
- Settings (API key, model) remain in window.storage or localStorage as user preferences (not critical data)

### Remove
- `storageOk` module-level flag
- `window.storage` dependency for client data (kept only for non-critical settings)

## Implementation Plan
1. Generate Motoko with stable HashMap/TrieMap records for Client, Letter, Note
2. Expose query/update functions for all CRUD operations
3. Update App.tsx: replace storage helpers with actor calls
4. On app init: call `getClients()` from backend; show spinner while loading
5. On create/update/delete: call corresponding backend mutation, update local state on success
6. Letters: fetched via `getLettersByClient(clientId)` when opening client detail; saved/updated via backend
7. Notes: fetched and updated via backend per client
8. Settings (apiKey, model): keep using window.storage/localStorage, not critical
9. Show one-time banner/toast if window.storage is unavailable (for settings only)
