import { AppIcon } from '@/components/ui/icons'
import type { MemoryInfo } from '@/types/status'
import { formatBytes } from '@/utils/format'

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

interface MemorySummaryCardsProps {
  memory: MemoryInfo
}

export default function MemorySummaryCards({ memory }: MemorySummaryCardsProps) {
  const totalStr = formatBytes(memory.total)
  const usedStr = formatBytes(memory.used)
  const availableStr = formatBytes(memory.available)
  const cachedStr = formatBytes(memory.cached)
  
  const swapTotalStr = formatBytes(memory.swap_total)
  const swapUsedStr = formatBytes(memory.swap_used)
  
  const cachePct = memory.total > 0 ? ((memory.cached / memory.total) * 100).toFixed(0) : '0'

  return (
    <div className="memory-summary-grid">
      <StatCard
        title="USED"
        icon="cpu"
        iconBg="rgba(38, 166, 154, 0.1)"
        iconColor="var(--kuro-color-primary)"
        mainValue={usedStr}
        subValue={`${memory.usage_percent.toFixed(0)}% of ${totalStr}`}
      />
      <StatCard
        title="AVAILABLE"
        icon="activity"
        iconBg="rgba(38, 166, 154, 0.1)"
        iconColor="var(--kuro-color-primary)"
        mainValue={availableStr}
        subValue="incl. reclaimable cache"
      />
      <StatCard
        title="CACHED"
        icon="database"
        iconBg="rgba(255, 179, 0, 0.1)"
        iconColor="var(--kuro-color-warning)"
        mainValue={cachedStr}
        subValue={`${cachePct}% file cache`}
      />
      <StatCard
        title="SWAP"
        icon="hard-drive"
        iconBg="rgba(239, 83, 80, 0.1)"
        iconColor="var(--kuro-color-danger)"
        mainValue={`${swapUsedStr} / ${swapTotalStr}`}
        subValue={`${memory.swap_usage_percent.toFixed(0)}% - zram`}
      />
    </div>
  )
}
