import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import { sendNodeSystemAction } from '../../api/assistant'
import { useSnackbar } from '@/hooks/useSnackbar'
import type { KuroNode } from '../../types'

interface WindowsWorkstationOverviewProps {
  node: KuroNode | null
  nodeId: string
  snapshot: any
  onRefresh?: () => void
}

const monoFont = 'var(--kuro-font-mono, "Space Mono", monospace)'

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s'
  const days = Math.floor(seconds / 86400)
  const hrs = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hrs > 0) parts.push(`${hrs}h`)
  if (mins > 0) parts.push(`${mins}m`)
  if (parts.length === 0 || secs > 0) parts.push(`${secs}s`)
  return parts.slice(0, 3).join(' ')
}

export const WindowsWorkstationOverview: React.FC<WindowsWorkstationOverviewProps> = ({
  node,
  nodeId,
  snapshot,
  onRefresh,
}) => {
  const { showSnackbar } = useSnackbar()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Extract snapshot fields
  const telemetry = snapshot || node?.telemetry || {}
  const rawContext = telemetry?.context || (node?.telemetry as any)?.context
  const rawMedia = telemetry?.media || (node?.telemetry as any)?.media
  const hardware = telemetry?.hardware || {}
  const network = telemetry?.network || {}
  const metadata = telemetry?.metadata || {}

  // Windows System Identity
  const gpuName = metadata?.gpu_name || (telemetry as any)?.gpu?.name || 'Dedicated / Integrated GPU'
  const cpuModel = metadata?.cpu_model || (telemetry as any)?.cpu?.model || 'Windows x64 / ARM64 Processor'
  const osVersion = hardware?.os_version || metadata?.os_version || 'Windows 11/10 Pro'
  const isAdmin = metadata?.is_admin ?? hardware?.is_admin ?? false
  const uptimeSec = hardware?.uptime_seconds || 0
  const hostname = network?.hostname || node?.hostname || nodeId

  // Active Context & Focused Window
  const activeApp = rawContext?.active_process_name || telemetry?.active_app || null
  const activeTitle = rawContext?.active_window_title || telemetry?.active_window || null
  const idleSec = rawContext?.user_idle_seconds || 0
  const isLocked = rawContext?.is_screen_locked || false

  // GSMTC Media Transport
  const mediaTrack = rawMedia?.track || null
  const mediaArtist = rawMedia?.artist || null
  const mediaAlbum = rawMedia?.album || null
  const mediaSource = rawMedia?.source || 'Windows Media Session'
  const mediaStatus = rawMedia?.status || 'stopped'

  // Network
  const localIp = network?.local_ip || node?.ip_address || '127.0.0.1'

  // System Action Handler
  const handleSystemAction = async (actionKey: string, label: string) => {
    if (!nodeId) return
    setActionLoading(actionKey)
    try {
      if (actionKey === 'lock') {
        await sendNodeSystemAction(nodeId, 'system.lock')
        showSnackbar('Workstation locked successfully', 'success')
      } else if (actionKey === 'media_play_pause') {
        await sendNodeSystemAction(nodeId, 'system.media.play_pause')
        showSnackbar('Media play/pause triggered', 'info')
      } else if (actionKey === 'media_next') {
        await sendNodeSystemAction(nodeId, 'system.media.next')
        showSnackbar('Next track', 'info')
      } else if (actionKey === 'media_prev') {
        await sendNodeSystemAction(nodeId, 'system.media.previous')
        showSnackbar('Previous track', 'info')
      } else if (actionKey === 'sleep') {
        await sendNodeSystemAction(nodeId, 'system.sleep')
        showSnackbar('Sent sleep signal to workstation', 'info')
      } else if (actionKey === 'restart') {
        if (window.confirm(`Are you sure you want to reboot ${hostname}?`)) {
          await sendNodeSystemAction(nodeId, 'system.reboot')
          showSnackbar('Sent reboot signal to workstation', 'warning')
        }
      }
      onRefresh?.()
    } catch (err: any) {
      showSnackbar(`Failed to execute ${label}: ${err?.message || 'Error'}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 1. Workstation Identity & Key Metrics Strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {/* Hostname & OS */}
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: 'rgba(184, 187, 38, 0.15)',
              color: 'var(--kuro-color-primary, #b8bb26)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="monitor" size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Host Machine
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hostname}
            </div>
            <div style={{ fontSize: 11, color: '#83a598', marginTop: 1 }}>
              {osVersion}
            </div>
          </div>
        </div>

        {/* CPU & GPU Specs */}
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: 'rgba(131, 165, 152, 0.15)',
              color: '#83a598',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="cpu" size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Processor & GPU
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cpuModel}
            </div>
            <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {gpuName}
            </div>
          </div>
        </div>

        {/* Uptime & Session */}
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: 'rgba(250, 189, 47, 0.15)',
              color: '#fabd2f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="clock" size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              System Uptime
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)', fontFamily: monoFont }}>
              {formatDuration(uptimeSec)}
            </div>
            <div style={{ fontSize: 11, color: isAdmin ? 'var(--kuro-color-primary, #b8bb26)' : '#a89984' }}>
              {isAdmin ? '🛡️ Administrator Privilege' : 'Standard User Privilege'}
            </div>
          </div>
        </div>

        {/* Quick Power / Lock Action Bar */}
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Workstation Controls
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => handleSystemAction('lock', 'Lock Workstation')}
              disabled={actionLoading === 'lock'}
              title="Lock Windows Screen"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: radius.button,
                backgroundColor: 'rgba(234, 105, 98, 0.15)',
                border: '1px solid rgba(234, 105, 98, 0.3)',
                color: '#ea6962',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <AppIcon name="lock" size={13} />
              <span>Lock</span>
            </button>

            <button
              onClick={() => handleSystemAction('sleep', 'Sleep Workstation')}
              disabled={actionLoading === 'sleep'}
              title="Sleep Workstation"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: radius.button,
                backgroundColor: 'rgba(250, 189, 47, 0.15)',
                border: '1px solid rgba(250, 189, 47, 0.3)',
                color: '#fabd2f',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <AppIcon name="moon" size={13} />
              <span>Sleep</span>
            </button>

            <button
              onClick={() => handleSystemAction('restart', 'Reboot Workstation')}
              disabled={actionLoading === 'restart'}
              title="Reboot Workstation"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: radius.button,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'var(--kuro-color-text-secondary, #a89984)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <AppIcon name="refresh-cw" size={13} />
              <span>Reboot</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Active Window Context & GSMTC Media Deck ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        {/* Active Window Context */}
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: 'rgba(184, 187, 38, 0.15)',
                  color: 'var(--kuro-color-primary, #b8bb26)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="layout" size={15} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--kuro-color-text-primary)' }}>
                Active Foreground Application
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: isLocked ? 'rgba(234, 105, 98, 0.15)' : 'rgba(184, 187, 38, 0.15)',
                color: isLocked ? '#ea6962' : 'var(--kuro-color-primary, #b8bb26)',
                border: `1px solid ${isLocked ? 'rgba(234, 105, 98, 0.3)' : 'rgba(184, 187, 38, 0.3)'}`,
              }}
            >
              {isLocked ? '🔒 SCREEN LOCKED' : '⚡ WORKSTATION ACTIVE'}
            </span>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Process:</span>
              <span style={{ fontFamily: monoFont, fontSize: 13, fontWeight: 700, color: '#83a598' }}>
                {activeApp || 'Desktop / Shell Experience'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Title:</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--kuro-color-text-primary)',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}
              >
                {activeTitle || 'No active window focus'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            <span>
              User Idle Timer: <strong style={{ color: idleSec > 300 ? '#fabd2f' : 'var(--kuro-color-text-secondary)' }}>{formatDuration(idleSec)}</strong>
            </span>
            <span>
              Network IP: <strong style={{ fontFamily: monoFont, color: 'var(--kuro-color-text-secondary)' }}>{localIp}</strong>
            </span>
          </div>
        </div>

        {/* GSMTC Media Transport Deck */}
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: 'rgba(211, 134, 155, 0.15)',
                  color: '#d3869b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="music" size={15} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--kuro-color-text-primary)' }}>
                Media Transport (GSMTC)
              </span>
            </div>
            {mediaTrack && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: mediaStatus === 'playing' ? 'rgba(184, 187, 38, 0.15)' : 'rgba(255,255,255,0.08)',
                  color: mediaStatus === 'playing' ? 'var(--kuro-color-primary, #b8bb26)' : '#a89984',
                  border: '1px solid rgba(255,255,255,0.1)',
                  textTransform: 'uppercase',
                }}
              >
                {mediaStatus === 'playing' ? '▶ PLAYING' : '⏸ PAUSED'}
              </span>
            )}
          </div>

          {mediaTrack ? (
            <div
              style={{
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                🎵 {mediaTrack}
              </div>
              <div style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mediaArtist || 'Unknown Artist'} {mediaAlbum ? `• ${mediaAlbum}` : ''}
              </div>
              <div style={{ fontSize: 10.5, color: '#d3869b', marginTop: 2 }}>
                App: {mediaSource}
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 8,
                padding: '20px 14px',
                textAlign: 'center',
                color: 'var(--kuro-color-text-muted)',
                fontSize: 12,
              }}
            >
              No active media session on Windows GSMTC bus
            </div>
          )}

          {/* Media Transport Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 'auto' }}>
            <button
              onClick={() => handleSystemAction('media_prev', 'Previous Track')}
              title="Previous Track"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--kuro-color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <AppIcon name="skip-back" size={15} />
            </button>
            <button
              onClick={() => handleSystemAction('media_play_pause', 'Play/Pause')}
              title="Play / Pause"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: 'var(--kuro-color-primary, #b8bb26)',
                border: 'none',
                color: '#14161b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(184, 187, 38, 0.4)',
              }}
            >
              <AppIcon name={mediaStatus === 'playing' ? 'pause' : 'play'} size={18} />
            </button>
            <button
              onClick={() => handleSystemAction('media_next', 'Next Track')}
              title="Next Track"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--kuro-color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <AppIcon name="skip-forward" size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
export default WindowsWorkstationOverview
