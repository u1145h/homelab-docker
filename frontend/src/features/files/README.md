# File Manager Feature Module

Feature-based File Manager (`src/features/files/`).

## Backend Capability Matrix

| Capability | Endpoint | Method | Status |
|---|---|---|---|
| List directory | `/api/v1/files?path=` | GET | ✓ |
| Create directory | `/api/v1/mkdir` | POST | ✓ |
| Delete file/dir | `/api/v1/file` | DELETE | ✓ |
| Rename file/dir | `/api/v1/rename` | POST | ✓ |
| Move file/dir | `/api/v1/move` | POST | ✓ |
| Copy file/dir | `/api/v1/copy` | POST | ✓ |
| Download file | `/api/v1/download?path=` | GET | ✓ |
| Read file inline | `/api/v1/file?path=` | GET | ✓ |
| Write text file | `/api/v1/file` | PUT | ✓ |
| Upload file | `/api/v1/upload` | POST | ✓ |
| Get stat | `/api/v1/stat?path=` | GET | ✓ |
| **Search** | — | — | ✗ |

## Structure

```
features/files/
├── api/files.ts          — REST API client (all 11 endpoints)
├── types/index.ts        — FileItem, DirectoryListing, StatInfo, enums
├── utils/files.ts        — formatFileSize, sortItems, filterItems, pathParts
├── hooks/
│   ├── useFiles.ts       — directory browsing, navigation, search, sorting
│   └── useFileOperations.ts — mutations with Snackbar feedback
├── components/
│   ├── FileBreadcrumbs   — clickable path segments
│   ├── FileToolbar       — Up, Refresh, New Folder, Rename, Delete, Copy, Move, Download
│   ├── FileListView      — table view with sortable columns
│   ├── FileGridView      — card grid view
│   ├── FileListSkeleton  — loading skeleton
│   ├── EmptyState        — empty folder / no search results
│   ├── ErrorState        — error alert with retry
│   ├── DetailsDrawer     — right-side metadata drawer (stat endpoint)
│   ├── ContextMenu       — right-click menu (supported actions only)
│   ├── NewFolderDialog   — create folder dialog
│   ├── RenameDialog      — rename dialog
│   └── DeleteDialog      — confirmation dialog
├── pages/FilesPage.tsx   — full page composition
├── index.ts              — barrel exports
└── README.md
```

## Architecture

- **Components** are presentation-only. No API calls, no business logic.
- **Hooks** contain all state, API calls, and business logic.
- **API** functions are thin wrappers over the Axios client.
- **Utils** are pure transformations (formatting, sorting, filtering).

## Unsupported Backend Capabilities

- Search (client-side filter only)
- File versioning/history
- Symlink management
- chmod/chown
- Archive (zip/tar)
- Batch operations

## States

| State | Component | Behavior |
|---|---|---|
| Loading (initial) | `FileListSkeleton` | 8-row skeleton table |
| Loading (navigate) | Stale data remains visible | No flash |
| Error | `ErrorState` | Alert + Retry button |
| Empty folder | `EmptyState` | FolderOff icon + message |
| Search no results | `EmptyState(isSearch=true)` | SearchOff icon + message |
| Selection | FileListView row highlight | Checkbox + highlight |
