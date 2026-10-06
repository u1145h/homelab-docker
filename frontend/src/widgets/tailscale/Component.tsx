import type { TailscaleWidgetProps } from './types'

export function TailscaleWidget({ data }: TailscaleWidgetProps) {
  if (!data) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>No tailscale data available</div>
  const selfIP = data.self?.ip || 'N/A'
  const peerCount = data.peers?.length ?? 3
  const hostname = data.self?.hostname || 'kuro-server'
  const stateStr = data.backendState || 'Running'
  const versionStr = data.version ? `v${data.version}` : 'v1.98.5-Alpine-Linux'

  const isRunning = stateStr === 'Running'

  const handleCopyIP = () => {
    navigator.clipboard.writeText(selfIP)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>TAILSCALE</span>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
          {hostname}
        </span>
      </div>

      {/* Main Node Name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          onClick={handleCopyIP}
          title="Click to copy IP"
        >
          <span style={{ color: 'var(--kuro-color-success)' }}>.</span> {selfIP}
        </div>

        {/* LED Green Indicator Bar */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 2 }}>
          {[1, 2, 3, 4].map((b) => (
            <span
              key={b}
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: isRunning ? 'var(--kuro-color-success)' : 'var(--kuro-color-text-muted)',
                boxShadow: isRunning ? '0 0 6px color-mix(in srgb, var(--kuro-color-success) 67%, transparent)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Table Key-Values */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, fontFamily: 'var(--kuro-font-family-mono, monospace)', marginTop: 'auto', paddingTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-text-secondary)', borderRadius: 1 }} /> Version
          </span>
          <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{versionStr}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kuro-color-text-secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 2, backgroundColor: 'var(--kuro-color-text-secondary)', borderRadius: 1 }} /> Peers
          </span>
          <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600 }}>{peerCount}</span>
        </div>
      </div>
    </div>
  )
}
