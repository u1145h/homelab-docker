import { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { PowerConfirmationModal } from '@/components/power/PowerConfirmationModal'
import { PowerStateOverlay } from '@/components/power/PowerStateOverlay'
import { getStatus } from '@/api/status'
import type { SystemInfo } from '@/types/status'
import { radius } from '@/design/radius'

export function PowerSection() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [isRebooting, setIsRebooting] = useState(false)

  useEffect(() => {
    getStatus()
      .then((data) => setSystemInfo(data.system))
      .catch(() => setSystemInfo(null))
      .finally(() => setLoading(false))
  }, [])

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${mins}m`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Overview Card */}
      <div
        style={{
          padding: 20,
          borderRadius: radius.card,
          border: '1px solid var(--kuro-color-border)',
          backgroundColor: 'var(--kuro-color-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(169, 182, 101, 0.12)',
                color: 'var(--kuro-color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="server" size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--kuro-color-text-h)' }}>
                Host System Information
              </h3>
              <p style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', margin: '2px 0 0 0' }}>
                Current node power state and operational metrics
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 20,
              backgroundColor: 'rgba(169, 182, 101, 0.15)',
              color: 'var(--kuro-color-success)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <AppIcon name="check-circle" size={12} />
            SYSTEM ONLINE
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 4 }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: radius.button,
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              border: '1px solid var(--kuro-color-border)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Hostname
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kuro-color-text-h)', marginTop: 4, fontFamily: 'monospace' }}>
              {loading ? '...' : systemInfo?.hostname || 'homelab-host'}
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: radius.button,
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              border: '1px solid var(--kuro-color-border)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Operating System
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kuro-color-text-h)', marginTop: 4 }}>
              {loading ? '...' : `${systemInfo?.os || 'Linux'} (${systemInfo?.arch || 'x86_64'})`}
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: radius.button,
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              border: '1px solid var(--kuro-color-border)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              System Uptime
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kuro-color-text-h)', marginTop: 4 }}>
              {loading ? '...' : formatUptime(systemInfo?.uptime)}
            </div>
          </div>
        </div>
      </div>

      {/* Power Control Action */}
      <div style={{ maxWidth: 420 }}>
        {/* Reboot Card */}
        <div
          style={{
            padding: 20,
            borderRadius: radius.card,
            border: '1px solid var(--kuro-color-border)',
            backgroundColor: 'var(--kuro-color-surface)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(230, 195, 132, 0.15)',
                color: 'var(--kuro-color-warning, #e6c384)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="rotate-cw" size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--kuro-color-text-h)' }}>
                Reboot Server
              </h4>
              <p style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                Safely restarts the host system. All containers and system services will be stopped and restarted.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: radius.button,
              border: '1px solid rgba(230, 195, 132, 0.4)',
              backgroundColor: 'rgba(230, 195, 132, 0.1)',
              color: 'var(--kuro-color-warning, #e6c384)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(230, 195, 132, 0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(230, 195, 132, 0.1)' }}
          >
            <AppIcon name="rotate-cw" size={14} />
            Reboot Server
          </button>
        </div>
      </div>

      {/* Confirmation Modal & Overlay */}
      <PowerConfirmationModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSuccess={() => setIsRebooting(true)}
      />

      <PowerStateOverlay active={isRebooting} />
    </div>
  )
}
