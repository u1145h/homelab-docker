import { radius } from '@/design/radius'

interface RoleDistributionPanelProps {
  total: number
  admins: number
  regular: number
  clients?: number
  readonly: number
}

export default function RoleDistributionPanel({ total, admins, regular, clients = 0, readonly }: RoleDistributionPanelProps) {
  if (total === 0) return null

  const adminPct = (admins / total) * 100
  const regularPct = (regular / total) * 100
  const clientPct = (clients / total) * 100
  const readonlyPct = (readonly / total) * 100

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Role distribution
        </span>
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
          {total} total
        </span>
      </div>

      {/* Stacked bar */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.05)',
          marginBottom: 20,
        }}
      >
        {adminPct > 0 && (
          <div style={{ width: `${adminPct}%`, height: '100%', backgroundColor: 'var(--kuro-color-healthy)' }} />
        )}
        {regularPct > 0 && (
          <div style={{ width: `${regularPct}%`, height: '100%', backgroundColor: 'var(--kuro-color-info)' }} />
        )}
        {clientPct > 0 && (
          <div style={{ width: `${clientPct}%`, height: '100%', backgroundColor: '#d79921' }} />
        )}
        {readonlyPct > 0 && (
          <div style={{ width: `${readonlyPct}%`, height: '100%', backgroundColor: 'var(--kuro-color-warning)' }} />
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--kuro-color-healthy)' }} />
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-primary)' }}>Administrators</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>{admins}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--kuro-color-info)' }} />
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-primary)' }}>Standard</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>{regular}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#d79921' }} />
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-primary)' }}>Ghost Clients</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>{clients}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--kuro-color-warning)' }} />
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-primary)' }}>Read only</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>{readonly}</span>
        </div>
      </div>
    </div>
  )
}
