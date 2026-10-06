import { Text } from '@/components/ui/typography'
import { AppIcon } from '@/components/ui/icons'
import { Button } from '@/components/ui/actions'

interface ThermalErrorProps {
  error?: string
  onRetry?: () => void
}

export function ThermalError({ error, onRetry }: ThermalErrorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, flex: 1, textAlign: 'center' }}>
      <AppIcon name="alert-triangle" size={24} style={{ color: 'var(--kuro-color-danger)' }} />
      <Text color="secondary" size={13}>{error ?? 'Unable to load thermal data'}</Text>
      {onRetry && (
        <Button variant="secondary" size="small" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
