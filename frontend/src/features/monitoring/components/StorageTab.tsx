import { AutoGrid } from '@/components/ui/layout'
import { Card, CardContent } from '@/components/ui/surface'
import { StatValue, ProgressBar } from '@/components/ui/display'
import { Text, Caption } from '@/components/ui/typography'
import { EmptyState } from '@/components/ui/feedback'
import { storageColor } from '../utils/monitoring'
import type { MonitoringData } from '../types'

const colorVar = (c: string) => {
  if (c === 'success') return 'var(--kuro-color-success)'
  if (c === 'warning') return 'var(--kuro-color-warning)'
  return 'var(--kuro-color-danger)'
}

interface StorageTabProps {
  data: MonitoringData
}

export default function StorageTab({ data }: StorageTabProps) {
  const { storage } = data

  if (storage.length === 0) {
    return <EmptyState icon="hard-drive" title="No storage mounts available" />
  }

  return (
    <AutoGrid minItemWidth={400} gap={24}>
      {storage.map((mount) => {
        const color = colorVar(storageColor(mount.usagePercent))
        return (
          <Card key={mount.mount.device}>
            <CardContent>
              <StatValue value={mount.usedFormatted} label={mount.mount.mount} />
              <ProgressBar value={mount.usagePercent} color={color} height={12} showLabel />
              <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
                <div>
                  <Caption>Device</Caption>
                  <Text>{mount.mount.device}</Text>
                </div>
                <div>
                  <Caption>Filesystem</Caption>
                  <Text>{mount.mount.filesystem}</Text>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </AutoGrid>
  )
}
