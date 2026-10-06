import type { AuditConfig } from '../types'
import { radius } from '@/design/radius'

interface RetentionWidgetProps {
  config: AuditConfig | null
}

export default function RetentionWidget({ config }: RetentionWidgetProps) {
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
        Retention
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: 'auto', marginBottom: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-accent)', borderRadius: '1px' }} />
            <span style={{ fontSize: '11px', color: 'var(--kuro-color-text-primary)' }}>Window</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
            {config ? `${config.retention_days} days` : '...'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-accent)', opacity: 0.6, borderRadius: '1px' }} />
            <span style={{ fontSize: '11px', color: 'var(--kuro-color-text-primary)' }}>Storage</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
            {config ? config.storage_backend : '...'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-success)', borderRadius: '1px' }} />
            <span style={{ fontSize: '11px', color: 'var(--kuro-color-text-primary)' }}>Stream</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
            {config ? config.stream_targets : '...'}
          </span>
        </div>
      </div>
    </div>
  )
}
