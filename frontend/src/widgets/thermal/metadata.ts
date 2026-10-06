import type { WidgetMetadata } from '@/widgets/shared/types'

export const thermalMetadata: WidgetMetadata = {
  id: 'thermal',
  title: 'Temperature',
  description: 'Thermal zone temperatures',
  icon: 'thermometer',
  category: 'monitoring',
  priority: 60,
  defaultSize: { width: 1, height: 1 },
  supportedSizes: [{ width: 1, height: 1 }, { width: 2, height: 1 }],
  refreshable: true,
  searchable: false,
  version: '1.0.0',
}
