import { useState, type ReactNode } from 'react'
import { Text } from '@/components/ui/typography'
import { AppIcon } from '@/components/ui/icons'

export interface MetricDetailProps {
  summary: string
  children: ReactNode
}

export function MetricDetail({ summary, children }: MetricDetailProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 0',
          width: '100%',
        }}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <Text size={11} color="muted" truncate>
            {summary}
          </Text>
        </div>
        <AppIcon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          style={{ color: 'var(--kuro-color-text-muted)', flexShrink: 0 }}
        />
      </button>
      {expanded && <div style={{ marginTop: 4 }}>{children}</div>}
    </div>
  )
}
