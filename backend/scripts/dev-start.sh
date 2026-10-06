#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
PROJECT_ROOT="$(dirname "$ROOT")"

ENV_FILE="$PROJECT_ROOT/.env"

BINARY="$ROOT/poco-serverd"
PIDFILE="$ROOT/.poco-serverd.pid"

DAEMON_MODE=0

if [ "${1:-}" = "--daemon" ]; then
    DAEMON_MODE=1
fi

cleanup_pidfile() {
    rm -f "$PIDFILE"
}

stop_existing() {
    [ -f "$PIDFILE" ] || return 0

    PID="$(cat "$PIDFILE" 2>/dev/null || true)"

    if [ -n "$PID" ] && [ -d "/proc/$PID" ]; then
        EXE="$(readlink -f "/proc/$PID/exe" 2>/dev/null || true)"

        if [ "$EXE" = "$BINARY" ]; then
            echo "Stopping existing server (PID $PID)..."

            kill "$PID" 2>/dev/null || true

            i=0
            while [ -d "/proc/$PID" ] && [ $i -lt 50 ]; do
                sleep 0.1
                i=$((i + 1))
            done

            if [ -d "/proc/$PID" ]; then
                echo "Force killing server..."
                kill -9 "$PID" 2>/dev/null || true

                while [ -d "/proc/$PID" ]; do
                    sleep 0.1
                done
            fi
        fi
    fi

    cleanup_pidfile
}

load_env() {
    if [ ! -f "$ENV_FILE" ]; then
        echo
        echo "ERROR: .env file not found."
        echo
        echo "Expected:"
        echo "  $ENV_FILE"
        echo
        exit 1
    fi

    echo "Loading environment..."

    set -a
    . "$ENV_FILE"
    set +a
}

cd "$ROOT"

stop_existing
load_env

echo "Formatting..."
go fmt ./...

echo "Running vet..."
go vet ./...

echo "Building..."
go build -o "$BINARY" ./cmd/poco-serverd

echo "Starting..."

"$BINARY" &
PID=$!

echo "$PID" > "$PIDFILE"

trap cleanup_pidfile EXIT

echo
echo "----------------------------------------"
echo "PID    : $PID"
echo "Binary : $BINARY"
echo "Env    : $ENV_FILE"
echo "----------------------------------------"
echo

if [ "$DAEMON_MODE" -eq 1 ]; then
    echo "Daemon mode enabled."
    exit 0
fi

wait "$PID"
