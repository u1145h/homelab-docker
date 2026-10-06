import { defineWidget } from '@/widgets/registry'
import { SystemWidget } from './Component'
import { SystemSkeleton } from './skeleton'
import { SystemEmpty } from './empty'
import { SystemError } from './error'
import { SystemPreview } from './preview'
import { systemMetadata } from './metadata'
import { selectSystemWidgetData } from './formatter'
import type { SystemWidgetProps } from './types'

export const systemWidget = defineWidget<SystemWidgetProps>({
  metadata: systemMetadata,
  component: SystemWidget,
  skeleton: SystemSkeleton,
  empty: SystemEmpty,
  error: SystemError,
  preview: SystemPreview,
  selectData: selectSystemWidgetData,
})

export { SystemWidget } from './Component'
export { SystemSkeleton } from './skeleton'
export { SystemEmpty } from './empty'
export { SystemError } from './error'
export { SystemPreview } from './preview'
export { systemMetadata } from './metadata'
export { selectSystemWidgetData } from './formatter'
export type { SystemWidgetProps } from './types'
export type { SystemWidgetData } from './types'
