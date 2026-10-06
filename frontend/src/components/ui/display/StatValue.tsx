import type { ReactNode } from 'react'

export interface StatValueProps {
  value: string | number
  label: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  align?: 'left' | 'center' | 'right'
  className?: string
}

const trendColors = {
  up: '#89B482',
  down: '#EA6962',
  neutral: 'var(--kuro-color-text-muted)',
}

const trendArrows = {
  up: '\u2191',
  down: '\u2193',
  neutral: '\u2192',
}

export function StatValue({ value, label, icon, trend, trendLabel, align = 'left', className }: StatValueProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ color: 'var(--kuro-color-text-muted)', display: 'flex' }}>{icon}</span>}
        <span
          style={{
            fontSize: 42,
            fontWeight: 600,
            lineHeight: 1.1,
            color: 'var(--kuro-color-text-primary)',
          }}
        >
          {value}
        </span>
      </div>
      <span
        style={{
          fontSize: 13,
          color: 'var(--kuro-color-text-secondary)',
          marginTop: 4,
        }}
      >
        {label}
      </span>
      {trend && (
        <span
          style={{
            fontSize: 12,
            color: trendColors[trend],
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {trendArrows[trend]} {trendLabel || ''}
        </span>
      )}
    </div>
  )
}
