import { TailscaleWidget } from './Component'
import type { TailscaleWidgetProps } from './types'

const mockData: TailscaleWidgetProps = {
  data: {
    version: '1.60.0',
    backendState: 'Running',
    self: { hostname: 'kurobox', ip: '100.100.100.1', online: true },
    peers: [
      { hostname: 'laptop', ip: '100.100.100.2', online: true },
      { hostname: 'phone', ip: '100.100.100.3', online: true },
      { hostname: 'server', ip: '100.100.100.4', online: false },
    ],
  },
}

export function TailscalePreview() {
  return <TailscaleWidget {...mockData} />
}
