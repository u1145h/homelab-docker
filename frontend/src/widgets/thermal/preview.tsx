import { ThermalWidget } from './Component'
import type { ThermalWidgetProps } from './types'

const mockData: ThermalWidgetProps = {
  data: {
    zones: [
      { name: 'cpu-thermal', temperature_c: 52.3 },
      { name: 'gpu-thermal', temperature_c: 48.1 },
      { name: 'nvme-thermal', temperature_c: 38.5 },
    ],
  } as unknown as any,
}

export function ThermalPreview() {
  return <ThermalWidget {...mockData} />
}
