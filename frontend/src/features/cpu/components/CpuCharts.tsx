import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

export interface CpuChartDataPoint {
  time: string
  usage: number
  freq: number
  temp: number
}

interface CpuChartsProps {
  data: CpuChartDataPoint[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 11,
        color: 'var(--kuro-color-text-primary)'
      }}>
        <div style={{ marginBottom: 4, color: 'var(--kuro-color-text-muted)' }}>{label}</div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color || p.stroke }}>
            {p.name}: {p.value.toFixed(1)}
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function CpuCharts({ data }: CpuChartsProps) {
  return (
    <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Usage Chart */}
      <div style={{ 
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: 12,
        padding: '20px 20px 10px 20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--kuro-color-text-secondary)' }}>USAGE</h3>
        <div style={{ height: 200, width: '100%' }}>
          <ResponsiveContainer width="99%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--kuro-color-border)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--kuro-color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--kuro-color-text-muted)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="usage" name="Usage (%)" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="cpu-charts-grid page-widget-gap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* Frequency Chart */}
        <div style={{ 
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: 12,
          padding: '20px 20px 10px 20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--kuro-color-text-secondary)' }}>FREQUENCY</h3>
          <div style={{ height: 160, width: '100%' }}>
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--kuro-color-border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--kuro-color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--kuro-color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="freq" name="Freq (GHz)" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Thermal Chart */}
        <div style={{ 
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: 12,
          padding: '20px 20px 10px 20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--kuro-color-text-secondary)' }}>THERMAL</h3>
          <div style={{ height: 160, width: '100%' }}>
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--kuro-color-border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--kuro-color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--kuro-color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="temp" name="Temp (°C)" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
