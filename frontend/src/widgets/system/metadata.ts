import type { WidgetMetadata } from '@/widgets/shared/types'

export const systemMetadata: WidgetMetadata = {
  id: 'system',
  title: 'System',
  description: 'System summary and host information',
  icon: 'server',
  category: 'system',
  priority: 90,
  defaultSize: { width: 1, height: 1 },
  supportedSizes: [{ width: 1, height: 1 }, { width: 2, height: 1 }, { width: 2, height: 2 }],
  refreshable: true,
  searchable: true,
  version: '1.0.0',
}
