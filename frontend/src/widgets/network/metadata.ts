import type { WidgetMetadata } from '@/widgets/shared/types'

export const networkMetadata: WidgetMetadata = {
  id: 'network',
  title: 'Network',
  description: 'Network interface status and throughput',
  icon: 'network',
  category: 'monitoring',
  priority: 40,
  defaultSize: { width: 1, height: 1 },
  supportedSizes: [{ width: 1, height: 1 }, { width: 2, height: 1 }],
  refreshable: true,
  searchable: false,
  version: '1.0.0',
}
