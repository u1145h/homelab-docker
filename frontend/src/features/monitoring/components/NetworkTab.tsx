import { AutoGrid } from '@/components/ui/layout'
import { Card, CardContent } from '@/components/ui/surface'
import { StatValue, StatusBadge } from '@/components/ui/display'
import { Text, Caption } from '@/components/ui/typography'
import { EmptyState } from '@/components/ui/feedback'
import { networkColor } from '../utils/monitoring'
import type { MonitoringData } from '../types'

const statusMap: Record<string, 'healthy' | 'danger'> = {
  success: 'healthy',
  error: 'danger',
}

interface NetworkTabProps {
  data: MonitoringData
}

export default function NetworkTab({ data }: NetworkTabProps) {
  const { network } = data

  if (network.length === 0) {
    return <EmptyState icon="network" title="No network interfaces available" />
  }

  return (
    <AutoGrid minItemWidth={400} gap={24}>
      {network.map((nic) => {
        const color = networkColor(nic.isUp)
        return (
          <Card key={nic.iface.name}>
            <CardContent>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatValue value={nic.isUp ? 'Connected' : 'Disconnected'} label={nic.iface.name} />
                <StatusBadge status={statusMap[color]} label={nic.isUp ? 'Up' : 'Down'} />
              </div>

              <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
                <div>
                  <Caption>Download</Caption>
                  <Text weight={600}>{nic.rxFormatted}</Text>
                </div>
                <div>
                  <Caption>Upload</Caption>
                  <Text weight={600}>{nic.txFormatted}</Text>
                </div>
                <div>
                  <Caption>MTU</Caption>
                  <Text>{nic.iface.mtu}</Text>
                </div>
              </div>

              {nic.iface.addresses && nic.iface.addresses.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Caption>Addresses</Caption>
                  {nic.iface.addresses.map((addr) => (
                    <Text key={addr}>{addr}</Text>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </AutoGrid>
  )
}
