# User Management Feature Module

Feature-based User Management (`src/features/users/`).

## Backend Capability Matrix

| Capability | Endpoint | Method | Auth | Status |
|---|---|---|---|---|
| List users | `/api/v1/users` | GET | admin | ✓ |
| Get user details | `/api/v1/users/{id}` | GET | any auth | ✓ |
| Create user | `/api/v1/users` | POST | admin | ✓ |
| Update user | `/api/v1/users/{id}` | PUT | admin | ✓ |
| Delete user | `/api/v1/users/{id}` | DELETE | admin | ✓ |
| Reset password | `/api/v1/users/{id}/password` | POST | self/admin | ✓ |
| Enable/Disable account | — | — | — | ✗ |
| Assign permissions | — | — | — | ✗ |
| User groups | — | — | — | ✗ |
| Search | — | — | — | ✗ |
| Pagination | — | — | — | ✗ |
| Last login | — | — | — | ✗ |
| MFA status | — | — | — | ✗ |

## User Model

| Field | Type | Notes |
|---|---|---|
| `id` | string | 32-char hex |
| `username` | string | unique |
| `role` | `"admin" \| "user" \| "readonly"` | determines permissions |
| `created_at` | RFC3339 | audit timestamp |
| `updated_at` | RFC3339 | audit timestamp |

## Structure

```
features/users/
├── api/users.ts              — REST API client (6 endpoints)
├── types/index.ts            — UserResponse, Create/Update/Password requests, UserRole
├── utils/users.ts            — filterUsers, getRoleColor, computeSummary, formatTimestamp
├── hooks/
│   ├── useUsers.ts           — listing, search, filter, summary
│   └── useUserMutations.ts   — create/update/delete/reset password + Snackbar
├── components/
│   ├── UserSummaryCards       — total, admin, user, readonly counts
│   ├── UserTable             — table with role chips
│   ├── UserDetailsDrawer     — right-hand metadata drawer
│   ├── UserSkeleton          — loading skeleton (5 rows)
│   ├── EmptyState            — no users / no search results
│   ├── ErrorState            — alert + retry
│   ├── UserFormDialog        — create/edit user form
│   ├── PasswordResetDialog   — password change form
│   └── DeleteConfirmDialog   — delete confirmation
├── pages/UsersPage.tsx       — full page composition
├── index.ts                  — barrel exports
└── README.md
```

## Architecture

- **Components** are presentation-only. No API calls, no business logic.
- **Hooks** contain all state, API calls, and business logic.
- **API** functions are thin wrappers over the Axios client.
- **Utils** are pure transformations (filtering, formatting).

## Backend Limitations

- No last-login tracking
- No enable/disable per-user (only role-based access control)
- No search endpoint (client-side filter only)
- No pagination (all users returned at once)
- No granular permissions (only 3 roles)
- No user groups
- Role is not in JWT — each admin-gated endpoint looks up the role from the database

## States

| State | Component | Behavior |
|---|---|---|
| Loading (initial) | `UserSkeleton` | 5-row skeleton table |
| Error | `ErrorState` | Alert + Retry button |
| Empty (no users) | `EmptyState(isSearch=false)` | GroupOff icon |
| Search no results | `EmptyState(isSearch=true)` | SearchOff icon |
