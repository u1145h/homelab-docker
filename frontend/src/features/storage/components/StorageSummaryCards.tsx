import { AppIcon } from '@/components/ui/icons'
import { formatBytes } from '@/utils/format'
import type { StorageSummary } from '@/types/status'
import { radius } from '@/design/radius'

interface StatCardProps {
  title: string
  icon: string
  iconColor: string
  iconBg: string
  mainValue: React.ReactNode
  subValue: string
}

function StatCard({ title, icon, iconColor, iconBg, mainValue, subValue }: StatCardProps) {
  return (
    <div style={{
      backgroundColor: 'var(--kuro-color-surface)',
      border: '1px solid var(--kuro-color-border)',
      borderRadius: radius.card,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 0,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: radius.card,
            backgroundColor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor
          }}>
            <AppIcon name={icon as any} size={15} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
        {mainValue}
      </div>
      <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
        {subValue}
      </div>
    </div>
  )
}

interface StorageSummaryCardsProps {
  summary?: StorageSummary
}

export default function StorageSummaryCards({ summary }: StorageSummaryCardsProps) {
  if (!summary) return null

  const hasCapacity = summary.total_capacity > 0
  const usagePercent = hasCapacity ? ((summary.used / summary.total_capacity) * 100).toFixed(0) : '0'
  const freePercent = hasCapacity ? ((summary.free / summary.total_capacity) * 100).toFixed(0) : '0'

  return (
    <div className="responsive-summary-grid">
      <StatCard
        title="TOTAL CAPACITY"
        icon="database"
        iconBg="rgba(255, 255, 255, 0.08)"
        iconColor="var(--kuro-color-text-primary)"
        mainValue={hasCapacity ? formatBytes(summary.total_capacity) : "No result found"}
        subValue={hasCapacity ? `${summary.physical_volumes} physical volumes` : "No result found"}
      />
      <StatCard
        title="USED"
        icon="hard-drive"
        iconBg="rgba(239, 83, 80, 0.1)"
        iconColor="var(--kuro-color-danger)"
        mainValue={hasCapacity ? formatBytes(summary.used) : "No result found"}
        subValue={hasCapacity ? `${usagePercent}% of capacity` : "No result found"}
      />
      <StatCard
        title="FREE"
        icon="box"
        iconBg="rgba(76, 175, 80, 0.1)"
        iconColor="var(--kuro-color-success)"
        mainValue={hasCapacity ? formatBytes(summary.free) : "No result found"}
        subValue={hasCapacity ? `${freePercent}% available` : "No result found"}
      />
      <StatCard
        title="BLOCK DEVICES"
        icon="server"
        iconBg="rgba(38, 166, 154, 0.1)"
        iconColor="var(--kuro-color-primary)"
        mainValue={summary.physical_volumes > 0 ? summary.physical_volumes : "No result found"}
        subValue={summary.physical_volumes > 0 ? `${summary.physical_volumes} physical volumes` : "No result found"}
      />
    </div>
  )
}
