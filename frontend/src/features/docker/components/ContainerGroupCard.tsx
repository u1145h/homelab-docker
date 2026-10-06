import { useState } from 'react'
import type { ContainerGroup, ContainerSummary } from '../types'
import ContainerCard, { ActionButton, StatusPill } from './ContainerCard'
import ContainerIcon from './ContainerIcon'
import { radius } from '@/design/radius'

interface ContainerGroupCardProps {
  group: ContainerGroup
  busyIds: Set<string>
  onStartGroup: (group: ContainerGroup) => void
  onStopGroup: (group: ContainerGroup) => void
  onRestartGroup: (group: ContainerGroup) => void
  onStartContainer: (c: ContainerSummary) => void
  onStopContainer: (c: ContainerSummary) => void
  onRestartContainer: (c: ContainerSummary) => void
  onContainerClick: (id: string) => void
}

export default function ContainerGroupCard({
  group,
  busyIds,
  onStartGroup,
  onStopGroup,
  onRestartGroup,
  onStartContainer,
  onStopContainer,
  onRestartContainer,
  onContainerClick,
}: ContainerGroupCardProps) {
  const [expanded, setExpanded] = useState(false)

  const isAnyBusy = group.containers.some((c) => busyIds.has(c.id))

  const dotColor =
    group.state === 'running'
      ? 'var(--kuro-color-success)'
      : group.state === 'stopped'
      ? 'var(--kuro-color-danger)'
      : 'var(--kuro-color-warning)'

  const stateLabel =
    group.state === 'running'
      ? 'All running'
      : group.state === 'stopped'
      ? 'All stopped'
      : 'Mixed state'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Group Header Card */}
      <div
        onClick={() => setExpanded(!expanded)}
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
            backgroundColor: dotColor,
            borderRadius: `${radius.card} 0 0 ${radius.card}`,
          }}
        />

        {/* Icon */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ContainerIcon container={group.name} size={28} />
        </div>

        {/* Content area */}
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--kuro-color-text-primary)',
                whiteSpace: 'nowrap',
                textTransform: 'capitalize',
              }}
            >
              {group.name} Stack
            </span>
            <StatusPill label={stateLabel} color={dotColor} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
            {group.containers.length} container{group.containers.length !== 1 && 's'}
          </div>
        </div>

        {/* Right: Group Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {group.state !== 'running' && (
            <ActionButton label="Start All" onClick={() => onStartGroup(group)} disabled={isAnyBusy} />
          )}
          {group.state !== 'stopped' && (
            <ActionButton label="Stop All" onClick={() => onStopGroup(group)} disabled={isAnyBusy} danger />
          )}
          <ActionButton label="Restart All" onClick={() => onRestartGroup(group)} disabled={isAnyBusy} />
        </div>
      </div>

      {/* Expanded Children */}
      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingLeft: 24,
            borderLeft: '2px solid var(--kuro-color-border)',
            marginLeft: 16,
            marginTop: 2,
            marginBottom: 6,
          }}
        >
          {group.containers.map((c) => (
            <ContainerCard
              key={c.id}
              container={c}
              busy={busyIds.has(c.id)}
              onStart={() => onStartContainer(c)}
              onStop={() => onStopContainer(c)}
              onRestart={() => onRestartContainer(c)}
              onClick={() => onContainerClick(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
