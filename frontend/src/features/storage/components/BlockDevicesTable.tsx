import { useState } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { formatBytes } from '@/utils/format'
import type { StorageBlockDevice } from '@/types/status'
import { radius } from '@/design/radius'

interface BlockDevicesTableProps {
  devices: StorageBlockDevice[]
  onRefresh?: () => void
}

export default function BlockDevicesTable({ devices, onRefresh }: BlockDevicesTableProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setTimeout(() => setIsRefreshing(false), 500)
      }
    }
  }

  return (
    <div style={{
      backgroundColor: 'var(--kuro-color-surface)',
      border: '1px solid var(--kuro-color-border)',
      borderRadius: radius.card,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%'
    }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--kuro-color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
            Block Devices
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
              {devices.length} devices
            </span>
            {onRefresh && (
              <button
                onClick={handleRefresh}
                title="Scan for connected external drives"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--kuro-color-border)',
                  borderRadius: radius.button,
                  padding: '5px 9px',
                  color: 'var(--kuro-color-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  transition: 'all 200ms ease'
                }}
              >
                <AppIcon
                  name="refresh-cw"
                  size={12}
                  style={{
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                  }}
                />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 11 }}>
          <thead>
            <tr style={{ color: 'var(--kuro-color-text-muted)', borderBottom: '1px solid var(--kuro-color-border)' }}>
              <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>DEVICE</th>
              <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>MODEL</th>
              <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SIZE</th>
              <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TEMP</th>
              <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>I/O (R / W)</th>
              <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>HEALTH</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--kuro-color-border)', color: 'var(--kuro-color-text-primary)' }}>
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ color: 'var(--kuro-color-text-secondary)', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: radius.button }}>
                      <AppIcon name="hard-drive" size={12} />
                    </div>
                    {device.device}
                  </div>
                </td>
                <td style={{ padding: '12px 20px', color: 'var(--kuro-color-text-secondary)' }}>{device.model}</td>
                <td style={{ padding: '12px 20px' }}>{formatBytes(device.size)}</td>
                <td style={{ padding: '12px 20px', color: 'var(--kuro-color-text-secondary)' }}>{device.temp}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{ color: 'var(--kuro-color-success)' }}>{formatBytes(device.read)}</span> <span style={{ color: 'var(--kuro-color-text-muted)' }}>/</span> <span style={{ color: 'var(--kuro-color-danger)' }}>{formatBytes(device.write)}</span>
                </td>
                <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 8px',
                    borderRadius: radius.badge,
                    border: '1px solid color-mix(in srgb, var(--kuro-color-success) 30%, transparent)',
                    color: 'var(--kuro-color-success)',
                    fontSize: 11,
                    textTransform: 'capitalize'
                  }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--kuro-color-success)' }} />
                    {device.health}
                  </div>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--kuro-color-text-muted)' }}>
                  No result found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
