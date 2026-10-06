import { defineWidget } from '@/widgets/registry'
import { MemoryWidget } from './Component'
import { MemorySkeleton } from './skeleton'
import { MemoryEmpty } from './empty'
import { MemoryError } from './error'
import { MemoryPreview } from './preview'
import { memoryMetadata } from './metadata'
import { selectMemoryWidgetData } from './formatter'
import type { MemoryWidgetProps } from './types'

export const memoryWidget = defineWidget<MemoryWidgetProps>({
  metadata: memoryMetadata,
  component: MemoryWidget,
  skeleton: MemorySkeleton,
  empty: MemoryEmpty,
  error: MemoryError,
  preview: MemoryPreview,
  selectData: selectMemoryWidgetData,
})

export { MemoryWidget } from './Component'
export { MemorySkeleton } from './skeleton'
export { MemoryEmpty } from './empty'
export { MemoryError } from './error'
export { MemoryPreview } from './preview'
export { memoryMetadata } from './metadata'
export { selectMemoryWidgetData } from './formatter'
export type { MemoryWidgetProps } from './types'
