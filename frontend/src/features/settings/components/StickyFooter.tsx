import { radius } from '@/design/radius'

interface StickyFooterProps {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}

export function StickyFooter({ dirty, saving, onSave, onDiscard }: StickyFooterProps) {
  if (!dirty && !saving) return null

  return (
    <div className="sticky-footer-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        You have unsaved changes.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onDiscard}
          disabled={saving}
          style={{
            padding: '7px 16px',
            borderRadius: radius.button,
            border: '1px solid var(--kuro-color-border)',
            backgroundColor: 'transparent',
            color: 'var(--kuro-color-text-secondary)',
            fontSize: 11,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
        >
          Discard
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '7px 18px',
            borderRadius: radius.button,
            border: 'none',
            backgroundColor: 'var(--kuro-color-accent)',
            color: '#000',
            fontSize: 11,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
