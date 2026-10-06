# Terminal Feature Module

Interactive terminal emulator using xterm.js.

## Backend Capabilities

| Capability | Endpoint | Status |
|---|---|---|
| Create session | `POST /api/v1/terminal/session` | ✓ |
| List sessions | `GET /api/v1/terminal/session` | ✓ |
| Get session | `GET /api/v1/terminal/session/{id}` | ✓ |
| Close session | `DELETE /api/v1/terminal/session/{id}` | ✓ |
| Resize session | `POST /api/v1/terminal/session/{id}/resize` | ✓ |
| WebSocket I/O | `GET /ws/terminal/{id}` | ✓ |

## Components

- `Terminal` — xterm.js terminal with fit addon
- `TerminalToolbar` — connect/disconnect buttons + connection status
- `ConnectionStatus` — status chip (disconnected/connecting/connected/closed/error)

## Hooks

- `useTerminal()` — Session lifecycle, WebSocket management, input/output forwarding

## API

- `terminal.ts` — REST API client
- `websocket.ts` — WebSocket client class

## Architecture

```
Page → useTerminal (hook) → terminal.ts / websocket.ts → Backend REST + WS
                                                                ↓
Components (Terminal, TerminalToolbar, ConnectionStatus) ← presentation only
```

## Structure

```
features/terminal/
├── api/terminal.ts        — REST API client
├── api/websocket.ts       — WebSocket client class
├── hooks/useTerminal.ts   — Session lifecycle, I/O forwarding
├── components/Terminal.tsx — xterm.js terminal
├── components/TerminalToolbar.tsx
├── components/ConnectionStatus.tsx
├── pages/TerminalPage.tsx
├── types/index.ts
├── utils/terminal.ts
├── index.ts
└── README.md
```

## Backend Limitations

- No reconnect — session is lost on WebSocket disconnect
- In-memory sessions — sessions are ephemeral
- Shell defaults to /bin/bash (configurable)
