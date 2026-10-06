import type { WidgetMetadata } from '@/widgets/shared/types'

export const memoryMetadata: WidgetMetadata = {
  id: 'memory',
  title: 'Memory',
  description: 'RAM usage and capacity',
  icon: 'hard-drive',
  category: 'monitoring',
  priority: 20,
  defaultSize: { width: 1, height: 1 },
  supportedSizes: [{ width: 1, height: 1 }, { width: 2, height: 1 }],
  refreshable: true,
  searchable: false,
  version: '1.0.0',
}
