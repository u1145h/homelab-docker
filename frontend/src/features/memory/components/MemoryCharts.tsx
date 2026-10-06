import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { MemoryInfo } from '@/types/status'
import { formatBytes } from '@/utils/format'

import { radius } from '@/design/radius'

export interface MemoryChartDataPoint {
  time: string
  used: number
  buffers: number
  cached: number
  swap: number
}

interface MemoryChartsProps {
  data: MemoryChartDataPoint[]
  current: MemoryInfo
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
              {formatBytes(entry.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function MemoryCharts({ data, current }: MemoryChartsProps) {
  const pieData = [
    { name: 'Used', value: current.used, color: '#3B82F6' },
    { name: 'Cache', value: current.cached + current.buffers, color: '#F59E0B' },
    { name: 'Available', value: current.available, color: '#26A69A' },
    { name: 'Free', value: current.free, color: '#9CA3AF' }
  ].filter(d => d.value > 0)

  return (
    <div className="responsive-content-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
      {/* Memory Over Time */}
      <div style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '18px 20px 14px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>MEMORY OVER TIME</h3>
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            used / cache / buffers / swap
          </div>
        </div>
        
        <div style={{ height: 200, width: '100%', overflow: 'hidden' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--kuro-color-border)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--kuro-color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="var(--kuro-color-text-muted)" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => formatBytes(val)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="used" name="Used" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="cached" name="Cached" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="buffers" name="Buffers" stroke="#26A69A" fill="#26A69A" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="swap" name="Swap" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Current Donut */}
      <div style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '18px 20px 14px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>CURRENT</h3>
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>physical</span>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 20 }}>
          <div style={{ width: 120, height: 120, position: 'relative', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                {current.usage_percent.toFixed(0)}%
              </span>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>USED</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {pieData.map(item => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: item.color }} />
                  <span style={{ color: 'var(--kuro-color-text-secondary)' }}>{item.name}</span>
                </div>
                <span style={{ color: 'var(--kuro-color-text-primary)' }}>{formatBytes(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
