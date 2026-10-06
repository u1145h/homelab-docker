import type { ReactNode } from 'react'

export interface SectionTitleProps {
  children: ReactNode
}

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--kuro-color-text-muted)',
        lineHeight: 1.2,
      }}
    >
      {children}
    </div>
  )
}
