import type { CSSProperties } from 'react'
import { radius } from '@/design/radius'

export interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  variant?: 'text' | 'rect' | 'circle'
  className?: string
  style?: CSSProperties
}

export function Skeleton({
  width,
  height,
  borderRadius,
  variant = 'rect',
  className,
  style,
}: SkeletonProps) {
  const isCircle = variant === 'circle'
  const isText = variant === 'text'

  return (
    <div
      className={className}
      aria-hidden
      style={{
        width: isText ? '100%' : (width ?? '100%'),
        height: isCircle ? (width ?? 32) : (height ?? 16),
        borderRadius: isCircle ? '50%' : (borderRadius ?? (isText ? radius.skeleton : radius.skeleton)),
        backgroundColor: 'var(--kuro-color-hover)',
        animation: 'kuro-shimmer 1.5s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
