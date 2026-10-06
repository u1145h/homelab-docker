# ========================================================
# Stage 1: Build React 19 Frontend SPA
# ========================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ========================================================
# Stage 2: Build Go Backend Binary
# ========================================================
FROM golang:alpine AS backend-builder
WORKDIR /app/backend

ENV GOTOOLCHAIN=auto

# Install build dependencies for CGO/SQLite
RUN apk add --no-cache gcc musl-dev git

COPY backend/go.* ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /app/bin/poco-serverd ./cmd/poco-serverd

# ========================================================
# Stage 3: Minimal Production Appliance Runtime
# ========================================================
FROM alpine:3.21

# Install runtime utilities for interactive terminal & host tools
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    bash \
    curl \
    util-linux \
    shadow \
    iproute2 \
    procps

WORKDIR /app

# Copy compiled backend binary
COPY --from=backend-builder /app/bin/poco-serverd /app/poco-serverd

# Copy compiled React SPA into frontend dist directory
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Initialize persistence directory
RUN mkdir -p /app/data && chmod 700 /app/data

EXPOSE 9876

ENV DATA_DIR=/app/data \
    FILE_MANAGER_ROOT=/host_root \
    DOCKER_SOCKET_PATH=/var/run/docker.sock \
    TERMINAL_DEFAULT_SHELL=/bin/bash \
    HOST_PROC=/host/proc \
    HOST_SYS=/host/sys \
    FRONTEND_DIST_DIR=/app/frontend/dist

VOLUME ["/app/data"]

CMD ["/app/poco-serverd"]
