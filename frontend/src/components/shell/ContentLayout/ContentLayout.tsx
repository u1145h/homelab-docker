import type { ReactNode } from 'react'

export interface ContentLayoutProps {
  className?: string
  children?: ReactNode
}

export function ContentLayout({ className, children }: ContentLayoutProps) {
  return (
    <div
      className={className}
      style={{
        flex: 1,
        minWidth: 0,
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--kuro-color-background)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}
