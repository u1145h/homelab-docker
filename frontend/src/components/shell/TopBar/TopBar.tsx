import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AppIcon } from '@/components/ui/icons'
import { useShell } from '@/components/shell/shellContext'
import { TopBarStatus } from './TopBarStatus'
import { TopBarActions } from './TopBarActions'
import { getBreadcrumbs } from '@/navigation'
import { layout } from '@/design/layout'
import { radius } from '@/design/radius'
import type { ContainerDetail, ContainerSummary } from '@/features/docker/types'

export interface TopBarProps {
  className?: string
}

export function TopBar({ className }: TopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isMobile, isTablet, setSidebarOpen } = useShell()

  const crumbs = getBreadcrumbs(location.pathname, (path, part) => {
    if (path.startsWith('/docker/')) {
      const id = part
      // 1. Check ContainerDetail cache
      const detail = queryClient.getQueryData<ContainerDetail>(['docker', 'detail', id])
      if (detail?.name) {
        return detail.name.replace(/^\//, '')
      }
      // 2. Check ContainerSummary list cache
      const containers = queryClient.getQueryData<ContainerSummary[]>(['docker', 'containers'])
      if (containers) {
        const found = containers.find(
          (c) => c.id === id || c.id.startsWith(id) || id.startsWith(c.id)
        )
        if (found?.name) {
          return found.name.replace(/^\//, '')
        }
      }
      // 3. Smart fallback: if ID is long hex, truncate to 12 chars
      if (part.length > 12 && /^[a-f0-9]+$/i.test(part)) {
        return part.substring(0, 12)
      }
    }
    return null
  })

  return (
    <header
      className={className}
      style={{
        height: layout.topbarHeight,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: `10px 10px 10px ${isMobile ? 10 : isTablet ? 20 : 25}px`,
        backgroundColor: 'var(--kuro-color-background)',
        borderBottom: '1px solid var(--kuro-color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        flexShrink: 0,
      }}
    >
      {/* Menu toggle — mobile only */}
      {isMobile && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            borderRadius: radius.button,
            border: 'none',
            background: 'transparent',
            color: 'var(--kuro-color-text-secondary)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <AppIcon name="menu" size={20} />
        </button>
      )}

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && (
                <AppIcon name="chevron-right" size={12} style={{ color: 'var(--kuro-color-text-muted)' }} />
              )}
              {isLast ? (
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--kuro-color-text-primary)', whiteSpace: 'nowrap' }}>
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(crumb.path)}
                  style={{
                    fontSize: 14,
                    color: 'var(--kuro-color-text-secondary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {crumb.label}
                </button>
              )}
            </span>
          )
        })}
      </nav>

      {/* Status */}
      <TopBarStatus />

      {/* Actions */}
      <TopBarActions />
    </header>
  )
}
