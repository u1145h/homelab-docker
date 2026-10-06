import { AutoGrid } from '@/components/ui/layout'
import { Card, CardContent } from '@/components/ui/surface'
import { StatValue, ProgressBar } from '@/components/ui/display'
import { Label } from '@/components/ui/typography'
import { cpuColor } from '../utils/monitoring'
import type { MonitoringData } from '../types'

const colorVar = (c: string) => {
  if (c === 'success') return 'var(--kuro-color-success)'
  if (c === 'warning') return 'var(--kuro-color-warning)'
  return 'var(--kuro-color-danger)'
}

interface CpuTabProps {
  data: MonitoringData
}

export default function CpuTab({ data }: CpuTabProps) {
  const { cpu } = data
  const usageMetric = cpu[0]
  const color = colorVar(cpuColor(usageMetric?.usage ?? 0))

  return (
    <AutoGrid minItemWidth={280} gap={24}>
      {cpu.map((metric) => (
        <Card key={metric.label}>
          <CardContent>
            <StatValue value={metric.value} label={metric.label} />
            {(metric.label === 'Usage' || metric.label === 'System Load') && (
              <div style={{ marginTop: 16 }}>
                <ProgressBar value={metric.usage} color={color} showLabel />
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <Label>{metric.secondary}</Label>
            </div>
          </CardContent>
        </Card>
      ))}
    </AutoGrid>
  )
}
