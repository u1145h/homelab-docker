import type { ReactNode } from 'react'
import type { WidgetState, WidgetSize } from './types'
import type { WidgetDefinition } from './types'
import { AppIcon } from '@/components/ui/icons'
import { Text } from '@/components/ui/typography'
import { radius } from '@/design/radius'

const RESPONSIVE_BREAKPOINT = 640

interface WidgetCardProps {
  widget: WidgetDefinition
  state: WidgetState
  size?: WidgetSize
  error?: string
  onRetry?: () => void
  children?: ReactNode
  className?: string
}

function ResponsiveWrapper({ size, children }: { size: WidgetSize; children: ReactNode }) {
  return (
    <div
      style={{
        gridColumn: `span ${size.width}`,
        gridRow: `span ${size.height}`,
        minHeight: size.height > 1 ? 320 : 180,
      }}
    >
      <style>{`
        @media (max-width: ${RESPONSIVE_BREAKPOINT}px) {
          .widget-responsive-${size.width}x${size.height} {
            grid-column: 1 / -1 !important;
            grid-row: auto !important;
          }
        }
      `}</style>
      {children}
    </div>
  )
}

export function WidgetCard({
  widget,
  state,
  size,
  error,
  onRetry,
  children,
  className,
}: WidgetCardProps) {
  const s = size ?? widget.metadata.defaultSize

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--kuro-color-surface)',
    border: '1px solid var(--kuro-color-border)',
    borderRadius: radius.card,
    padding: 24,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
  }

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return <widget.skeleton />
      case 'empty':
        return <widget.empty />
      case 'offline':
        return <widget.empty />
      case 'error':
        return <widget.error error={error} onRetry={onRetry} />
      case 'ready':
        return children ?? null
    }
  }

  return (
    <ResponsiveWrapper size={s}>
      <div
        className={`widget-responsive-${s.width}x${s.height}${className ? ` ${className}` : ''}`}
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--kuro-color-accent)'
          e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
          e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <AppIcon name={widget.metadata.icon} size={16} style={{ color: 'var(--kuro-color-text-primary)' }} />
          <Text color="primary" size={12} weight={600} uppercase>
            {widget.metadata.title}
          </Text>
        </div>
        {renderContent()}
      </div>
    </ResponsiveWrapper>
  )
}
