# Monitoring Feature Module

Unified tabbed monitoring page for real-time system metrics.

## Tabs

- **Overview** — Summary cards for CPU, Memory, Storage, Network with system health status
- **CPU** — Usage, model, core count, frequency, system load
- **Memory** — Used/free/total with usage bar
- **Storage** — Per-mount usage bars with device/filesystem info
- **Network** — Per-interface status with download/upload bytes and addresses

## Components

### Reusable
- `MetricCard` — Card with label, value, secondary text, optional icon, optional children
- `MetricGrid` — Responsive grid wrapper for MetricCards
- `ProgressMetric` — Label + value + colored progress bar
- `UsageBar` — Used/free/total display with visual bar
- `MonitorEmptyState` — Icon + message for empty states
- `MonitoringSkeleton` — Full-page loading skeleton

### Tab-specific
- `OverviewTab` — Summary cards + health status
- `CpuTab` — CPU details (model, cores, frequency, load, usage)
- `MemoryTab` — Memory used/free/total with bar
- `StorageTab` — Per-mount usage bars
- `NetworkTab` — Per-interface network status

## Hooks

- `useMonitoring` — Wraps `useStatus` + data transforms into monitoring-specific shape

## Architecture

```
Page (MonitoringPage) → useMonitoring (hook) → useStatus (shared hook) → Backend API
                                                                ↓
Tab Components (OverviewTab, CpuTab, etc.) ← presentation only
    ↓
Reusable Components (MetricCard, MetricGrid, UsageBar, etc.)
```

## Structure

```
features/monitoring/
├── components/     — 11 components (5 tab-specific + 6 reusable)
├── hooks/          — useMonitoring
├── pages/          — MonitoringPage
├── types/          — Monitoring types
├── utils/          — monitoring helpers
├── index.ts
└── README.md
```

## States

| State | Component | Behavior |
|---|---|---|
| Loading | `MonitoringSkeleton` | Full-page skeleton |
| Error | (handled by hook) | Error shown inline |
| Empty | `MonitorEmptyState` | Per-tab empty state |
| Loaded | Tab components | Full metric display |

## Known Limitations

- No per-core CPU data from backend — shows aggregate only
- Network rx/tx are cumulative bytes since boot, not transfer rates
- Uses shared `GET /api/v1/status` endpoint (no dedicated monitoring API)
