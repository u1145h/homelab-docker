export interface NavigationDividerProps {
  className?: string
}

export function NavigationDivider({ className }: NavigationDividerProps) {
  return (
    <div
      className={className}
      style={{
        height: 1,
        backgroundColor: 'var(--kuro-color-border)',
        margin: '8px 16px',
      }}
    />
  )
}
