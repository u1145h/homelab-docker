import type { ReactNode } from 'react'

export interface AutoGridProps {
  minItemWidth?: number
  gap?: number
  className?: string
  children?: ReactNode
}

export function AutoGrid({
  minItemWidth = 240,
  gap = 16,
  className,
  children,
}: AutoGridProps) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minItemWidth}px, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  )
}
