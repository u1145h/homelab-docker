import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic,
  MicOff,
  Download,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  RefreshCw,
  Volume2,
  VolumeX,
  Sun,
  Clock,
  MessageSquare,
  Vibrate,
  Power,
  AlertTriangle,
} from 'lucide-react'
import { radius } from '@/design/radius'
import {
  getNodeMicrophones,
  recordNodeAudio,
  controlNodeMicStream,
  getNodeSystemStatus,
  setNodeSystemSetting,
  sendNodeSystemAction,
  type AudioRecordResult,
  type NodeSystemStatusResponse,
} from '../api/assistant'
import { useSnackbar } from '@/hooks/useSnackbar'

interface ClientHardwareTabProps {
  nodeId: string
  deviceName?: string
  platform?: string
}

const monoFont = 'var(--kuro-font-family-mono, "Space Mono", monospace)'
const sansFont = 'var(--kuro-font-family-sans, "Space Mono", sans-serif)'

export const ClientHardwareTab: React.FC<ClientHardwareTabProps> = ({
  nodeId,
  deviceName = 'Android Device',
  platform: _platform,
}) => {
  const { showSnackbar } = useSnackbar()

  // ── Dynamic Hardware Microphones State ──
  const [hardwareMics, setHardwareMics] = useState<{ id: string; name: string; deviceId?: string }[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('0')

  // ── Microphone State ──
  const [audioDuration, setAudioDuration] = useState<number>(10)
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false)
  const [audioCountdown, setAudioCountdown] = useState<number>(0)
  const [lastAudio, setLastAudio] = useState<AudioRecordResult | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)

  // ── Live Microphone Broadcast State ──
  const [isLiveMicBroadcasting, setIsLiveMicBroadcasting] = useState<boolean>(false)
  const [isLiveMuted, setIsLiveMuted] = useState<boolean>(false)
  const [liveVolume, setLiveVolume] = useState<number>(85)
  const [broadcastDurationSec, setBroadcastDurationSec] = useState<number>(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number | null>(null)

  // ── Audio Output & System Controls State ──
  const [_systemStatus, setSystemStatus] = useState<NodeSystemStatusResponse | null>(null)
  const [isRinging, setIsRinging] = useState<boolean>(false)

  // Volume sliders
  const [mediaVol, setMediaVol] = useState<number>(50)
  const [ringVol, setRingVol] = useState<number>(70)
  const [alarmVol, setAlarmVol] = useState<number>(80)
  const [notifVol, setNotifVol] = useState<number>(60)

  // Display & Screen
  const [brightness, setBrightness] = useState<number>(50)
  const [screenTimeout, setScreenTimeout] = useState<number>(60)

  // TTS & Power
  const [ttsText, setTtsText] = useState<string>('')
  const [showRebootModal, setShowRebootModal] = useState<boolean>(false)

  const fetchStatus = useCallback(async (quiet = false) => {
    if (!nodeId) return
    try {
      const data = await getNodeSystemStatus(nodeId)
      setSystemStatus(data)
      if (data.toggles) {
        setBrightness(data.toggles.brightness ?? 50)
        setScreenTimeout(data.toggles.screen_timeout_seconds ?? 60)
        setIsRinging(!!data.toggles.is_ringing)
      }
      if (data.volumes) {
        if (data.volumes.media) setMediaVol(data.volumes.media.percent)
        if (data.volumes.ring) setRingVol(data.volumes.ring.percent)
        if (data.volumes.alarm) setAlarmVol(data.volumes.alarm.percent)
        if (data.volumes.notification) setNotifVol(data.volumes.notification.percent)
      }
    } catch (e: any) {
      if (!quiet) {
        showSnackbar(`Failed to load device status: ${e.message || 'Offline'}`, 'error')
      }
    }
  }, [nodeId, showSnackbar])

  useEffect(() => {
    fetchStatus(true)
    const interval = setInterval(() => {
      fetchStatus(true)
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Volume slider change
  const handleVolumeChange = async (stream: string, val: number) => {
    try {
      await setNodeSystemSetting(nodeId, 'volume', val, { stream })
    } catch (e: any) {
      showSnackbar(`Failed to set ${stream} volume: ${e.message}`, 'error')
    }
  }

  // Brightness slider
  const handleBrightnessChange = async (val: number) => {
    setBrightness(val)
    try {
      await setNodeSystemSetting(nodeId, 'brightness', val)
    } catch (e: any) {
      showSnackbar(`Failed to set brightness: ${e.message}`, 'error')
    }
  }

  // Screen timeout dropdown
  const handleScreenTimeoutChange = async (sec: number) => {
    setScreenTimeout(sec)
    try {
      await setNodeSystemSetting(nodeId, 'screen_timeout', sec)
      showSnackbar(`Screen timeout set to ${sec < 60 ? `${sec}s` : `${sec / 60}m`}`)
    } catch (e: any) {
      showSnackbar(`Failed to set timeout: ${e.message}`, 'error')
    }
  }

  // Siren Ring
  const handleToggleRing = async () => {
    try {
      const next = !isRinging
      await sendNodeSystemAction(nodeId, next ? 'system.ring' : 'system.stop_ring')
      setIsRinging(next)
      showSnackbar(next ? 'Device siren started' : 'Device siren stopped')
    } catch (e: any) {
      showSnackbar(`Siren toggle failed: ${e.message}`, 'error')
    }
  }

  // Vibration buzz
  const handleVibrate = async (duration = 500) => {
    try {
      await sendNodeSystemAction(nodeId, 'system.vibrate', { duration_ms: duration })
      showSnackbar('Vibration pulse sent')
    } catch (e: any) {
      showSnackbar(`Vibration failed: ${e.message}`, 'error')
    }
  }

  // TTS speak
  const handleSpeak = async () => {
    if (!ttsText.trim()) return
    try {
      await sendNodeSystemAction(nodeId, 'system.speak', { text: ttsText.trim() })
      showSnackbar(`Broadcasting voice announcement...`)
      setTtsText('')
    } catch (e: any) {
      showSnackbar(`Failed to speak: ${e.message}`, 'error')
    }
  }

  // Reboot
  const handleReboot = async () => {
    setShowRebootModal(false)
    try {
      await sendNodeSystemAction(nodeId, 'system.reboot')
      showSnackbar(`Reboot command sent to ${deviceName}`)
    } catch (e: any) {
      showSnackbar(`Reboot failed: ${e.message}`, 'error')
    }
  }

  // Load client-scanned microphones from Kuro Node API
  useEffect(() => {
    if (!nodeId) return

    getNodeMicrophones(nodeId)
      .then((micRes) => {
        if (micRes?.microphones?.length > 0) {
          const parsedMics = micRes.microphones.map((m: any, idx: number) => ({
            id: String(m.id ?? idx),
            name: m.name || `Microphone ${m.id ?? idx}`,
            deviceId: String(m.device_id || m.id || idx),
          }))
          setHardwareMics(parsedMics)
          setSelectedMicId(parsedMics[0].id)
        } else {
          setHardwareMics([{ id: '0', name: 'Default Microphone' }])
        }
      })
      .catch(() => {
        setHardwareMics([{ id: '0', name: 'Default Microphone' }])
      })
  }, [nodeId])

  // Live broadcast duration timer for microphone
  useEffect(() => {
    let interval: any
    if (isLiveMicBroadcasting) {
      interval = setInterval(() => {
        setBroadcastDurationSec((prev) => prev + 1)
      }, 1000)
    } else {
      setBroadcastDurationSec(0)
    }
    return () => clearInterval(interval)
  }, [isLiveMicBroadcasting])

  // Audio Visualizer Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let phase = 0

    const renderWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (isLiveMicBroadcasting && !isLiveMuted) {
        ctx.lineWidth = 2
        ctx.strokeStyle = '#b8bb26' // Gruvbox green / Kuro theme primary
        ctx.beginPath()

        const sliceWidth = canvas.width / 40
        let x = 0

        for (let i = 0; i <= 40; i++) {
          const amp = Math.sin(phase + i * 0.3) * (canvas.height / 3.5) * (liveVolume / 100)
          const y = canvas.height / 2 + amp

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
          x += sliceWidth
        }

        ctx.stroke()
        phase += 0.12
      } else {
        // Flatline idle line
        ctx.lineWidth = 1.5
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
        ctx.beginPath()
        ctx.moveTo(0, canvas.height / 2)
        ctx.lineTo(canvas.width, canvas.height / 2)
        ctx.stroke()
      }

      animFrameRef.current = requestAnimationFrame(renderWave)
    }

    renderWave()

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isLiveMicBroadcasting, isLiveMuted, liveVolume])

  // Record short audio clip
  const handleRecordAudio = async () => {
    if (!nodeId || isRecordingAudio) return

    setIsRecordingAudio(true)
    setAudioCountdown(audioDuration)
    setAudioError(null)

    const timer = setInterval(() => {
      setAudioCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    try {
      const res = await recordNodeAudio(nodeId, audioDuration)

      if (res.success && res.file_path) {
        setLastAudio(res)
      } else {
        setAudioError(res.error || 'Failed to record audio from node.')
      }
    } catch (err: any) {
      setAudioError(err.message || 'Failed to trigger audio recording.')
    } finally {
      clearInterval(timer)
      setIsRecordingAudio(false)
      setAudioCountdown(0)
    }
  }

  // Toggle Live Microphone Broadcast
  const handleToggleLiveMic = async () => {
    if (!nodeId) return

    try {
      const nextState = !isLiveMicBroadcasting
      await controlNodeMicStream(nodeId, nextState ? 'start' : 'stop')
      setIsLiveMicBroadcasting(nextState)
    } catch (err: any) {
      setAudioError(err.message || 'Failed to toggle live microphone stream.')
    }
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 1. Microphone Input & Recording Section ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {/* Card A: Live Microphone Broadcast */}
        <div
          style={{
            padding: 16,
            borderRadius: radius.card,
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.button,
                  backgroundColor: isLiveMicBroadcasting ? 'rgba(239, 68, 68, 0.15)' : 'rgba(184, 187, 38, 0.15)',
                  color: isLiveMicBroadcasting ? 'var(--kuro-color-danger, #ef4444)' : 'var(--kuro-color-primary, #b8bb26)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${isLiveMicBroadcasting ? 'rgba(239, 68, 68, 0.3)' : 'rgba(184, 187, 38, 0.3)'}`,
                }}
              >
                {isLiveMicBroadcasting ? <MicOff size={15} /> : <Mic size={15} />}
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                  Live Microphone Stream
                </div>
                <span style={{ fontSize: 10.5, color: 'var(--kuro-color-text-muted)', fontFamily: monoFont }}>
                  {isLiveMicBroadcasting ? `LIVE (${formatTimer(broadcastDurationSec)})` : 'Standby / Inactive'}
                </span>
              </div>
            </div>

            {/* Mic Selector */}
            {hardwareMics.length > 1 && (
              <select
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                disabled={isLiveMicBroadcasting || isRecordingAudio}
                style={{
                  padding: '3px 8px',
                  borderRadius: radius.button,
                  backgroundColor: 'var(--kuro-color-surface-elevated, #161819)',
                  border: '1px solid var(--kuro-color-border)',
                  color: 'var(--kuro-color-text-primary)',
                  fontSize: 10.5,
                  fontFamily: monoFont,
                  cursor: 'pointer',
                }}
              >
                {hardwareMics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Visualizer Canvas Box */}
          <div
            style={{
              height: 56,
              borderRadius: radius.button,
              backgroundColor: '#0c0d0e',
              border: '1px solid var(--kuro-color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 8px',
            }}
          >
            <canvas ref={canvasRef} width={320} height={56} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Volume and Mute Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <button
                type="button"
                onClick={() => setIsLiveMuted(!isLiveMuted)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isLiveMuted ? 'var(--kuro-color-danger)' : 'var(--kuro-color-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: 2,
                }}
              >
                {isLiveMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isLiveMuted ? 0 : liveVolume}
                onChange={(e) => {
                  setLiveVolume(Number(e.target.value))
                  if (isLiveMuted) setIsLiveMuted(false)
                }}
                style={{ flex: 1, accentColor: 'var(--kuro-color-primary)' }}
              />
              <span style={{ fontSize: 10.5, fontFamily: monoFont, color: 'var(--kuro-color-text-muted)', minWidth: 26, textAlign: 'right' }}>
                {isLiveMuted ? '0%' : `${liveVolume}%`}
              </span>
            </div>
          </div>

          {/* Broadcast Toggle Button */}
          <button
            type="button"
            onClick={handleToggleLiveMic}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 14px',
              borderRadius: radius.button,
              border: 'none',
              backgroundColor: isLiveMicBroadcasting ? 'var(--kuro-color-danger)' : 'var(--kuro-color-primary)',
              color: isLiveMicBroadcasting ? '#ffffff' : 'var(--kuro-color-background, #14161b)',
              fontWeight: 700,
              fontSize: 12,
              fontFamily: sansFont,
              cursor: 'pointer',
              transition: 'all var(--kuro-transition-normal, 150ms)',
            }}
          >
            {isLiveMicBroadcasting ? (
              <>
                <MicOff size={14} />
                Stop Live Broadcast
              </>
            ) : (
              <>
                <Mic size={14} />
                Start Live Microphone Broadcast
              </>
            )}
          </button>
        </div>

        {/* Card B: Audio Clip Recording */}
        <div
          style={{
            padding: 16,
            borderRadius: radius.card,
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.button,
                  backgroundColor: 'color-mix(in srgb, var(--kuro-color-purple, #b16286) 14%, transparent)',
                  color: 'var(--kuro-color-purple, #b16286)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid color-mix(in srgb, var(--kuro-color-purple, #b16286) 30%, transparent)',
                }}
              >
                <Mic size={15} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                  Record Audio Clip
                </div>
                <span style={{ fontSize: 10.5, color: 'var(--kuro-color-text-muted)', fontFamily: monoFont }}>
                  Saves to <span style={{ color: 'var(--kuro-color-text-secondary)' }}>Music/Kuro</span>
                </span>
              </div>
            </div>

            {/* Duration Presets */}
            <div
              style={{
                display: 'flex',
                gap: 3,
                padding: 2,
                borderRadius: radius.button,
                backgroundColor: 'var(--kuro-color-surface-elevated, #161819)',
                border: '1px solid var(--kuro-color-border)',
              }}
            >
              {[5, 10, 30, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setAudioDuration(d)}
                  disabled={isRecordingAudio}
                  style={{
                    padding: '3px 7px',
                    borderRadius: radius.button,
                    border: 'none',
                    fontSize: 10.5,
                    fontFamily: monoFont,
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: audioDuration === d ? 'color-mix(in srgb, var(--kuro-color-purple, #b16286) 24%, transparent)' : 'transparent',
                    color: audioDuration === d ? 'var(--kuro-color-purple, #b16286)' : 'var(--kuro-color-text-muted)',
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {audioError && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: radius.button,
                backgroundColor: 'color-mix(in srgb, var(--kuro-color-danger) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--kuro-color-danger) 30%, transparent)',
                color: 'var(--kuro-color-danger)',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertCircle size={14} />
              {audioError}
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={handleRecordAudio}
            disabled={isRecordingAudio}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 14px',
              borderRadius: radius.button,
              border: 'none',
              backgroundColor: isRecordingAudio ? 'color-mix(in srgb, var(--kuro-color-purple, #b16286) 40%, transparent)' : 'var(--kuro-color-purple, #b16286)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 12,
              fontFamily: sansFont,
              cursor: isRecordingAudio ? 'not-allowed' : 'pointer',
              transition: 'all var(--kuro-transition-normal, 150ms)',
            }}
          >
            {isRecordingAudio ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Recording Audio ({audioCountdown}s remaining)...
              </>
            ) : (
              <>
                <Mic size={14} />
                Record {audioDuration}s Audio Clip
              </>
            )}
          </button>

          {/* Audio Playback Card */}
          {lastAudio && (
            <div
              style={{
                marginTop: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 10,
                borderRadius: radius.card,
                backgroundColor: 'var(--kuro-color-surface-elevated, #161819)',
                border: '1px solid var(--kuro-color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--kuro-color-success)', fontSize: 11.5, fontWeight: 700, fontFamily: monoFont }}>
                <CheckCircle2 size={14} />
                Audio Saved to Device ({lastAudio.duration_seconds}s)
              </div>

              {lastAudio.preview_b64 && (
                <audio
                  controls
                  src={lastAudio.preview_b64}
                  style={{ width: '100%', height: 32, borderRadius: 4, outline: 'none' }}
                />
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--kuro-color-text-secondary)', gap: 8, fontFamily: monoFont }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <HardDrive size={12} style={{ color: 'var(--kuro-color-purple, #b16286)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastAudio.file_path}</span>
                </div>
                {lastAudio.preview_b64 && (
                  <a
                    href={lastAudio.preview_b64}
                    download={lastAudio.file_name || 'audio.m4a'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--kuro-color-primary)',
                      textDecoration: 'none',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    <Download size={12} /> Save to PC
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Audio Output, Volume Controls & Display Brightness ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {/* Volume Sliders Card */}
        <div
          style={{
            padding: 20,
            borderRadius: radius.card,
            backgroundColor: 'var(--kuro-color-surface, #1e1e1e)',
            border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Volume2 size={18} style={{ color: 'var(--kuro-color-primary, #b8bb26)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary, #ebdbb2)' }}>
              Volume Controls
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <HardwareVolumeSliderRow
              label="Media Volume"
              percent={mediaVol}
              onChange={(v) => {
                setMediaVol(v)
                handleVolumeChange('media', v)
              }}
            />
            <HardwareVolumeSliderRow
              label="Ringtone"
              percent={ringVol}
              onChange={(v) => {
                setRingVol(v)
                handleVolumeChange('ring', v)
              }}
            />
            <HardwareVolumeSliderRow
              label="Alarm"
              percent={alarmVol}
              onChange={(v) => {
                setAlarmVol(v)
                handleVolumeChange('alarm', v)
              }}
            />
            <HardwareVolumeSliderRow
              label="Notification"
              percent={notifVol}
              onChange={(v) => {
                setNotifVol(v)
                handleVolumeChange('notification', v)
              }}
            />
          </div>
        </div>

        {/* Screen Brightness & Timeout */}
        <div
          style={{
            padding: 20,
            borderRadius: radius.card,
            backgroundColor: 'var(--kuro-color-surface, #1e1e1e)',
            border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Sun size={18} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary, #ebdbb2)' }}>
              Display Brightness ({brightness}%)
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={100}
            value={brightness}
            onChange={(e) => handleBrightnessChange(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: 'var(--kuro-color-primary, #b8bb26)',
              cursor: 'pointer',
              marginBottom: 16,
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--kuro-color-text-muted, #a89984)' }}>
              <Clock size={15} />
              <span>Screen Timeout</span>
            </div>
            <select
              value={screenTimeout}
              onChange={(e) => handleScreenTimeoutChange(Number(e.target.value))}
              style={{
                padding: '6px 10px',
                borderRadius: radius.button,
                backgroundColor: 'var(--kuro-color-bg, #14161b)',
                border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.15))',
                color: 'var(--kuro-color-text-primary, #ebdbb2)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={1800}>30 minutes</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 4. Voice Announcement & Power Actions ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {/* Text To Speech Broadcast */}
        <div
          style={{
            padding: 20,
            borderRadius: radius.card,
            backgroundColor: 'var(--kuro-color-surface, #1e1e1e)',
            border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MessageSquare size={18} style={{ color: 'var(--kuro-color-primary, #b8bb26)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary, #ebdbb2)' }}>
              Remote Voice Broadcast (TTS)
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Type message to speak over phone speaker..."
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSpeak()}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: radius.input,
                backgroundColor: 'var(--kuro-color-bg, #14161b)',
                border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.15))',
                color: 'var(--kuro-color-text-primary, #ebdbb2)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSpeak}
              disabled={!ttsText.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: radius.button,
                backgroundColor: ttsText.trim() ? 'var(--kuro-color-primary, #b8bb26)' : 'rgba(255, 255, 255, 0.05)',
                color: ttsText.trim() ? '#14161b' : 'var(--kuro-color-text-muted)',
                fontWeight: 700,
                fontSize: 13,
                border: 'none',
                cursor: ttsText.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
            >
              Speak
            </button>
          </div>
        </div>

        {/* Haptic Vibration & Power Menu */}
        <div
          style={{
            padding: 20,
            borderRadius: radius.card,
            backgroundColor: 'var(--kuro-color-surface, #1e1e1e)',
            border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary, #ebdbb2)', marginBottom: 4 }}>
              Haptic & Power Diagnostics
            </div>
            <div style={{ fontSize: 12, color: 'var(--kuro-color-text-muted, #a89984)' }}>
              Send haptic pulse, ring siren, or reboot client device
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleToggleRing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: radius.button,
                backgroundColor: isRinging ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${isRinging ? '#ef4444' : 'rgba(239, 68, 68, 0.3)'}`,
                color: '#ef4444',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Volume2 size={14} />
              <span>{isRinging ? 'Stop Siren' : 'Ring Device'}</span>
            </button>

            <button
              onClick={() => handleVibrate(500)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: radius.button,
                backgroundColor: 'var(--kuro-color-bg, #14161b)',
                border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--kuro-color-text-primary, #ebdbb2)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Vibrate size={14} />
              <span>Buzz</span>
            </button>

            <button
              onClick={() => setShowRebootModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: radius.button,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Power size={14} />
              <span>Reboot</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Reboot Confirmation Modal ── */}
      {showRebootModal && (
        <div
          onClick={() => setShowRebootModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--kuro-color-surface, #1e1e1e)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: radius.card,
              maxWidth: 420,
              width: '100%',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={24} style={{ color: '#ef4444' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                Reboot Client Device?
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--kuro-color-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              Are you sure you want to send a remote reboot signal to <strong>{deviceName}</strong>? The device will restart and temporarily disconnect.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowRebootModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: radius.button,
                  backgroundColor: 'transparent',
                  border: '1px solid var(--kuro-color-border)',
                  color: 'var(--kuro-color-text-primary)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReboot}
                style={{
                  padding: '8px 16px',
                  borderRadius: radius.button,
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Reboot Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Volume Slider Row Component ──
const HardwareVolumeSliderRow: React.FC<{
  label: string
  percent: number
  onChange: (val: number) => void
}> = ({ label, percent, onChange }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
        <span style={{ color: 'var(--kuro-color-text-secondary, #a89984)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--kuro-color-primary, #b8bb26)', fontWeight: 700 }}>{percent}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--kuro-color-primary, #b8bb26)',
          cursor: 'pointer',
        }}
      />
    </div>
  )
}

export default ClientHardwareTab
