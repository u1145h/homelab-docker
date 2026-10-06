import type { ContainerSummary } from '../types'
import { radius } from '@/design/radius'

function getStateColor(state: string): string {
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

interface ContainerHealthPanelProps {
  containers: ContainerSummary[]
}

export default function ContainerHealthPanel({ containers }: ContainerHealthPanelProps) {
  const total = containers.length
  const running = containers.filter((c) => c.state === 'running').length
  const stopped = containers.filter((c) => c.state === 'exited' || c.state === 'dead').length
  const paused = containers.filter((c) => c.state === 'paused').length

  const healthyCount = running
  const safeTotal = total === 0 ? 1 : total

  const runningPct = Math.round((running / safeTotal) * 100)
  const stoppedPct = Math.round((stopped / safeTotal) * 100)
  const pausedPct = Math.round((paused / safeTotal) * 100)

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--kuro-color-text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          Container health
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--kuro-color-success)',
            fontWeight: 500,
          }}
        >
          {healthyCount} / {total} healthy
        </span>
      </div>

      {/* Colored squares — one per container */}
      {containers.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {containers.map((c) => (
            <div
              key={c.id}
              title={`${c.name} — ${c.state}`}
              style={{
                width: 14,
                height: 14,
                borderRadius: radius.badge,
                backgroundColor: getStateColor(c.state),
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Stacked bar */}
      <div
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: 'var(--kuro-color-border)',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {running > 0 && (
          <div
            style={{
              width: `${runningPct}%`,
              backgroundColor: 'var(--kuro-color-success)',
              transition: 'width 0.4s ease',
            }}
          />
        )}
        {stopped > 0 && (
          <div
            style={{
              width: `${stoppedPct}%`,
              backgroundColor: 'var(--kuro-color-danger)',
              transition: 'width 0.4s ease',
            }}
          />
        )}
        {paused > 0 && (
          <div
            style={{
              width: `${pausedPct}%`,
              backgroundColor: 'var(--kuro-color-warning)',
              transition: 'width 0.4s ease',
            }}
          />
        )}
        {/* Fill remainder to 100% if rounding left gaps */}
        {running + stopped + paused === 0 && (
          <div style={{ width: '100%', backgroundColor: 'var(--kuro-color-border)' }} />
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Running', color: 'var(--kuro-color-success)', count: running },
          { label: 'Stopped', color: 'var(--kuro-color-danger)', count: stopped },
          { label: 'Paused', color: 'var(--kuro-color-warning)', count: paused },
        ].map(({ label, color, count }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 14,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                {label}
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--kuro-color-text-primary)',
                minWidth: 20,
                textAlign: 'right',
              }}
            >
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
