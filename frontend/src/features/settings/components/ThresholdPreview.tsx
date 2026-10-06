import { useStatus } from '@/hooks/useStatus'
import { AppIcon } from '@/components/ui/icons'
import type { UserPreferences } from '../types'

interface PreviewRow {
  label: string
  icon: string
  getValue: (status: any) => number
  threshold: number
  maxValue?: number
}

interface ThresholdPreviewProps {
  prefs: UserPreferences
}

function Meter({ value, threshold, maxValue = 100 }: { value: number, threshold: number, maxValue?: number }) {
  const pct = Math.min(100, (value / maxValue) * 100)
  const overThreshold = value >= threshold
  const color = overThreshold ? 'var(--kuro-color-danger)' : 'var(--kuro-color-accent)'
  return (
    <div style={{ flex: 1, minWidth: 60, maxWidth: 120, height: 4, backgroundColor: 'var(--kuro-color-border)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, transition: 'width 300ms, background-color 300ms' }} />
    </div>
  )
}

export function ThresholdPreview({ prefs }: ThresholdPreviewProps) {
  const { data: status } = useStatus()

  const rows: PreviewRow[] = [
    {
      label: 'CPU',
      icon: 'cpu',
      getValue: (s) => s?.cpu?.usage_percent ?? 0,
      threshold: prefs.cpu_warn,
    },
    {
      label: 'Memory',
      icon: 'hard-drive',
      getValue: (s) => s?.memory?.usage_percent ?? 0,
      threshold: prefs.mem_warn,
    },
    {
      label: 'Root filesystem',
      icon: 'hard-drive',
      getValue: (s) => s?.storage?.mounts?.find((m: any) => m.mount === '/')?.usage_percent ?? 0,
      threshold: prefs.fs_warn,
    },
    {
      label: 'Package temp',
      icon: 'thermometer',
      getValue: (s) => {
        const cpuZone = s?.thermal?.zones?.find((z: any) => z.name?.toLowerCase().includes('cpu'))
        return cpuZone?.temperature_c ?? 0
      },
      threshold: prefs.temp_warn,
      maxValue: 110,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((row) => {
        const value = row.getValue(status)
        const maxValue = row.maxValue ?? 100
        const threshold = row.threshold
        const overThreshold = value >= threshold
        return (
          <div key={row.label} className="threshold-row">
            <span style={{ display: 'flex', alignItems: 'center', width: 20, flexShrink: 0 }}>
              <AppIcon name={row.icon as any} size={14} style={{ color: 'var(--kuro-color-text-muted)' }} />
            </span>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-primary)', flex: 1, minWidth: 60 }}>{row.label}</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: overThreshold ? 'var(--kuro-color-danger)' : 'var(--kuro-color-text-primary)', minWidth: 60, textAlign: 'right' }}>
              {value.toFixed(0)}{row.maxValue ? ' °C' : '%'}
              <span style={{ color: 'var(--kuro-color-text-muted)' }}> / {threshold}{row.maxValue ? ' °C' : '%'}</span>
            </span>
            <Meter value={value} threshold={threshold} maxValue={maxValue} />
          </div>
        )
      })}
    </div>
  )
}
