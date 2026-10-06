import { defineWidget } from '@/widgets/registry'
import { BatteryWidget } from './Component'
import { BatterySkeleton } from './skeleton'
import { BatteryEmpty } from './empty'
import { BatteryError } from './error'
import { BatteryPreview } from './preview'
import { batteryMetadata } from './metadata'
import { selectBatteryWidgetData } from './formatter'
import type { BatteryWidgetProps } from './types'

export const batteryWidget = defineWidget<BatteryWidgetProps>({
  metadata: batteryMetadata,
  component: BatteryWidget,
  skeleton: BatterySkeleton,
  empty: BatteryEmpty,
  error: BatteryError,
  preview: BatteryPreview,
  selectData: selectBatteryWidgetData,
})

export { BatteryWidget } from './Component'
export { BatterySkeleton } from './skeleton'
export { BatteryEmpty } from './empty'
export { BatteryError } from './error'
export { BatteryPreview } from './preview'
export { batteryMetadata } from './metadata'
export { selectBatteryWidgetData } from './formatter'
export type { BatteryWidgetProps } from './types'
