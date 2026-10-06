import { Text } from '@/components/ui/typography'
import { Flex } from '@/components/ui/layout'
import type { SystemWidgetProps } from './types'

export function SystemWidget({ data }: SystemWidgetProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <Text weight={600} size={16}>{data.hostname}</Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        <Flex justify="space-between">
          <Text color="secondary" size={13}>OS</Text>
          <Text size={13}>{data.os}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="secondary" size={13}>Kernel</Text>
          <Text size={13}>{data.kernel}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="secondary" size={13}>Arch</Text>
          <Text size={13}>{data.arch}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="secondary" size={13}>Uptime</Text>
          <Text size={13}>{data.uptime}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="secondary" size={13}>Containers</Text>
          <Text size={13}>{data.runningContainers} / {data.totalContainers}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="secondary" size={13}>Runtime</Text>
          <Text size={13}>{data.goVersion}</Text>
        </Flex>
      </div>
    </div>
  )
}
