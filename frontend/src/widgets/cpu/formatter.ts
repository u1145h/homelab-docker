import type { StatusResponse } from '@/types/status'
import type { CPUWidgetProps } from './types'

export function selectCPUWidgetData(status: StatusResponse | null): CPUWidgetProps | null {
  if (!status) return null
  return { data: status.cpu }
}
