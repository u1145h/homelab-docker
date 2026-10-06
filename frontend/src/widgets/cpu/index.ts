import { defineWidget } from '@/widgets/registry'
import { CPUWidget } from './Component'
import { CPUSkeleton } from './skeleton'
import { CPUEmpty } from './empty'
import { CPUError } from './error'
import { CPUPreview } from './preview'
import { cpuMetadata } from './metadata'
import { selectCPUWidgetData } from './formatter'
import type { CPUWidgetProps } from './types'

export const cpuWidget = defineWidget<CPUWidgetProps>({
  metadata: cpuMetadata,
  component: CPUWidget,
  skeleton: CPUSkeleton,
  empty: CPUEmpty,
  error: CPUError,
  preview: CPUPreview,
  selectData: selectCPUWidgetData,
})

export { CPUWidget } from './Component'
export { CPUSkeleton } from './skeleton'
export { CPUEmpty } from './empty'
export { CPUError } from './error'
export { CPUPreview } from './preview'
export { cpuMetadata } from './metadata'
export { selectCPUWidgetData } from './formatter'
export type { CPUWidgetProps } from './types'
