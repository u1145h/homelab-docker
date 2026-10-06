#!/usr/bin/env bash
# Host Telemetry Agent Launcher for macOS / Linux
set -e

SERVER="${1:-ws://localhost:9876/api/v1/kuro/ws/node}"
SECRET="${2:-}"

echo "=========================================="
echo "  Homelab Host Telemetry Agent            "
echo "=========================================="
echo "Connecting to containerized Homelab server at: $SERVER"

export KURO_NODE_SERVER="$SERVER"
if [ -n "$SECRET" ]; then
    export KURO_NODE_SECRET="$SECRET"
fi

go run ../backend/cmd/poco-console
