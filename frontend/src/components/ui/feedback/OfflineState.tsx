import { AppIcon } from '@/components/ui/icons'

export interface OfflineStateProps {
  message?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function OfflineState({
  message = 'Connection lost. Reconnecting\u2026',
  onRetry,
  retryLabel = 'Try again',
  className,
}: OfflineStateProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <AppIcon
        name="wifi-off"
        size={32}
        style={{ color: 'var(--kuro-color-text-muted)', marginBottom: 12 }}
      />
      <span
        style={{
          fontSize: 14,
          color: 'var(--kuro-color-text-muted)',
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 16,
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--kuro-color-text-primary)',
            backgroundColor: 'var(--kuro-color-hover)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: 12,
            cursor: 'pointer',
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
