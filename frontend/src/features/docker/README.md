# Docker Feature Module

Container management for Docker.

## Components

- `DockerSummary` — 4 metric cards: total, running, stopped, paused
- `DockerToolbar` — Search text field
- `ContainerCard` — Clickable card with name, image, status, actions
- `ContainerActions` — Start/Stop/Restart buttons (context-aware)
- `ContainerDetailsDrawer` — Right drawer with full container info
- `StatusBadge` — Colored chip for container state
- `ConfirmDialog` — Confirmation before stop/restart
- `DockerSkeleton` — Loading skeleton

## Hooks

- `useDocker()` — Container list, filtering, detail loading, lifecycle actions with snackbar

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/docker/containers` | List all containers |
| GET | `/api/v1/docker/containers/{id}` | Get container details (inspect) |
| POST | `/api/v1/docker/containers/{id}/start` | Start container |
| POST | `/api/v1/docker/containers/{id}/stop` | Stop container |
| POST | `/api/v1/docker/containers/{id}/restart` | Restart container |

## Architecture

```
Page (DockerPage) → useDocker (hook) → api/docker.ts → Backend API
                                                    ↓
Components (ContainerCard, ContainerDetailsDrawer, etc.) ← presentation only
```

## Structure

```
features/docker/
├── api/docker.ts            — REST API client (5 endpoints)
├── hooks/useDocker.ts       — Container list, filter, detail, actions
├── components/              — 8 components (DockerSummary, DockerToolbar, ContainerCard, ContainerActions, ContainerDetailsDrawer, StatusBadge, ConfirmDialog, DockerSkeleton)
├── pages/DockerPage.tsx
├── types/index.ts
├── utils/docker.ts
├── index.ts
└── README.md
```

## States

| State | Component | Behavior |
|---|---|---|
| Loading | `DockerSkeleton` | Card skeleton grid |
| Empty | (inline) | "No containers" message |
| Error | (inline) | Error shown with retry |
| Loaded | All components | Container cards + summary + toolbar |

## Backend Limitations

- No container logs endpoint
- No container stats endpoint
- No environment variables in inspect response
- No Docker Compose project management exposed in frontend

## Authentication

Read operations (list, inspect): any authenticated user.
Write operations (start, stop, restart): admin or user role (readonly denied).
