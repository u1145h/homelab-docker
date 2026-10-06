import type { StatusResponse } from '@/types/status'
import type { NetworkWidgetProps } from './types'

export function selectNetworkWidgetData(status: StatusResponse | null): NetworkWidgetProps | null {
  if (!status) return null
  return { data: status.network }
}
