#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
BINARY="$ROOT/poco-serverd"
PIDFILE="$ROOT/.poco-serverd.pid"

stop_pid() {
    PID="$1"

    [ -n "$PID" ] || return 1
    [ -d "/proc/$PID" ] || return 1

    EXE="$(readlink -f "/proc/$PID/exe" 2>/dev/null || true)"

    [ "$EXE" = "$BINARY" ] || return 1

    echo "Stopping server (PID $PID)..."

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

    return 0
}

# First try PID file
if [ -f "$PIDFILE" ]; then
    PID="$(cat "$PIDFILE" 2>/dev/null || true)"

    if stop_pid "$PID"; then
        rm -f "$PIDFILE"
        echo "Server stopped."
        exit 0
    fi

    rm -f "$PIDFILE"
fi

# Fallback: discover running binary
FOUND=0

for PID in $(pgrep -x poco-serverd 2>/dev/null || true); do
    if stop_pid "$PID"; then
        FOUND=1
    fi
done

rm -f "$PIDFILE"

if [ "$FOUND" -eq 1 ]; then
    echo "Server stopped."
else
    echo "Server is not running."
fi
