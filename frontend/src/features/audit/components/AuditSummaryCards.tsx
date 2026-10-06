import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'

interface AuditSummaryCardsProps {
  total: number
  success: number
  warning: number
  failed: number
}

interface StatCardProps {
  title: string
  value: number
  subtitle: string
  icon: string
  iconColor: string
  iconBg: string
}

function StatCard({ title, value, subtitle, icon, iconColor, iconBg }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.card,
              backgroundColor: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: iconColor,
            }}
          >
            <AppIcon name={icon as any} size={15} />
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: 'var(--kuro-color-text-secondary)',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
        {subtitle}
      </div>
    </div>
  )
}

export default function AuditSummaryCards({ total, success, warning, failed }: AuditSummaryCardsProps) {
  return (
    <div className="responsive-summary-grid">
      <StatCard
        title="TOTAL EVENTS"
        value={total}
        subtitle="last 24 hours"
        icon="shield"
        iconBg="rgba(255, 255, 255, 0.08)"
        iconColor="var(--kuro-color-text-primary)"
      />
      <StatCard
        title="SUCCESS"
        value={success}
        subtitle="ok"
        icon="check-circle"
        iconBg="rgba(38, 166, 154, 0.1)"
        iconColor="var(--kuro-color-primary)"
      />
      <StatCard
        title="WARNINGS"
        value={warning}
        subtitle="review"
        icon="alert-triangle"
        iconBg="rgba(255, 179, 0, 0.1)"
        iconColor="var(--kuro-color-warning)"
      />
      <StatCard
        title="FAILED"
        value={failed}
        subtitle="denied / errors"
        icon="x-circle"
        iconBg="rgba(239, 83, 80, 0.1)"
        iconColor="var(--kuro-color-danger)"
      />
    </div>
  )
}
