import { useNavigate } from 'react-router-dom'
import type { ContainerSummary } from '../types'
import ContainerIcon from './ContainerIcon'
import { radius } from '@/design/radius'

function getStateAccentColor(state: string): string {
  switch (state) {
    case 'running': return 'var(--kuro-color-success)'
    case 'paused': return 'var(--kuro-color-warning)'
    case 'restarting': return 'var(--kuro-color-info)'
    case 'exited':
    case 'dead':
      return 'var(--kuro-color-danger)'
    default:
      return 'var(--kuro-color-text-muted)'
  }
}

function getStateDotColor(state: string): string {
  return getStateAccentColor(state)
}

function getHealthFromStatus(status: string): string | null {
  if (!status) return null
  const lower = status.toLowerCase()
  if (lower.includes('healthy')) return 'healthy'
  if (lower.includes('unhealthy')) return 'unhealthy'
  return null
}

function parseUptime(status: string): string {
  if (!status) return ''
  // e.g. "Up 4 hours", "Up 3 days", "Exited (0) 2 hours ago"
  return status
}

export interface ActionButtonProps {
  label: string
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  danger?: boolean
}

export function ActionButton({ label, onClick, disabled, danger }: ActionButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '4px 12px',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: radius.button,
        border: '1px solid var(--kuro-color-border)',
        backgroundColor: 'var(--kuro-color-background)',
        color: danger ? 'var(--kuro-color-danger)' : 'var(--kuro-color-text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
        e.currentTarget.style.borderColor = danger
          ? 'var(--kuro-color-danger)'
          : 'var(--kuro-color-text-muted)'
        if (danger) e.currentTarget.style.color = 'var(--kuro-color-danger)'
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        e.currentTarget.style.backgroundColor = 'var(--kuro-color-background)'
        e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
        e.currentTarget.style.color = danger
          ? 'var(--kuro-color-danger)'
          : 'var(--kuro-color-text-secondary)'
      }}
    >
      {label}
    </button>
  )
}

export interface StatusPillProps {
  label: string
  color: string
}

export function StatusPill({ label, color }: StatusPillProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        color,
        padding: '2px 0',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  )
}

interface ContainerCardProps {
  container: ContainerSummary
  busy: boolean
  onStart: () => void
  onStop: () => void
  onRestart: () => void
  onClick?: () => void
}

export default function ContainerCard({
  container,
  busy,
  onStart,
  onStop,
  onRestart,
  onClick,
}: ContainerCardProps) {
  const navigate = useNavigate()
  const isRunning = container.state === 'running'
  const accentColor = getStateAccentColor(container.state)
  const dotColor = getStateDotColor(container.state)
  const health = getHealthFromStatus(container.status)
  const uptime = parseUptime(container.status)

  const handleClick = () => {
    navigate(`/docker/${container.id}`)
    onClick?.()
  }

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
        overflow: 'hidden',
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--kuro-color-hover)'
        e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
        e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface)'
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accentColor,
          borderRadius: `${radius.card} 0 0 ${radius.card}`,
        }}
      />

      {/* Icon */}
      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8 }}>
        <ContainerIcon container={container} size={28} />
      </div>

      {/* Content area */}
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
        {/* Row 1: name + status badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--kuro-color-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {container.name}
          </span>
          <StatusPill label={container.state} color={dotColor} />
          {health && (
            <StatusPill
              label={health}
              color={
                health === 'healthy'
                  ? 'var(--kuro-color-success)'
                  : 'var(--kuro-color-danger)'
              }
            />
          )}
        </div>
        {/* Row 2: image + uptime */}
        <div
          style={{
            fontSize: 11,
            color: 'var(--kuro-color-text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ opacity: 0.7 }}>{container.image}</span>
          {uptime && (
            <span style={{ marginLeft: 6, color: 'var(--kuro-color-text-muted)' }}>
              · {uptime}
            </span>
          )}
        </div>
      </div>

      {/* Right: Action buttons */}
      <div
        style={{ display: 'flex', gap: 6, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isRunning && (
          <ActionButton label="Start" onClick={onStart} disabled={busy} />
        )}
        {isRunning && (
          <ActionButton label="Stop" onClick={onStop} disabled={busy} danger />
        )}
        <ActionButton label="Restart" onClick={onRestart} disabled={busy} />
      </div>
    </div>
  )
}
