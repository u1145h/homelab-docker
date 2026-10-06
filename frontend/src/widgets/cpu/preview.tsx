import { CPUWidget } from './Component'
import type { CPUWidgetProps } from './types'

const baseMock = {
  architecture: 'amd64',
  cores: [],
  interrupts: { context_switches: 0, interrupts: 0, softirqs: 0 },
  cache: { l1: '512 KB', l2: '4 MB', l3: '32 MB' },
  governor: 'performance'
}

const healthyMock: CPUWidgetProps = {
  data: {
    model: 'AMD Ryzen 7 5800X',
    logical_cores: 16,
    physical_cores: 8,
    frequency_mhz: 3800,
    usage_percent: 34.5,
    ...baseMock
  },
}

const warningMock: CPUWidgetProps = {
  data: {
    model: 'AMD Ryzen 7 5800X',
    logical_cores: 16,
    physical_cores: 8,
    frequency_mhz: 4200,
    usage_percent: 78.2,
    ...baseMock
  },
}

const criticalMock: CPUWidgetProps = {
  data: {
    model: 'AMD Ryzen 7 5800X',
    logical_cores: 16,
    physical_cores: 8,
    frequency_mhz: 4500,
    usage_percent: 95.0,
    ...baseMock
  },
}

export function CPUPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <CPUWidget {...healthyMock} />
      </div>
      <div>
        <CPUWidget {...warningMock} />
      </div>
      <div>
        <CPUWidget {...criticalMock} />
      </div>
    </div>
  )
}
