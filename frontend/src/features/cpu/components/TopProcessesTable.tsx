import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import type { Process } from '@/types/status'
import { radius } from '@/design/radius'

interface TopProcessesTableProps {
  processes: Process[]
  title?: string
  hideUserColumn?: boolean
}

const DEFAULT_PROCESSES: Process[] = [
  { pid: '1287', command: 'plex-media-server', user: 'plex', cpu: 12.4, memory: 4.8, threads: 22, time: '1:22:41' },
  { pid: '4021', command: 'immich-server', user: 'immich', cpu: 8.9, memory: 6.1, threads: 18, time: '0:47:12' },
  { pid: '902', command: 'postgres', user: 'postgres', cpu: 6.2, memory: 3.4, threads: 14, time: '1:48:03' },
  { pid: '331', command: 'dockerd', user: 'root', cpu: 4.1, memory: 2.2, threads: 32, time: '1:51:22' },
  { pid: '2211', command: 'node /vaultwarden', user: 'vault', cpu: 3.6, memory: 1.8, threads: 8, time: '1:50:12' },
  { pid: '5540', command: 'home-assistant', user: 'hass', cpu: 3.1, memory: 5.2, threads: 24, time: '1:50:01' },
  { pid: '88', command: 'systemd-journald', user: 'root', cpu: 1.2, memory: 0.4, threads: 4, time: '1:52:41' },
  { pid: '6712', command: 'nginx: worker', user: 'www-data', cpu: 0.9, memory: 0.3, threads: 2, time: '0:32:18' },
  { pid: '122', command: 'kswapd0', user: 'root', cpu: 0.6, memory: 0.0, threads: 1, time: '1:52:41' },
  { pid: '421', command: 'tailscaled', user: 'root', cpu: 0.4, memory: 0.6, threads: 6, time: '1:52:12' },
]

export default function TopProcessesTable({ processes, title = 'TOP PROCESSES', hideUserColumn = false }: TopProcessesTableProps) {
  const [search, setSearch] = useState('')

  const activeProcesses = processes && processes.length > 0 ? processes : DEFAULT_PROCESSES

  const filtered = useMemo(() => {
    if (!search.trim()) return activeProcesses
    const q = search.toLowerCase()
    return activeProcesses.filter(
      (p) =>
        p.command.toLowerCase().includes(q) ||
        p.user.toLowerCase().includes(q) ||
        p.pid.toString().includes(q)
    )
  }, [activeProcesses, search])

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '18px 20px 14px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
          {title}
        </span>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
          {filtered.length} of {activeProcesses.length}
        </span>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: 12, width: '100%' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--kuro-color-text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, user or PID"
          style={{
            width: '100%',
            height: 32,
            padding: '6px 12px 6px 32px',
            fontSize: 11,
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.input,
            color: 'var(--kuro-color-text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Table Container */}
      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 500 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', borderBottom: '1px solid var(--kuro-color-border)' }}>
                PID
              </th>
              <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', borderBottom: '1px solid var(--kuro-color-border)' }}>
                PROCESS
              </th>
              {!hideUserColumn && (
                <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', borderBottom: '1px solid var(--kuro-color-border)' }}>
                  USER
                </th>
              )}
              <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', borderBottom: '1px solid var(--kuro-color-border)', textAlign: 'right' }}>
                CPU%
              </th>
              <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', borderBottom: '1px solid var(--kuro-color-border)', textAlign: 'right' }}>
                MEM%
              </th>
              <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', borderBottom: '1px solid var(--kuro-color-border)', textAlign: 'right' }}>
                THREADS
              </th>
              <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', borderBottom: '1px solid var(--kuro-color-border)', textAlign: 'right' }}>
                TIME
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={hideUserColumn ? 6 : 7} style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                  No matching processes
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr
                  key={`${p.pid}-${i}`}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                    {p.pid}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>
                    {p.command}
                  </td>
                  {!hideUserColumn && (
                    <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                      {p.user}
                    </td>
                  )}
                  <td style={{ padding: '8px 10px', fontSize: 11, color: p.cpu > 0 ? '#A9B665' : 'var(--kuro-color-text-primary)', fontWeight: 600, textAlign: 'right', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                    {p.cpu.toFixed(1)}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--kuro-color-text-primary)', textAlign: 'right', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                    {p.memory.toFixed(1)}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--kuro-color-text-muted)', textAlign: 'right', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                    {p.threads}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--kuro-color-text-muted)', textAlign: 'right', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                    {p.time}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
