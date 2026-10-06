import type { ReactNode } from 'react'
import { AppIcon, type IconName } from '@/components/ui/icons'

export interface EmptyStateProps {
  icon?: IconName
  title: string
  message?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon = 'inbox', title, message, action, className }: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <AppIcon
        name={icon}
        size={40}
        style={{ color: 'var(--kuro-color-text-muted)', marginBottom: 16 }}
      />
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--kuro-color-text-primary)',
          marginBottom: 4,
        }}
      >
        {title}
      </span>
      {message && (
        <span
          style={{
            fontSize: 14,
            color: 'var(--kuro-color-text-muted)',
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {message}
        </span>
      )}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}
