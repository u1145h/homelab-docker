interface LegendRowProps {
  label: string
  value: string | number
  color?: string
}

export function LegendRow({ label, value, color = 'var(--kuro-color-accent)' }: LegendRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--kuro-color-text-secondary)' }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, flexShrink: 0 }} />
        {label}
      </div>
      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{value}</span>
    </div>
  )
}
