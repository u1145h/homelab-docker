import type { StatusResponse } from '@/types/status'
import type { ThermalWidgetProps } from './types'

export function selectThermalWidgetData(status: StatusResponse | null): ThermalWidgetProps | null {
  if (!status) return null
  return { data: status.thermal }
}
