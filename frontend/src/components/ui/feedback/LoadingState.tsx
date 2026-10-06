import type { ReactNode } from 'react'

export interface LoadingStateProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  inline?: boolean
  className?: string
  children?: ReactNode
}

const spinnerSizes = {
  sm: { border: 2, size: 16 },
  md: { border: 3, size: 24 },
  lg: { border: 4, size: 36 },
}

export function LoadingState({ message, size = 'md', inline = false, className, children }: LoadingStateProps) {
  const dim = spinnerSizes[size]

  const spinner = (
    <span
      style={{
        width: dim.size,
        height: dim.size,
        border: `${dim.border}px solid var(--kuro-color-border)`,
        borderTopColor: 'var(--kuro-color-accent)',
        borderRadius: '50%',
        animation: 'kuro-spin 0.6s linear infinite',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )

  if (inline) {
    return (
      <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {spinner}
        {children}
      </span>
    )
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        gap: 12,
      }}
    >
      {spinner}
      {message && (
        <span style={{ fontSize: 14, color: 'var(--kuro-color-text-muted)' }}>{message}</span>
      )}
      {children}
    </div>
  )
}
