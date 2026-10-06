import { defineWidget } from '@/widgets/registry'
import { NetworkWidget } from './Component'
import { NetworkSkeleton } from './skeleton'
import { NetworkEmpty } from './empty'
import { NetworkError } from './error'
import { NetworkPreview } from './preview'
import { networkMetadata } from './metadata'
import { selectNetworkWidgetData } from './formatter'
import type { NetworkWidgetProps } from './types'

export const networkWidget = defineWidget<NetworkWidgetProps>({
  metadata: networkMetadata,
  component: NetworkWidget,
  skeleton: NetworkSkeleton,
  empty: NetworkEmpty,
  error: NetworkError,
  preview: NetworkPreview,
  selectData: selectNetworkWidgetData,
})

export { NetworkWidget } from './Component'
export { NetworkSkeleton } from './skeleton'
export { NetworkEmpty } from './empty'
export { NetworkError } from './error'
export { NetworkPreview } from './preview'
export { networkMetadata } from './metadata'
export { selectNetworkWidgetData } from './formatter'
export type { NetworkWidgetProps } from './types'
