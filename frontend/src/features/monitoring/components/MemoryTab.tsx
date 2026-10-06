import { AutoGrid } from '@/components/ui/layout'
import { Card, CardContent } from '@/components/ui/surface'
import { StatValue, ProgressBar } from '@/components/ui/display'
import { Label } from '@/components/ui/typography'
import { memoryColor } from '../utils/monitoring'
import type { MonitoringData } from '../types'

const colorVar = (c: string) => {
  if (c === 'success') return 'var(--kuro-color-success)'
  if (c === 'warning') return 'var(--kuro-color-warning)'
  return 'var(--kuro-color-danger)'
}

interface MemoryTabProps {
  data: MonitoringData
}

export default function MemoryTab({ data }: MemoryTabProps) {
  const { memory } = data
  const color = colorVar(memoryColor(memory.usagePercent))

  return (
    <AutoGrid minItemWidth={280} gap={24}>
      <Card>
        <CardContent>
          <StatValue value={`${memory.usagePercent.toFixed(0)}%`} label="Memory Usage" />
          <ProgressBar value={memory.usagePercent} color={color} height={12} showLabel />
          <div style={{ marginTop: 8 }}>
            <Label>{memory.usedFormatted} of {memory.totalFormatted}</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <StatValue value={memory.totalFormatted} label="Total" />
          <Label>Installed RAM</Label>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <StatValue value={memory.freeFormatted} label="Available" />
          <Label>{(100 - memory.usagePercent).toFixed(0)}% free</Label>
        </CardContent>
      </Card>
    </AutoGrid>
  )
}
