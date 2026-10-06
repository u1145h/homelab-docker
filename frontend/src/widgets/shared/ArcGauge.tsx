export interface ArcGaugeProps {
  value: number
  max?: number
  label?: string
  valueDisplay?: string
  color?: string
  trackColor?: string
  size?: number
  strokeWidth?: number
}

export function ArcGauge({
  value,
  max = 100,
  label,
  valueDisplay,
  color = 'var(--kuro-color-accent)',
  trackColor = 'var(--kuro-color-hover)',
  size = 124,
  strokeWidth = 12,
}: ArcGaugeProps) {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0
  const percent = Math.min(100, Math.max(0, (safeValue / max) * 100))
  const r = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2 + 6
  const arcLength = Math.PI * r
  const strokeDashoffset = arcLength * (1 - percent / 100)

  const displayText = valueDisplay ?? `${Math.round(safeValue)}%`

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size * 0.65,
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`} style={{ overflow: 'visible' }}>
        {/* Background Track Arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Dynamic Value Arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${arcLength}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 4px ${color}66)`,
          }}
        />
      </svg>

      {/* Center text content */}
      <div
        style={{
          position: 'absolute',
          top: '26%',
          left: 0,
          right: 0,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--kuro-color-text-primary)',
            lineHeight: 1.1,
            fontFamily: 'var(--kuro-font-family-mono, monospace)',
            letterSpacing: '-0.5px',
            marginTop: 15,
          }}
        >
          {displayText}
        </span>
        {label && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--kuro-color-text-secondary)',
              letterSpacing: '0.8px',
              marginTop: 2,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
