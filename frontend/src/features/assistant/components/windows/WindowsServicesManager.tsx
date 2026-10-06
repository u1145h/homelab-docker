import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, RefreshCw, Play, Square, RotateCw } from 'lucide-react'
import { radius } from '@/design/radius'
import { useSnackbar } from '@/hooks/useSnackbar'
import { getWindowsServices, controlWindowsService, type WindowsServiceItem } from '../../api/assistant'
import type { KuroNode } from '../../types'

interface WindowsServicesManagerProps {
  node?: KuroNode
  nodeId: string
}

export const WindowsServicesManager: React.FC<WindowsServicesManagerProps> = ({ nodeId }) => {
  const { showSnackbar } = useSnackbar()
  const [services, setServices] = useState<WindowsServiceItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Running' | 'Stopped'>('all')
  const [actingName, setActingName] = useState<string | null>(null)

  const fetchServices = useCallback(async () => {
    if (!nodeId) return
    setLoading(true)
    try {
      const res = await getWindowsServices(nodeId)
      setServices(res?.services || [])
    } catch (err: any) {
      showSnackbar(`Failed to load Windows services: ${err?.message || 'Offline'}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [nodeId, showSnackbar])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  const handleAction = async (svc: WindowsServiceItem, action: 'start' | 'stop' | 'restart') => {
    setActingName(svc.name)
    try {
      const res = await controlWindowsService(nodeId, svc.name, action)
      showSnackbar(`Service ${svc.name} is now ${res.status || action}`, 'success')
      setServices((prev) =>
        prev.map((s) => (s.name === svc.name ? { ...s, status: res.status || (action === 'start' ? 'Running' : 'Stopped') } : s))
      )
    } catch (err: any) {
      showSnackbar(`Failed to ${action} service: ${err?.message || 'Access Denied'}`, 'error')
    } finally {
      setActingName(null)
    }
  }

  const filtered = useMemo(() => {
    return services
      .filter((s) => {
        if (statusFilter !== 'all' && s.status !== statusFilter) return false
        return (
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.display_name.toLowerCase().includes(search.toLowerCase())
        )
      })
      .sort((a, b) => a.display_name.localeCompare(b.display_name))
  }, [services, search, statusFilter])

  const runningCount = useMemo(() => services.filter((s) => s.status === 'Running').length, [services])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Top Bar ── */}
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
            placeholder="Search Windows services by name or display name..."
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['all', 'Running', 'Stopped'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: radius.button,
                border: `1px solid ${statusFilter === st ? 'var(--kuro-color-accent, #a9b665)' : 'var(--kuro-color-border, rgba(255,255,255,0.1))'}`,
                backgroundColor: statusFilter === st ? 'rgba(169, 182, 101, 0.15)' : 'transparent',
                color: statusFilter === st ? 'var(--kuro-color-accent, #a9b665)' : 'var(--kuro-color-text-muted, #888)',
                cursor: 'pointer',
              }}
            >
              {st === 'all' ? `All (${services.length})` : st === 'Running' ? `Running (${runningCount})` : `Stopped (${services.length - runningCount})`}
            </button>
          ))}

          <button
            onClick={fetchServices}
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
            Refresh
          </button>
        </div>
      </div>

      {/* ── Services Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))',
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
            {loading ? 'Discovering Windows background services...' : 'No matching services found'}
          </div>
        ) : (
          filtered.map((svc) => {
            const isRunning = svc.status === 'Running'
            const isBusy = actingName === svc.name

            return (
              <div
                key={svc.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '12px 14px',
                  backgroundColor: 'var(--kuro-color-surface, #18191a)',
                  border: `1px solid ${isRunning ? 'rgba(16, 185, 129, 0.2)' : 'var(--kuro-color-border, rgba(255,255,255,0.07))'}`,
                  borderRadius: radius.card,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {svc.display_name || svc.name}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isRunning ? '#10b981' : '#f87171',
                        border: `1px solid ${isRunning ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      }}
                    >
                      {svc.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--kuro-font-mono, monospace)', color: 'var(--kuro-color-text-muted, #777)' }}>
                    {svc.name}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8 }}>
                  {isRunning ? (
                    <>
                      <button
                        onClick={() => handleAction(svc, 'restart')}
                        disabled={isBusy}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: radius.button,
                          color: '#60a5fa',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        <RotateCw size={11} className={isBusy ? 'spin' : ''} />
                        Restart
                      </button>
                      <button
                        onClick={() => handleAction(svc, 'stop')}
                        disabled={isBusy || !svc.can_stop}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: radius.button,
                          color: '#f87171',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        <Square size={11} />
                        Stop
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAction(svc, 'start')}
                      disabled={isBusy}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: radius.button,
                        color: '#10b981',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Play size={11} />
                      Start Service
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
