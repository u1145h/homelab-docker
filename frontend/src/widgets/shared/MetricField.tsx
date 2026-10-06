import { Text } from '@/components/ui/typography'

export interface MetricFieldProps {
  label: string
  value: string
}

export function MetricField({ label, value }: MetricFieldProps) {
  return (
    <div>
      <Text size={11} color="muted" uppercase weight={600}>
        {label}
      </Text>
      <div style={{ marginTop: 2 }}>
        <Text size={13} weight={500}>
          {value}
        </Text>
      </div>
    </div>
  )
}
