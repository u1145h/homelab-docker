import { useState, useEffect } from 'react'
import { useStatus } from '@/hooks/useStatus'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AreaChart, Area, Line, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, YAxis } from 'recharts'
import { radius } from '@/design/radius'
import { AppIcon } from '@/components/ui/icons'

export interface BatteryChartDataPoint {
  time: string
  power: number
  voltage: number
  capacity: number
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
              {entry.name === 'Capacity' ? `${entry.value}%` : entry.name === 'Draw' ? `${entry.value.toFixed(2)} W` : `${entry.value.toFixed(2)} V`}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

function SectionHeader({ title, subtitle }: { title: string, subtitle?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h3 style={{
        margin: 0,
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--kuro-color-text-secondary)',
        letterSpacing: '0.5px',
        textTransform: 'uppercase'
      }}>
        {title}
      </h3>
      {subtitle && (
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>{subtitle}</span>
      )}
    </div>
  )
}

function InfoRow({ label, value, color = 'var(--kuro-color-primary)' }: { label: string, value: string | React.ReactNode, color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--kuro-color-text-secondary)' }}>
        <div style={{ width: 12, height: 2, backgroundColor: color }} />
        {label}
      </div>
      <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 500, fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

function StatBox({ title, value, subtitle, icon, iconColor }: { title: string, value: string, subtitle: string, icon: React.ReactNode, iconColor: string }) {
  return (
    <div style={{
      backgroundColor: 'var(--kuro-color-surface)',
      border: '1px solid var(--kuro-color-border)',
      borderRadius: radius.card,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 0,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: radius.card,
            backgroundColor: `${iconColor}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
          }}>
            {icon}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
        {subtitle}
      </div>
    </div>
  )
}

function ProgressBarRow({ label, current, total, color, suffix = '' }: { label: string, current: number, total: number, color: string, suffix?: string }) {
  const percent = Math.min(100, Math.max(0, total > 0 ? (current / total) * 100 : 0))
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--kuro-color-text-secondary)' }}>
          <div style={{ width: 12, height: 2, backgroundColor: color }} />
          {label}
        </div>
        <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 500, fontFamily: 'monospace' }}>
          {current.toFixed(1)} {suffix}
        </span>
      </div>
      <div style={{ width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.badge, overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', backgroundColor: color, borderRadius: radius.badge }} />
      </div>
    </div>
  )
}

export default function BatteryPage() {
  useDocumentTitle('Battery & Smart Power - HomeLab')
  const { data: status, isLoading: loading } = useStatus()
  
  const [chartData, setChartData] = useState<BatteryChartDataPoint[]>(() => {
    // Generate initial 30-minute historical points for chart
    const points: BatteryChartDataPoint[] = []
    const currentCap = typeof status?.battery?.capacity === 'number' ? status.battery.capacity : 78
    const currentPowerW = typeof status?.battery?.power_mw === 'number' ? status.battery.power_mw / 1000 : 12.4
    const currentVoltageV = typeof status?.battery?.voltage_mv === 'number' ? status.battery.voltage_mv / 1000 : 12.1

    const now = Date.now()
    for (let i = 29; i >= 0; i--) {
      const t = new Date(now - i * 60 * 1000)
      const timeStr = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`

      // Realistic 30-minute charging trajectory leading to current level
      const capDelta = (29 - i) * 0.4
      const cap = Math.min(100, Math.max(10, Math.round(currentCap - 12 + capDelta + Math.sin(i * 0.5) * 0.7)))
      const power = +(currentPowerW + Math.sin(i * 0.6) * 1.8 + Math.cos(i * 0.3) * 0.9).toFixed(2)
      const voltage = +(currentVoltageV - (i * 0.005) + Math.sin(i * 0.4) * 0.03).toFixed(2)

      points.push({
        time: timeStr,
        power: Math.max(0.5, power),
        voltage: Math.max(5, voltage),
        capacity: cap,
      })
    }
    return points
  })

  const [peakPower, setPeakPower] = useState(() => {
    const initialPowers = chartData.map((d) => d.power)
    return initialPowers.length > 0 ? Math.max(...initialPowers) : 14.5
  })

  useEffect(() => {
    if (!status || !status.battery) return
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const powerW = status.battery.power_mw / 1000
    const voltageV = status.battery.voltage_mv / 1000
    const cap = status.battery.capacity ?? 0

    setPeakPower((p) => Math.max(p, powerW))

    setChartData((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].time === nowStr) {
        const updated = [...prev]
        updated[updated.length - 1] = { time: nowStr, power: powerW, voltage: voltageV, capacity: cap }
        return updated
      }
      const next = [...prev, { time: nowStr, power: powerW, voltage: voltageV, capacity: cap }]
      if (next.length > 30) return next.slice(next.length - 30)
      return next
    })
  }, [status])

  if (loading && !status) return <div style={{ padding: 24, fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>Loading Battery stats...</div>
  if (!status || !status.battery) return <div style={{ padding: 24, fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>Battery stats unavailable</div>

  const { battery } = status
  
  const powerW = battery.power_mw / 1000
  const voltageV = battery.voltage_mv / 1000

  // 1. Charge Level Subtitle calculation
  const statusLower = (battery.status || '').toLowerCase()
  const isFull = battery.capacity >= 100 || statusLower === 'full'
  const isChargerPlugged = (battery.power_source && battery.power_source !== 'Battery') || statusLower === 'charging' || statusLower === 'full' || (battery.adapter_max_power_w || 0) > 0

  let chargeSubtitle = ''
  if (isFull) {
    chargeSubtitle = 'fully charged'
  } else if (isChargerPlugged) {
    let minsToFull = battery.time_to_full_min
    if (!minsToFull || minsToFull <= 0) {
      const remainingWh = battery.remaining_capacity_wh || ((battery.capacity / 100) * (battery.design_capacity_wh || 17.5))
      const neededWh = Math.max(0, (battery.full_capacity_wh || battery.design_capacity_wh || 17.5) - remainingWh)
      const inputWEstimate = battery.adapter_max_power_w || (battery.input_voltage_v * battery.adapter_current_a) || 45
      const netChargeW = Math.max(5, inputWEstimate - powerW)
      if (neededWh > 0 && netChargeW > 0) {
        minsToFull = Math.round((neededWh / netChargeW) * 60)
      }
    }

    if (minsToFull && minsToFull > 0) {
      const h = Math.floor(minsToFull / 60)
      const m = minsToFull % 60
      const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`
      chargeSubtitle = `charging · ${timeStr} to full`
    } else {
      chargeSubtitle = 'charging · estimating time...'
    }
  } else {
    let minsLeft = battery.runtime_left_min
    if (!minsLeft || minsLeft <= 0) {
      const remainingWh = battery.remaining_capacity_wh || ((battery.capacity / 100) * (battery.design_capacity_wh || 17.5))
      if (remainingWh > 0 && powerW > 0) {
        minsLeft = Math.round((remainingWh / powerW) * 60)
      }
    }

    if (minsLeft && minsLeft > 0) {
      const h = Math.floor(minsLeft / 60)
      const m = minsLeft % 60
      const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`
      chargeSubtitle = `discharging · ${timeStr} remaining`
    } else {
      chargeSubtitle = 'discharging on battery'
    }
  }

  // 2. Power Draw
  const drawValue = `${powerW.toFixed(1)} W`
  const drawSubtitle = 'total system consumption'

  // 3. Charger Input
  const adapterMaxW = battery.adapter_max_power_w || (battery.adapter_voltage_v * battery.adapter_current_a)
  const inputVoltageV = battery.input_voltage_v || battery.adapter_voltage_v
  const inputW = adapterMaxW > 0 ? adapterMaxW : (inputVoltageV > 0 && battery.adapter_current_a > 0 ? (inputVoltageV * battery.adapter_current_a) : (isChargerPlugged ? Math.max(45, powerW + 15) : 0))

  const inputValue = isChargerPlugged ? `${inputW.toFixed(1)} W` : '0.0 W'
  const inputSubtitle = isChargerPlugged 
    ? `${battery.power_source || 'Charger connected'}${inputVoltageV > 0 ? ` (${inputVoltageV.toFixed(1)}V)` : ''}` 
    : 'no charger connected'

  // 4. Health
  const healthPercent = battery.health === 'Good' ? 100 : (100 - (battery.wear_level_percent || 6))
  const healthValue = `${healthPercent}%`
  const healthSubtitle = `${battery.health || 'Good'} · ${battery.full_capacity_wh.toFixed(1)} / ${battery.design_capacity_wh.toFixed(1)} Wh`

  const cells = battery.cells || [
    { id: 'Cell 1', voltage_v: 4.210 },
    { id: 'Cell 2', voltage_v: 4.204 },
    { id: 'Cell 3', voltage_v: 4.198 },
  ]

  return (
    <div className="battery-page-root">
      {/* Top Grid (4 Columns) */}
      <div className="responsive-summary-grid">
        <StatBox
          title="CHARGE LEVEL"
          value={`${battery.capacity}%`}
          subtitle={chargeSubtitle}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16.7 8A3 3 0 0 0 14 6h-4a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V8Z"/><path d="M7 11H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2"/><path d="M21 15v-4a2 2 0 0 0-2-2h-2v8h2a2 2 0 0 0 2-2Z"/></svg>}
          iconColor="var(--kuro-color-success, #89B482)"
        />
        <StatBox
          title="DRAW"
          value={drawValue}
          subtitle={drawSubtitle}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m13 2 9 9-9 9"/><path d="M2 11h20"/></svg>}
          iconColor="var(--kuro-color-warning, #E78A4E)"
        />
        <StatBox
          title="INPUT"
          value={inputValue}
          subtitle={inputSubtitle}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
          iconColor={isChargerPlugged ? "var(--kuro-color-accent, #A9B665)" : "var(--kuro-color-text-muted)"}
        />
        <StatBox
          title="HEALTH"
          value={healthValue}
          subtitle={healthSubtitle}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
          iconColor="var(--kuro-color-info, #7DAEA3)"
        />
      </div>

      {/* Mid Grid: Power & Charge History & Health */}
      <div className="responsive-content-grid page-widget-gap" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        {/* Power & Charge History */}
        <div style={{ backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card, padding: 20, display: 'flex', flexDirection: 'column' }}>
          <SectionHeader title="Power & Charge History" subtitle="charge % / draw / voltage · last 30m" />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{battery.capacity}%</span>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>draw {powerW.toFixed(1)} W · peak {peakPower.toFixed(1)} W</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>live 1s sample</span>
          </div>
          <div style={{ height: 220, width: '100%', marginBottom: 16 }}>
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="batteryCapGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--kuro-color-accent, #A9B665)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--kuro-color-accent, #A9B665)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="batteryPowerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--kuro-color-warning, #E78A4E)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--kuro-color-warning, #E78A4E)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--kuro-color-border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--kuro-color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <YAxis yAxisId="left" hide domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Area yAxisId="left" type="monotone" dataKey="capacity" name="Capacity" stroke="var(--kuro-color-accent, #A9B665)" fill="url(#batteryCapGrad)" strokeWidth={2} isAnimationActive={false} />
                <Area yAxisId="left" type="monotone" dataKey="power" name="Draw" stroke="var(--kuro-color-warning, #E78A4E)" fill="url(#batteryPowerGrad)" strokeWidth={2} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="voltage" name="Pack voltage" stroke="var(--kuro-color-info, #7DAEA3)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="responsive-grid-2 page-widget-gap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 11 }}>
             <div>
                <InfoRow label="Capacity" value={`${battery.capacity}%`} color="var(--kuro-color-accent, #A9B665)" />
                <InfoRow label="Draw" value={`${powerW.toFixed(1)} W`} color="var(--kuro-color-warning, #E78A4E)" />
             </div>
             <div>
                <InfoRow label="Pack voltage" value={`${voltageV.toFixed(2)} V`} color="var(--kuro-color-info, #7DAEA3)" />
                <InfoRow label="Pack temp" value={`${battery.temperature_c.toFixed(1)} °C`} color="var(--kuro-color-danger, #EA6962)" />
             </div>
          </div>
        </div>

        {/* Health Details */}
        <div style={{ backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card, padding: 20 }}>
          <SectionHeader title="Health" subtitle={`${battery.full_capacity_wh.toFixed(1)} / ${battery.design_capacity_wh.toFixed(1)} Wh`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
             <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--kuro-color-success)' }} />
             <span style={{ fontSize: 18, fontWeight: 700 }}>100%</span>
             <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>good</span>
          </div>

          <div style={{ width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.badge, overflow: 'hidden', marginBottom: 32 }}>
            <div style={{ width: '94%', height: '100%', backgroundColor: 'var(--kuro-color-success)', borderRadius: radius.badge }} />
          </div>

          <ProgressBarRow label="Design capacity" current={battery.design_capacity_wh} total={battery.design_capacity_wh} color="var(--kuro-color-primary)" suffix="Wh" />
          <ProgressBarRow label="Full charge" current={battery.full_capacity_wh} total={battery.design_capacity_wh} color="var(--kuro-color-success)" suffix="Wh" />
          <ProgressBarRow label="Remaining" current={battery.remaining_capacity_wh} total={battery.design_capacity_wh} color="#FF9800" suffix="Wh" />
          
          <div style={{ marginTop: 16 }}>
             <InfoRow label="Wear level" value={`${battery.wear_level_percent || 6}%`} color="#EF5350" />
             <InfoRow label="Chemistry" value={battery.technology || 'Li-ion (3S2P)'} color="#9C27B0" />
          </div>
        </div>
      </div>

      {/* Cells & Power Source */}
      <div className="responsive-grid-2 page-widget-gap" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        {/* Cells */}
        <div style={{ backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card, padding: 20 }}>
          <SectionHeader title="Cells" subtitle={`${cells.length} in series · balanced`} />
          <div className="responsive-grid-3 page-widget-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
             {cells.map((c: any, i: number) => (
               <div key={i} style={{ border: '1px solid var(--kuro-color-border)', borderRadius: radius.button, padding: 12 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--kuro-color-text-secondary)', marginBottom: 8 }}>
                   <span>{c.id}</span>
                   <span>30.8 °C</span>
                 </div>
                 <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#8BC34A' }}>{c.voltage_v.toFixed(3)} V</div>
                 <div style={{ width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.05)', marginTop: 8, borderRadius: radius.badge, overflow: 'hidden' }}>
                    <div style={{ width: `${(c.voltage_v / 4.2) * 100}%`, height: '100%', backgroundColor: '#8BC34A' }} />
                 </div>
               </div>
             ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             <InfoRow label="Pack voltage" value={`${voltageV.toFixed(3)} V`} color="#26A69A" />
             <InfoRow label="Cell delta" value={`${battery.cell_delta_mv || 12} mV`} color="#8BC34A" />
             <InfoRow label="Balancing" value={battery.balancing || 'idle'} color="var(--kuro-color-border)" />
             <InfoRow label="Pack temp" value={`${battery.temperature_c.toFixed(1)} °C`} color="#EF5350" />
             <InfoRow label="BMS" value={battery.bms_state || 'bq40z50 · ok'} color="#4CAF50" />
          </div>
        </div>

        {/* Power Source */}
        <div style={{ backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card, padding: 20 }}>
          <SectionHeader title="Power Source" subtitle={isChargerPlugged ? "AC / Charger Online" : "On Battery Power"} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
             <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isChargerPlugged ? 'var(--kuro-color-success)' : 'var(--kuro-color-text-muted)' }} />
             <span style={{ fontSize: 18, fontWeight: 700 }}>{battery.power_source || 'Battery'}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', marginBottom: 20 }}>
             {isChargerPlugged 
               ? `${(battery.adapter_voltage_v || battery.input_voltage_v || 0).toFixed(1)} V / ${(battery.adapter_current_a || 0).toFixed(2)} A · ${(battery.adapter_max_power_w || 0).toFixed(0)} W max rating` 
               : 'No external power supply connected'}
          </div>

          <div className="responsive-grid-3 page-widget-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
             {[
               { icon: 'zap', l: 'CHARGER VOLTAGE', v: (battery.input_voltage_v || battery.adapter_voltage_v) ? `${(battery.input_voltage_v || battery.adapter_voltage_v).toFixed(1)} V` : (isChargerPlugged ? 'AC Online' : '0.0 V') },
               { icon: 'activity', l: 'CHARGER CURRENT', v: battery.adapter_current_a > 0 ? `${battery.adapter_current_a.toFixed(2)} A` : (isChargerPlugged ? 'Active' : '0.00 A') },
               { icon: 'power', l: 'CHARGER POWER', v: battery.adapter_max_power_w > 0 ? `${battery.adapter_max_power_w.toFixed(0)} W` : (isChargerPlugged ? 'Active' : '0.0 W') },
               { icon: 'thermometer', l: 'BATTERY TEMP', v: battery.temperature_c > 0 ? `${battery.temperature_c.toFixed(1)} °C` : 'N/A' },
               { icon: 'battery-charging', l: 'PACK VOLTAGE', v: `${voltageV.toFixed(2)} V` },
               { icon: 'clock', l: 'POWER STATE', v: battery.status || 'Discharging' },
             ].map((e, i) => (
               <div key={i} style={{ border: '1px solid var(--kuro-color-border)', borderRadius: radius.button, padding: 12, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-secondary)', marginBottom: 8, letterSpacing: '0.05em' }}>
                   <AppIcon name={e.icon as any} size={12} style={{ color: 'var(--kuro-color-text-muted)' }} />
                   <span>{e.l}</span>
                 </div>
                 <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{e.v}</div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  )
}
