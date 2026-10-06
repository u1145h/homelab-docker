interface Option<T extends string | number> {
  label: string
  value: T
}

interface SegmentedControlProps<T extends string | number> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label'?: string
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="segmented-control-container"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            role="radio"
            aria-checked={active}
            className="segmented-control-btn"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 500,
              border: 'none',
              borderRight: '1px solid var(--kuro-color-border)',
              backgroundColor: active ? 'var(--kuro-color-accent)' : 'var(--kuro-color-surface)',
              color: active ? '#000' : 'var(--kuro-color-text-secondary)',
              cursor: 'pointer',
              transition: 'background-color 150ms, color 150ms',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
