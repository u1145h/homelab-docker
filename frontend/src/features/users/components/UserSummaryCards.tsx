import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'

interface UserSummaryCardsProps {
  total: number
  admins: number
  regular: number
  clients?: number
  readonly: number
}

interface UserStatCardProps {
  title: string
  value: number
  subtitle: string
  icon: string
  iconColor: string
  iconBg: string
}

function UserStatCard({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  iconBg,
}: UserStatCardProps) {
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

export default function UserSummaryCards({
  admins,
  regular,
  clients = 0,
  readonly,
}: UserSummaryCardsProps) {
  return (
    <div className="users-summary-grid">
      <UserStatCard
        title="Administrators"
        value={admins}
        subtitle="full access"
        icon="shield"
        iconBg="rgba(38, 166, 154, 0.1)"
        iconColor="var(--kuro-color-primary)"
      />
      <UserStatCard
        title="Standard"
        value={regular}
        subtitle="read + write"
        icon="user"
        iconBg="rgba(33, 150, 243, 0.1)"
        iconColor="var(--kuro-color-info)"
      />
      <UserStatCard
        title="Ghost Clients"
        value={clients}
        subtitle="sync only"
        icon="smartphone"
        iconBg="rgba(215, 153, 33, 0.12)"
        iconColor="#d79921"
      />
      <UserStatCard
        title="Read Only"
        value={readonly}
        subtitle="view only"
        icon="eye"
        iconBg="rgba(255, 179, 0, 0.1)"
        iconColor="var(--kuro-color-warning)"
      />
    </div>
  )
}
