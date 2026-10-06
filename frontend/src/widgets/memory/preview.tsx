import { MemoryWidget } from './Component'
import type { MemoryWidgetProps } from './types'

const healthyMock: MemoryWidgetProps = {
  data: {
    total: 34359738368,
    free: 19327352832,
    available: 21474836480,
    used: 12884901888,
    usage_percent: 37.5,
    cached: 0, buffers: 0, shared: 0, swap_total: 0, swap_free: 0, swap_used: 0, swap_usage_percent: 0,
    sreclaimable: 0, sunreclaim: 0, slab: 0, page_tables: 0, kernel_stack: 0, dirty: 0, writeback: 0, mapped: 0, active: 0, inactive: 0
  },
}

const warningMock: MemoryWidgetProps = {
  data: {
    total: 34359738368,
    free: 6871947674,
    available: 8589934592,
    used: 27487790694,
    usage_percent: 80.0,
    cached: 0, buffers: 0, shared: 0, swap_total: 0, swap_free: 0, swap_used: 0, swap_usage_percent: 0,
    sreclaimable: 0, sunreclaim: 0, slab: 0, page_tables: 0, kernel_stack: 0, dirty: 0, writeback: 0, mapped: 0, active: 0, inactive: 0
  },
}

const criticalMock: MemoryWidgetProps = {
  data: {
    total: 34359738368,
    free: 1717986918,
    available: 2576980378,
    used: 32641751450,
    usage_percent: 95.0,
    cached: 0, buffers: 0, shared: 0, swap_total: 0, swap_free: 0, swap_used: 0, swap_usage_percent: 0,
    sreclaimable: 0, sunreclaim: 0, slab: 0, page_tables: 0, kernel_stack: 0, dirty: 0, writeback: 0, mapped: 0, active: 0, inactive: 0
  },
}

export function MemoryPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <MemoryWidget {...healthyMock} />
      </div>
      <div>
        <MemoryWidget {...warningMock} />
      </div>
      <div>
        <MemoryWidget {...criticalMock} />
      </div>
    </div>
  )
}
