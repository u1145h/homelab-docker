import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { TerminalProvider } from "@/features/terminal/contexts/TerminalContext"
import { UploadProvider } from "@/contexts/UploadContext"

export default function ProtectedLayout() {
  const { authenticated, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          backgroundColor: 'var(--kuro-color-background)',
        }}
      >
        <img src="/favicon.svg" alt="HomeLab" style={{ width: 56, height: 56, objectFit: 'contain' }} />
        <span
          style={{
            width: 24,
            height: 24,
            border: '3px solid var(--kuro-color-border)',
            borderTopColor: 'var(--kuro-color-accent)',
            borderRadius: '50%',
            animation: 'kuro-spin 0.6s linear infinite',
          }}
        />
        <span style={{ fontSize: 14, color: 'var(--kuro-color-text-muted)' }}>
          Checking session...
        </span>
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <UploadProvider>
      <TerminalProvider>
        <Outlet />
      </TerminalProvider>
    </UploadProvider>
  )
}
