import type { StatusResponse } from '@/types/status'
import type { DockerWidgetProps } from './types'

export function selectDockerWidgetData(status: StatusResponse | null): DockerWidgetProps | null {
  if (!status) return null
  return { data: status.docker }
}
