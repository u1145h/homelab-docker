import { useMemo, useState } from 'react'
import { Drawer } from '@mui/material'
import { useShell } from '@/components/shell/shellContext'
import { NavigationGroup } from '@/components/shell/Navigation'
import { SidebarSection } from './SidebarSection'
import { SidebarItem } from './SidebarItem'
import { navGroups, getNavItemsByGroup } from '@/components/shell/navigation.config'
import { useAuth } from '@/contexts/AuthContext'
import { AppIcon } from '@/components/ui/icons'
import { layout } from '@/design/layout'

const SIDEBAR_WIDTH = layout.sidebarWidth
const SIDEBAR_COLLAPSED_WIDTH = 60

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const { setSidebarOpen, toggleSidebar, sidebarMode } = useShell()
  const [hovered, setHovered] = useState(false)

  const handleNavClick = () => {
    setSidebarOpen(false)
  }

  const { role } = useAuth()

  const sortedGroups = useMemo(
    () => [...navGroups].sort((a, b) => a.order - b.order),
    [],
  )

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--kuro-color-background)',
        borderRight: '1px solid var(--kuro-color-border)',
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        overflow: 'hidden',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Logo */}
      <SidebarSection>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '16px 0' : '14px 20px',
          }}
        >
          <div
            style={{
              width: 35,
              height: 35,
              borderRadius: 8,
              backgroundColor: '#a9b665',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={toggleSidebar}
            aria-label={sidebarMode === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {hovered ? (
              <AppIcon
                name={sidebarMode === 'expanded' ? 'chevron-left' : 'chevron-right'}
                size={25}
                style={{ color: '#111314' }}
              />
            ) : (
              <img src="/sidebar-logo.svg" alt="HomeLab" style={{ width: 'auto', height: 22 }} />
            )}
          </div>
          {!collapsed && (
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginLeft: 10, textTransform: 'none' }}>
              HomeLab
            </span>
          )}
        </div>
      </SidebarSection>

      {/* Navigation */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 8 }}>
        <div style={{ paddingTop: 4, paddingBottom: 4 }}>
          <SidebarItem
            icon="layout-dashboard"
            title="Dashboard"
            route="/"
            collapsed={collapsed}
            onClick={handleNavClick}
          />
        </div>
        {sortedGroups.map((group) => {
          const items = getNavItemsByGroup(group.id).filter((item) => {
            if (!item.roles) return true
            if (!role) return false
            return item.roles.includes(role as 'admin' | 'user' | 'readonly')
          })
          if (items.length === 0) return null

          return (
            <NavigationGroup key={group.id} label={collapsed ? '' : group.label}>
              {items.map((item) => (
                <SidebarItem
                  key={item.id}
                  icon={item.icon}
                  title={item.title}
                  route={item.route}
                  collapsed={collapsed}
                  badge={item.badge}
                  external={item.external}
                  onClick={handleNavClick}
                />
              ))}
            </NavigationGroup>
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar() {
  const { sidebarMode, sidebarOpen, setSidebarOpen, isMobile } = useShell()
  const collapsed = !isMobile && sidebarMode === 'collapsed'
  const effectiveWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
          },
        }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <SidebarContent collapsed={false} />
        </div>
      </Drawer>
    )
  }

  // Tablet & Desktop permanent drawer
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: effectiveWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: effectiveWidth,
          boxSizing: 'border-box',
          border: 'none',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
        },
      }}
    >
      <SidebarContent collapsed={collapsed} />
    </Drawer>
  )
}
