import { ArcGauge } from '@/widgets/shared/ArcGauge'
import { WaveChart } from '@/widgets/shared/WaveChart'
import { useMetricHistory } from '@/hooks/useMetricHistory'
import type { CPUWidgetProps } from './types'

export function CPUWidget({ data }: CPUWidgetProps) {
  if (!data) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>No CPU data available</div>
  const { usage_percent, logical_cores, frequency_mhz } = data
  const safeUsage = typeof usage_percent === 'number' && !isNaN(usage_percent) ? usage_percent : 0

  const cpuHistory = useMetricHistory(safeUsage)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%' }}>
      {/* Top Header Line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>CPU</span>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
          {logical_cores} cores • {frequency_mhz} MHz
        </span>
      </div>

      {/* Main Content: Left Arc Gauge, Right Wave & Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* Left Column: Arc Gauge */}
        <ArcGauge
          value={safeUsage}
          label="USAGE"
          valueDisplay={`${Math.round(safeUsage)}%`}
          color="var(--kuro-color-accent)"
          size={118}
        />

        {/* Right Column: Wave Chart & Legend */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <WaveChart color="var(--kuro-color-accent)" height={36} dataPoints={cpuHistory} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-accent)', borderRadius: 1 }} /> CPU usage
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{safeUsage.toFixed(0)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-accent)', opacity: 0.6, borderRadius: 1 }} /> Cores
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{logical_cores}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-accent)', opacity: 0.4, borderRadius: 1 }} /> Clock
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{frequency_mhz} MHz</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
