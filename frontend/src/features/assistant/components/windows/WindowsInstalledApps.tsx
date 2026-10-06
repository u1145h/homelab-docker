import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, RefreshCw, Package } from 'lucide-react'
import { radius } from '@/design/radius'
import { useSnackbar } from '@/hooks/useSnackbar'
import { getWindowsInstalledApps, type WindowsAppItem } from '../../api/assistant'
import type { KuroNode } from '../../types'

interface WindowsInstalledAppsProps {
  node?: KuroNode
  nodeId: string
}

export const WindowsInstalledApps: React.FC<WindowsInstalledAppsProps> = ({ nodeId }) => {
  const { showSnackbar } = useSnackbar()
  const [apps, setApps] = useState<WindowsAppItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')

  const fetchApps = useCallback(async () => {
    if (!nodeId) return
    setLoading(true)
    try {
      const res = await getWindowsInstalledApps(nodeId)
      setApps(res?.apps || [])
    } catch (err: any) {
      showSnackbar(`Failed to load installed applications: ${err?.message || 'Offline'}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [nodeId, showSnackbar])

  useEffect(() => {
    fetchApps()
  }, [fetchApps])

  const filtered = useMemo(() => {
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.publisher.toLowerCase().includes(search.toLowerCase()) ||
        a.version.toLowerCase().includes(search.toLowerCase())
    )
  }, [apps, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Search & Metrics Bar ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          backgroundColor: 'var(--kuro-color-surface, #18191a)',
          border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
          borderRadius: radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <Search size={16} color="var(--kuro-color-text-muted, #888)" />
          <input
            type="text"
            placeholder="Search installed software by name or publisher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--kuro-color-text-primary, #fff)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--kuro-color-text-muted, #888)' }}>
            <span style={{ color: 'var(--kuro-color-accent, #a9b665)', fontWeight: 600 }}>{filtered.length}</span> / {apps.length} applications cataloged
          </div>

          <button
            onClick={fetchApps}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
              borderRadius: radius.button,
              color: 'var(--kuro-color-text-primary, #fff)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Scan Software
          </button>
        </div>
      </div>

      {/* ── Apps Table ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
          gap: 12,
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '40px 16px',
              textAlign: 'center',
              backgroundColor: 'var(--kuro-color-surface, #18191a)',
              borderRadius: radius.card,
              color: 'var(--kuro-color-text-muted, #888)',
            }}
          >
            {loading ? 'Scanning registry and Windows Store packages...' : 'No matching applications found'}
          </div>
        ) : (
          filtered.map((app, idx) => (
            <div
              key={`${app.name}-${idx}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 8,
                padding: '12px 14px',
                backgroundColor: 'var(--kuro-color-surface, #18191a)',
                border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.07))',
                borderRadius: radius.card,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: 'rgba(169, 182, 101, 0.1)',
                    color: 'var(--kuro-color-accent, #a9b665)',
                    flexShrink: 0,
                  }}
                >
                  <Package size={18} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {app.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary, #aaa)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {app.publisher || 'Unknown Publisher'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  paddingTop: 8,
                  fontSize: 11,
                  fontFamily: 'var(--kuro-font-mono, monospace)',
                  color: 'var(--kuro-color-text-muted, #777)',
                }}
              >
                <span>v{app.version || '1.0'}</span>
                {app.install_date ? <span>Installed: {app.install_date}</span> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
