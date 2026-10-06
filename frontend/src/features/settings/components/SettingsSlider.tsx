type SliderColor = 'accent' | 'warning' | 'danger' | 'purple' | 'info'

const colorMap: Record<SliderColor, string> = {
  accent: 'var(--kuro-color-accent)',
  warning: 'var(--kuro-color-warning)',
  danger: 'var(--kuro-color-danger)',
  purple: 'var(--kuro-color-purple)',
  info: 'var(--kuro-color-info)',
}

interface SettingsSliderProps {
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
  color?: SliderColor
  unit?: string
  'aria-label'?: string
}

export function SettingsSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  color = 'accent',
  unit = '',
  'aria-label': ariaLabel,
}: SettingsSliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  const trackColor = colorMap[color]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 100 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: '100%',
            appearance: 'none',
            height: 4,
            borderRadius: 2,
            outline: 'none',
            cursor: 'pointer',
            background: `linear-gradient(to right, ${trackColor} ${pct}%, var(--kuro-color-border) ${pct}%)`,
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--kuro-color-text-primary)', minWidth: 48, textAlign: 'right' }}>
        {value}{unit}
      </span>
    </div>
  )
}
