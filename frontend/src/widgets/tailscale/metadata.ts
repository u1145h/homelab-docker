import type { WidgetMetadata } from '@/widgets/shared/types'

export const tailscaleMetadata: WidgetMetadata = {
  id: 'tailscale',
  title: 'Tailscale',
  description: 'Tailscale VPN status',
  icon: 'globe',
  category: 'management',
  priority: 80,
  defaultSize: { width: 1, height: 1 },
  supportedSizes: [{ width: 1, height: 1 }, { width: 2, height: 1 }],
  refreshable: true,
  searchable: false,
  version: '1.0.0',
}
