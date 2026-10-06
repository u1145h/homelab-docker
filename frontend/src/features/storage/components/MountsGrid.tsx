import { useState, useMemo } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { formatBytes } from '@/utils/format'
import type { StorageMount } from '@/types/status'
import { radius } from '@/design/radius'

interface MountsGridProps {
  mounts: StorageMount[]
}

function getPillStyle(type: string) {
  switch (type) {
    case 'root':
      return { color: 'var(--kuro-color-warning)', label: 'ROOT' }
    case 'boot':
      return { color: 'var(--kuro-color-info)', label: 'BOOT' }
    case 'user':
      return { color: 'var(--kuro-color-danger)', label: 'USER' }
    default:
      return { color: 'var(--kuro-color-text-secondary)', label: 'VIRTUAL' }
  }
}

export default function MountsGrid({ mounts }: MountsGridProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'All' | 'Physical' | 'Virtual'>('Physical')

  const filteredMounts = useMemo(() => {
    return mounts.filter(m => {
      if (filter === 'Physical' && m.type === 'virtual') return false
      if (filter === 'Virtual' && m.type !== 'virtual') return false
      if (search) {
        const q = search.toLowerCase()
        if (!m.mount.toLowerCase().includes(q) && !m.device.toLowerCase().includes(q) && !m.filesystem.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [mounts, search, filter])

  return (
    <div style={{
      backgroundColor: 'var(--kuro-color-surface)',
      border: '1px solid var(--kuro-color-border)',
      borderRadius: radius.card,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--kuro-color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>Mounted Filesystems</h3>
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>{filteredMounts.length} of {mounts.length}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.input,
            padding: '8px 12px',
            gap: '8px'
          }}>
            <AppIcon name="search" size={14} style={{ color: 'var(--kuro-color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search mounts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--kuro-color-text-primary)',
                fontSize: 11,
                width: '100%'
              }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['All', 'Physical', 'Virtual'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? 'var(--kuro-color-border)' : 'transparent',
                  color: filter === f ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-secondary)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: radius.button,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Body */}
      {filteredMounts.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>
          No result found
        </div>
      ) : (
        <div className="responsive-grid-3" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {filteredMounts.map((mount, i) => {
            const pill = getPillStyle(mount.type)
            const usagePercent = mount.total > 0 ? ((mount.used / mount.total) * 100).toFixed(0) : '0'

            return (
              <div key={i} style={{
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.card,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginBottom: '4px' }}>
                      {mount.total > 0 ? formatBytes(mount.used) : '0 B'} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-muted)' }}>/ {formatBytes(mount.total)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                      {mount.mount}
                    </div>
                  </div>
                  <div style={{
                    border: `1px solid color-mix(in srgb, ${pill.color} 30%, transparent)`,
                    color: pill.color,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: radius.badge,
                    backgroundColor: `color-mix(in srgb, ${pill.color} 10%, transparent)`,
                    letterSpacing: '0.05em'
                  }}>
                    {pill.label}
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div style={{ height: '4px', backgroundColor: 'var(--kuro-color-border)', borderRadius: radius.badge, overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: `${usagePercent}%`, height: '100%', backgroundColor: pill.color }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                    {usagePercent}%
                  </div>
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', gap: '16px', fontSize: 11 }}>
                  <div>
                    <span style={{ color: 'var(--kuro-color-text-muted)' }}>device</span> <span style={{ color: 'var(--kuro-color-text-primary)' }}>{mount.device}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--kuro-color-text-muted)' }}>fs</span> <span style={{ color: 'var(--kuro-color-text-primary)' }}>{mount.filesystem}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
