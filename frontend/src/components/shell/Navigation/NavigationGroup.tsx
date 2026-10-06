import type { ReactNode } from 'react'

export interface NavigationGroupProps {
  label: string
  children?: ReactNode
  className?: string
}

export function NavigationGroup({ label, children, className }: NavigationGroupProps) {
  if (!children) return null
  return (
    <div className={className}>
      <div
        style={{
          padding: '0 16px',
          marginBottom: 4,
          marginTop: 16,
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--kuro-color-sidebar-category)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}
