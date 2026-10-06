import { radius } from '@/design/radius'

export interface BadgeProps {
  count: number
  maxCount?: number
  dot?: boolean
  className?: string
}

export function Badge({ count, maxCount = 99, dot = false, className }: BadgeProps) {
  if (dot) {
    return (
      <span
        className={className}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'var(--kuro-color-danger)',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
    )
  }

  if (count <= 0) return null

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: radius.badge,
        backgroundColor: 'var(--kuro-color-danger)',
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '18px',
        textAlign: 'center',
      }}
    >
      {count > maxCount ? `${maxCount}+` : count}
    </span>
  )
}
