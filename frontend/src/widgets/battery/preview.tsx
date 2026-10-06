import { BatteryWidget } from './Component'
import type { BatteryWidgetProps } from './types'

const mockData: BatteryWidgetProps = {
  data: {
    present: true,
    status: 'Charging',
    capacity: 85,
    health: 'Good',
    technology: 'Li-ion',
    voltage_mv: 11500,
    current_ma: 1200,
    power_mw: 13800,
    temperature_c: 32.5,
  } as unknown as any,
}

export function BatteryPreview() {
  return <BatteryWidget {...mockData} />
}
