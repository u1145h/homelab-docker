import { AreaChart, Area, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { LinkQuality } from '@/types/status'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'

export interface LinkQualityDataPoint {
  time: string
  signal: number
  latency: number
}

interface LinkQualityChartProps {
  data: LinkQualityDataPoint[]
  current?: LinkQuality
  rxRate?: number
  txRate?: number
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s'
  if (bytesPerSec >= 1000000000) return `${(bytesPerSec / 1000000000).toFixed(1)} GB/s`
  if (bytesPerSec >= 1000000) return `${(bytesPerSec / 1000000).toFixed(1)} MB/s`
  if (bytesPerSec >= 1000) return `${(bytesPerSec / 1000).toFixed(1)} KB/s`
  return `${Math.round(bytesPerSec)} B/s`
}

export default function LinkQualityChart({
  data,
  current = { signal: 85, latency: 12, jitter: 2.1, loss: 0 },
  rxRate = 0,
  txRate = 0,
}: LinkQualityChartProps) {
  const signalPct = Math.max(0, Math.min(100, current?.signal || 0))
  const circumference = 2 * Math.PI * 36 // r=36
  const strokeDashoffset = circumference - (signalPct / 100) * circumference

  let signalColor = '#89B482' // Green
  if (signalPct < 40) signalColor = '#EA6962' // Red
  else if (signalPct < 70) signalColor = '#E78A4E' // Orange

  let healthStatus = 'EXCELLENT'
  let healthColor = '#89B482'
  if (current.loss > 2 || signalPct < 40 || current.latency > 100) {
    healthStatus = 'POOR'
    healthColor = '#EA6962'
  } else if (current.loss > 0 || signalPct < 70 || current.latency > 40) {
    healthStatus = 'GOOD'
    healthColor = '#E78A4E'
  }

  const formattedRx = formatSpeed(rxRate)
  const formattedTx = formatSpeed(txRate)

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: '100%',
        minWidth: 0,
      }}
    >
      {/* Widget Header (Clean title with NO icon) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--kuro-color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          LINK QUALITY & SPEED
        </h3>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>live telemetry</span>
      </div>

      {/* Live Speed Meter Cards (Download & Upload) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Download Speed Meter */}
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.card,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#89B482' }}>
            <AppIcon name="arrow-down-circle" size={14} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              DOWNLOAD SPEED
            </span>
          </div>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--kuro-color-text-primary)',
              fontFamily: 'var(--kuro-font-family-mono, monospace)',
            }}
          >
            {formattedRx}
          </span>
        </div>

        {/* Upload Speed Meter */}
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.card,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7DAEA3' }}>
            <AppIcon name="arrow-up-circle" size={14} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              UPLOAD SPEED
            </span>
          </div>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--kuro-color-text-primary)',
              fontFamily: 'var(--kuro-font-family-mono, monospace)',
            }}
          >
            {formattedTx}
          </span>
        </div>
      </div>

      {/* Circular Signal Gauge with Status Label & Telemetry Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Radial Signal Gauge + Status Label underneath */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: 8 }}>
          <div style={{ position: 'relative', width: 84, height: 84 }}>
            <svg width="84" height="84" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="36" fill="none" stroke="var(--kuro-color-border)" strokeWidth="6" />
              <circle
                cx="42"
                cy="42"
                r="36"
                fill="none"
                stroke={signalColor}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 42 42)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                {signalPct.toFixed(0)}%
              </span>
              <span style={{ fontSize: 9, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase' }}>
                SIGNAL
              </span>
            </div>
          </div>

          {/* Status Label moved underneath the circular gauge */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: 12,
              backgroundColor: `${healthColor}20`,
              color: healthColor,
              letterSpacing: '0.05em',
            }}
          >
            {healthStatus}
          </span>
        </div>

        {/* Telemetry Breakdown Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              padding: '5px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--kuro-color-text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#2196F3' }} />
              Latency (Ping)
            </div>
            <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)', fontFamily: 'monospace' }}>
              {current.latency.toFixed(0)} ms
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              padding: '5px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--kuro-color-text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#E5C07B' }} />
              Jitter
            </div>
            <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)', fontFamily: 'monospace' }}>
              {current.jitter.toFixed(1)} ms
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              padding: '5px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--kuro-color-text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: current.loss > 0 ? '#EA6962' : '#89B482' }} />
              Packet Loss
            </div>
            <span
              style={{
                fontWeight: 600,
                color: current.loss > 0 ? '#EA6962' : 'var(--kuro-color-text-primary)',
                fontFamily: 'monospace',
              }}
            >
              {current.loss.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Proper Chart at Bottom (Styled like Power & Charge History in Battery Page) */}
      <div style={{ height: 110, width: '100%', marginTop: 'auto' }}>
        <ResponsiveContainer width="99%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="linkSignalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#89B482" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#89B482" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="linkLatencyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2196F3" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2196F3" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--kuro-color-border)" vertical={false} />
            <XAxis dataKey="time" stroke="var(--kuro-color-text-muted)" fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--kuro-color-surface)',
                borderColor: 'var(--kuro-color-border)',
                borderRadius: radius.card,
                fontSize: 11,
              }}
            />
            <Area
              type="monotone"
              dataKey="signal"
              name="Signal %"
              stroke="#89B482"
              fill="url(#linkSignalGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="latency"
              name="Latency (ms)"
              stroke="#2196F3"
              fill="url(#linkLatencyGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
