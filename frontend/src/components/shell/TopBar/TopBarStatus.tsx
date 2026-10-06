import { useStatusContext } from '@/contexts/StatusContext'

export interface TopBarStatusProps {
  className?: string
}

export function TopBarStatus({ className }: TopBarStatusProps) {
  const { status, loading } = useStatusContext()

  const isOnline = !loading && status != null
  const color = isOnline ? '#89B482' : 'var(--kuro-color-danger)'
  const label = isOnline ? 'Connected' : 'Disconnected'

  return (
    <div
      className={className}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--kuro-color-text-muted)',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
    </div>
  )
}
