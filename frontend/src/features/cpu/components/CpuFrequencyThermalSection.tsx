import { radius } from '@/design/radius'
import { WaveChart } from '@/widgets/shared/WaveChart'

interface CpuFrequencyThermalSectionProps {
  clockMhz: number
  tempC: number
  governor?: string
  freqHistory?: number[]
  tempHistory?: number[]
  minFreq?: number
  maxFreq?: number
  baseFreq?: number
  boostFreq?: number
  peakTemp?: number
  avgTemp?: number
  ambientTemp?: number
  fanStatus?: string
  thermalZoneName?: string
}

export default function CpuFrequencyThermalSection({
  clockMhz,
  tempC,
  governor = 'ondemand',
  freqHistory = [1600, 1650, 1732, 1700, 1732, 1680, 1732],
  tempHistory = [50, 52, 54, 53, 55.2, 54.8, 55.2],
  minFreq = 600,
  maxFreq = 2400,
  baseFreq = 1500,
  boostFreq = 2400,
  peakTemp = 55.2,
  avgTemp = 50.7,
  ambientTemp = 28.2,
  fanStatus = 'idle',
  thermalZoneName = 'cpu4-thermal',
}: CpuFrequencyThermalSectionProps) {
  const safeClock = typeof clockMhz === 'number' && clockMhz > 0 ? clockMhz : 1732
  const safeTemp = typeof tempC === 'number' && tempC > 0 ? tempC : 55.2

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 15,
        width: '100%',
        boxSizing: 'border-box',
      }}
      className="cpu-freq-thermal-grid"
    >
      {/* Left Card: FREQUENCY */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
          padding: '18px 20px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
              FREQUENCY
            </span>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
              MHz · avg all cores
            </span>
          </div>

          {/* Stat Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--kuro-color-text-primary)',
                  fontFamily: 'var(--kuro-font-family-mono, monospace)',
                }}
              >
                {Math.round(safeClock)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                MHz
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
              min {minFreq} · max {maxFreq}
            </span>
          </div>

          {/* Chart */}
          <div style={{ width: '100%', height: 68, margin: '4px 0 10px' }}>
            <WaveChart
              color="#D3869B"
              height={68}
              dataPoints={freqHistory.length >= 2 ? freqHistory : [1600, 1680, 1732, 1710, 1732]}
            />
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            rowGap: 6,
            columnGap: 16,
            paddingTop: 10,
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 2, backgroundColor: '#D3869B', borderRadius: 1 }} />
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Current</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {Math.round(safeClock)} MHz
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 2, backgroundColor: '#D3869B', borderRadius: 1 }} />
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Base</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {baseFreq} MHz
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 2, backgroundColor: '#D3869B', borderRadius: 1 }} />
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Boost</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {boostFreq} MHz
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 2, backgroundColor: '#D3869B', borderRadius: 1 }} />
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Governor</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {governor}
            </span>
          </div>
        </div>
      </div>

      {/* Right Card: THERMAL */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
          padding: '18px 20px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
              THERMAL
            </span>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
              peak {peakTemp.toFixed(1)}°C
            </span>
          </div>

          {/* Stat Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--kuro-color-text-primary)',
                  fontFamily: 'var(--kuro-font-family-mono, monospace)',
                }}
              >
                {safeTemp.toFixed(1)}°
              </span>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                {thermalZoneName}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
              throttle 85°
            </span>
          </div>

          {/* Chart */}
          <div style={{ width: '100%', height: 68, margin: '4px 0 10px' }}>
            <WaveChart
              color="#EA6962"
              height={68}
              dataPoints={tempHistory.length >= 2 ? tempHistory : [50, 52, 54, 53, 55.2]}
            />
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            rowGap: 6,
            columnGap: 16,
            paddingTop: 10,
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 2, backgroundColor: '#EA6962', borderRadius: 1 }} />
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Peak</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {peakTemp.toFixed(1)}°C
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 2, backgroundColor: '#EA6962', borderRadius: 1 }} />
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Average</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {avgTemp.toFixed(1)}°C
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 2, backgroundColor: '#EA6962', borderRadius: 1 }} />
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Ambient</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {ambientTemp.toFixed(1)}°C
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 2, backgroundColor: '#EA6962', borderRadius: 1 }} />
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Fan</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {fanStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
