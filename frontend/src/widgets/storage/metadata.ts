import type { WidgetMetadata } from '@/widgets/shared/types'

export const storageMetadata: WidgetMetadata = {
  id: 'storage',
  title: 'Storage',
  description: 'Disk usage and mount information',
  icon: 'hard-drive',
  category: 'monitoring',
  priority: 30,
  defaultSize: { width: 1, height: 1 },
  supportedSizes: [{ width: 1, height: 1 }, { width: 2, height: 1 }],
  refreshable: true,
  searchable: false,
  version: '1.0.0',
}
