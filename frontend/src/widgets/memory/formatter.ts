import type { StatusResponse } from '@/types/status'
import type { MemoryWidgetProps } from './types'

export function selectMemoryWidgetData(status: StatusResponse | null): MemoryWidgetProps | null {
  if (!status) return null
  return { data: status.memory }
}
