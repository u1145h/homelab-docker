import { ArcGauge } from '@/widgets/shared/ArcGauge'
import { WaveChart } from '@/widgets/shared/WaveChart'
import { useMetricHistory } from '@/hooks/useMetricHistory'
import type { StorageWidgetProps } from './types'

function formatGB(bytes: number): string {
  const v = typeof bytes === 'number' && !isNaN(bytes) ? bytes : 0
  return (v / 1024 / 1024 / 1024).toFixed(1)
}

export function StorageWidget({ data }: StorageWidgetProps) {
  if (!data) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>No storage data available</div>

  let used = 0
  let total = 0
  let available = 0
  let usage_percent = 0

  if (data.summary && data.summary.total_capacity > 0) {
    total = data.summary.total_capacity
    used = data.summary.used
    available = data.summary.free
    usage_percent = total > 0 ? (used / total) * 100 : 0
  } else if (data.mounts && data.mounts.length > 0) {
    const root = data.mounts.find((m) => m.mount === '/' && m.total > 0) ?? data.mounts.find((m) => m.total > 0) ?? data.mounts[0]
    if (root) {
      used = root.used
      total = root.total
      available = root.available
      usage_percent = root.usage_percent
    }
  }

  if (total === 0 && (!data.mounts || data.mounts.length === 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>
        No storage data available
      </div>
    )
  }

  const usedGB = formatGB(used)
  const totalGB = formatGB(total)
  const freeGB = formatGB(available)

  const storageHistory = useMetricHistory(usage_percent)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%' }}>
      {/* Header Line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>STORAGE</span>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
          {usedGB} GB used • {totalGB} GB total
        </span>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <ArcGauge
          value={usage_percent}
          label="USED"
          valueDisplay={`${Math.round(usage_percent)}%`}
          color="var(--kuro-color-warning)"
          size={118}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <WaveChart color="var(--kuro-color-warning)" height={36} dataPoints={storageHistory} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-warning)', borderRadius: 1 }} /> Free
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{freeGB} GB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-warning)', opacity: 0.6, borderRadius: 1 }} /> Used
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{usedGB} GB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-warning)', opacity: 0.4, borderRadius: 1 }} /> Total
              </span>
              <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{totalGB} GB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
