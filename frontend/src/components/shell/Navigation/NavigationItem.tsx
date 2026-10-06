import { NavLink, useLocation } from 'react-router-dom'
import { AppIcon, type IconName } from '@/components/ui/icons'
import { radius } from '@/design/radius'

export interface NavigationItemProps {
  icon: IconName
  title: string
  route: string
  collapsed?: boolean
  badge?: number
  external?: boolean
  onClick?: () => void
}

export function NavigationItem({ icon, title, route, collapsed = false, badge, external, onClick }: NavigationItemProps) {
  const location = useLocation()
  const isActive = !external && (location.pathname === route || (route !== '/' && location.pathname.startsWith(route)))

  if (external) {
    return (
      <a
        href={route}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: collapsed ? '10px 0' : '8px 16px',
          margin: '0 8px',
          borderRadius: radius.button,
          textDecoration: 'none',
          color: 'var(--kuro-color-sidebar-text)',
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: 'background-color 0.15s, color 0.15s',
          position: 'relative',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
        aria-label={collapsed ? title : undefined}
      >
        <AppIcon name={icon} size={collapsed ? 17 : 18} style={{ flexShrink: 0 }} />
        {!collapsed && (
          <span style={{ fontSize: 14, fontWeight: 400, lineHeight: '20px', flex: 1 }}>
            {title}
          </span>
        )}
        {!collapsed && <AppIcon name="external-link" size={12} style={{ color: 'var(--kuro-color-text-muted)' }} />}
      </a>
    )
  }

  return (
    <NavLink
      to={route}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: collapsed ? '10px 0' : '8px 16px',
        margin: '0 8px',
        borderRadius: radius.button,
        textDecoration: 'none',
        color: isActive ? 'var(--kuro-color-accent)' : 'var(--kuro-color-sidebar-text)',
        backgroundColor: isActive ? 'color-mix(in srgb, var(--kuro-color-accent) 8%, transparent)' : 'transparent',
        justifyContent: collapsed ? 'center' : 'flex-start',
        transition: 'background-color 0.15s, color 0.15s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent'
        }
      }}
      aria-label={collapsed ? title : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon === 'bot' ? (
        <img
          src="/kuro-assistant/icon-sidebar-nv.svg"
          alt="Assistant"
          width={collapsed ? 17 : 18}
          height={collapsed ? 17 : 18}
          style={{
            display: 'block',
            width: collapsed ? 17 : 18,
            height: collapsed ? 17 : 18,
            objectFit: 'contain',
            flexShrink: 0,
            opacity: isActive ? 1 : 0.75,
          }}
        />
      ) : (
        <AppIcon
          name={icon}
          size={collapsed ? 17 : 18}
          style={{ flexShrink: 0, color: isActive ? undefined : 'var(--kuro-color-sidebar-text)' }}
        />
      )}
      {!collapsed && (
        <span style={{ fontSize: 14, fontWeight: isActive ? 500 : 400, lineHeight: '20px' }}>
          {title}
        </span>
      )}
      {!collapsed && badge != null && badge > 0 && (
        <span
          style={{
            marginLeft: 'auto',
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 9999,
            backgroundColor: 'var(--kuro-color-danger)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            lineHeight: '18px',
            textAlign: 'center',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}
