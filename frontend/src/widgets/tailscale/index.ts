import { defineWidget } from '@/widgets/registry'
import { TailscaleWidget } from './Component'
import { TailscaleSkeleton } from './skeleton'
import { TailscaleEmpty } from './empty'
import { TailscaleError } from './error'
import { TailscalePreview } from './preview'
import { tailscaleMetadata } from './metadata'
import { selectTailscaleWidgetData } from './formatter'
import type { TailscaleWidgetProps } from './types'

export const tailscaleWidget = defineWidget<TailscaleWidgetProps>({
  metadata: tailscaleMetadata,
  component: TailscaleWidget,
  skeleton: TailscaleSkeleton,
  empty: TailscaleEmpty,
  error: TailscaleError,
  preview: TailscalePreview,
  selectData: selectTailscaleWidgetData,
})

export { TailscaleWidget } from './Component'
export { TailscaleSkeleton } from './skeleton'
export { TailscaleEmpty } from './empty'
export { TailscaleError } from './error'
export { TailscalePreview } from './preview'
export { tailscaleMetadata } from './metadata'
export { selectTailscaleWidgetData } from './formatter'
export type { TailscaleWidgetProps } from './types'
