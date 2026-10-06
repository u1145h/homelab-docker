import { Text } from '@/components/ui/typography'
import { radius } from '@/design/radius'

export interface SystemSummaryData {
  hostname: string
  uptime: string
  kernel: string
  arch: string
  goVersion: string
  runningContainers: number
  totalContainers: number
}

export interface SystemSummaryProps {
  data: SystemSummaryData
}

export function SystemSummary({ data }: SystemSummaryProps) {
  const rows = [
    { label: 'Hostname', value: data.hostname },
    { label: 'Uptime', value: data.uptime },
    { label: 'Containers', value: `${data.runningContainers} / ${data.totalContainers} running` },
    { label: 'Kernel', value: data.kernel },
    { label: 'Architecture', value: data.arch },
    { label: 'Runtime', value: data.goVersion },
  ]

  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--kuro-color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 12,
        }}
      >
        System Summary
      </div>

      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px 32px',
          }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Text color="muted" size={11} uppercase weight={600}>
                {row.label}
              </Text>
              <Text size={11} weight={600}>
                {row.value}
              </Text>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
