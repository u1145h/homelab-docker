import type { NetworkInterface } from '@/types/status'
import { AppIcon } from '@/components/ui/icons'
import { formatBytes } from '@/utils/format'
import { radius } from '@/design/radius'

interface InterfacesTableProps {
  interfaces: NetworkInterface[]
}

export default function InterfacesTable({ interfaces }: InterfacesTableProps) {
  return (
    <div style={{ backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card, padding: '20px 0', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 24px 16px 24px' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>INTERFACES</h3>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>{interfaces.filter(i => i.up).length} / {interfaces.length} up</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
          <thead>
            <tr style={{ color: 'var(--kuro-color-text-secondary)', fontSize: 11, letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 24px', fontWeight: 600 }}>INTERFACE</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATUS</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>IP</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>MAC</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>SPEED</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>RX</th>
              <th style={{ padding: '12px 24px', fontWeight: 600 }}>TX</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: 11 }}>
            {interfaces.map((iface, i) => {
              const primaryIP = iface.addresses && iface.addresses.length > 0 
                ? iface.addresses.filter(a => !a.includes('::'))[0] // prefer IPv4
                : null
              const ipStr = primaryIP ? primaryIP.split('/')[0] : '--'

              let icon = 'hard-drive'
              if (iface.name.startsWith('wlan') || iface.name.startsWith('wlp')) icon = 'wifi'
              if (iface.name.startsWith('docker') || iface.name.startsWith('br-')) icon = 'box'
              if (iface.name.startsWith('tailscale')) icon = 'globe'
              if (iface.name === 'lo') icon = 'refresh-cw'

              return (
                <tr key={i} style={{ 
                  borderTop: '1px solid var(--kuro-color-border)',
                  backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)'
                }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        backgroundColor: 'var(--kuro-color-surface-hover)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--kuro-color-text-secondary)'
                      }}>
                        <AppIcon name={icon as any} size={14} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{iface.name}</span>
                        {iface.ssid && <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>{iface.ssid}</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: iface.up ? '#4CAF50' : '#F44336' }}>
                      <AppIcon name={iface.up ? 'arrow-up-circle' : 'arrow-down-circle'} size={14} />
                      {iface.up ? 'up' : 'down'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 16px', color: 'var(--kuro-color-text-secondary)', fontFamily: 'monospace' }}>{ipStr}</td>
                  <td style={{ padding: '16px 16px', color: 'var(--kuro-color-text-secondary)', fontFamily: 'monospace' }}>{iface.mac || '--'}</td>
                  <td style={{ padding: '16px 16px', color: 'var(--kuro-color-text-secondary)' }}>
                    {iface.up && iface.mtu ? `MTU ${iface.mtu}` : '--'}
                  </td>
                  <td style={{ padding: '16px 16px', color: 'var(--kuro-color-text-secondary)' }}>{formatBytes(iface.rx_bytes)}</td>
                  <td style={{ padding: '16px 24px', color: 'var(--kuro-color-text-secondary)' }}>{formatBytes(iface.tx_bytes)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
