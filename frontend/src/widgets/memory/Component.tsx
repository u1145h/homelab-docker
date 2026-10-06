import { ArcGauge } from '@/widgets/shared/ArcGauge'
import { WaveChart } from '@/widgets/shared/WaveChart'
import { useMetricHistory } from '@/hooks/useMetricHistory'
import type { MemoryWidgetProps } from './types'

function formatGB(bytes: number): string {
  const v = typeof bytes === 'number' && !isNaN(bytes) ? bytes : 0
  return (v / 1024 / 1024 / 1024).toFixed(1)
}

export function MemoryWidget({ data }: MemoryWidgetProps) {
  if (!data) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>No memory data available</div>
  const { usage_percent, used, total, available, free } = data

  const usedGB = formatGB(used)
  const totalGB = formatGB(total)
  const freeGB = formatGB(free ?? available ?? Math.max(0, total - used))

  const memHistory = useMetricHistory(usage_percent)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>MEMORY</span>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
          {usedGB} GB used • {totalGB} GB total
        </span>
      </div>

      {/* Main Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <ArcGauge
          value={usage_percent}
          label="USED"
          valueDisplay={`${Math.round(usage_percent)}%`}
          color="var(--kuro-color-success)"
          size={118}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <WaveChart color="var(--kuro-color-success)" height={36} dataPoints={memHistory} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-success)', borderRadius: 1 }} /> Used
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{usedGB} GB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-success)', opacity: 0.6, borderRadius: 1 }} /> Total
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{totalGB} GB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-success)', opacity: 0.4, borderRadius: 1 }} /> Free
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{freeGB} GB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
