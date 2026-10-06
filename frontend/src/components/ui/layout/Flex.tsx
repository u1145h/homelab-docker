import type { ReactNode } from 'react'

export interface FlexProps {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse'
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse'
  gap?: number
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
  flex?: number | string
  className?: string
  children?: ReactNode
  as?: 'div' | 'nav' | 'section' | 'article' | 'main' | 'header' | 'footer' | 'label'
}

export function Flex({
  direction = 'row',
  wrap = 'nowrap',
  gap = 0,
  align = 'center',
  justify = 'flex-start',
  flex,
  className,
  children,
  as: Component = 'div',
}: FlexProps) {
  return (
    <Component
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        flexWrap: wrap,
        gap,
        alignItems: align,
        justifyContent: justify,
        flex: flex ?? undefined,
      }}
    >
      {children}
    </Component>
  )
}
