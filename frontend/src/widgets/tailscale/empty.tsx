import { AppIcon } from '@/components/ui/icons'

export function TailscaleEmpty() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, textAlign: 'center' }}>
      <AppIcon name="globe" size={28} style={{ color: 'var(--kuro-color-text-muted)' }} />
      <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>No Tailscale data available</span>
    </div>
  )
}
