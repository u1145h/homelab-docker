import { radius } from '@/design/radius'

export interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  height?: number
  showLabel?: boolean
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  color = 'var(--kuro-color-accent)',
  height = 6,
  showLabel = false,
  className,
}: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          flex: 1,
          height,
          borderRadius: radius.skeleton,
          backgroundColor: 'var(--kuro-color-hover)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: radius.skeleton,
            backgroundColor: color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      {showLabel && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--kuro-color-text-muted)',
            flexShrink: 0,
            minWidth: 32,
            textAlign: 'right',
          }}
        >
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
}
