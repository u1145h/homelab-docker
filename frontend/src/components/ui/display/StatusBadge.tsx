import { statusConfig, type StatusType } from '@/design/status'
import { radius } from '@/design/radius'

export interface StatusBadgeProps {
  status: StatusType
  label?: string
  dotOnly?: boolean
  className?: string
}

export function StatusBadge({ status, label, dotOnly = false, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  const displayLabel = label ?? config.label

  if (dotOnly) {
    return (
      <span
        className={className}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: config.color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: radius.button,
        backgroundColor: config.background,
        border: `1px solid ${config.border}`,
        color: config.color,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '20px',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: config.color,
          flexShrink: 0,
        }}
      />
      {displayLabel}
    </span>
  )
}
