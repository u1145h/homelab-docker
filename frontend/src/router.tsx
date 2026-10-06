/* eslint-disable react-refresh/only-export-components */

import { lazy } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"
import type { ReactNode } from "react"

import { AppShell } from "@/components/shell"
import ProtectedLayout from "@/layouts/ProtectedLayout"
import LazyPage from "@/components/LazyPage"
import type { Role } from "@/components/shell/navigation.config"
import { useAuth } from "@/contexts/AuthContext"

const LoginPage = lazy(() => import("@/pages/Login"))
const DashboardPage = lazy(() => import("@/pages/Dashboard"))
const MonitoringPage = lazy(() => import("@/pages/Memory"))
const CPUPage = lazy(() => import("@/pages/CPU"))
const StoragePage = lazy(() => import("@/pages/Storage"))
const NetworkPage = lazy(() => import("@/pages/Network"))
const BatteryPage = lazy(() => import("@/pages/Battery"))
const ThermalPage = lazy(() => import("@/pages/Thermal"))
const DockerPage = lazy(() => import("@/pages/Docker"))
const DockerContainerPage = lazy(() => import("@/pages/DockerContainer"))
const AssistantModelPage = lazy(() => import("@/features/assistant").then(m => ({ default: m.AssistantModelPage })))
const AssistantMemoriesPage = lazy(() => import("@/features/assistant").then(m => ({ default: m.AssistantMemoriesPage })))
const AssistantClientsPage = lazy(() => import("@/features/assistant").then(m => ({ default: m.AssistantClientsPage })))
const AssistantDataPage = lazy(() => import("@/features/assistant").then(m => ({ default: m.AssistantDataPage })))
const AssistantServerConfigPage = lazy(() => import("@/features/assistant").then(m => ({ default: m.AssistantServerConfigPage })))
const CameraPage = lazy(() => import("@/pages/Camera"))
const UsersPage = lazy(() => import("@/pages/Users"))
const RecentActivityPage = lazy(() => import("@/pages/RecentActivity"))
const AuditPage = lazy(() => import("@/pages/Audit"))
const SettingsPage = lazy(() => import("@/pages/Settings"))
const AnimatePage = lazy(() => import("@/pages/Animate"))
const NotFoundPage = lazy(() => import("@/pages/NotFound"))

/**
 * Placeholder rendered by routes whose components live in the keep-alive layer
 * (AppShell renders them always; the Outlet here is intentionally empty).
 */
function KeepAlivePlaceholder() {
  return null
}

function RouteGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role, loading } = useAuth()

  if (loading) return null

  if (!role || !roles.includes(role as Role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LazyPage><LoginPage /></LazyPage>,
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        element: <AppShell />,
        children: [
          // ── Monitoring (Accessible by admin and readonly wall monitors) ──
          { index: true, element: <LazyPage><DashboardPage /></LazyPage> },
          { path: "memory", element: <LazyPage><MonitoringPage /></LazyPage> },
          { path: "cpu", element: <LazyPage><CPUPage /></LazyPage> },
          { path: "storage", element: <LazyPage><StoragePage /></LazyPage> },
          { path: "network", element: <LazyPage><NetworkPage /></LazyPage> },
          { path: "battery", element: <LazyPage><BatteryPage /></LazyPage> },
          { path: "thermal", element: <LazyPage><ThermalPage /></LazyPage> },

          // ── Management (Admin only) ──
          { path: "docker", element: <RouteGuard roles={['admin']}><LazyPage><DockerPage /></LazyPage></RouteGuard> },
          { path: "docker/:id", element: <RouteGuard roles={['admin']}><LazyPage><DockerContainerPage /></LazyPage></RouteGuard> },
          
          // ── Dedicated Assistant Routes (Admin only on web) ──
          { path: "assistant", element: <Navigate to="/assistant/model" replace /> },
          { path: "assistant/model", element: <RouteGuard roles={['admin']}><LazyPage><AssistantModelPage /></LazyPage></RouteGuard> },
          { path: "assistant/memories", element: <RouteGuard roles={['admin']}><LazyPage><AssistantMemoriesPage /></LazyPage></RouteGuard> },
          { path: "assistant/clients", element: <RouteGuard roles={['admin']}><LazyPage><AssistantClientsPage /></LazyPage></RouteGuard> },
          { path: "assistant/clients/data", element: <RouteGuard roles={['admin']}><LazyPage><AssistantDataPage /></LazyPage></RouteGuard> },
          { path: "assistant/integration", element: <RouteGuard roles={['admin']}><LazyPage><AssistantServerConfigPage /></LazyPage></RouteGuard> },
          { path: "assistant/server", element: <Navigate to="/assistant/integration" replace /> },

          // files & terminal: keep-alive (Admin only)
          { path: "files",    element: <RouteGuard roles={['admin']}><KeepAlivePlaceholder /></RouteGuard> },
          { path: "terminal", element: <RouteGuard roles={['admin']}><KeepAlivePlaceholder /></RouteGuard> },
          { path: "camera",   element: <RouteGuard roles={['admin']}><LazyPage><CameraPage /></LazyPage></RouteGuard> },

          // ── System ──
          { path: "users", element: <RouteGuard roles={['admin']}><LazyPage><UsersPage /></LazyPage></RouteGuard> },
          { path: "recent-activity", element: <LazyPage><RecentActivityPage /></LazyPage> },
          { path: "notifications", element: <Navigate to="/recent-activity" replace /> },
          { path: "audit", element: <RouteGuard roles={['admin']}><LazyPage><AuditPage /></LazyPage></RouteGuard> },
          { path: "settings", element: <RouteGuard roles={['admin', 'readonly']}><LazyPage><SettingsPage /></LazyPage></RouteGuard> },
          { path: "animate", element: <LazyPage><AnimatePage /></LazyPage> },
          { path: "*", element: <LazyPage><NotFoundPage /></LazyPage> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <LazyPage><NotFoundPage /></LazyPage>,
  },
])

export default router
