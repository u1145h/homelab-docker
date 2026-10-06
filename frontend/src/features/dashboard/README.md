# Dashboard Feature Module

System overview dashboard with status cards, quick actions, and system summary.

## Components

- `DashboardHeader` — Title, online status, last updated, refresh button
- `StatusCard` — Reusable card with icon, label, value, color, optional progress bar
- `StatusCardGrid` — Grid of 8 status cards (CPU, Memory, Storage, Battery, Temperature, Docker, Network, Tailscale)
- `QuickActions` — Navigation shortcuts (Monitoring, Docker, Files, Terminal)
- `RecentActivity` — Activity panel (currently shows empty state)
- `SystemSummary` — Hostname, uptime, containers, platform info
- `DashboardSkeleton` — Loading skeleton matching the dashboard layout

## Hooks

- `useDashboard` — Fetches status data and transforms it into dashboard format

## Architecture

```
Page (DashboardPage) → useDashboard (hook) → useStatus (shared hook) → Backend API
                                                                ↓
Components (StatusCard, StatusCardGrid, etc.) ← presentation only
```

## Structure

```
features/dashboard/
├── components/   — 7 components (DashboardHeader, StatusCard, StatusCardGrid, QuickActions, RecentActivity, SystemSummary, DashboardSkeleton)
├── hooks/        — useDashboard
├── pages/        — DashboardPage
├── types/        — Dashboard types
├── utils/        — dashboard helpers, statusColor
├── index.ts
└── README.md
```

## States

| State | Component | Behavior |
|---|---|---|
| Loading | `DashboardSkeleton` | Grid of skeleton cards |
| Error | (handled by hook) | Error displayed inline |
| Loaded | All components | Full dashboard rendered |

## Backend Data Source

Dashboard consumes the shared `GET /api/v1/status` endpoint via `useStatus` hook. No dedicated dashboard API.
