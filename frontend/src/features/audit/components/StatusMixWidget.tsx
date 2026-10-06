import { radius } from '@/design/radius'

interface StatusMixWidgetProps {
  success: number
  warning: number
  failed: number
}

export default function StatusMixWidget({ success, warning, failed }: StatusMixWidgetProps) {
  const total = success + warning + failed || 1
  const successPct = (success / total) * 100
  const warningPct = (warning / total) * 100
  const failedPct = (failed / total) * 100

  return (
    <div style={{
      backgroundColor: 'var(--kuro-color-surface)',
      border: '1px solid var(--kuro-color-border)',
      borderRadius: radius.card,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      height: '100%'
    }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
        Status mix
      </div>

      {/* Progress Bar */}
      <div style={{ display: 'flex', height: '6px', borderRadius: radius.card, overflow: 'hidden', backgroundColor: 'var(--kuro-color-border)' }}>
        <div style={{ width: `${successPct}%`, backgroundColor: 'var(--kuro-color-success)' }} />
        <div style={{ width: `${warningPct}%`, backgroundColor: 'var(--kuro-color-warning)' }} />
        <div style={{ width: `${failedPct}%`, backgroundColor: 'var(--kuro-color-danger)' }} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-success)', borderRadius: '1px' }} />
            <span style={{ fontSize: '11px', color: 'var(--kuro-color-text-primary)' }}>Success</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{success}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-warning)', borderRadius: '1px' }} />
            <span style={{ fontSize: '11px', color: 'var(--kuro-color-text-primary)' }}>Warning</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{warning}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-danger)', borderRadius: '1px' }} />
            <span style={{ fontSize: '11px', color: 'var(--kuro-color-text-primary)' }}>Failed</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{failed}</span>
        </div>
      </div>
    </div>
  )
}
