import { AppIcon } from '@/components/ui/icons'
import { useAppearance } from '@/hooks/useAppearance'
import { useShell } from '@/components/shell/shellContext'
import { radius } from '@/design/radius'

export interface SidebarFooterProps {
  collapsed?: boolean
}

export function SidebarFooter({ collapsed = false }: SidebarFooterProps) {
  const { theme, toggleTheme } = useAppearance()
  const { setSidebarMode, sidebarMode } = useShell()

  return (
    <div
      style={{
        borderTop: '1px solid var(--kuro-color-border)',
        padding: collapsed ? '12px 0' : '12px 16px',
        display: 'flex',
        flexDirection: collapsed ? 'column' : 'row',
        alignItems: 'center',
        gap: 4,
        justifyContent: collapsed ? 'center' : 'space-between',
      }}
    >
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: collapsed ? '8px' : '8px 12px',
          borderRadius: radius.button,
          border: 'none',
          background: 'transparent',
          color: 'var(--kuro-color-text-secondary)',
          cursor: 'pointer',
          fontSize: 13,
          width: collapsed ? 36 : 'auto',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        {!collapsed && (theme === 'dark' ? 'Light Mode' : 'Dark Mode')}
      </button>

      <button
        type="button"
        onClick={() => setSidebarMode(sidebarMode === 'expanded' ? 'collapsed' : 'expanded')}
        aria-label={sidebarMode === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
        title={sidebarMode === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: radius.button,
          border: 'none',
          background: 'transparent',
          color: 'var(--kuro-color-text-muted)',
          cursor: 'pointer',
          width: collapsed ? 36 : 'auto',
          marginTop: collapsed ? 4 : 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <AppIcon name={collapsed ? 'chevron-right' : 'chevron-left'} size={14} />
      </button>

      {!collapsed && (
        <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', textAlign: 'center', marginTop: 4 }}>
          HomeLab v0.1.0
        </div>
      )}
    </div>
  )
}
