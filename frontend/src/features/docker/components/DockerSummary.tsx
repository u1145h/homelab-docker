import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'

interface DockerSummaryProps {
  total: number
  running: number
  stopped: number
  paused: number
}

interface StatCardProps {
  title: string
  value: number
  subtitle: string
  icon: string
  iconColor: string
  iconBg: string
  barColor: string
  barWidth: string
}

function StatCard({ title, value, subtitle, icon, iconColor, iconBg, barColor, barWidth }: StatCardProps) {
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
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
        {value}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
          {subtitle}
        </div>
        {/* Progress bar track */}
        <div
          style={{
            height: 3,
            borderRadius: 2,
            backgroundColor: 'var(--kuro-color-border)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: barWidth,
              backgroundColor: barColor,
              borderRadius: 2,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default function DockerSummary({ total, running, stopped, paused }: DockerSummaryProps) {
  const safeTotal = total === 0 ? 1 : total
  const runningPct = `${Math.round((running / safeTotal) * 100)}%`
  const stoppedPct = `${Math.round((stopped / safeTotal) * 100)}%`
  const pausedPct = `${Math.round((paused / safeTotal) * 100)}%`

  return (
    <div className="responsive-summary-grid">
      <StatCard
        title="TOTAL"
        value={total}
        subtitle="all containers"
        icon="box"
        iconBg="rgba(255, 255, 255, 0.08)"
        iconColor="var(--kuro-color-text-primary)"
        barColor="var(--kuro-color-border)"
        barWidth="100%"
      />
      <StatCard
        title="RUNNING"
        value={running}
        subtitle={`${runningPct} active`}
        icon="play-circle"
        iconBg="rgba(38, 166, 154, 0.1)"
        iconColor="var(--kuro-color-primary)"
        barColor="var(--kuro-color-primary)"
        barWidth={runningPct}
      />
      <StatCard
        title="STOPPED"
        value={stopped}
        subtitle={`${stoppedPct} inactive`}
        icon="x-circle"
        iconBg="rgba(239, 83, 80, 0.1)"
        iconColor="var(--kuro-color-danger)"
        barColor="var(--kuro-color-danger)"
        barWidth={stoppedPct}
      />
      <StatCard
        title="PAUSED"
        value={paused}
        subtitle={`${pausedPct} suspended`}
        icon="pause-circle"
        iconBg="rgba(255, 179, 0, 0.1)"
        iconColor="var(--kuro-color-warning)"
        barColor="var(--kuro-color-warning)"
        barWidth={pausedPct}
      />
    </div>
  )
}
