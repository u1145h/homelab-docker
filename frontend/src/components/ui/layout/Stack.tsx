import type { ReactNode } from 'react'

export interface StackProps {
  direction?: 'column' | 'row'
  gap?: number
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch'
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
  className?: string
  children?: ReactNode
  as?: 'div' | 'nav' | 'section' | 'article' | 'main' | 'header' | 'footer'
}

export function Stack({
  direction = 'column',
  gap = 8,
  align = 'stretch',
  justify = 'flex-start',
  className,
  children,
  as: Component = 'div',
}: StackProps) {
  return (
    <Component
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap,
        alignItems: align,
        justifyContent: justify,
      }}
    >
      {children}
    </Component>
  )
}
