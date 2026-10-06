import { SystemWidget } from './Component'
import type { SystemWidgetProps } from './types'

const mockData: SystemWidgetProps = {
  data: {
    hostname: 'kurobox',
    os: 'Ubuntu 24.04',
    kernel: '6.8.0-45-generic',
    arch: 'x86_64',
    uptime: '14d 6h 32m',
    runningContainers: 3,
    totalContainers: 5,
    goVersion: 'go1.22.5',
  },
}

export function SystemPreview() {
  return <SystemWidget {...mockData} />
}
