import type { WidgetMetadata } from '@/widgets/shared/types'

export const cpuMetadata: WidgetMetadata = {
  id: 'cpu',
  title: 'CPU',
  description: 'Central processing unit usage and information',
  icon: 'cpu',
  category: 'monitoring',
  priority: 10,
  defaultSize: { width: 1, height: 1 },
  supportedSizes: [{ width: 1, height: 1 }, { width: 2, height: 1 }],
  refreshable: true,
  searchable: false,
  version: '1.0.0',
}
