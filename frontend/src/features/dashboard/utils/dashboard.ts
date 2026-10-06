import type { StatusResponse } from "@/types/status"
import type { DashboardStats, SystemSummaryData } from "../types"

function safeNum(v: number | undefined | null, fallback = 0): number {
  return typeof v === 'number' && !isNaN(v) ? v : fallback
}

export function buildDashboardStats(status: StatusResponse): DashboardStats {
  const rootMount =
    status.storage.mounts.find((m) => m.mount === "/") ??
    status.storage.mounts[0]

  const hottest =
    status.thermal.zones.length > 0
      ? status.thermal.zones.reduce((max, zone) =>
          zone.temperature_c > max.temperature_c ? zone : max,
        )
      : null

  const runningContainers = status.docker.containers.filter(
    (container) => container.state === "running",
  ).length

  const primaryInterface =
    status.network.interfaces.find(
      (iface) => iface.name === "wlan0" || iface.name === "tailscale0",
    ) ?? status.network.interfaces[0]

  return {
    cpuValue: `${safeNum(status.cpu.usage_percent).toFixed(0)}%`,
    cpuSubtitle: status.cpu.model || `${status.cpu.logical_cores} Cores`,
    cpuProgress: safeNum(status.cpu.usage_percent),
    memoryValue: `${safeNum(status.memory.usage_percent).toFixed(0)}%`,
    memorySubtitle: `${safeNum(status.memory.used / 1024 / 1024 / 1024).toFixed(1)} GB Used`,
    memoryProgress: safeNum(status.memory.usage_percent),
    storageValue: rootMount ? `${safeNum(rootMount.usage_percent).toFixed(0)}%` : "--",
    storageSubtitle: rootMount?.mount ?? "Unavailable",
    storageProgress: safeNum(rootMount?.usage_percent),
    batteryValue: status.battery.present ? `${status.battery.capacity}%` : "N/A",
    batterySubtitle: status.battery.status,
    batteryProgress: status.battery.present ? safeNum(status.battery.capacity) : 0,
    temperatureValue: hottest ? `${safeNum(hottest.temperature_c).toFixed(1)}°C` : "--",
    temperatureSubtitle: hottest?.name ?? "Unavailable",
    dockerValue: `${runningContainers}`,
    dockerSubtitle: "Running",
    networkValue: primaryInterface?.name ?? "--",
    networkSubtitle: primaryInterface?.up ? "Connected" : "Disconnected",
    tailscaleValue: status.tailscale.backendState,
    tailscaleSubtitle: status.tailscale.self.ip,
  }
}

export function buildSystemSummary(status: StatusResponse): SystemSummaryData {
  const runningContainers = status.docker.containers.filter(
    (c) => c.state === "running",
  ).length

  const uptimeTotal = status.system.uptime
  const days = Math.floor(uptimeTotal / 86400)
  const hours = Math.floor((uptimeTotal % 86400) / 3600)
  const minutes = Math.floor((uptimeTotal % 3600) / 60)
  const uptimeStr = days > 0
    ? `${days}d ${hours}h ${minutes}m`
    : `${hours}h ${minutes}m`

  const onlineInterfaces = status.network.interfaces.filter(
    (iface) => iface.up,
  ).length

  return {
    hostname: status.system.hostname,
    os: status.system.os,
    kernel: status.system.kernel,
    arch: status.system.arch,
    uptime: uptimeStr,
    runningContainers,
    totalContainers: status.docker.containers.length,
    servicesOnline: onlineInterfaces,
  }
}


