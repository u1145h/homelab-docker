import type { WidgetMetadata } from '@/widgets/shared/types'

export const batteryMetadata: WidgetMetadata = {
  id: 'battery',
  title: 'Battery',
  description: 'Battery status and capacity',
  icon: 'battery-full',
  category: 'monitoring',
  priority: 70,
  defaultSize: { width: 1, height: 1 },
  supportedSizes: [{ width: 1, height: 1 }, { width: 2, height: 1 }],
  refreshable: true,
  searchable: false,
  version: '1.0.0',
}
