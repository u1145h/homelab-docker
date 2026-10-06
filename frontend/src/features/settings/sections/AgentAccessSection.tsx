import { Panel } from '@/components/ui/surface'
import { SettingRow } from '../components/SettingRow'
import { LegendRow } from '../components/LegendRow'
import { useSettings } from '../hooks/useSettings'
import { useStatus } from '@/hooks/useStatus'
import { radius } from '@/design/radius'

export function AgentAccessSection() {
  const { settings: serverSettings } = useSettings()
  const { data: status } = useStatus()
  
  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s'
    const days = Math.floor(seconds / (24 * 3600))
    const hours = Math.floor((seconds % (24 * 3600)) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  return (
    <>
      <Panel title="AGENT" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>backend process</span>} flush>
        <div style={{ margin: '16px 24px', fontSize: 11, color: 'var(--kuro-color-text-secondary)', padding: 12, backgroundColor: 'var(--kuro-color-surface-elevated)', borderRadius: radius.card, border: '1px solid var(--kuro-color-border)' }}>
          Agent networking and daemon settings are managed via the host system.
        </div>
        <SettingRow label="Docker socket" hint="Path to Docker daemon.">
          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{serverSettings?.docker?.socketPath ?? 'N/A'}</span>
        </SettingRow>
        <SettingRow label="App data directory" hint="Where poco-server stores state.">
          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{serverSettings?.dataDir ?? 'N/A'}</span>
        </SettingRow>
        <SettingRow label="Terminal shell" hint="Default shell spawned for web terminal sessions.">
          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{serverSettings?.terminal?.defaultShell ?? 'N/A'}</span>
        </SettingRow>
      </Panel>

      <Panel title="ACCESS" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>security</span>} flush>
        <SettingRow label="Active user" hint="The account you are currently logged in as.">
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{serverSettings?.username ?? 'admin'}</span>
        </SettingRow>
        <SettingRow label="API Token" hint="Used for programmatic access (CLI/API).">
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', backgroundColor: 'var(--kuro-color-surface-elevated)', padding: '4px 8px', borderRadius: radius.button, border: '1px solid var(--kuro-color-border)' }}>
              ••••••••••••••••
            </span>
            <button style={{ padding: '4px 12px', fontSize: 11, borderRadius: radius.button, border: '1px solid var(--kuro-color-border)', background: 'transparent', color: 'var(--kuro-color-text-primary)', cursor: 'pointer' }}>
              Rotate
            </button>
          </div>
        </SettingRow>
      </Panel>

      <Panel title="CONNECTION LEGEND" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>live status</span>}>
        <LegendRow label="Agent status" value="Online" color="var(--kuro-color-success)" />
        <LegendRow label="Host OS" value={status?.system?.os ?? 'Linux'} color="var(--kuro-color-info)" />
        <LegendRow label="Uptime" value={formatUptime(status?.system?.uptime ?? 0)} color="var(--kuro-color-accent)" />
      </Panel>
    </>
  )
}
