import type { ElementType, ReactNode } from 'react'
import { forwardRef } from 'react'
import { fontSize, fontWeight, lineHeight, fontFamily } from '@/design/typography'

type TextColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const colorMap: Record<TextColor, string> = {
  primary: 'var(--kuro-color-text-primary)',
  secondary: 'var(--kuro-color-text-secondary)',
  muted: 'var(--kuro-color-text-muted)',
  accent: 'var(--kuro-color-accent)',
  success: 'var(--kuro-color-success)',
  warning: 'var(--kuro-color-warning)',
  danger: 'var(--kuro-color-danger)',
  info: 'var(--kuro-color-info)',
}

export interface TextProps {
  as?: ElementType
  color?: TextColor
  size?: number
  weight?: number
  align?: 'left' | 'center' | 'right'
  truncate?: boolean
  mono?: boolean
  uppercase?: boolean
  className?: string
  children?: ReactNode
}

export const Text = forwardRef<HTMLElement, TextProps>(
  (
    {
      as: Component = 'span',
      color = 'primary',
      size = fontSize.body,
      weight = fontWeight.regular,
      align,
      truncate = false,
      mono = false,
      uppercase = false,
      className,
      children,
    },
    ref,
  ) => {
    return (
      <Component
        ref={ref}
        className={className}
        style={{
          fontSize: size,
          fontWeight: weight,
          fontFamily: mono ? fontFamily.mono : fontFamily.sans,
          color: colorMap[color] || colorMap.primary,
          lineHeight: lineHeight.normal,
          textAlign: align,
          textTransform: uppercase ? 'uppercase' : undefined,
          letterSpacing: uppercase ? '0.5px' : undefined,
          overflow: truncate ? 'hidden' : undefined,
          textOverflow: truncate ? 'ellipsis' : undefined,
          whiteSpace: truncate ? 'nowrap' : undefined,
          margin: 0,
        }}
      >
        {children}
      </Component>
    )
  },
)

Text.displayName = 'Text'
