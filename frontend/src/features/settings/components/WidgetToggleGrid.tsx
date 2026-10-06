import { ALL_WIDGETS } from '../types'
import { radius } from '@/design/radius'

const WIDGET_LABELS: Record<string, string> = {
  cpu: 'CPU gauge + timeline',
  memory: 'Memory gauge + composition',
  storage: 'Storage mounts',
  network: 'Network throughput',
  thermal: 'Thermal zones',
  battery: 'Battery / power',
  docker: 'Docker containers',
  tailscale: 'Tailscale peers',
  activity: 'Recent activity',
}

interface WidgetToggleGridProps {
  visible: string[]
  onChange: (visible: string[]) => void
}

export function WidgetToggleGrid({ visible, onChange }: WidgetToggleGridProps) {
  const currentVisible = Array.isArray(visible) ? visible : []
  const toggle = (id: string) => {
    if (currentVisible.includes(id)) {
      onChange(currentVisible.filter((v) => v !== id))
    } else {
      onChange([...currentVisible, id])
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))',
      gap: 10,
      paddingTop: 8,
    }}>
      {ALL_WIDGETS.map((id) => {
        const on = currentVisible.includes(id)
        return (
          <button
            key={id}
            onClick={() => toggle(id)}
            aria-pressed={on}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              border: `1px solid ${on ? 'var(--kuro-color-accent)' : 'var(--kuro-color-border)'}`,
              borderRadius: radius.button,
              backgroundColor: on ? 'rgba(var(--kuro-color-accent-rgb, 169,182,101), 0.08)' : 'var(--kuro-color-surface)',
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--kuro-color-text-primary)',
              textAlign: 'left',
              transition: 'border-color 150ms, background-color 150ms',
            }}
          >
            <span>{WIDGET_LABELS[id] ?? id}</span>
            <div style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              border: `2px solid ${on ? 'var(--kuro-color-accent)' : 'var(--kuro-color-border)'}`,
              backgroundColor: on ? 'var(--kuro-color-accent)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background-color 150ms, border-color 150ms',
            }}>
              {on && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
