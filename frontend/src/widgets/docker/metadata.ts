import type { WidgetMetadata } from '@/widgets/shared/types'

export const dockerMetadata: WidgetMetadata = {
  id: 'docker',
  title: 'Docker',
  description: 'Container runtime status',
  icon: 'container',
  category: 'management',
  priority: 50,
  defaultSize: { width: 1, height: 1 },
  supportedSizes: [{ width: 1, height: 1 }, { width: 2, height: 1 }],
  refreshable: true,
  searchable: false,
  version: '1.0.0',
}
