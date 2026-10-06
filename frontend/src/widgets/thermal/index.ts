import { defineWidget } from '@/widgets/registry'
import { ThermalWidget } from './Component'
import { ThermalSkeleton } from './skeleton'
import { ThermalEmpty } from './empty'
import { ThermalError } from './error'
import { ThermalPreview } from './preview'
import { thermalMetadata } from './metadata'
import { selectThermalWidgetData } from './formatter'
import type { ThermalWidgetProps } from './types'

export const thermalWidget = defineWidget<ThermalWidgetProps>({
  metadata: thermalMetadata,
  component: ThermalWidget,
  skeleton: ThermalSkeleton,
  empty: ThermalEmpty,
  error: ThermalError,
  preview: ThermalPreview,
  selectData: selectThermalWidgetData,
})

export { ThermalWidget } from './Component'
export { ThermalSkeleton } from './skeleton'
export { ThermalEmpty } from './empty'
export { ThermalError } from './error'
export { ThermalPreview } from './preview'
export { thermalMetadata } from './metadata'
export { selectThermalWidgetData } from './formatter'
export type { ThermalWidgetProps } from './types'
