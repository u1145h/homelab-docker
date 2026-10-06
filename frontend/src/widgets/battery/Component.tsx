import { ArcGauge } from '@/widgets/shared/ArcGauge'
import { WaveChart } from '@/widgets/shared/WaveChart'
import { useMetricHistory } from '@/hooks/useMetricHistory'
import type { BatteryWidgetProps } from './types'

function getBatteryTimeInfo(data: any): { label: string; value: string } {
  if (!data || data.present === false) {
    return { label: 'Time', value: 'N/A' }
  }

  const capacity = data.capacity ?? 0
  const statusLower = (data.status || '').toLowerCase()
  const isFull = capacity >= 100 || statusLower === 'full'
  const isCharging = statusLower === 'charging' || (data.power_source && data.power_source !== 'Battery') || (data.adapter_max_power_w || 0) > 0

  if (isFull) {
    return { label: 'Time', value: 'Battery fully Charged' }
  }

  if (isCharging) {
    let minsToFull = data.time_to_full_min
    if (!minsToFull || minsToFull <= 0) {
      const powerW = (data.power_mw || 0) / 1000
      const remainingWh = data.remaining_capacity_wh || ((capacity / 100) * (data.design_capacity_wh || 17.5))
      const neededWh = Math.max(0, (data.full_capacity_wh || data.design_capacity_wh || 17.5) - remainingWh)
      const inputWEstimate = data.adapter_max_power_w || (data.input_voltage_v * data.adapter_current_a) || 45
      const netChargeW = Math.max(5, inputWEstimate - powerW)
      if (neededWh > 0 && netChargeW > 0) {
        minsToFull = Math.round((neededWh / netChargeW) * 60)
      }
    }

    if (minsToFull && minsToFull > 0) {
      const h = Math.floor(minsToFull / 60)
      const m = minsToFull % 60
      const formatted = h > 0 ? `${h}h ${m}m` : `${m}m`
      return { label: 'Time to Charge', value: formatted }
    }
    return { label: 'Time to Charge', value: 'Charging' }
  } else {
    let minsLeft = data.runtime_left_min
    const powerW = (data.power_mw || 0) / 1000
    if (!minsLeft || minsLeft <= 0) {
      const remainingWh = data.remaining_capacity_wh || ((capacity / 100) * (data.design_capacity_wh || 17.5))
      if (remainingWh > 0 && powerW > 0) {
        minsLeft = Math.round((remainingWh / powerW) * 60)
      }
    }

    if (minsLeft && minsLeft > 0) {
      const h = Math.floor(minsLeft / 60)
      const m = minsLeft % 60
      const formatted = h > 0 ? `${h}h ${m}m` : `${m}m`
      return { label: 'Time Left', value: formatted }
    }
    return { label: 'Time Left', value: 'Discharging' }
  }
}

export function BatteryWidget({ data }: BatteryWidgetProps) {
  if (!data) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>No battery data available</div>
  const isPresent = data?.present ?? true
  const capacity = isPresent ? (data.capacity ?? 0) : 0
  const tech = isPresent ? (data.technology || 'Li-Ion') : 'Li-Ion'
  const isCharging = data?.status === 'Charging' || data?.status === 'Full' || (data?.power_source && data?.power_source !== 'Battery')
  
  const powerW = data?.power_mw ? (data.power_mw / 1000) : (data?.soc_power_w || 0)
  const powerDrawStr = `${powerW.toFixed(1)} W`
  const timeInfo = getBatteryTimeInfo(data)

  const batteryHistory = useMetricHistory(capacity)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>BATTERY</span>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
          {tech}
        </span>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <ArcGauge
          value={capacity}
          label="CHARGE"
          valueDisplay={`${capacity}%`}
          color="var(--kuro-color-success)"
          size={118}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <WaveChart color="var(--kuro-color-success)" height={36} dataPoints={batteryHistory} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8E919C' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: isCharging ? 'var(--kuro-color-success)' : 'var(--kuro-color-danger)', borderRadius: 1 }} /> Charger
              </span>
              <span style={{ color: isCharging ? 'var(--kuro-color-success)' : 'var(--kuro-color-danger)', fontWeight: 600 }}>{isCharging ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-success)', opacity: 0.6, borderRadius: 1 }} /> Power Draw
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{powerDrawStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-success)', opacity: 0.4, borderRadius: 1 }} /> {timeInfo.label}
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timeInfo.value}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
