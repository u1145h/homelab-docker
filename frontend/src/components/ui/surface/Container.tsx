import type { ReactNode } from 'react'

export interface ContainerProps {
  maxWidth?: number
  padding?: number
  children?: ReactNode
  className?: string
}

export function Container({
  maxWidth = 1400,
  padding = 32,
  children,
  className,
}: ContainerProps) {
  return (
    <div
      className={className}
      style={{
        maxWidth,
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: padding,
        paddingRight: padding,
        width: '100%',
      }}
    >
      {children}
    </div>
  )
}
