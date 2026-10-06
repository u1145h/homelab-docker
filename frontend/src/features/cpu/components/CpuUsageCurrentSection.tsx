import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { radius } from '@/design/radius'
import { ArcGauge } from '@/widgets/shared/ArcGauge'
import { WaveChart } from '@/widgets/shared/WaveChart'

export interface CpuUsagePoint {
  time: string
  total: number
  user: number
  system: number
  iowait: number
}

interface CpuUsageCurrentSectionProps {
  usage: number
  coresCount: number
  threadsCount: number
  governor: string
  chartData: CpuUsagePoint[]
  peakUsage?: number
  idleUsage?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 11,
          color: 'var(--kuro-color-text-primary)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ marginBottom: 4, color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>{label}</div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: p.stroke, fontSize: 11 }}>
            <span>{p.name}:</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {typeof p.value === 'number' ? `${p.value.toFixed(1)}%` : p.value}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function CpuUsageCurrentSection({
  usage,
  coresCount = 8,
  threadsCount = 8,
  governor = 'ondemand',
  chartData,
  peakUsage = 47,
  idleUsage = 76,
}: CpuUsageCurrentSectionProps) {
  const safeUsage = typeof usage === 'number' && !isNaN(usage) ? usage : 22
  const latestPoint = chartData[chartData.length - 1] || {
    total: safeUsage,
    user: (safeUsage * 0.65),
    system: (safeUsage * 0.28),
    iowait: (safeUsage * 0.08),
  }

  const wavePoints = chartData.map((d) => d.total)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.85fr) minmax(0, 1fr)',
        gap: 15,
        width: '100%',
        boxSizing: 'border-box',
      }}
      className="cpu-usage-current-grid"
    >
      {/* Left Card: USAGE CHART */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
          padding: '18px 20px 14px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
            USAGE
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            <span>last 30m · user / sys / iowait</span>
            <span>1s sample</span>
          </div>
        </div>

        {/* Sub-header stat */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--kuro-color-text-primary)',
              fontFamily: 'var(--kuro-font-family-mono, monospace)',
            }}
          >
            {Math.round(safeUsage)}%
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--kuro-color-text-muted)',
              fontFamily: 'var(--kuro-font-family-mono, monospace)',
            }}
          >
            peak {Math.round(peakUsage)}% · idle {Math.round(idleUsage)}%
          </span>
        </div>

        {/* Chart */}
        <div style={{ height: 160, width: '100%', minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="time"
                stroke="var(--kuro-color-text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.05)' }}
                dy={6}
              />
              <YAxis
                stroke="var(--kuro-color-text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                hide
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#F7F3EA"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="user"
                name="User"
                stroke="#E7C664"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="system"
                name="System"
                stroke="#EA6962"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="iowait"
                name="I/O wait"
                stroke="#7DAEA3"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 8, height: 2, backgroundColor: '#F7F3EA', borderRadius: 1 }} />
            <span style={{ color: 'var(--kuro-color-text-muted)' }}>Total:</span>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {Math.round(latestPoint.total)}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 8, height: 2, backgroundColor: '#E7C664', borderRadius: 1 }} />
            <span style={{ color: 'var(--kuro-color-text-muted)' }}>User:</span>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {latestPoint.user.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 8, height: 2, backgroundColor: '#EA6962', borderRadius: 1 }} />
            <span style={{ color: 'var(--kuro-color-text-muted)' }}>System:</span>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {latestPoint.system.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 8, height: 2, backgroundColor: '#7DAEA3', borderRadius: 1 }} />
            <span style={{ color: 'var(--kuro-color-text-muted)' }}>I/O wait:</span>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {latestPoint.iowait.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Right Card: CURRENT */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
              CURRENT
            </span>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
              package
            </span>
          </div>

          {/* Center Gauges/Visuals */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, marginBottom: 12 }}>
            <div style={{ transform: 'scale(0.92)', transformOrigin: 'left center' }}>
              <ArcGauge
                value={safeUsage}
                max={100}
                label="USAGE"
                size={105}
                strokeWidth={9}
                color="#A9B665"
                trackColor="rgba(255, 255, 255, 0.08)"
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
              <WaveChart
                color="#A9B665"
                height={40}
                dataPoints={wavePoints.length > 0 ? wavePoints : [20, 25, 22, 30, 24, 28, 22]}
              />
            </div>
          </div>
        </div>

        {/* Bottom Key-Values */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingTop: 10,
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Usage</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {Math.round(safeUsage)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Cores</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {coresCount}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Threads</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {threadsCount}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Governor</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {governor}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
