import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import { setNodeSystemSetting } from '../../api/assistant'
import { useSnackbar } from '@/hooks/useSnackbar'
import type { KuroNode } from '../../types'

interface WindowsHardwareHudProps {
  node: KuroNode | null
  nodeId: string
  snapshot: any
  onRefresh?: () => void
}

const monoFont = 'var(--kuro-font-mono, "Space Mono", monospace)'

export const WindowsHardwareHud: React.FC<WindowsHardwareHudProps> = ({
  node,
  nodeId,
  snapshot,
  onRefresh,
}) => {
  const { showSnackbar } = useSnackbar()

  // Extract telemetry
  const telemetry = snapshot || node?.telemetry || {}
  const hardware = telemetry?.hardware || {}
  const battery = telemetry?.battery || {}
  const metadata = telemetry?.metadata || {}

  // CPU
  const cpuPercent = typeof hardware?.cpu_percent === 'number'
    ? hardware.cpu_percent
    : typeof node?.cpu_usage === 'number'
    ? node.cpu_usage
    : 0
  const cpuModel = metadata?.cpu_model || (telemetry as any)?.cpu?.model || 'Windows Processor'
  const cpuTemp = hardware?.cpu_temp_c || (telemetry as any)?.thermal?.cpu_c || null

  // RAM
  const ramUsedMb = hardware?.ram_used_mb || 0
  const ramTotalMb = hardware?.ram_total_mb || (hardware?.ram_used_mb ? hardware.ram_used_mb * 2 : 0)
  const ramPercent = ramTotalMb > 0 ? Math.round((ramUsedMb / ramTotalMb) * 100) : (node?.ram_usage || 0)
  const ramUsedGb = (ramUsedMb / 1024).toFixed(1)
  const ramTotalGb = (ramTotalMb / 1024).toFixed(1)
  const ramAvailGb = (Math.max(0, ramTotalMb - ramUsedMb) / 1024).toFixed(1)

  // GPU
  const gpuName = metadata?.gpu_name || (telemetry as any)?.gpu?.name || 'Dedicated / Integrated GPU'
  const gpuTemp = hardware?.gpu_temp_c || (telemetry as any)?.thermal?.gpu_c || null
  const gpuUsage = typeof (telemetry as any)?.gpu?.usage_percent === 'number' ? (telemetry as any).gpu.usage_percent : null

  // Power & Battery
  const hasBattery = battery?.percent !== undefined || battery?.level !== undefined
  const batteryPct = battery?.percent ?? (battery?.level ? Math.round(battery.level * 100) : 100)
  const isCharging = battery?.is_charging ?? battery?.power_ac ?? true

  // Master Volume & Audio Endpoints
  const defaultVolume = typeof telemetry?.audio?.master_volume === 'number' ? telemetry.audio.master_volume : 65
  const [masterVolume, setMasterVolume] = useState<number>(defaultVolume)
  const [isMuted, setIsMuted] = useState<boolean>(telemetry?.audio?.is_muted || false)
  const [volumeLoading, setVolumeLoading] = useState<boolean>(false)

  const handleVolumeChange = async (newVal: number) => {
    setMasterVolume(newVal)
    if (!nodeId) return
    try {
      await setNodeSystemSetting(nodeId, 'volume', newVal, { stream: 'master' })
    } catch (e: any) {
      console.error('Failed to set master volume:', e)
    }
  }

  const handleToggleMute = async () => {
    const nextMute = !isMuted
    setIsMuted(nextMute)
    if (!nodeId) return
    setVolumeLoading(true)
    try {
      await setNodeSystemSetting(nodeId, 'mute', nextMute)
      showSnackbar(`Workstation Audio ${nextMute ? 'Muted' : 'Unmuted'}`, 'info')
      onRefresh?.()
    } catch (e: any) {
      setIsMuted(!nextMute)
      showSnackbar(`Failed to toggle mute: ${e?.message || 'Error'}`, 'error')
    } finally {
      setVolumeLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 1. CPU, Memory & GPU Real-Time Gauges ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* CPU Gauge Card */}
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
                  backgroundColor: 'rgba(131, 165, 152, 0.15)',
                  color: '#83a598',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="cpu" size={16} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--kuro-color-text-primary)' }}>
                CPU Core Load
              </span>
            </div>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 14,
                fontWeight: 800,
                color: cpuPercent > 80 ? '#ea6962' : cpuPercent > 50 ? '#fabd2f' : '#8ec07c',
              }}
            >
              {cpuPercent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, cpuPercent))}%`,
                height: '100%',
                backgroundColor: cpuPercent > 80 ? '#ea6962' : cpuPercent > 50 ? '#fabd2f' : '#8ec07c',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--kuro-color-text-muted)' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
              {cpuModel}
            </span>
            {cpuTemp !== null && (
              <span style={{ fontFamily: monoFont, color: cpuTemp > 75 ? '#ea6962' : '#83a598' }}>
                🌡️ {cpuTemp}°C
              </span>
            )}
          </div>
        </div>

        {/* RAM Usage Card */}
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
                <AppIcon name="database" size={16} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--kuro-color-text-primary)' }}>
                RAM Allocation
              </span>
            </div>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 14,
                fontWeight: 800,
                color: ramPercent > 85 ? '#ea6962' : ramPercent > 65 ? '#fabd2f' : '#8ec07c',
              }}
            >
              {ramPercent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, ramPercent))}%`,
                height: '100%',
                backgroundColor: ramPercent > 85 ? '#ea6962' : ramPercent > 65 ? '#fabd2f' : '#8ec07c',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--kuro-color-text-muted)' }}>
            <span>{ramUsedGb} GB used</span>
            <span>{ramAvailGb} GB free of {ramTotalGb} GB</span>
          </div>
        </div>

        {/* GPU & Display Card */}
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
                <AppIcon name="tv" size={16} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--kuro-color-text-primary)' }}>
                Graphics Accelerator
              </span>
            </div>
            {gpuUsage !== null && (
              <span style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 800, color: '#8ec07c' }}>
                {gpuUsage}%
              </span>
            )}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {gpuName}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--kuro-color-text-muted)' }}>
            <span>Hardware Accelerated Direct3D / Vulkan</span>
            {gpuTemp !== null && (
              <span style={{ fontFamily: monoFont, color: '#8ec07c' }}>
                🌡️ {gpuTemp}°C
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Windows Audio Master HUD & Power Topology ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        {/* Windows Core Audio HUD */}
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
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
                  backgroundColor: 'rgba(250, 189, 47, 0.15)',
                  color: '#fabd2f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="volume-2" size={16} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--kuro-color-text-primary)' }}>
                Windows Master Audio Endpoint
              </span>
            </div>
            <button
              onClick={handleToggleMute}
              disabled={volumeLoading}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 5,
                backgroundColor: isMuted ? 'rgba(234, 105, 98, 0.2)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${isMuted ? 'rgba(234, 105, 98, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: isMuted ? '#ea6962' : 'var(--kuro-color-text-secondary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <AppIcon name={isMuted ? 'volume-x' : 'volume-2'} size={13} />
              <span>{isMuted ? 'MUTED' : 'ACTIVE'}</span>
            </button>
          </div>

          {/* Volume Slider Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AppIcon name={isMuted || masterVolume === 0 ? 'volume-x' : masterVolume < 40 ? 'volume-1' : 'volume-2'} size={18} color="var(--kuro-color-text-muted)" />
            <input
              type="range"
              min={0}
              max={100}
              value={masterVolume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: 'var(--kuro-color-primary, #b8bb26)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontFamily: monoFont, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', width: 40, textAlign: 'right' }}>
              {masterVolume}%
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Default WASAPI Playback Device</span>
            <span>Real-Time Volume Dispatch</span>
          </div>
        </div>

        {/* Power & AC Topology */}
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
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
                  backgroundColor: 'rgba(142, 192, 124, 0.15)',
                  color: '#8ec07c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="zap" size={16} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--kuro-color-text-primary)' }}>
                Power Architecture & Battery
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: isCharging ? 'rgba(142, 192, 124, 0.15)' : 'rgba(250, 189, 47, 0.15)',
                color: isCharging ? '#8ec07c' : '#fabd2f',
                border: `1px solid ${isCharging ? 'rgba(142, 192, 124, 0.3)' : 'rgba(250, 189, 47, 0.3)'}`,
              }}
            >
              {isCharging ? '⚡ AC POWERED' : '🔋 ON BATTERY'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>Power Profile</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginTop: 2 }}>
                Windows High Performance
              </div>
            </div>

            {hasBattery && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>Battery Charge</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#8ec07c', fontFamily: monoFont, marginTop: 2 }}>
                  {batteryPct}%
                </div>
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            Workstation Standby Timeout: Never (Always On Server Mode)
          </div>
        </div>
      </div>
    </div>
  )
}
export default WindowsHardwareHud
