# Audit Logs Feature Module

Feature-based Audit Logs (`src/features/audit/`).

## Backend Capability Matrix

| Capability | Endpoint | Method | Auth | Status |
|---|---|---|---|---|
| List events | `/api/v1/audit` | GET | admin | ✓ |
| Event details | `/api/v1/audit/{id}` | GET | admin | ✓ |
| Filter by action | `?action=` | query | — | ✓ |
| Pagination (offset/limit) | `?offset=&limit=` | query | — | ✓ |
| Filter by user/actor | — | — | — | ✗ |
| Filter by resource/target | — | — | — | ✗ |
| Filter by status | — | — | — | ✗ |
| Filter by date range | — | — | — | ✗ |
| Search (full-text) | — | — | — | ✗ |
| Sort | — | — | — | ✗ |
| Export | — | — | — | ✗ |
| IP address | — | — | — | ✗ |
| User Agent | — | — | — | ✗ |
| Correlation ID | — | — | — | ✗ |
| Request ID | — | — | — | ✗ |

## Audit Entry Model

| Field | Type | Notes |
|---|---|---|
| `id` | string | 32-char hex |
| `action` | Action string | One of 19 action constants |
| `actor` | string | Username who performed the action |
| `target` | string (optional) | Object acted upon |
| `status` | `"success" \| "failure"` | Outcome |
| `message` | string (optional) | Error message on failure |
| `metadata` | object (optional) | Arbitrary key-value context |
| `timestamp` | RFC3339 | When event occurred |

## Structure

```
features/audit/
├── api/audit.ts              — REST API client (2 endpoints)
├── types/index.ts            — AuditEntry, AuditAction (20 action constants), AuditFilter
├── utils/audit.ts            — formatTimestamp, getActionColor/Label, getStatusColor, filterEntries
├── hooks/useAudit.ts         — listing, action filter, search, pagination (load more)
├── components/
│   ├── AuditTable            — 5-column table with action/status chips
│   ├── AuditDetailsDrawer    — right-hand drawer with metadata
│   ├── AuditSkeleton         — 8-row skeleton
│   ├── EmptyState            — no events / no results
│   └── ErrorState            — alert + retry
├── pages/AuditPage.tsx       — full page composition
├── index.ts                  — barrel exports
└── README.md
```

## Architecture

- **Components** are presentation-only. No API calls, no business logic.
- **Hooks** contain all state, API calls, pagination, and client-side search.
- **API** functions are thin wrappers over the Axios client.
- **Utils** are pure transformations (formatting, color mapping, client-side filtering).

## Backend Limitations

- No user/actor filter — only action filter supported
- No status severity (only success/failure)
- No IP address or user agent tracking
- No date range filtering
- No export capability
- Always sorted newest-first (hardcoded)
- Admin-only access (403 for non-admin users)

## States

| State | Component | Behavior |
|---|---|---|
| Loading (initial) | `AuditSkeleton` | 8-row skeleton table |
| Error | `ErrorState` | Alert + Retry button |
| Empty (no events) | `EmptyState(isSearch=false)` | HistoryToggleOff icon |
| Search/filter no results | `EmptyState(isSearch=true)` | SearchOff icon |
| Has more pages | "Load More" button | offset-based pagination |
