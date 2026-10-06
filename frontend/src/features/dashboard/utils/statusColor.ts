import type { StatusColor } from "../types"

export function cpuStatusColor(usage: number): StatusColor {
  if (usage >= 90) return "error"
  if (usage >= 70) return "warning"
  return "success"
}

export function memoryStatusColor(usage: number): StatusColor {
  if (usage >= 90) return "error"
  if (usage >= 75) return "warning"
  return "success"
}

export function storageStatusColor(usage: number): StatusColor {
  if (usage >= 90) return "error"
  if (usage >= 75) return "warning"
  return "success"
}

export function temperatureStatusColor(temp: number): StatusColor {
  if (temp >= 80) return "error"
  if (temp >= 60) return "warning"
  return "success"
}

export function dockerStatusColor(running: number, total: number): StatusColor {
  if (total === 0) return "default"
  if (running === 0 && total > 0) return "error"
  if (running < total) return "warning"
  return "success"
}

export function networkStatusColor(up: boolean): StatusColor {
  return up ? "success" : "error"
}

export function tailscaleStatusColor(state: string): StatusColor {
  if (state === "Running") return "success"
  if (state === "NeedsLogin") return "warning"
  return "error"
}

export function batteryStatusColor(capacity: number, present: boolean): StatusColor {
  if (!present) return "default"
  if (capacity <= 20) return "error"
  if (capacity <= 50) return "warning"
  return "success"
}
