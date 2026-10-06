import type { StatusResponse, StorageMount, NetworkInterface } from "@/types/status"

export type MonitoringTab = "overview" | "cpu" | "memory" | "storage" | "network"

export interface CpuMetric {
  label: string
  value: string
  secondary: string
  usage: number
}

export interface MemoryMetric {
  label: string
  usedFormatted: string
  freeFormatted: string
  totalFormatted: string
  usagePercent: number
}

export interface StorageMetric {
  mount: StorageMount
  usedFormatted: string
  freeFormatted: string
  totalFormatted: string
  usagePercent: number
}

export interface NetworkMetric {
  iface: NetworkInterface
  rxFormatted: string
  txFormatted: string
  isUp: boolean
}

export interface OverviewData {
  cpuUsage: number
  cpuValue: string
  cpuSecondary: string
  cpuColor: "success" | "warning" | "error"

  memoryUsage: number
  memoryValue: string
  memorySecondary: string
  memoryColor: "success" | "warning" | "error"

  storageUsage: number
  storageValue: string
  storageSecondary: string
  storageColor: "success" | "warning" | "error"

  networkStatus: string
  networkSecondary: string
  networkColor: "success" | "warning" | "error"
}

export interface MonitoringData {
  status: StatusResponse
  overview: OverviewData
  cpu: CpuMetric[]
  memory: MemoryMetric
  storage: StorageMetric[]
  network: NetworkMetric[]
  lastUpdated: Date
}
