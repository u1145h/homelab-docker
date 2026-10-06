import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatBytes } from '@/utils/format'
import { radius } from '@/design/radius'

export interface NetworkChartDataPoint {
  time: string
  rx: number
  tx: number
}

interface ThroughputChartProps {
  data: NetworkChartDataPoint[]
  currentRxBytes: number
  currentTxBytes: number
  totalRxBytes: number
  totalTxBytes: number
  ifaceName: string
  rssi: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '8px 12px',
        boxShadow: 'var(--shadow)',
        fontSize: 11
      }}>
        <div style={{ marginBottom: 6, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{label}</div>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--kuro-color-text-secondary)', marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: entry.color }} />
            <span>{entry.name}:</span>
            <span style={{ fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>
              {formatBytes(entry.value)}/s
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function ThroughputChart({ data, currentRxBytes, currentTxBytes, totalRxBytes, totalTxBytes, ifaceName, rssi }: ThroughputChartProps) {
  return (
    <div style={{
      backgroundColor: 'var(--kuro-color-surface)',
      border: '1px solid var(--kuro-color-border)',
      borderRadius: radius.card,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>THROUGHPUT</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>Connected</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ width: 12, height: 6, borderRadius: 1, backgroundColor: i < 5 ? '#8BC34A' : 'var(--kuro-color-border)' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>{ifaceName} · last 60s</span>
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', marginTop: 22 }}>
            RSSI {rssi} dBm
          </div>
        </div>
      </div>
      
      <div style={{ flex: 1, minHeight: 200, width: '100%' }}>
        <ResponsiveContainer width="99%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--kuro-color-border)" vertical={false} />
            <XAxis dataKey="time" stroke="var(--kuro-color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="rx" name="RX" stroke="#26A69A" fill="#26A69A" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
            <Area type="monotone" dataKey="tx" name="TX" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--kuro-color-text-secondary)' }}>
              <div style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: '#26A69A' }} />
              RX
            </div>
            <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{formatBytes(currentRxBytes)}/s</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--kuro-color-text-secondary)' }}>
              <div style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: 'transparent' }} />
              Total RX
            </div>
            <span style={{ fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>{formatBytes(totalRxBytes)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--kuro-color-text-secondary)' }}>
              <div style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: '#F59E0B' }} />
              TX
            </div>
            <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{formatBytes(currentTxBytes)}/s</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--kuro-color-text-secondary)' }}>
              <div style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: 'transparent' }} />
              Total TX
            </div>
            <span style={{ fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>{formatBytes(totalTxBytes)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
