# Homelab Docker Appliance

[![Docker CI](https://github.com/u1145h/homelab-docker/actions/workflows/docker-build.yml/badge.svg)](https://github.com/u1145h/homelab-docker/actions/workflows/docker-build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/Go-1.25%2B-00ADD8?logo=go)](https://go.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)

An all-in-one homelab monitoring, orchestration, and hardware telemetry server packaged into a high-performance **Unified Single Docker Container** (~40MB RAM) on port `9876`.

Bundles both the modern **React 19 SPA Web Dashboard** and the **Go API/WebSocket Server** into a minimal Alpine appliance with persistent SQLite metrics, interactive containerized PTY terminals, host Docker management, and cross-platform host OS telemetry.

---

## 🏗️ Architecture

```
                       Browser / Mobile App
                                │
                                ▼
                 http://<host-ip-or-localhost>:9876
                                │
    ┌───────────────────────────┴──────────────────────────────┐
    │             HOMELAB DOCKER CONTAINER                    │
    │                                                          │
    │   ┌──────────────────────────────────────────────────┐   │
    │   │         Built-in Chi v5 Web & API Server         │   │
    │   │                   (Port 9876)                    │   │
    │   └────────┬───────────────────────┬─────────────────┘   │
    │            │                       │                     │
    │   ┌────────▼─────────┐    ┌────────▼─────────────────┐   │
    │   │ React 19 Web SPA │    │ REST APIs & WebSockets   │   │
    │   │ (/frontend/dist) │    │  • /api/v1/* (Auth, CRUD)│   │
    │   │                  │    │  • /ws/terminal (PTY)    │   │
    │   │                  │    │  • /ws/camera (Streams)  │   │
    │   │                  │    │  • /api/v1/kuro/ws/node  │   │
    │   └──────────────────┘    └────────┬─────────────────┘   │
    │                                    │                     │
    │   ┌────────────────────────────────▼─────────────────┐   │
    │   │            Internal Services Engine              │   │
    │   │  • SQLite Storage (history.db, kuro.db)          │   │
    │   │  • Docker Engine Client (/var/run/docker.sock)   │   │
    │   │  • Telemetry Collector (Dynamic Proc/Sys Paths)  │   │
    │   │  • Terminal PTY Manager & File Manager           │   │
    │   └────────────────────────────────┬─────────────────┘   │
    └────────────────────────────────────┼─────────────────────┘
                                         │
                    Host System Volumes & Sockets
             ┌───────────────────────────┼───────────────────────────┐
             ▼                           ▼                           ▼
     [ /app/data Volume ]    [ /var/run/docker.sock ]    [ Host Telemetry Mounts ]
     (SQLite DBs & JSONs)    (Host Docker Management)   (Linux: /proc, /sys)
                                                        (Win/Mac: Native Agent WS)
```

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/u1145h/homelab-docker.git
cd homelab-docker
```

### 2. Configure Environment Variables
Create your local `.env` from the provided template:
```bash
cp .env.example .env
```

Generate your secrets:
- **JWT Secret**:
  ```bash
  # Linux / macOS:
  openssl rand -base64 64

  # Windows PowerShell:
  [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
  ```
- **Admin Password Hash (bcrypt)**:
  ```bash
  htpasswd -bnBC 10 "" "your-password" | tr -d ':\n'
  ```

Update `.env` with these values.

### 3. Start the Container
```bash
docker compose up -d --build
```

### 4. Access the Dashboard
Open your browser at:
```
http://localhost:9876
```

---

## 💻 Cross-Platform Host Hardware Telemetry

### Linux Hosts (Ubuntu, Debian, Arch, Raspberry Pi OS, postmarketOS)
The container automatically monitors physical host hardware via Docker volume mounts (`/proc:/host/proc:ro`, `/sys:/host/sys:ro`, `pid: host`):
- Physical CPU usage, frequency, and cores
- Real RAM and swap allocation
- Host disk mounts and block device stats
- Thermal zones and battery status
- Real host process tree

### Windows Hosts (Docker Desktop WSL2)
Docker Desktop on Windows runs Linux containers inside a virtual machine. To stream **native Windows host metrics** (physical NTFS drives C:, D:, physical laptop battery, Task Manager processes):
```powershell
.\scripts\run-agent.ps1
```

### macOS Hosts (Apple Silicon / Intel)
To stream **native macOS host metrics** (Apple Silicon SoC thermals, macOS battery health, APFS disk mounts):
```bash
./scripts/run-agent.sh
```

---

## ⚙️ Configuration Reference

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD_HASH` | *Required* | Bcrypt hash of admin password |
| `JWT_SECRET` | *Required* | Secret key for signing session tokens |
| `DATA_DIR` | `/app/data` | Path to persistent database directory |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` | Path to host Docker daemon socket |
| `TERMINAL_DEFAULT_SHELL` | `/bin/bash` | Default shell for terminal sessions |
| `HOST_PROC` | `/host/proc` | Mounted host procfs directory |
| `HOST_SYS` | `/host/sys` | Mounted host sysfs directory |
| `FILE_MANAGER_ROOT` | `/host_root` | Root path for browser file manager |

---

## 📂 Data Persistence

All persistent state (SQLite history metrics database `history.db`, Kuro database `kuro.db`, users, notifications, and security audit logs) is stored in the Docker volume:
```
homelab-data -> /app/data
```
Data persists across container restarts, updates, and rebuilds.

---

## 🛠️ Management Commands

```bash
# View live container logs
docker compose logs -f

# Restart the service
docker compose restart

# Stop the container
docker compose down

# Update and rebuild after code changes
docker compose up -d --build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
