import { useState } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PageContainer } from '@/components/shell'
import { AppearanceSection } from '../sections/AppearanceSection'
import { ThresholdsSection } from '../sections/ThresholdsSection'
import { NotificationsSection } from '../sections/NotificationsSection'
import { DefaultValuesSection } from '../sections/DefaultValuesSection'
import { ServerConnectionsSection } from '../sections/ServerConnectionsSection'
import { PowerSection } from '../sections/PowerSection'
import { usePreferences } from '../hooks/usePreferences'
import { useServer } from '@/contexts/ServerContext'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingState } from '@/components/ui/feedback'
import { StickyFooter } from '../components/StickyFooter'
import { radius } from '@/design/radius'

const ALL_SECTIONS = [
  { id: 'servers', label: 'Server Connections', isAndroidOnly: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg> },
  { id: 'appearance', label: 'Appearance', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg> },
  { id: 'thresholds', label: 'Thresholds', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg> },
  { id: 'notifications', label: 'Notifications', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg> },
  { id: 'defaults', label: 'Default values', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="17" y2="18"/><circle cx="19" cy="12" r="2"/><circle cx="21" cy="18" r="2"/></svg> },
  { id: 'power', label: 'Power Management', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg> },
]

export default function SettingsPage() {
  useDocumentTitle('Settings - HomeLab')
  const prefHook = usePreferences()
  const { isAndroidNative } = useServer()
  const { role } = useAuth()
  const isReadonly = role === 'readonly'
  const [activeSection, setActiveSection] = useState('appearance')

  const sections = ALL_SECTIONS.filter((s) => {
    if (s.isAndroidOnly && !isAndroidNative) return false
    if (isReadonly) {
      return s.id === 'appearance' || s.id === 'defaults'
    }
    return true
  })

  if (prefHook.loading) {
    return (
      <PageContainer fullWidth padding={10}>
        <LoadingState message="Loading preferences..." />
      </PageContainer>
    )
  }

  return (
    <PageContainer fullWidth padding={0}>
      <div className="settings-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px', margin: 0, color: 'var(--kuro-color-text-h)' }}>
            Settings
          </h1>
          <p style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', marginTop: 4 }}>
            Dashboard preferences, thresholds and agent configuration
          </p>
        </div>

        {/* Global Save Actions (Top Header) */}
        {(prefHook.dirty || prefHook.saving) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>unsaved changes</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={prefHook.discard}
                disabled={prefHook.saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--kuro-color-text-secondary)',
                  fontSize: 11,
                  cursor: prefHook.saving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Reset
              </button>
              <button
                onClick={prefHook.save}
                disabled={prefHook.saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 18px',
                  borderRadius: radius.button,
                  border: 'none',
                  backgroundColor: 'var(--kuro-color-accent)',
                  color: '#000',
                  fontSize: 11,
                  cursor: prefHook.saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  opacity: prefHook.saving ? 0.7 : 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                {prefHook.saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-layout-container" style={{ marginTop: 24 }}>
        
        {/* Mobile Nav (Horizontal Tab) */}
        <div className="settings-nav-mobile">
          {sections.map((s) => {
            const active = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: radius.button,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: active ? 'var(--kuro-color-border)' : 'transparent',
                  backgroundColor: active ? 'var(--kuro-color-surface)' : 'transparent',
                  color: active ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 150ms, color 150ms, border-color 150ms',
                }}
              >
                {s.icon}
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Left Nav (sticky desktop) */}
        <div style={{ 
          width: 220, 
          flexShrink: 0 
        }}
        className="settings-nav-desktop"
        >
          <div style={{ position: 'sticky', top: 32, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sections.map((s) => {
              const active = activeSection === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    borderRadius: radius.button,
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    backgroundColor: active ? 'rgba(255,255,255,0.03)' : 'transparent',
                    color: active ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
                    textAlign: 'left',
                    transition: 'background-color 150ms, color 150ms',
                  }}
                >
                  {s.icon}
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Content */}
        <div className="page-widget-gap" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingBottom: 120 }}>
          
          {activeSection === 'servers' && (
            <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column' }}>
              <ServerConnectionsSection />
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column' }}>
              <AppearanceSection prefHook={prefHook} />
            </div>
          )}

          {activeSection === 'thresholds' && (
            <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column' }}>
              <ThresholdsSection prefHook={prefHook} />
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column' }}>
              <NotificationsSection prefHook={prefHook} />
            </div>
          )}

          {activeSection === 'defaults' && (
            <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column' }}>
              <DefaultValuesSection prefHook={prefHook} />
            </div>
          )}

          {activeSection === 'power' && (
            <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column' }}>
              <PowerSection />
            </div>
          )}
          
          {/* Global Sticky Footer */}
          <StickyFooter dirty={prefHook.dirty} saving={prefHook.saving} onSave={prefHook.save} onDiscard={prefHook.discard} />
        </div>

      </div>
    </PageContainer>
  )
}
