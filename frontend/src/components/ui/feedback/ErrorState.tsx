import { AppIcon } from '@/components/ui/icons'

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
  className,
}: ErrorStateProps) {
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
        name="alert-triangle"
        size={32}
        style={{ color: 'var(--kuro-color-danger)', marginBottom: 12 }}
      />
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--kuro-color-text-primary)',
          marginBottom: 4,
        }}
      >
        {title}
      </span>
      {message && (
        <span
          style={{
            fontSize: 14,
            color: 'var(--kuro-color-text-muted)',
            maxWidth: 400,
            lineHeight: 1.5,
          }}
        >
          {message}
        </span>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 20,
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
