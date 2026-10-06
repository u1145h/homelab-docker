import { Text } from '@/components/ui/typography'
import type { MetricStatus } from './metricStatus'

export interface MetricStatusBadgeProps {
  status: MetricStatus
}

export function MetricStatusBadge({ status }: MetricStatusBadgeProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: status.colorVar,
          flexShrink: 0,
        }}
      />
      <Text size={13} weight={500} color={status.level}>
        {status.label}
      </Text>
    </div>
  )
}
