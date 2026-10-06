import type { StatusResponse } from '@/types/status'
import type { BatteryWidgetProps } from './types'

export function selectBatteryWidgetData(status: StatusResponse | null): BatteryWidgetProps | null {
  if (!status) return null
  return { data: status.battery }
}
