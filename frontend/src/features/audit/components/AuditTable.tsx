import { useState, useMemo } from 'react'
import type { AuditEntry } from '../types'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import { useShell } from '@/components/shell/shellContext'
import { formatDateTime } from '@/utils/format'

interface AuditTableProps {
  entries: AuditEntry[]
}

function getActionStyle(action: string) {
  const lower = action.toLowerCase()
  if (lower.includes('create') && lower.includes('user')) {
    return { icon: 'user-plus', topIcon: 'user', color: '#81C784' }
  }
  if (lower.includes('login')) {
    if (lower.includes('fail')) {
      return { icon: 'alert-triangle', topIcon: 'alert-triangle', color: '#E57373' }
    }
    return { icon: 'log-in', topIcon: 'log-in', color: '#81C784' }
  }
  if (lower.includes('timeout')) {
    return { icon: 'clock', topIcon: 'clock', color: '#FABD2F' }
  }
  if (lower.includes('logout') || lower.includes('close')) {
    return { icon: 'log-out', topIcon: 'log-out', color: '#8EC07C' }
  }
  if (lower.includes('open') || lower.includes('session')) {
    return { icon: 'activity', topIcon: 'activity', color: '#83A598' }
  }
  if (lower.includes('settings') || lower.includes('update')) {
    return { icon: 'settings', topIcon: 'settings', color: '#FF8A65' }
  }
  if (lower.includes('password') || lower.includes('key')) {
    return { icon: 'key', topIcon: 'key', color: '#BA68C8' }
  }
  if (lower.includes('delete') || lower.includes('fail')) {
    return { icon: 'alert-triangle', topIcon: 'alert-triangle', color: '#E57373' }
  }
  return { icon: 'activity', topIcon: 'activity', color: 'var(--kuro-color-info)' }
}

function getActionLabel(action: string) {
  if (action === 'user.create') return 'Create User'
  if (action === 'auth.login') return 'Login'
  if (action === 'auth.failed_login' || action === 'auth.login.failed') return 'Failed Login'
  if (action === 'settings.update') return 'Update Settings'
  if (action === 'auth.password_reset') return 'Password Reset'
  if (action === 'session.open') return 'Open Session'
  if (action === 'session.close') return 'Close Session'
  if (action === 'session.timeout') return 'Timeout Session'
  const parts = action.split('.')
  if (parts.length > 1) {
    return parts[1].charAt(0).toUpperCase() + parts[1].slice(1) + ' ' + parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  }
  return action.charAt(0).toUpperCase() + action.slice(1)
}

function getStatusStyle(status: string) {
  if (status === 'success') return '#81C784'
  if (status === 'warning') return '#FFB74D'
  return '#E57373'
}

export default function AuditTable({ entries }: AuditTableProps) {
  const { isMobile } = useShell()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'All' | 'success' | 'warning' | 'failure'>('All')

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== 'All' && e.status !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !e.actor.toLowerCase().includes(q) &&
          !e.action.toLowerCase().includes(q) &&
          !(e.target && e.target.toLowerCase().includes(q))
        ) {
          return false
        }
      }
      return true
    })
  }, [entries, search, filter])

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: isMobile ? '16px 14px' : '20px', borderBottom: '1px solid var(--kuro-color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 12 : 20 }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>Events</h3>
          <span style={{ fontSize: '11px', color: 'var(--kuro-color-text-muted)' }}>
            {filteredEntries.length} of {entries.length}
          </span>
        </div>

        {/* Controls Container */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 16, alignItems: isMobile ? 'stretch' : 'center' }}>
          {/* Search */}
          <div
            style={{
              flex: isMobile ? 'none' : 1,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.input,
              padding: '8px 12px',
              gap: '8px',
            }}
          >
            <AppIcon name="search" size={14} style={{ color: 'var(--kuro-color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--kuro-color-text-primary)',
                fontSize: '11px',
                width: '100%',
              }}
            />
          </div>

          {/* Category Dropdown */}
          <select
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--kuro-color-border)',
              color: 'var(--kuro-color-text-secondary)',
              padding: '8px 12px',
              borderRadius: radius.input,
              fontSize: '11px',
              outline: 'none',
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? '100%' : '120px',
              boxSizing: 'border-box',
            }}
          >
            <option>All</option>
          </select>

          {/* Filter Pills Container */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              padding: '3px',
              width: isMobile ? '100%' : 'auto',
              boxSizing: 'border-box',
            }}
          >
            {(['All', 'success', 'warning', 'failure'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex: isMobile ? 1 : 'none',
                  background: filter === f ? 'var(--kuro-color-border)' : 'transparent',
                  color: filter === f ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-secondary)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: radius.button,
                  fontSize: '11px',
                  fontWeight: filter === f ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {f === 'failure' ? 'Failed' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events List Body */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredEntries.map((entry) => {
            const actionStyle = getActionStyle(entry.action)
            const statusColor = getStatusStyle(entry.status)
            const formattedDate = formatDateTime(entry.timestamp)

            return (
              <div
                key={entry.id}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--kuro-color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.01)',
                }}
              >
                {/* 1. Header Row: Action Pill (left) + Status Badge (right) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: `1px solid color-mix(in srgb, ${actionStyle.color} 30%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${actionStyle.color} 12%, transparent)`,
                      color: actionStyle.color,
                      fontSize: 11.5,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <AppIcon name={actionStyle.icon} size={13} />
                    <span>{getActionLabel(entry.action)}</span>
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 9px',
                      borderRadius: 12,
                      border: `1px solid color-mix(in srgb, ${statusColor} 40%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
                      color: statusColor,
                      fontSize: 10.5,
                      fontWeight: 600,
                      fontFamily: 'var(--kuro-font-family-mono, monospace)',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }} />
                    {entry.status === 'failure' ? 'failed' : entry.status}
                  </div>
                </div>

                {/* 2. Target (if present) Row */}
                {entry.target && entry.target !== '-' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 6,
                      padding: '5px 8px',
                      fontSize: 11,
                      fontFamily: 'var(--kuro-font-family-mono, monospace)',
                      color: 'var(--kuro-color-text-secondary)',
                      minWidth: 0,
                    }}
                  >
                    <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600, flexShrink: 0 }}>
                      Target
                    </span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--kuro-color-text-primary)',
                        minWidth: 0,
                      }}
                      title={entry.target}
                    >
                      {entry.target}
                    </span>
                  </div>
                )}

                {/* 3. Footer Row: Timestamp (left) & Actor (right) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--kuro-color-text-muted)', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                    {formattedDate}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 10 }}>by</span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        fontWeight: 600,
                        fontFamily: 'var(--kuro-font-family-mono, monospace)',
                      }}
                    >
                      {entry.actor}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          {filteredEntries.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>
              No events found.
            </div>
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ color: 'var(--kuro-color-text-muted)', borderBottom: '1px solid var(--kuro-color-border)' }}>
                <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TIMESTAMP</th>
                <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACTOR</th>
                <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACTION</th>
                <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TARGET</th>
                <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const actionStyle = getActionStyle(entry.action)
                const statusColor = getStatusStyle(entry.status)
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--kuro-color-border)', color: 'var(--kuro-color-text-primary)' }}>
                    <td style={{ padding: '12px 20px' }}>
                      {formatDateTime(entry.timestamp)}
                    </td>
                    <td style={{ padding: '12px 20px', fontWeight: 600 }}>{entry.actor}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          borderRadius: radius.button,
                          border: `1px solid color-mix(in srgb, ${actionStyle.color} 30%, transparent)`,
                          backgroundColor: `color-mix(in srgb, ${actionStyle.color} 10%, transparent)`,
                          color: actionStyle.color,
                          fontSize: '11px',
                        }}
                      >
                        <AppIcon name={actionStyle.icon} size={12} />
                        {getActionLabel(entry.action)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', color: 'var(--kuro-color-text-secondary)' }}>{entry.target || '-'}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          borderRadius: radius.button,
                          border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
                          backgroundColor: 'transparent',
                          color: 'var(--kuro-color-text-secondary)',
                          fontSize: '11px',
                        }}
                      >
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor }} />
                        {entry.status === 'failure' ? 'Failed' : entry.status}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--kuro-color-text-muted)' }}>
                    No events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
