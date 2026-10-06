import { useMemo } from 'react'
import type { DockerWidgetProps } from './types'
import { groupContainers } from '@/features/docker/utils/docker'
import type { ContainerSummary } from '@/features/docker/types'
import ContainerIcon from '@/features/docker/components/ContainerIcon'
import { radius } from '@/design/radius'
import { loadDockerDefaults, ensureProtocol } from '@/features/docker/utils/dockerDefaults'

interface WidgetDisplayItem {
  id: string
  name: string
  state: string
  statusText: string
  customLink?: string
  rawContainer?: ContainerSummary | string
}

export function DockerWidget({ data }: DockerWidgetProps) {
  const defaults = useMemo(() => loadDockerDefaults(), [])

  if (!data || !data.containers) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>
        No docker data available
      </div>
    )
  }

  const { containers } = data
  const total = containers.length
  const running = containers.filter((c) => c.state === 'running').length

  const norm = (n: string) => n.replace(/^\//, '').toLowerCase()

  // Build display items list based on user settings or fallback to default top 6
  let displayItems: WidgetDisplayItem[] = []

  if (defaults.selectedContainers && defaults.selectedContainers.length > 0) {
    displayItems = defaults.selectedContainers.slice(0, 6).map((sc) => {
      const match = containers.find(
        (c) => c.id === sc.id || norm(c.name) === norm(sc.name)
      )

      if (match) {
        return {
          id: match.id,
          name: sc.name || match.name.replace(/^\//, ''),
          state: match.state,
          statusText: match.status.replace(/Up\s+/, '').replace(/\s*\(.*?\)/g, ''),
          customLink: sc.customLink,
          rawContainer: match as unknown as ContainerSummary,
        }
      }

      return {
        id: sc.id || sc.name,
        name: sc.name,
        state: 'offline',
        statusText: 'offline',
        customLink: sc.customLink,
        rawContainer: sc.name,
      }
    })
  } else {
    const groupedContainers = groupContainers(containers as unknown as ContainerSummary[])
    displayItems = groupedContainers.slice(0, 6).map((item) => {
      const isGroup = 'isGroup' in item
      const state = isGroup ? item.state : item.state
      const statusText = isGroup
        ? item.containers[0]?.status.replace(/Up\s+/, '').replace(/\s*\(.*?\)/g, '') || ''
        : item.status.replace(/Up\s+/, '').replace(/\s*\(.*?\)/g, '')
      const name = item.name

      return {
        id: isGroup ? `group-${item.name}` : item.id,
        name,
        state,
        statusText,
        rawContainer: isGroup ? item.name : (item as ContainerSummary),
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>DOCKER</span>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
          running {running} • total {total}
        </span>
      </div>

      {/* 2x3 Mini Containers Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginTop: 2,
        }}
      >
        {displayItems.map((item) => {
          const dotColor =
            item.state === 'running'
              ? 'var(--kuro-color-success)'
              : item.state === 'stopped' || item.state === 'exited' || item.state === 'dead'
              ? 'var(--kuro-color-danger)'
              : item.state === 'offline'
              ? 'var(--kuro-color-text-muted)'
              : 'var(--kuro-color-warning)'

          const hasLink = Boolean(item.customLink && item.customLink.trim())
          const formattedUrl = hasLink ? ensureProtocol(item.customLink!) : ''

          return (
            <div
              key={item.id}
              onClick={(e) => {
                if (hasLink) {
                  e.stopPropagation()
                  window.open(formattedUrl, '_blank', 'noopener,noreferrer')
                }
              }}
              title={hasLink ? `Launch app: ${formattedUrl}` : item.name}
              style={{
                backgroundColor: 'var(--kuro-color-surface)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.card,
                padding: '12px 0 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minWidth: 0,
                position: 'relative',
                cursor: hasLink ? 'pointer' : 'default',
                transition: 'border-color 150ms, transform 150ms, background-color 150ms',
              }}
              onMouseEnter={(e) => {
                if (hasLink) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface-elevated, rgba(255,255,255,0.04))'
                }
              }}
              onMouseLeave={(e) => {
                if (hasLink) {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface)'
                }
              }}
            >

              {/* Status Dot */}
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                }}
              />

              {/* Icon */}
              <ContainerIcon container={item.rawContainer || item.name} size={32} />

              {/* Status Text */}
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--kuro-color-text-secondary)',
                  fontFamily: 'var(--kuro-font-family-mono, monospace)',
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.statusText}
              </span>
            </div>
          )
        })}
      </div>

      {/* Solid Green Progress Line Accent */}
      <div style={{ width: '100%', height: 6, backgroundColor: 'var(--kuro-color-success)', borderRadius: 3, marginTop: 'auto' }} />
    </div>
  )
}
