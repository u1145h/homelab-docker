export interface WaveChartProps {
  color?: string
  height?: number
  dataPoints?: number[]
  gradientId?: string
  className?: string
}

export function WaveChart({
  color = '#CDDC39',
  height = 42,
  dataPoints = [30, 45, 35, 55, 40, 65, 50, 70, 55, 60],
  gradientId,
}: WaveChartProps) {
  const id = gradientId ?? `wave-${Math.random().toString(36).substring(2, 9)}`
  
  const width = 180
  const safePoints = dataPoints.filter((v): v is number => typeof v === 'number' && !isNaN(v))
  if (safePoints.length < 2) {
    dataPoints = [30, 45, 35, 55, 40, 65, 50, 70, 55, 60]
  }

  const max = Math.max(...dataPoints, 100)
  const min = Math.min(...dataPoints, 0)
  const range = max - min || 1

  const points = dataPoints.map((val, idx) => {
    const x = (idx / (dataPoints.length - 1)) * width
    const y = height - ((val - min) / range) * (height - 8) - 4
    return { x, y }
  })

  // Smooth bezier spline math
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const cp1x = curr.x + (next.x - curr.x) / 2
    const cp1y = curr.y
    const cp2x = curr.x + (next.x - curr.x) / 2
    const cp2y = next.y
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`
  }

  const fillD = `${d} L ${width} ${height} L 0 ${height} Z`

  return (
    <div style={{ width: '100%', height, overflow: 'hidden', pointerEvents: 'none' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        {/* Filled Area Gradient */}
        <path d={fillD} fill={`url(#${id})`} />
        {/* Glowing Top Line */}
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          style={{ filter: `drop-shadow(0 2px 4px ${color}66)` }}
        />
      </svg>
    </div>
  )
}
