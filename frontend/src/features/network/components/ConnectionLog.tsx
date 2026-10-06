import { useState } from 'react'
import type { LogEvent } from '@/types/status'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'

interface ConnectionLogProps {
  logs: LogEvent[]
}

function getLogTypeStyle(type: string) {
  const upper = type.toUpperCase()
  if (upper === 'DOWNLOAD' || upper === 'RX') {
    return { bg: 'rgba(137, 180, 130, 0.15)', text: '#89B482', label: 'DOWNLOAD (RX)' }
  }
  if (upper === 'UPLOAD' || upper === 'TX') {
    return { bg: 'rgba(231, 138, 78, 0.15)', text: '#E78A4E', label: 'UPLOAD (TX)' }
  }
  if (upper === 'CONNECT') {
    return { bg: 'rgba(125, 174, 163, 0.15)', text: '#7DAEA3', label: 'CONNECT' }
  }
  if (upper === 'DNS') {
    return { bg: 'rgba(229, 192, 123, 0.15)', text: '#E5C07B', label: 'DNS' }
  }
  if (upper === 'DHCP') {
    return { bg: 'rgba(209, 154, 102, 0.15)', text: '#D19A66', label: 'DHCP' }
  }
  if (upper === 'DISCONNECT' || upper === 'ERROR') {
    return { bg: 'rgba(234, 105, 98, 0.15)', text: '#EA6962', label: upper }
  }
  return { bg: 'rgba(158, 158, 158, 0.15)', text: '#9E9E9E', label: upper }
}

export default function ConnectionLog({ logs }: ConnectionLogProps) {
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [followingLogs, setFollowingLogs] = useState(true)
  const [cleared, setCleared] = useState(false)

  const filters = ['All', 'Download (RX)', 'Upload (TX)', 'Connect', 'DNS', 'DHCP']

  const activeLogs = cleared ? [] : logs

  const filteredLogs = activeLogs.filter(log => {
    if (filter !== 'All') {
      const target = filter.toLowerCase().split(' ')[0]
      if (!log.type.toLowerCase().includes(target)) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const matchMsg = log.message.toLowerCase().includes(q)
      const matchIface = log.iface.toLowerCase().includes(q)
      const matchType = log.type.toLowerCase().includes(q)
      if (!matchMsg && !matchIface && !matchType) return false
    }
    return true
  })

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
            CONNECTION & TRAFFIC LOG
          </h3>
        </div>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
          {filteredLogs.length} recent events
        </span>
      </div>

      {/* Toolbar & Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 200,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.input,
            padding: '6px 10px',
          }}
        >
          <AppIcon name="search" size={14} color="var(--kuro-color-text-muted)" />
          <input
            type="text"
            placeholder="Search transfer, IP, domain, interface..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--kuro-color-text-primary)',
              width: '100%',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--kuro-color-surface-hover)' : 'transparent',
                border: filter === f ? '1px solid var(--kuro-color-border)' : '1px solid transparent',
                color: filter === f ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)',
                borderRadius: radius.button,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: filter === f ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Monospace Log Viewer Box (Docker Log Widget Style) */}
      <div
        style={{
          fontFamily: 'var(--kuro-font-family-mono, monospace)',
          fontSize: 11,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 320,
          overflow: 'auto',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          borderRadius: radius.card,
          padding: '12px 14px',
          minWidth: 0,
          border: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        {filteredLogs.length === 0 ? (
          <span style={{ color: 'var(--kuro-color-text-muted)', padding: '12px 0', whiteSpace: 'nowrap' }}>
            {cleared ? 'Log buffer cleared.' : 'No matching network traffic events.'}
          </span>
        ) : (
          filteredLogs.map((log, i) => {
            const badge = getLogTypeStyle(log.type)
            return (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', whiteSpace: 'nowrap', width: 'max-content', minWidth: '100%' }}>
                {/* Timestamp */}
                <span style={{ color: '#6b7280', flexShrink: 0, fontSize: 11 }}>
                  [{log.time}]
                </span>

                {/* Log Type Badge */}
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: badge.bg,
                    color: badge.text,
                    letterSpacing: '0.05em',
                  }}
                >
                  {badge.label}
                </span>

                {/* Interface Badge */}
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 3,
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--kuro-color-text-secondary)',
                  }}
                >
                  {log.iface}
                </span>

                {/* Message */}
                <span style={{ color: 'var(--kuro-color-text-primary)', whiteSpace: 'nowrap' }}>
                  {log.message}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Action Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFollowingLogs(v => !v)}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontFamily: 'inherit',
            fontWeight: 500,
            borderRadius: radius.button,
            border: '1px solid var(--kuro-color-border)',
            backgroundColor: followingLogs ? 'var(--kuro-color-accent)' : 'var(--kuro-color-surface)',
            color: followingLogs ? '#fff' : 'var(--kuro-color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          {followingLogs ? 'Following logs' : 'Follow logs'}
        </button>

        <button
          onClick={() => {
            const text = filteredLogs
              .map(l => `[${l.time}] [${l.type}] [${l.iface}] ${l.message}`)
              .join('\n')
            const blob = new Blob([text], { type: 'text/plain' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `network-connection-logs.txt`
            a.click()
          }}
          disabled={filteredLogs.length === 0}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontFamily: 'inherit',
            fontWeight: 500,
            borderRadius: radius.button,
            border: '1px solid var(--kuro-color-border)',
            backgroundColor: 'var(--kuro-color-surface)',
            color: 'var(--kuro-color-text-secondary)',
            cursor: 'pointer',
            opacity: filteredLogs.length === 0 ? 0.5 : 1,
          }}
        >
          Download
        </button>

        <button
          onClick={() => setCleared(true)}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontFamily: 'inherit',
            fontWeight: 500,
            borderRadius: radius.button,
            border: '1px solid var(--kuro-color-border)',
            backgroundColor: 'var(--kuro-color-surface)',
            color: 'var(--kuro-color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
