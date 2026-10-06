import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import type { KuroHealth, KuroSettings, KuroNode, KuroMemory } from '../types'

interface AssistantSummaryCardsProps {
  health: KuroHealth | null
  settings: KuroSettings | null
  nodes: KuroNode[]
  memories: KuroMemory[]
  conversationCount: number
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: string
  iconColor: string
  iconBg: string
  statusBadge?: { text: string; color: string; bg: string }
}

function StatCard({ title, value, subtitle, icon, iconColor, iconBg, statusBadge }: StatCardProps) {
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
              fontWeight: 600,
              color: 'var(--kuro-color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {title}
          </span>
        </div>
        {statusBadge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              color: statusBadge.color,
              backgroundColor: statusBadge.bg,
              textTransform: 'uppercase',
            }}
          >
            {statusBadge.text}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--kuro-color-text-primary)',
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>

      <span
        style={{
          fontSize: 12,
          color: 'var(--kuro-color-text-muted)',
        }}
      >
        {subtitle}
      </span>
    </div>
  )
}

export default function AssistantSummaryCards({
  health,
  settings,
  nodes,
  memories,
  conversationCount,
}: AssistantSummaryCardsProps) {
  const isOnline = health?.status === 'ok'
  const modelName = settings?.model || health?.model || 'qwen2.5:3b'
  const activeNodesCount = nodes.filter((n) => n.status !== 'offline').length

  return (
    <div
      className="responsive-summary-grid"
      style={{ gap: 12 }}
    >
      <StatCard
        title="AI Engine Status"
        value={isOnline ? 'Online' : 'Offline'}
        subtitle={`Provider: ${settings?.provider || health?.provider || 'openai_compat'}`}
        icon="bot"
        iconColor={isOnline ? 'var(--kuro-color-success)' : 'var(--kuro-color-danger)'}
        iconBg={isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}
        statusBadge={
          isOnline
            ? { text: 'READY', color: 'var(--kuro-color-success)', bg: 'rgba(16, 185, 129, 0.15)' }
            : { text: 'UNAVAILABLE', color: 'var(--kuro-color-danger)', bg: 'rgba(239, 68, 68, 0.15)' }
        }
      />

      <StatCard
        title="Active LLM Model"
        value={modelName}
        subtitle={`Temp: ${settings?.temperature ?? 0.7} • Max: ${settings?.max_tokens ?? 2048}t`}
        icon="cpu"
        iconColor="var(--kuro-color-primary)"
        iconBg="rgba(99, 102, 241, 0.12)"
      />

      <StatCard
        title="Connected Clients"
        value={`${activeNodesCount} / ${nodes.length}`}
        subtitle="Workstations & Mobile Nodes"
        icon="network"
        iconColor="var(--kuro-color-info)"
        iconBg="rgba(6, 182, 212, 0.12)"
      />

      <StatCard
        title="Knowledge & Memory"
        value={memories.length}
        subtitle={`${conversationCount} active conversations`}
        icon="sparkles"
        iconColor="#a855f7"
        iconBg="rgba(168, 85, 247, 0.12)"
      />
    </div>
  )
}
