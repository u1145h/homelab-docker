import { ArcGauge } from '@/widgets/shared/ArcGauge'
import { WaveChart } from '@/widgets/shared/WaveChart'
import { useMetricHistory } from '@/hooks/useMetricHistory'
import type { ThermalWidgetProps } from './types'

export function ThermalWidget({ data }: ThermalWidgetProps) {
  if (!data || !data.zones || data.zones.length === 0) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>No thermal data available</div>
  
  const zoneCount = data.zones.length
  const hottest = data.zones.reduce(
    (max, z) => (z.temperature_c > max.temperature_c ? z : max),
    data.zones[0],
  )

  const avg = zoneCount > 0
    ? data.zones.reduce((sum, z) => sum + z.temperature_c, 0) / zoneCount
    : 0

  const temp = hottest && typeof hottest.temperature_c === 'number' && !isNaN(hottest.temperature_c) ? hottest.temperature_c : 0
  const zoneNameLabel = (hottest?.name || 'THERMAL').toUpperCase().slice(0, 6)

  const thermalHistory = useMetricHistory(temp)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>THERMAL</span>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
          {zoneCount} zones • avg {avg.toFixed(1)}°
        </span>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <ArcGauge
          value={temp}
          max={100}
          label={zoneNameLabel}
          valueDisplay={`${temp.toFixed(1)}°`}
          color="var(--kuro-color-danger)"
          size={118}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <WaveChart color="var(--kuro-color-danger)" height={36} dataPoints={thermalHistory} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-danger)', borderRadius: 1 }} /> {zoneNameLabel.toLowerCase()} thermal
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{temp.toFixed(1)}°</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-danger)', opacity: 0.6, borderRadius: 1 }} /> Average
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{avg.toFixed(1)}°</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-danger)', opacity: 0.4, borderRadius: 1 }} /> Zones
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{zoneCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
