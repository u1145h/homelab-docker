import type { StatusResponse } from '@/types/status'
import type { StorageWidgetProps } from './types'

export function selectStorageWidgetData(status: StatusResponse | null): StorageWidgetProps | null {
  if (!status) return null
  return { data: status.storage }
}
