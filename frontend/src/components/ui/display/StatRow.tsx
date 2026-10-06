import type { ReactNode } from 'react'

export interface StatRowItem {
  value: string | number
  label: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
}

export interface StatRowProps {
  items: StatRowItem[]
  columns?: number
  className?: string
}

export function StatRow({ items, columns = items.length, className }: StatRowProps) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 24,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.icon && <span style={{ color: 'var(--kuro-color-text-muted)', display: 'flex' }}>{item.icon}</span>}
            <span
              style={{
                fontSize: 42,
                fontWeight: 600,
                lineHeight: 1.1,
                color: 'var(--kuro-color-text-primary)',
              }}
            >
              {item.value}
            </span>
          </div>
          <span
            style={{
              fontSize: 13,
              color: 'var(--kuro-color-text-secondary)',
              marginTop: 4,
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
