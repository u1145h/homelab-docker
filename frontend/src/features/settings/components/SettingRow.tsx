import type { ReactNode } from 'react'

interface SettingRowProps {
  label: string
  hint?: string
  children: ReactNode
  inlineOnMobile?: boolean
  stacked?: boolean
}

export function SettingRow({ label, hint, children, inlineOnMobile, stacked }: SettingRowProps) {
  return (
    <div className={`setting-row ${inlineOnMobile ? 'setting-row-inline' : ''} ${stacked ? 'setting-row-stacked' : ''}`}>
      <div style={{ flex: stacked ? 'none' : 1, width: stacked ? '100%' : undefined, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', marginTop: 2, lineHeight: 1.5 }}>
            {hint}
          </div>
        )}
      </div>
      <div className="setting-row-content" style={{ width: stacked ? '100%' : undefined, marginLeft: stacked ? 0 : undefined, marginTop: stacked ? 12 : undefined }}>
        {children}
      </div>
    </div>
  )
}
