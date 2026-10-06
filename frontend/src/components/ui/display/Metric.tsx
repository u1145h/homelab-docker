import type { ReactNode } from 'react'

export interface MetricProps {
  label: string
  value: string | number
  icon?: ReactNode
  indicator?: 'healthy' | 'warning' | 'danger'
  unit?: string
  className?: string
}

const indicatorColors = {
  healthy: '#89B482',
  warning: '#E78A4E',
  danger: '#EA6962',
}

export function Metric({ label, value, icon, indicator, unit, className }: MetricProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {indicator && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: indicatorColors[indicator],
              flexShrink: 0,
            }}
          />
        )}
        {icon && <span style={{ color: 'var(--kuro-color-text-muted)', display: 'flex' }}>{icon}</span>}
        <span style={{ fontSize: 14, color: 'var(--kuro-color-text-secondary)' }}>{label}</span>
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
        {value}{unit && <span style={{ fontWeight: 400, color: 'var(--kuro-color-text-muted)', marginLeft: 2 }}>{unit}</span>}
      </span>
    </div>
  )
}
