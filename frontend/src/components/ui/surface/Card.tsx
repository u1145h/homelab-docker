import type { ElementType, ReactNode } from 'react'
import { forwardRef } from 'react'
import { styled } from '@mui/material'
import { radius } from '@/design/radius'
import { getTransition } from '@/design/motion'

export type CardVariant = 'default' | 'interactive' | 'elevated'

const transition = getTransition(['background-color', 'border-color', 'opacity'], 'normal')

const CardRoot = styled('div')<{
  $variant: CardVariant
  $accentColor?: string
  $clickable: boolean
  $disabled: boolean
  $noPadding?: boolean
}>(({ $variant, $accentColor, $clickable, $disabled, $noPadding }) => ({
  backgroundColor: 'var(--kuro-color-surface)',
  border: '1px solid var(--kuro-color-border)',
  borderRadius: radius.card,
  padding: $noPadding ? 0 : 24,
  transition,
  opacity: $disabled ? 0.5 : 1,
  pointerEvents: $disabled ? 'none' : undefined,
  ...($accentColor ? { borderTop: `3px solid ${$accentColor}` } : {}),
  ...($variant === 'interactive'
    ? {
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'var(--kuro-color-hover)',
          borderColor: 'var(--kuro-color-accent)',
        },
      }
    : {}),
  ...($variant === 'elevated'
    ? { border: '1px solid transparent', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
    : {}),
  ...($clickable ? { cursor: 'pointer' } : {}),
}))

export interface CardProps {
  variant?: CardVariant
  accentColor?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
  children?: ReactNode
  component?: ElementType
  noPadding?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', accentColor, onClick, disabled = false, className, children, component, noPadding }, ref) => {
    const clickable = !!onClick
    return (
      <CardRoot
        ref={ref}
        as={component}
        $variant={variant}
        $accentColor={accentColor}
        $clickable={clickable}
        $disabled={disabled}
        $noPadding={noPadding}
        className={className}
        onClick={onClick}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
        aria-disabled={disabled}
      >
        {children}
      </CardRoot>
    )
  },
)

Card.displayName = 'Card'

export interface CardHeaderProps {
  children?: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({ children, action, className }: CardHeaderProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}
    >
      {children && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
          {children}
        </div>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}

export interface CardContentProps {
  children?: ReactNode
  className?: string
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={className}>{children}</div>
}

export interface CardFooterProps {
  children?: ReactNode
  className?: string
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={className}
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid var(--kuro-color-border)',
      }}
    >
      {children}
    </div>
  )
}
