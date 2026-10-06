import type { ReactNode } from 'react'
import { layout } from '@/design/layout'

export interface PageContainerProps {
  maxWidth?: number
  fullWidth?: boolean
  padding?: number | string
  className?: string
  children?: ReactNode
}

export function PageContainer({
  maxWidth = layout.contentMaxWidth,
  fullWidth = false,
  padding,
  className,
  children,
}: PageContainerProps) {
  const p = padding ?? layout.pagePadding
  return (
    <div
      className={className}
      style={{
        maxWidth: fullWidth ? '100%' : maxWidth,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: p,
        paddingRight: p,
        paddingTop: p,
        paddingBottom: p,
      }}
    >
      {children}
    </div>
  )
}
