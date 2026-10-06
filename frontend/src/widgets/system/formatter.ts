import type { StatusResponse } from '@/types/status'
import type { SystemWidgetData, SystemWidgetProps } from './types'

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  return `${hours}h ${minutes}m`
}

export function selectSystemWidgetData(status: StatusResponse | null): SystemWidgetProps | null {
  if (!status) return null

  const running = status.docker?.containers?.filter((c) => c.state === 'running')?.length || 0

  const data: SystemWidgetData = {
    hostname: status.system.hostname,
    os: status.system.os,
    kernel: status.system.kernel,
    arch: status.system.arch,
    uptime: formatUptime(status.system.uptime),
    runningContainers: running,
    totalContainers: status.docker?.containers?.length || 0,
    goVersion: status.system.go,
  }

  return { data }
}
