import type { ReactNode } from 'react'
import { Card } from '@/components/ui/surface'
import { AppIcon, type IconName } from '@/components/ui/icons'

export interface ActionCardProps {
  icon?: IconName
  iconNode?: ReactNode
  title: string
  description?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export function ActionCard({ icon, iconNode, title, description, onClick, disabled, className }: ActionCardProps) {
  return (
    <Card
      variant="interactive"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {(icon || iconNode) && (
          <div style={{ flexShrink: 0, marginTop: 2 }}>
            {iconNode ?? (
              <AppIcon name={icon!} size={20} style={{ color: 'var(--kuro-color-accent)' }} />
            )}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--kuro-color-text-primary)', marginBottom: 2 }}>
            {title}
          </div>
          {description && (
            <div style={{ fontSize: 13, color: 'var(--kuro-color-text-muted)', lineHeight: 1.4 }}>
              {description}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
