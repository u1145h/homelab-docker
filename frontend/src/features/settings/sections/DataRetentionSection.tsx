import { Panel } from '@/components/ui/surface'
import { SettingRow } from '../components/SettingRow'
import { LegendRow } from '../components/LegendRow'
import { useSettings } from '../hooks/useSettings'
import { useStatus } from '@/hooks/useStatus'
import { radius } from '@/design/radius'

export function DataRetentionSection() {
  const { settings: serverSettings } = useSettings()
  const { data: status } = useStatus()

  // Calculate some fake/real usage for the UI meter
  const metricsUsage = (status as any)?.history?.size_bytes ?? 0
  const auditUsage = 0 // Not available in status yet
  const totalDisk = status?.storage?.mounts?.find((m: any) => m.mount === '/')?.total ?? 1
  const freeDisk = status?.storage?.mounts?.find((m: any) => m.mount === '/')?.available ?? 1

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <>
      <Panel title="METRIC STORAGE" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>backend config</span>} flush>
        <div style={{ margin: '16px 24px', fontSize: 11, color: 'var(--kuro-color-text-secondary)', padding: 12, backgroundColor: 'var(--kuro-color-surface-elevated)', borderRadius: radius.card, border: '1px solid var(--kuro-color-border)' }}>
          Data retention policies are currently managed via server environment variables.
        </div>
        <SettingRow label="Sampling interval" hint="How often the backend saves metric snapshots.">
          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{serverSettings?.history?.samplingInterval ?? 'N/A'}</span>
        </SettingRow>
        <SettingRow label="Retention period" hint="How long to keep historical data.">
          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{serverSettings?.history?.retentionPeriod ?? 'N/A'}</span>
        </SettingRow>
        <SettingRow label="Database path" hint="Where SQLite metrics are stored.">
          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{serverSettings?.history?.dbPath ?? 'N/A'}</span>
        </SettingRow>
      </Panel>

      <Panel title="STORAGE USAGE" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>app data</span>}>
        <div style={{ width: '100%', height: 8, backgroundColor: 'var(--kuro-color-border)', borderRadius: radius.badge, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
          <div style={{ width: `${(metricsUsage / totalDisk) * 100}%`, backgroundColor: 'var(--kuro-color-accent)', minWidth: 2 }} />
          <div style={{ width: `${(auditUsage / totalDisk) * 100}%`, backgroundColor: 'var(--kuro-color-warning)', minWidth: 0 }} />
        </div>
        <LegendRow label="Metrics (SQLite)" value={formatBytes(metricsUsage)} color="var(--kuro-color-accent)" />
        <LegendRow label="Audit logs" value={formatBytes(auditUsage)} color="var(--kuro-color-warning)" />
        <LegendRow label="Free disk space" value={formatBytes(freeDisk)} color="var(--kuro-color-border)" />
      </Panel>
    </>
  )
}
