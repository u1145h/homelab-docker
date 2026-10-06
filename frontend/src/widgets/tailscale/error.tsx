import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'

interface TailscaleErrorProps {
  error?: string
  onRetry?: () => void
}

export function TailscaleError({ error, onRetry }: TailscaleErrorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
      <AppIcon name="alert-triangle" size={24} style={{ color: 'var(--kuro-color-danger)' }} />
      <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>{error ?? 'Failed to load Tailscale data'}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} style={{ padding: '6px 16px', fontSize: 11, borderRadius: radius.button, border: '1px solid var(--kuro-color-border)', background: 'transparent', color: 'var(--kuro-color-text-secondary)', cursor: 'pointer' }}>
          Retry
        </button>
      )}
    </div>
  )
}
