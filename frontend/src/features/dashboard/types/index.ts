import type { StatusResponse } from "@/types/status"

export interface DashboardStats {
  cpuValue: string
  cpuSubtitle: string
  cpuProgress: number

  memoryValue: string
  memorySubtitle: string
  memoryProgress: number

  storageValue: string
  storageSubtitle: string
  storageProgress: number

  batteryValue: string
  batterySubtitle: string
  batteryProgress: number

  temperatureValue: string
  temperatureSubtitle: string

  dockerValue: string
  dockerSubtitle: string

  networkValue: string
  networkSubtitle: string

  tailscaleValue: string
  tailscaleSubtitle: string
}

export interface SystemSummaryData {
  hostname: string
  os: string
  kernel: string
  arch: string
  uptime: string
  runningContainers: number
  totalContainers: number
  servicesOnline: number
}

export type StatusColor = "success" | "warning" | "error" | "default"

export interface StatusCardConfig {
  label: string
  value: string
  secondary: string
  icon: React.ReactNode
  color: StatusColor
  progress?: number
  href?: string
}

export interface QuickAction {
  label: string
  path: string
  icon: React.ReactNode
  description: string
}

export interface DashboardData {
  stats: DashboardStats
  system: SystemSummaryData
  status: StatusResponse
  lastUpdated: Date
}
