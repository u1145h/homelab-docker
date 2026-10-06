# Settings Feature Module

Feature-based Settings (`src/features/settings/`).

## Backend Capability Matrix

All settings capabilities are **not supported** — the backend has no Settings REST API. All configuration is loaded from environment variables at startup (`internal/config/config.go`).

| Capability | Status |
|---|---|
| Get application settings (GET /api/v1/settings) | ✗ |
| Update application settings (PUT /api/v1/settings) | ✗ |
| Reset defaults (POST /api/v1/settings/reset) | ✗ |
| Validation | ✗ |
| Runtime categories | ✗ |

## Structure

```
features/settings/
├── api/settings.ts          — API client (handles 404 gracefully)
├── types/index.ts           — Settings, DockerSettings, TerminalSettings, HistorySettings
├── utils/settings.ts        — Category metadata, formatDuration
├── hooks/useSettings.ts     — Load/save/reset lifecycle
├── components/
│   ├── SettingsSkeleton     — 3-card skeleton
│   ├── EmptyState           — Not available state with category docs
│   └── ErrorState           — Alert + retry
├── pages/SettingsPage.tsx   — Full page composition
├── index.ts                 — Barrel exports
└── README.md
```

## Architecture

- **Components** are presentation-only. No API calls, no business logic.
- **Hooks** contain all state, API calls, save/load lifecycle.
- **API** functions are thin wrappers over the Axios client. Gracefully handle 404 (returns null).
- **Utils** contain category metadata and formatting functions.

## States

| State | Component | Behavior |
|---|---|---|
| Loading (initial) | `SettingsSkeleton` | 3-card skeleton |
| Error | `ErrorState` | Alert + Retry button |
| Backend not available | `EmptyState` | Icon + explanation + category cards |
| Backend available | (future) | Rendered settings form sections |

## Backend Limitations

- No settings REST API exists — all configuration is static env vars at startup
- No runtime persistence for settings
- No validation API
- No reset or restart-required mechanisms
- Adding a Settings API requires backend changes (handler, router, service, persistence)
