# Poco Server — Frontend

Modern, high-performance React 19 Single Page Application (SPA) and Capacitor mobile app for the Poco Server homelab management platform.

---

## 💻 Technology Stack

- **Framework**: React 19 with TypeScript ~6.0
- **Build Tool**: Vite 8 with `@vitejs/plugin-react`
- **UI Components & Styling**: Material UI (MUI) 9, Emotion, Lucide Icons, Custom Kuro Design Tokens
- **Typography**: Space Grotesk (display/headers), Plus Jakarta Sans (body UI), JetBrains Mono & Space Mono (data/code)
- **State Management**: TanStack Query 5 (server state polling & caching), React Context (auth, appearance, notifications, keep-alive state)
- **Routing**: React Router 7 with config-driven navigation and `KeepAlivePlaceholder` persistence
- **HTTP Client**: Axios with 401 interceptors, cookie credentials, and multi-server profile switching
- **Visualizations**: Recharts (time-series historical metrics), Leaflet (real-time interactive GPS tracking maps)
- **Terminal Emulator**: xterm.js with WebSocket binary PTY transport, fit addon, and responsive mobile accessory bar
- **Camera Streaming**: Binary WebSocket stream (`/ws/camera/stream`) and HTTP MJPEG stream with canvas orientation controls
- **Mobile Runtime**: Capacitor 7 with native screen orientation, status bar, navigation bar, and home screen widgets

---

## 📁 Project Structure

```
src/
├── api/             # Axios client, baseURL, authentication interceptors
├── components/      # Shared presentation UI components
│   ├── LazyPage.tsx          — Suspense wrapper
│   ├── PageLoader.tsx        — Centered loading spinner
│   ├── Sidebar.tsx           — Config-driven navigation drawer
│   ├── TopBar.tsx            — Header with breadcrumbs, theme switcher, notifications, user menu
│   ├── StatCard.tsx          — Icon + value stat cards
│   ├── ProgressStatCard.tsx  — StatCard with progress indicators
│   └── metrics/              — MetricCard (shared across monitoring and dashboard)
├── contexts/        # AuthContext, StatusContext, AppearanceContext, TerminalContext
├── design/          # Design tokens (colors, radius, shadows, typography, transitions)
├── features/        # 14 feature modules
│   ├── assistant/   — Kuro AI hub (ModelSettings, Memories, Connected Nodes, ClientData, ServerIntegrations, Windows Suite)
│   ├── camera/      — Video stream monitor (MJPEG/WS), snapshot capture, canvas flip & rotation
│   ├── dashboard/   — System overview cards, quick actions, widget grid
│   ├── monitoring/  — Dedicated high-performance views (CPU, Memory, Storage, Network, Battery, Thermal)
│   ├── docker/      — Container list, compose projects, live logs, resource stats, lifecycle actions
│   ├── files/       — File browser with keep-alive state, upload, download, move, copy, and Trash/Recycle Bin management
│   ├── terminal/    — Interactive xterm.js PTY shell (Local PTY + SSH) with keep-alive session
│   ├── history/     — Historical time-series metric charts (Recharts)
│   ├── users/       — User management with slide-over drawer, 2FA configuration, and active session revocation
│   ├── notifications/ — Real-time notification center with calendar filtering, unread counts, audio chimes
│   ├── recent-activity/ — Activity event log and change tracking feed
│   ├── audit/       — Security audit trail with category filtering and offset pagination
│   ├── settings/    — Cross-device user preference sync, widget visibility grid, layout density
│   └── animate/     — Interactive UI component animation showcase
├── hooks/           # Shared hooks (useStatus, useSnackbar, usePermissions, useNativeKeyboard, useThemeMode)
├── layouts/         # ProtectedLayout (auth guard), AppShell (sidebar + topbar + keep-alive viewport)
├── navigation/      # Config-driven nav routes, permission checks, breadcrumb mapping
├── pages/           # Page composition entry points
├── providers/       # Composed application providers (Query, Theme, Appearance, Snackbar, Auth)
├── theme/           # Light & dark MUI theme definitions, palette tokens, typography rules
├── types/           # TypeScript domain types (system status, metrics, docker, kuro, auth)
└── utils/           # Formatters (formatBytes, formatUptime), authStorage, date helpers
```

---

## 📱 Page & Route Catalog

| Route | Role | Implements |
|:---|:---|:---|
| `/login` | Public | Multi-server profile selector, latency monitor, secure JWT & 2FA login form |
| `/` | Any | Main dashboard overview with dynamic widget grid and system status cards |
| `/memory` | Any | High-performance RAM & Swap utilization breakdown |
| `/cpu` | Any | Multi-core CPU utilization, load averages, and core frequency gauges |
| `/storage` | Any | Filesystem disk utilization, partitions, and mount point statistics |
| `/network` | Any | Network throughput graphs, interface counters, speedtest, and Wi-Fi scanning |
| `/battery` | Any | Battery charge status, health telemetry, charging power draw |
| `/thermal` | Any | Thermal zone temperatures, sensor readouts, and throttling alerts |
| `/camera` | Admin | Real-time camera feed (MJPEG / WebSocket), device selector, snapshot gallery, canvas controls |
| `/docker` | Admin | Docker container list, Compose projects, resource charts, start/stop/restart |
| `/docker/:id` | Admin | Deep container inspection, environment variables, live log streaming |
| `/files` | Admin | Persistent file manager with keep-alive state, upload, download, and Trash/Recycle Bin |
| `/terminal` | Admin | Persistent interactive PTY terminal (Local / SSH) with keep-alive persistence |
| `/assistant/model` | Admin | Multi-provider model configuration (Ollama, OpenAI, Anthropic, Gemini, Needle, Papra), hyperparameter controls |
| `/assistant/memories` | Admin | Long-term associative memory inspector, importance scoring, manual additions |
| `/assistant/clients` | Admin | Connected companion nodes list, Windows Workstation Diagnostics Suite, Android Utilities |
| `/assistant/clients/data`| Admin | Aggregated mobile device telemetry (push notifications, call logs, SMS logs) |
| `/assistant/integration`| Admin | Companion service integrations (Baïkal CalDAV, Immich Photos, Papra Document Management) |
| `/users` | Admin | User accounts table, slide-over details drawer, 2FA management, session revocation |
| `/notifications` | Any | Notification center with unread badges, calendar date filter, severity badges |
| `/recent-activity` | Any | System event and change tracking feed |
| `/audit` | Admin | Security audit trail with category filtering, offset pagination, JSON details drawer |
| `/settings` | Any | Cross-device preferences synchronization, widget toggle grid, layout density |
| `/animate` | Any | Component micro-animation and transition showcase |

---

## ⚡ Development & Build

### Running Dev Server
```bash
npm install
npm run dev -- --host 0.0.0.0
```
Default URL: `http://localhost:5173` (proxies `/api` and `/ws` to backend daemon).

### Production Build
```bash
npm run build    # Outputs optimized production assets to dist/
npm run lint     # Runs ESLint checks
```

### Mobile APK Build (Capacitor)
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```
Output APK: `android/app/build/outputs/apk/debug/app-debug.apk`
