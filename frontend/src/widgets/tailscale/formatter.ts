import type { StatusResponse } from '@/types/status'
import type { TailscaleWidgetProps } from './types'

export function selectTailscaleWidgetData(status: StatusResponse | null): TailscaleWidgetProps | null {
  if (!status) return null
  return { data: status.tailscale }
}
