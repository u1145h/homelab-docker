import { Outlet, useLocation } from 'react-router-dom'
import { ShellProvider } from '@/components/shell/shellContext'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopBar } from '@/components/shell/TopBar'
import { ContentLayout } from '@/components/shell/ContentLayout'
import { PageContainer } from '@/components/shell/ContentLayout'
import { useAuth } from '@/contexts/AuthContext'
import { lazy, Suspense } from 'react'
import PageLoader from '@/components/PageLoader'

// Keep-alive pages — imported eagerly so they are never torn down on route change.
// We use lazy() here purely for code-splitting; the components themselves stay
// mounted in the DOM (just display: none when inactive).
const TerminalPage = lazy(() => import('@/features/terminal/pages/TerminalPage'))
const FilesPage    = lazy(() => import('@/features/files/pages/FilesPage'))

// Pages that get the keep-alive treatment and which roles can access them.
const KEEP_ALIVE_ROUTES: { path: string; roles: string[]; Component: React.ComponentType }[] = [
  { path: '/terminal', roles: ['admin', 'user'], Component: TerminalPage },
  { path: '/files',    roles: ['admin', 'user'], Component: FilesPage },
]

/** Renders keep-alive pages always in the DOM, toggled via display style. */
function KeepAliveSlots({ currentPath }: { currentPath: string }) {
  const { role } = useAuth()

  return (
    <>
      {KEEP_ALIVE_ROUTES.map(({ path, roles, Component }) => {
        // Skip rendering if the user doesn't have the required role
        if (!role || !roles.includes(role)) return null

        const isActive = currentPath === path

        return (
          <div
            key={path}
            style={{
              display: isActive ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <Suspense fallback={<PageLoader />}>
              <Component />
            </Suspense>
          </div>
        )
      })}
    </>
  )
}

export interface AppShellProps {}

export function AppShell(_props: AppShellProps) {
  const location = useLocation()

  // Normalize pathname — strip trailing slash except for root
  const currentPath = location.pathname === '/' ? '/' : location.pathname.replace(/\/$/, '')

  // True when the current route is handled by a keep-alive slot (not the Outlet)
  const isKeepAlivePath = KEEP_ALIVE_ROUTES.some((r) => currentPath === r.path)

  return (
    <ShellProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100%', minWidth: 0, overflow: 'hidden' }}>
        <Sidebar />
        <ContentLayout>
          <TopBar />
          <main style={{ flex: 1, minWidth: 0, overflow: isKeepAlivePath ? 'hidden' : 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* ── Keep-alive pages: always mounted, hidden when inactive ─────── */}
            <KeepAliveSlots currentPath={currentPath} />

            {/* ── Normal pages: rendered via Outlet, hidden when keep-alive is active */}
            <div
              style={{
                display: isKeepAlivePath ? 'none' : 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                minWidth: 0,
              }}
            >
              <PageContainer fullWidth padding={0}>
                <Outlet />
              </PageContainer>
            </div>
          </main>
        </ContentLayout>
      </div>
    </ShellProvider>
  )
}

