import { useEffect, useState } from 'react'
import { CircularProgress, Typography } from '@mui/material'
import { AppIcon } from '@/components/ui/icons'

interface PowerStateOverlayProps {
  active: boolean
}

export function PowerStateOverlay({ active }: PowerStateOverlayProps) {
  const [reconnected, setReconnected] = useState(false)
  const [pingCount, setPingCount] = useState(0)

  useEffect(() => {
    if (!active) {
      setReconnected(false)
      setPingCount(0)
      return
    }

    const interval = setInterval(async () => {
      setPingCount((prev) => prev + 1)
      try {
        const res = await fetch('/api/v1/health', { method: 'GET', cache: 'no-store' })
        if (res.ok) {
          setReconnected(true)
          clearInterval(interval)
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        }
      } catch {
        // Server still restarting / unreachable
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [active])

  if (!active) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(10, 12, 14, 0.94)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: 'rgba(230, 195, 132, 0.12)',
          color: 'var(--kuro-color-warning, #e6c384)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          border: '1px solid rgba(230, 195, 132, 0.25)',
        }}
      >
        <AppIcon name="rotate-cw" size={32} />
      </div>

      <Typography variant="h5" style={{ fontWeight: 700, color: 'var(--kuro-color-text-h)', marginBottom: 8 }}>
        {reconnected ? 'Server Reconnected!' : 'Server is Rebooting'}
      </Typography>

      <Typography
        variant="body2"
        style={{ color: 'var(--kuro-color-text-secondary)', maxWidth: 420, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}
      >
        {reconnected
          ? 'Host system has successfully restarted. Reloading application...'
          : 'Power reboot action initiated. Waiting for the server system to restart and services to come back online...'}
      </Typography>

      {!reconnected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <CircularProgress size={18} style={{ color: 'var(--kuro-color-warning, #e6c384)' }} />
          <Typography variant="caption" style={{ color: 'var(--kuro-color-text-secondary)', fontSize: 12 }}>
            Pinging server ({pingCount > 0 ? `attempt ${pingCount}` : 'connecting...'})
          </Typography>
        </div>
      )}
    </div>
  )
}
