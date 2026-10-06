import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { radius } from '@/design/radius'
import { useSnackbar } from '@/hooks/useSnackbar'
import { getWindowsProcesses, killWindowsProcess, type WindowsProcessItem } from '../../api/assistant'
import type { KuroNode } from '../../types'

interface WindowsProcessManagerProps {
  node?: KuroNode
  nodeId: string
}

export const WindowsProcessManager: React.FC<WindowsProcessManagerProps> = ({ nodeId }) => {
  const { showSnackbar } = useSnackbar()
  const [processes, setProcesses] = useState<WindowsProcessItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const [killingPid, setKillingPid] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'ram' | 'name' | 'pid'>('ram')
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  const fetchProcesses = useCallback(async () => {
    if (!nodeId) return
    setLoading(true)
    try {
      const res = await getWindowsProcesses(nodeId)
      setProcesses(res?.processes || [])
    } catch (err: any) {
      showSnackbar(`Failed to load processes: ${err?.message || 'Offline'}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [nodeId, showSnackbar])

  useEffect(() => {
    fetchProcesses()
  }, [fetchProcesses])

  const handleKill = async (proc: WindowsProcessItem) => {
    if (!confirm(`Are you sure you want to terminate ${proc.name} (PID ${proc.pid})?`)) return
    setKillingPid(proc.pid)
    try {
      await killWindowsProcess(nodeId, proc.pid)
      showSnackbar(`Terminated process ${proc.name} (PID ${proc.pid})`, 'success')
      setProcesses((prev) => prev.filter((p) => p.pid !== proc.pid))
    } catch (err: any) {
      showSnackbar(`Failed to kill process: ${err?.message || 'Access Denied'}`, 'error')
    } finally {
      setKillingPid(null)
    }
  }

  const filtered = useMemo(() => {
    return processes
      .filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.pid.toString().includes(search)
      )
      .sort((a, b) => {
        let diff = 0
        if (sortBy === 'ram') diff = b.ram_mb - a.ram_mb
        else if (sortBy === 'name') diff = a.name.localeCompare(b.name)
        else if (sortBy === 'pid') diff = a.pid - b.pid
        return sortAsc ? -diff : diff
      })
  }, [processes, search, sortBy, sortAsc])

  const totalRamUsed = useMemo(() => {
    return Math.round(processes.reduce((acc, p) => acc + p.ram_mb, 0))
  }, [processes])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Top Summary & Search Bar ── */}
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
            placeholder="Search processes by name, window title, or PID..."
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
            <span style={{ color: 'var(--kuro-color-accent, #a9b665)', fontWeight: 600 }}>{filtered.length}</span> active (
            <span style={{ color: '#60a5fa' }}>{totalRamUsed} MB</span> allocated)
          </div>

          <button
            onClick={fetchProcesses}
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

      {/* ── Processes Table ── */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface, #18191a)',
          border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
          borderRadius: radius.card,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 2fr 3fr 120px 100px 90px',
            padding: '10px 16px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--kuro-color-text-muted, #888)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <div
            onClick={() => {
              if (sortBy === 'pid') setSortAsc(!sortAsc)
              else { setSortBy('pid'); setSortAsc(false) }
            }}
            style={{ cursor: 'pointer' }}
          >
            PID {sortBy === 'pid' ? (sortAsc ? '↑' : '↓') : ''}
          </div>
          <div
            onClick={() => {
              if (sortBy === 'name') setSortAsc(!sortAsc)
              else { setSortBy('name'); setSortAsc(false) }
            }}
            style={{ cursor: 'pointer' }}
          >
            Process Name {sortBy === 'name' ? (sortAsc ? '↑' : '↓') : ''}
          </div>
          <div>Window Title</div>
          <div
            onClick={() => {
              if (sortBy === 'ram') setSortAsc(!sortAsc)
              else { setSortBy('ram'); setSortAsc(false) }
            }}
            style={{ cursor: 'pointer', textAlign: 'right' }}
          >
            Memory {sortBy === 'ram' ? (sortAsc ? '↑' : '↓') : ''}
          </div>
          <div style={{ textAlign: 'center' }}>Threads</div>
          <div style={{ textAlign: 'center' }}>Action</div>
        </div>

        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--kuro-color-text-muted, #888)', fontSize: 13 }}>
              {loading ? 'Scanning running processes...' : 'No matching processes found'}
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.pid}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 2fr 3fr 120px 100px 90px',
                  alignItems: 'center',
                  padding: '9px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  fontSize: 12,
                  fontFamily: 'var(--kuro-font-mono, monospace)',
                  transition: 'background-color 120ms',
                }}
              >
                <div style={{ color: 'var(--kuro-color-text-muted, #777)' }}>#{p.pid}</div>
                <div style={{ color: 'var(--kuro-color-text-primary, #fff)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}.exe
                </div>
                <div style={{ color: 'var(--kuro-color-text-secondary, #aaa)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title || '—'}
                </div>
                <div style={{ textAlign: 'right', color: p.ram_mb > 500 ? '#f87171' : p.ram_mb > 150 ? '#fbbf24' : '#a9b665', fontWeight: 600 }}>
                  {p.ram_mb.toFixed(1)} MB
                </div>
                <div style={{ textAlign: 'center', color: 'var(--kuro-color-text-muted, #888)' }}>{p.threads}</div>
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => handleKill(p)}
                    disabled={killingPid === p.pid}
                    title="End Task"
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: radius.button,
                      color: '#f87171',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {killingPid === p.pid ? 'Killing...' : 'End Task'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
