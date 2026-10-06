#!/usr/bin/env bash
# Host Telemetry Agent for macOS / Linux
# Automatically samples physical hardware metrics and feeds containerized Homelab
set -e

SERVER="${1:-http://localhost:9876}"
INTERVAL="${2:-5}"

echo "=========================================="
echo "  Homelab Host Telemetry Agent (POSIX)    "
echo "=========================================="
echo "Target Server: $SERVER"
echo "Interval: ${INTERVAL}s"

ENDPOINT="${SERVER%/}/api/v1/host/telemetry"

while true; do
  OS_NAME="$(uname -s)"
  HOSTNAME="$(hostname)"
  
  if [ "$OS_NAME" = "Darwin" ]; then
    # macOS
    CPU_MODEL="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple Silicon / Intel")"
    CORES="$(sysctl -n hw.ncpu 2>/dev/null || echo 4)"
    MEM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
    
    # Battery
    BAT_PCT="$(pmset -g batt | grep -Eo '[0-9]+%' | tr -d '%' | head -1 || echo 100)"
    BAT_STATE="$(pmset -g batt | grep -q 'AC Power' && echo "AC" || echo "Battery")"
    
    # Simple JSON payload for macOS
    JSON_PAYLOAD=$(cat <<EOF
{
  "system": {
    "os": "macOS $(sw_vers -productVersion 2>/dev/null || echo "")",
    "hostname": "$HOSTNAME"
  },
  "cpu": {
    "model": "$CPU_MODEL",
    "logical_cores": $CORES,
    "physical_cores": $CORES
  },
  "memory": {
    "total": $MEM_BYTES
  },
  "battery": {
    "present": true,
    "capacity": ${BAT_PCT:-100},
    "status": "Discharging",
    "power_source": "$BAT_STATE"
  }
}
EOF
)
  else
    # Linux
    JSON_PAYLOAD=$(cat <<EOF
{
  "system": {
    "os": "$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"' || uname -s)",
    "hostname": "$HOSTNAME"
  }
}
EOF
)
  fi

  curl -s -X POST -H "Content-Type: application/json" -H "X-Host-Agent: posix-agent" -d "$JSON_PAYLOAD" "$ENDPOINT" > /dev/null 2>&1 || true
  sleep "$INTERVAL"
done
