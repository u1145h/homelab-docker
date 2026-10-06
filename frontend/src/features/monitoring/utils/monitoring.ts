import { formatBytes, formatUptime } from "@/utils/format"
import type { StatusResponse } from "@/types/status"
import type {
  MonitoringData,
  OverviewData,
  CpuMetric,
  MemoryMetric,
  StorageMetric,
  NetworkMetric,
} from "../types"

function safeNum(v: number | undefined | null, fallback = 0): number {
  return typeof v === 'number' && !isNaN(v) ? v : fallback
}

function cpuColor(usage: number): "success" | "warning" | "error" {
  if (usage >= 90) return "error"
  if (usage >= 70) return "warning"
  return "success"
}

function memoryColor(usage: number): "success" | "warning" | "error" {
  if (usage >= 90) return "error"
  if (usage >= 75) return "warning"
  return "success"
}

function storageColor(usage: number): "success" | "warning" | "error" {
  if (usage >= 90) return "error"
  if (usage >= 75) return "warning"
  return "success"
}

function networkColor(up: boolean): "success" | "warning" | "error" {
  return up ? "success" : "error"
}

export function buildOverviewData(status: StatusResponse): OverviewData {
  const rootMount =
    status.storage.mounts.find((m) => m.mount === "/") ??
    status.storage.mounts[0]

  const anyUp = status.network.interfaces.some((iface) => iface.up)

  return {
    cpuUsage: safeNum(status.cpu.usage_percent),
    cpuValue: `${safeNum(status.cpu.usage_percent).toFixed(0)}%`,
    cpuSecondary: status.cpu.model || `${status.cpu.logical_cores} Cores`,
    cpuColor: cpuColor(safeNum(status.cpu.usage_percent)),
    memoryUsage: safeNum(status.memory.usage_percent),
    memoryValue: `${safeNum(status.memory.usage_percent).toFixed(0)}%`,
    memorySecondary: `${safeNum(status.memory.used / 1024 / 1024 / 1024).toFixed(1)} GB of ${safeNum(status.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB`,
    memoryColor: memoryColor(safeNum(status.memory.usage_percent)),
    storageUsage: safeNum(rootMount?.usage_percent),
    storageValue: rootMount ? `${safeNum(rootMount.usage_percent).toFixed(0)}%` : "--",
    storageSecondary: rootMount?.mount ?? "Unavailable",
    storageColor: storageColor(safeNum(rootMount?.usage_percent)),
    networkStatus: anyUp ? "Connected" : "Disconnected",
    networkSecondary: `${status.network.interfaces.length} interface${status.network.interfaces.length === 1 ? "" : "s"}`,
    networkColor: networkColor(anyUp),
  }
}

export function buildCpuMetrics(status: StatusResponse): CpuMetric[] {
  return [
    {
      label: "Usage",
      value: `${safeNum(status.cpu.usage_percent).toFixed(1)}%`,
      secondary: `of ${status.cpu.logical_cores} logical cores`,
      usage: safeNum(status.cpu.usage_percent),
    },
    {
      label: "Model",
      value: status.cpu.model || "Unknown",
      secondary: `${status.cpu.physical_cores} physical / ${status.cpu.logical_cores} logical`,
      usage: 0,
    },
    {
      label: "Frequency",
      value: status.cpu.frequency_mhz ? `${status.cpu.frequency_mhz} MHz` : "Unknown",
      secondary: status.cpu.model ? "Current clock" : "Not available",
      usage: 0,
    },
    {
      label: "System Load",
      value: `${safeNum(status.cpu.usage_percent).toFixed(0)}%`,
      secondary: `Uptime: ${formatUptime(status.system.uptime)}`,
      usage: safeNum(status.cpu.usage_percent),
    },
  ]
}

export function buildMemoryMetric(status: StatusResponse): MemoryMetric {
  return {
    label: "Memory",
    usedFormatted: formatBytes(status.memory.used),
    freeFormatted: formatBytes(status.memory.available),
    totalFormatted: formatBytes(status.memory.total),
    usagePercent: status.memory.usage_percent,
  }
}

export function buildStorageMetrics(status: StatusResponse): StorageMetric[] {
  return status.storage.mounts.map((mount) => ({
    mount,
    usedFormatted: formatBytes(mount.used),
    freeFormatted: formatBytes(mount.available),
    totalFormatted: formatBytes(mount.total),
    usagePercent: mount.usage_percent,
  }))
}

export function buildNetworkMetrics(status: StatusResponse): NetworkMetric[] {
  return status.network.interfaces.map((iface) => ({
    iface,
    rxFormatted: formatBytes(iface.rx_bytes),
    txFormatted: formatBytes(iface.tx_bytes),
    isUp: iface.up,
  }))
}

export function buildMonitoringData(status: StatusResponse): MonitoringData {
  return {
    status,
    overview: buildOverviewData(status),
    cpu: buildCpuMetrics(status),
    memory: buildMemoryMetric(status),
    storage: buildStorageMetrics(status),
    network: buildNetworkMetrics(status),
    lastUpdated: new Date(),
  }
}

export { formatBytes, formatUptime, cpuColor, memoryColor, storageColor, networkColor }
