import { Text } from '@/components/ui/typography'
import { AppIcon } from '@/components/ui/icons'

export function DockerEmpty() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, textAlign: 'center' }}>
      <AppIcon name="container" size={24} style={{ color: 'var(--kuro-color-text-muted)' }} />
      <Text color="muted" size={13}>No Docker data available</Text>
    </div>
  )
}
