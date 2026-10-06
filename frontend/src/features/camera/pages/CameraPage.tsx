import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
import { NavigationBar } from '@capawesome/capacitor-navigation-bar'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import client from '@/api/client'
import { authStorage } from '@/utils/authStorage'
import * as prefsApi from '@/features/settings/api/preferences'
import {
  getConnectedNodes,
  getNodeCameras,
  captureNodePhoto,
  recordNodeVideo,
  controlNodeCameraStream,
  getNodeCameraStreamFrame,
} from '@/features/assistant/api/assistant'
import type { KuroNode } from '@/features/assistant/types'

interface ScreenOrientationPlugin {
  lock(options: { orientation: string }): Promise<void>
  unlock(): Promise<void>
}

const ScreenOrientation = registerPlugin<ScreenOrientationPlugin>('ScreenOrientation')

export function getRotationDegree(orientation: string | undefined): number {
  if (!orientation) return 0
  if (orientation === 'landscape') return 0
  if (orientation === 'portrait') return 90
  const parsed = parseInt(String(orientation).replace(/[^0-9]/g, ''), 10)
  return isNaN(parsed) ? 0 : parsed
}

export interface CameraDevice {
  id: string
  name: string
  type: 'back' | 'front' | 'usb' | 'generic'
  path: string
  driver: string
  resolutions: string[]
  status: string
  facing?: 'front' | 'back' | 'external'
  deviceId?: string
}

interface CameraStreamFeedProps {
  devicePath: string
  resolution: string
  orientationMode: string
  apiBase: string
  token: string
  mjpegUrl: string
}

function CameraStreamFeed({
  devicePath,
  resolution,
  orientationMode,
  apiBase,
  token,
  mjpegUrl,
}: CameraStreamFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [useFallback, setUseFallback] = useState(false)

  const deg = getRotationDegree(orientationMode)
  const isVertical = deg === 90 || deg === 270

  useEffect(() => {
    let active = true
    let ws: WebSocket | null = null

    // Determine WS URL
    let wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    let wsHost = window.location.host

    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      try {
        const u = new URL(apiBase)
        wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
        wsHost = u.host
      } catch {}
    }

    const wsUrl = `${wsProtocol}//${wsHost}/ws/camera/stream?device=${encodeURIComponent(devicePath)}&res=${encodeURIComponent(resolution)}&token=${encodeURIComponent(token)}`

    setUseFallback(false)

    try {
      ws = new WebSocket(wsUrl)
      ws.binaryType = 'blob'

      let isDrawing = false

      ws.onmessage = async (event) => {
        if (!active || !(event.data instanceof Blob)) return
        if (isDrawing) return // Drop frame if rendering cannot keep up (zero backlog)

        isDrawing = true
        try {
          const blob = event.data
          if ('createImageBitmap' in window) {
            const bitmap = await createImageBitmap(blob)
            if (active && canvasRef.current) {
              const canvas = canvasRef.current
              if (canvas.width !== bitmap.width) canvas.width = bitmap.width
              if (canvas.height !== bitmap.height) canvas.height = bitmap.height
              const ctx = canvas.getContext('2d')
              if (ctx) {
                ctx.drawImage(bitmap, 0, 0)
              }
            }
            bitmap.close()
          } else {
            const img = new Image()
            const url = URL.createObjectURL(blob)
            img.onload = () => {
              if (active && canvasRef.current) {
                const canvas = canvasRef.current
                if (canvas.width !== img.width) canvas.width = img.width
                if (canvas.height !== img.height) canvas.height = img.height
                const ctx = canvas.getContext('2d')
                if (ctx) ctx.drawImage(img, 0, 0)
              }
              URL.revokeObjectURL(url)
            }
            img.src = url
          }
        } catch (e) {
          console.warn('Frame render error:', e)
        } finally {
          isDrawing = false
        }
      }

      ws.onerror = () => {
        if (active) {
          console.warn('[CameraWS] Connection error, falling back to MJPEG')
          setUseFallback(true)
        }
      }

      ws.onclose = () => {
        if (active && !useFallback) {
          setUseFallback(true)
        }
      }
    } catch (e) {
      if (active) {
        setUseFallback(true)
      }
    }

    return () => {
      active = false
      if (ws) {
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
        ws.close()
      }
    }
  }, [devicePath, resolution, apiBase, token])

  const feedStyle: React.CSSProperties = {
    width: isVertical ? '177.78%' : '100%',
    height: isVertical ? '56.25%' : '100%',
    transform: deg !== 0 ? `rotate(${deg}deg)` : 'none',
    transformOrigin: 'center center',
    objectFit: 'cover',
    display: 'block',
    flexShrink: 0,
    transition: 'transform 0.3s ease',
  }

  if (useFallback) {
    return (
      <img
        src={mjpegUrl}
        alt="Camera Live Stream Feed (MJPEG)"
        style={feedStyle}
        onError={() => console.warn('Stream feed connecting...')}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={feedStyle}
    />
  )
}

export function CameraPage() {
  useDocumentTitle('Camera Monitor & Controls')

  // ── Source Device Selection State (Server vs Connected Kuro Client Nodes) ──
  const [deviceSource, setDeviceSource] = useState<string>('server') // 'server' or nodeId
  const [nodes, setNodes] = useState<KuroNode[]>([])
  const [nodesLoading, setNodesLoading] = useState<boolean>(false)

  // ── Camera Hardware State ──
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<CameraDevice | null>(null)
  const [resolution, setResolution] = useState<string>('1280x720')
  const [isStreaming, setIsStreaming] = useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [orientationMode, setOrientationMode] = useState<string>('0')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<string[]>([])

  // ── Remote Client Live Streaming & Recording State ──
  const [clientLiveFrame, setClientLiveFrame] = useState<string | null>(null)
  const [clientLiveFps, setClientLiveFps] = useState<number>(0)
  const [isCapturingPhoto, setIsCapturingPhoto] = useState<boolean>(false)
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false)
  const [videoDuration, setVideoDuration] = useState<number>(10)
  const [videoCountdown, setVideoCountdown] = useState<number>(0)
  const frameCountRef = useRef<number>(0)
  const lastFpsCalcRef = useRef<number>(Date.now())

  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Active selected node object
  const activeNode = useMemo(() => {
    return deviceSource === 'server' ? null : nodes.find((n) => n.id === deviceSource)
  }, [deviceSource, nodes])

  const isWindowsNode = useMemo(() => {
    return activeNode?.platform?.toLowerCase() === 'windows' || activeNode?.id?.toLowerCase().includes('win')
  }, [activeNode])

  // Helper to extract facing ('front' | 'back')
  const getDeviceFacing = (dev?: CameraDevice | null): 'front' | 'back' => {
    if (!dev) return 'back'
    if (dev.facing === 'front' || dev.type === 'front') return 'front'
    return 'back'
  }

  // Load saved default orientation preference on first mount
  useEffect(() => {
    prefsApi.getPreferences()
      .then((p) => {
        const saved = (p as any).camera_default_orientation
        if (saved !== undefined && saved !== null && saved !== '') {
          setOrientationMode(String(saved))
        }
      })
      .catch(() => { /* ignore — keep default */ })
  }, [])

  // Fetch connected Kuro nodes on mount
  useEffect(() => {
    fetchConnectedNodes()
  }, [])

  const fetchConnectedNodes = async () => {
    setNodesLoading(true)
    try {
      const nodeList = await getConnectedNodes()
      setNodes(nodeList || [])
    } catch (e) {
      console.warn('Failed to fetch connected client nodes:', e)
    } finally {
      setNodesLoading(false)
    }
  }

  // Fetch camera devices whenever deviceSource changes
  useEffect(() => {
    fetchDevicesForSource(deviceSource)
  }, [deviceSource])

  const fetchDevicesForSource = async (sourceId: string) => {
    setLoading(true)
    setError(null)
    setClientLiveFrame(null)
    setClientLiveFps(0)

    if (sourceId === 'server') {
      try {
        const res = await client.get<{ devices: CameraDevice[] }>('/camera/devices')
        if (res.data.devices && res.data.devices.length > 0) {
          // Deduplicate identical paths
          const seen = new Set<string>()
          const uniqueDevs = res.data.devices.filter((d: CameraDevice) => {
            const key = d.path || d.id
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          setDevices(uniqueDevs)
          const mainCam = uniqueDevs.find((d: CameraDevice) => d.path === '/dev/video2') || uniqueDevs[0]
          setSelectedDevice(mainCam)
          setResolution('1280x720')
        } else {
          setDevices([])
          setSelectedDevice(null)
          setError('No camera hardware or video nodes detected on this server device.')
        }
      } catch (err: any) {
        setError(err.message || 'Error connecting to server camera daemon')
      } finally {
        setLoading(false)
      }
    } else {
      // Fetch devices for client node (Android or Windows)
      try {
        const camRes = await getNodeCameras(sourceId)
        const targetNode = nodes.find((n) => n.id === sourceId)
        const isWin = targetNode?.platform?.toLowerCase() === 'windows' || sourceId.toLowerCase().includes('win')

        if (camRes?.cameras && camRes.cameras.length > 0) {
          // Deduplicate camera entries
          const seenKeys = new Set<string>()
          const parsed: CameraDevice[] = []

          camRes.cameras.forEach((c: any, idx: number) => {
            const facing = (c.facing === 'front' ? 'front' : c.facing === 'external' ? 'usb' : 'back') as 'front' | 'back' | 'usb'
            const devId = String(c.device_id || (c.id ?? idx))
            const uniqueKey = `${facing}-${devId}`

            if (seenKeys.has(uniqueKey) && camRes.cameras.length > 2) {
              return
            }
            seenKeys.add(uniqueKey)

            let label = c.name
            if (!label) {
              if (isWin) {
                label = idx === 0 ? 'Integrated Webcam' : `Camera ${idx + 1}`
              } else {
                label = facing === 'front' ? 'Front Camera (Selfie)' : idx === 0 ? 'Main Back Camera' : `Rear Camera ${idx + 1}`
              }
            }

            parsed.push({
              id: String(c.id ?? idx),
              name: label,
              type: facing === 'front' ? 'front' : isWin ? 'usb' : 'back',
              path: c.device_id || (isWin ? `WinCamera-${idx}` : `/dev/camera/${c.id ?? idx}`),
              driver: isWin ? 'DirectShow / MediaFoundation' : 'Android Camera2 NDK',
              resolutions: c.supported_resolutions || ['1920x1080', '1280x720', '640x480'],
              status: 'active',
              facing: facing === 'front' ? 'front' : 'back',
              deviceId: devId,
            })
          })

          setDevices(parsed)
          setSelectedDevice(parsed[0] || null)
          setResolution('720p')
        } else {
          // Fallback architecture-specific defaults
          if (isWin) {
            const defaultWinCams: CameraDevice[] = [
              {
                id: '0',
                name: 'Integrated Webcam / Main Camera',
                type: 'usb',
                path: 'USB\\VID_046D&PID_0825',
                driver: 'DirectShow / PnP Camera Entity',
                resolutions: ['1920x1080', '1280x720', '640x480'],
                status: 'active',
                facing: 'back',
              },
            ]
            setDevices(defaultWinCams)
            setSelectedDevice(defaultWinCams[0])
            setResolution('720p')
          } else {
            const defaultAndroidCams: CameraDevice[] = [
              {
                id: '0',
                name: 'Main Back Camera (Rear Primary)',
                type: 'back',
                path: 'Camera 0 (Back)',
                driver: 'Android Camera2 HAL',
                resolutions: ['1920x1080', '1280x720', '640x480'],
                status: 'active',
                facing: 'back',
              },
              {
                id: '1',
                name: 'Front Camera (Selfie)',
                type: 'front',
                path: 'Camera 1 (Front)',
                driver: 'Android Camera2 HAL',
                resolutions: ['1920x1080', '1280x720', '640x480'],
                status: 'active',
                facing: 'front',
              },
            ]
            setDevices(defaultAndroidCams)
            setSelectedDevice(defaultAndroidCams[0])
            setResolution('720p')
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || 'Failed to query camera hardware from client device.')
      } finally {
        setLoading(false)
      }
    }
  }

  // Handle client node live streaming frame poller
  useEffect(() => {
    let poller: any
    let active = true

    if (deviceSource !== 'server' && isStreaming && selectedDevice) {
      // Start client stream
      const facing = getDeviceFacing(selectedDevice)
      controlNodeCameraStream(deviceSource, 'start', facing, resolution).catch(() => {})

      poller = setInterval(async () => {
        if (!active) return
        try {
          const res = await getNodeCameraStreamFrame(deviceSource)
          if (res?.has_frame && res?.frame_b64) {
            setClientLiveFrame(res.frame_b64)
            frameCountRef.current += 1

            const now = Date.now()
            if (now - lastFpsCalcRef.current >= 1000) {
              setClientLiveFps(frameCountRef.current)
              frameCountRef.current = 0
              lastFpsCalcRef.current = now
            }
          }
        } catch (_: any) {}
      }, 70) // ~14-16 FPS
    } else {
      setClientLiveFrame(null)
      setClientLiveFps(0)
      if (deviceSource !== 'server') {
        const facing = getDeviceFacing(selectedDevice)
        controlNodeCameraStream(deviceSource, 'stop', facing, resolution).catch(() => {})
      }
    }

    return () => {
      active = false
      if (poller) clearInterval(poller)
      if (deviceSource !== 'server') {
        controlNodeCameraStream(deviceSource, 'stop').catch(() => {})
      }
    }
  }, [deviceSource, isStreaming, selectedDevice?.id, resolution])

  const handleDeviceChange = async (dev: CameraDevice) => {
    setSelectedDevice(dev)
    setIsStreaming(true)
    if (deviceSource !== 'server') {
      const facing = getDeviceFacing(dev)
      try {
        await controlNodeCameraStream(deviceSource, 'switch', facing, resolution)
      } catch (e) {
        console.warn('Switch camera stream error:', e)
      }
    }
  }

  const handleResolutionChange = async (newRes: string) => {
    setResolution(newRes)
    if (deviceSource !== 'server' && isStreaming && selectedDevice) {
      const facing = getDeviceFacing(selectedDevice)
      try {
        await controlNodeCameraStream(deviceSource, 'switch', facing, newRes)
      } catch (e) {
        console.warn('Resolution change error:', e)
      }
    }
  }

  const apiBase = (client.defaults.baseURL || '/api/v1').replace(/\/+$/, '')
  const token = authStorage.getToken() || ''

  // Snapshot handler (Server vs Client)
  const handleSnapshot = async () => {
    if (!selectedDevice) return

    if (deviceSource === 'server') {
      const snapshotUrl = `${apiBase}/camera/snapshot?device=${encodeURIComponent(selectedDevice.path)}&token=${encodeURIComponent(token)}&t=${Date.now()}`
      setSnapshots((prev) => [snapshotUrl, ...prev.slice(0, 7)])

      const link = document.createElement('a')
      link.href = snapshotUrl
      link.download = `snapshot_server_${selectedDevice.type}_${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      // Client node photo capture
      setIsCapturingPhoto(true)
      try {
        const facing = getDeviceFacing(selectedDevice)
        const res = await captureNodePhoto(deviceSource, facing)
        if (res?.preview_b64) {
          setSnapshots((prev) => [res.preview_b64!, ...prev.slice(0, 7)])
        }
      } catch (err: any) {
        alert(err?.response?.data?.error || err.message || 'Photo capture failed on client device')
      } finally {
        setIsCapturingPhoto(false)
      }
    }
  }

  // Client video recording handler
  const handleRecordVideo = async () => {
    if (deviceSource === 'server' || !selectedDevice || isRecordingVideo) return
    setIsRecordingVideo(true)
    setVideoCountdown(videoDuration)

    const timer = setInterval(() => {
      setVideoCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    try {
      const facing = getDeviceFacing(selectedDevice)
      const res = await recordNodeVideo(deviceSource, facing, videoDuration)
      if (res?.file_path) {
        alert(`Video saved to client device storage: ${res.file_name || res.file_path}`)
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Video recording failed on client device')
    } finally {
      clearInterval(timer)
      setIsRecordingVideo(false)
      setVideoCountdown(0)
    }
  }

  const streamUrl = selectedDevice && isStreaming && deviceSource === 'server'
    ? `${apiBase}/camera/stream?device=${encodeURIComponent(selectedDevice.path)}&res=${resolution}&token=${encodeURIComponent(token)}&t=${selectedDevice.id}`
    : ''

  // Screen orientation lock
  const applyOrientation = async (mode: string) => {
    const deg = getRotationDegree(mode)
    const lockMode = (deg === 90 || deg === 270) ? 'portrait' : 'landscape'
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ orientation: lockMode })
      } catch (e) {
        console.warn(`Capacitor ScreenOrientation lock (${lockMode}) warning:`, e)
      }
    } else if (screen.orientation && 'lock' in screen.orientation) {
      try {
        await (screen.orientation as any).lock(lockMode)
      } catch (e) {
        console.warn(`Web screen.orientation lock (${lockMode}) warning:`, e)
      }
    }
  }

  const lockCurrentOrientation = async () => {
    await applyOrientation(orientationMode)
    if (Capacitor.isNativePlatform()) {
      try {
        await StatusBar.hide()
      } catch (e) {}
      try {
        await NavigationBar.hide()
      } catch (e) {}
      try {
        ;(window as any).AndroidThemeBridge?.setFullscreen?.(true)
      } catch (e) {}
    }
  }

  const unlockOrientation = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.unlock()
      } catch (e) {}
      try {
        await StatusBar.show()
      } catch (e) {}
      try {
        await NavigationBar.show()
      } catch (e) {}
      try {
        ;(window as any).AndroidThemeBridge?.setFullscreen?.(false)
      } catch (e) {}
    } else if (screen.orientation && 'unlock' in screen.orientation) {
      try {
        screen.orientation.unlock()
      } catch (e) {}
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !document.fullscreenElement
      setIsFullscreen(isFull)
      if (!isFull) {
        unlockOrientation()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreenMode()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      window.removeEventListener('keydown', handleKeyDown)
      unlockOrientation()
    }
  }, [isFullscreen])

  const enterFullscreenMode = async () => {
    setIsFullscreen(true)
    await lockCurrentOrientation()

    if (videoContainerRef.current && document.fullscreenEnabled) {
      try {
        if (!document.fullscreenElement) {
          await videoContainerRef.current.requestFullscreen()
        }
      } catch (err) {
        console.warn('Native requestFullscreen unsupported or failed, using Portal overlay:', err)
      }
    }
  }

  const exitFullscreenMode = async () => {
    setIsFullscreen(false)
    await unlockOrientation()

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch (err) {
        console.warn('document.exitFullscreen failed:', err)
      }
    }
  }

  const toggleFullscreen = async () => {
    if (isFullscreen || !document.fullscreenElement) {
      await exitFullscreenMode()
    } else {
      await enterFullscreenMode()
    }
  }

  const deg = getRotationDegree(orientationMode)
  const isVertical = deg === 90 || deg === 270

  const renderVideoPlayer = () => (
    <div
      ref={videoContainerRef}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        right: isFullscreen ? 0 : undefined,
        bottom: isFullscreen ? 0 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        maxWidth: isFullscreen ? '100vw' : isVertical ? '450px' : '100%',
        height: isFullscreen ? '100vh' : undefined,
        maxHeight: isFullscreen ? '100vh' : isVertical ? '750px' : undefined,
        zIndex: isFullscreen ? 2147483647 : 1,
        backgroundColor: '#090a0c',
        border: isFullscreen ? 'none' : '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
        borderRadius: isFullscreen ? 0 : radius.card,
        overflow: 'hidden',
        aspectRatio: isFullscreen ? (isVertical ? '9/16' : undefined) : (isVertical ? '9/16' : '16/9'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isFullscreen ? 'none' : '0 8px 30px rgba(0, 0, 0, 0.4)',
        margin: isFullscreen ? 0 : isVertical ? '0 auto' : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Live Video Frame Stream */}
      {isStreaming && selectedDevice ? (
        deviceSource === 'server' ? (
          <CameraStreamFeed
            devicePath={selectedDevice.path}
            resolution={resolution}
            orientationMode={orientationMode}
            apiBase={apiBase}
            token={token}
            mjpegUrl={streamUrl}
          />
        ) : clientLiveFrame ? (
          <img
            src={clientLiveFrame}
            alt="Client Live Camera Feed"
            style={{
              width: isVertical ? '177.78%' : '100%',
              height: isVertical ? '56.25%' : '100%',
              transform: deg !== 0 ? `rotate(${deg}deg)` : 'none',
              transformOrigin: 'center center',
              objectFit: 'contain',
              display: 'block',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--kuro-color-text-muted)', padding: 30 }}>
            <div style={{ display: 'inline-block', animation: 'spin 1.5s linear infinite', marginBottom: 10, color: 'var(--kuro-color-primary, #b8bb26)' }}>
              <AppIcon name="refresh-cw" size={30} />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
              Connecting to Camera Stream...
            </div>
            <div style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7 }}>
              Receiving live stream from {activeNode?.name || 'Remote Client'}
            </div>
          </div>
        )
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--kuro-color-text-muted)', padding: 30 }}>
          <AppIcon name="video-off" size={40} style={{ marginBottom: 10, opacity: 0.4 }} />
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
            Camera Stream Paused
          </div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
            Click &quot;Start Feed&quot; in the action dock below to resume stream.
          </div>
        </div>
      )}

      {/* Top Floating Overlay Badges */}
      {selectedDevice && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {/* Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 11px',
              borderRadius: 20,
              backgroundColor: 'rgba(10, 12, 16, 0.82)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <style>{`
              @keyframes recBlink {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.35; transform: scale(0.85); }
              }
            `}</style>
            <div
              style={{
                width: 7.5,
                height: 7.5,
                borderRadius: '50%',
                backgroundColor: isStreaming ? '#ff4d4f' : '#6b7280',
                boxShadow: isStreaming ? '0 0 8px #ff4d4f' : 'none',
                animation: isStreaming ? 'recBlink 1.2s infinite ease-in-out' : 'none',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', letterSpacing: '0.4px' }}>
              {isStreaming ? 'LIVE' : 'OFFLINE'}
            </span>
            <span style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.65)' }}>
              • {deviceSource === 'server' ? 'Server Host' : activeNode?.name || 'Client'}
            </span>
          </div>

          {/* Right Metrics & Resolution Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {deviceSource !== 'server' && isStreaming && clientLiveFps > 0 && (
              <div
                style={{
                  padding: '4px 9px',
                  borderRadius: 14,
                  backgroundColor: 'rgba(10, 12, 16, 0.82)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#b8bb26',
                  fontFamily: 'monospace',
                }}
              >
                {clientLiveFps} FPS
              </div>
            )}
            <div
              style={{
                padding: '4px 9px',
                borderRadius: 14,
                backgroundColor: 'rgba(10, 12, 16, 0.82)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: 10.5,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.85)',
                fontFamily: 'monospace',
              }}
            >
              {resolution}
            </div>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              style={{
                pointerEvents: 'auto',
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: 'rgba(10, 12, 16, 0.82)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.15s ease',
              }}
            >
              <AppIcon name={isFullscreen ? 'minimize-2' : 'maximize-2'} size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="camera-page-container">
      <style>{`
        .camera-page-container {
          padding: 20px;
          width: 100%;
          max-width: 100%;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-sizing: border-box;
        }
        .camera-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 0 2px;
        }
        .camera-header-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .camera-rescan-desktop {
          display: flex;
          align-items: center;
        }
        .camera-rescan-mobile {
          display: none;
        }
        .camera-device-switcher {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          max-width: 100%;
        }
        .camera-device-pills {
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: var(--kuro-color-bg);
          border: 1px solid var(--kuro-color-border);
          border-radius: 8px;
          padding: 4px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          max-width: 100%;
        }
        .camera-device-pills::-webkit-scrollbar {
          display: none;
        }
        .camera-device-pill-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 13px;
          border-radius: 6px;
          border: none;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .camera-header {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .camera-header-title-row {
            width: 100%;
          }
          .camera-rescan-desktop {
            display: none !important;
          }
          .camera-rescan-mobile {
            display: flex !important;
            align-items: center;
          }
          .camera-device-switcher {
            width: 100%;
            overflow: hidden;
          }
          .camera-device-pills {
            width: 100%;
            padding: 4px 6px;
            gap: 6px;
          }
        }
        .camera-grid-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 18px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .camera-grid-layout {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .camera-page-container {
            padding: 14px;
            gap: 14px;
          }
        }
        @media (max-width: 640px) {
          .camera-page-container {
            padding: 10px;
            gap: 12px;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP HEADER & SEGMENTED TARGET DEVICE SELECTOR */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="camera-header">
        <div className="camera-header-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.button,
                backgroundColor: 'rgba(184, 187, 38, 0.15)',
                color: 'var(--kuro-color-primary, #b8bb26)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="camera" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-text-primary)', lineHeight: 1.2 }}>
                Camera Monitor
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--kuro-color-text-muted)', marginTop: 2 }}>
                {nodes.length + 1} connected video source{nodes.length > 0 ? 's' : ''} available
              </div>
            </div>
          </div>

          {/* Mobile Rescan Button (Same row as title) */}
          <div className="camera-rescan-mobile">
            <button
              onClick={() => {
                fetchConnectedNodes()
                fetchDevicesForSource(deviceSource)
              }}
              title="Rescan video sources and cameras"
              disabled={nodesLoading || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: radius.button,
                backgroundColor: 'var(--kuro-color-surface)',
                border: '1px solid var(--kuro-color-border)',
                color: 'var(--kuro-color-text-secondary)',
                cursor: nodesLoading || loading ? 'default' : 'pointer',
                opacity: nodesLoading || loading ? 0.5 : 1,
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <div style={{ animation: nodesLoading || loading ? 'spin 1s linear infinite' : 'none' }}>
                <AppIcon name="refresh-cw" size={15} />
              </div>
            </button>
          </div>
        </div>

        {/* Device Switcher Pills */}
        <div className="camera-device-switcher">
          <div className="camera-device-pills">
            {/* Server Option */}
            <button
              onClick={() => setDeviceSource('server')}
              className="camera-device-pill-btn"
              style={{
                backgroundColor: deviceSource === 'server' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                color: deviceSource === 'server' ? '#14161b' : 'var(--kuro-color-text-secondary)',
                fontWeight: deviceSource === 'server' ? 700 : 600,
                boxShadow: deviceSource === 'server' ? '0 2px 8px rgba(184, 187, 38, 0.25)' : 'none',
              }}
            >
              <AppIcon name="server" size={13} />
              <span>Server Host</span>
            </button>

            {/* Client Nodes Options */}
            {nodes.map((node) => {
              const isSelected = deviceSource === node.id
              const isWin = node.platform?.toLowerCase() === 'windows' || node.id?.toLowerCase().includes('win')
              return (
                <button
                  key={node.id}
                  onClick={() => setDeviceSource(node.id)}
                  className="camera-device-pill-btn"
                  style={{
                    backgroundColor: isSelected ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                    color: isSelected ? '#14161b' : 'var(--kuro-color-text-secondary)',
                    fontWeight: isSelected ? 700 : 600,
                    boxShadow: isSelected ? '0 2px 8px rgba(184, 187, 38, 0.25)' : 'none',
                  }}
                >
                  <AppIcon name={isWin ? 'monitor' : 'smartphone'} size={13} />
                  <span>{node.name || (isWin ? 'Windows' : 'Android')}</span>
                </button>
              )
            })}
          </div>

          {/* Desktop Rescan Button */}
          <div className="camera-rescan-desktop">
            <button
              onClick={() => {
                fetchConnectedNodes()
                fetchDevicesForSource(deviceSource)
              }}
              title="Rescan video sources and cameras"
              disabled={nodesLoading || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: radius.button,
                backgroundColor: 'var(--kuro-color-surface)',
                border: '1px solid var(--kuro-color-border)',
                color: 'var(--kuro-color-text-secondary)',
                cursor: nodesLoading || loading ? 'default' : 'pointer',
                opacity: nodesLoading || loading ? 0.5 : 1,
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <div style={{ animation: nodesLoading || loading ? 'spin 1s linear infinite' : 'none' }}>
                <AppIcon name="refresh-cw" size={14} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 2. MAIN CONSOLE LAYOUT (STREAM VIEWPORT + UNIFIED SIDEBAR) */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="camera-grid-layout">
        {/* ── Left Column: Live Viewport, Action Dock & Snapshots ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {isFullscreen ? (
            <>
              <div style={{ aspectRatio: isVertical ? '9/16' : '16/9', width: '100%', maxWidth: isVertical ? '450px' : '100%', margin: isVertical ? '0 auto' : 0 }} />
              {createPortal(renderVideoPlayer(), document.body)}
            </>
          ) : (
            renderVideoPlayer()
          )}

          {/* ── TACTILE ACTION DOCK (Directly under Stream) ── */}
          {selectedDevice && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                padding: '10px 14px',
                backgroundColor: 'var(--kuro-color-surface)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.card,
              }}
            >
              {/* Left Action: Start / Stop Stream Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setIsStreaming(!isStreaming)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 14px',
                    borderRadius: radius.button,
                    backgroundColor: isStreaming ? 'rgba(234, 105, 98, 0.12)' : 'rgba(184, 187, 38, 0.15)',
                    border: `1px solid ${isStreaming ? 'rgba(234, 105, 98, 0.4)' : 'var(--kuro-color-primary, #b8bb26)'}`,
                    color: isStreaming ? '#ea6962' : 'var(--kuro-color-primary, #b8bb26)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <AppIcon name={isStreaming ? 'video-off' : 'video'} size={14} />
                  <span>{isStreaming ? 'Stop Feed' : 'Start Feed'}</span>
                </button>
              </div>

              {/* Middle & Right Actions: Instant Snapshot & Video Recording */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Snapshot Button */}
                <button
                  onClick={handleSnapshot}
                  disabled={isCapturingPhoto}
                  title="Capture Instant High-Resolution Snapshot"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: radius.button,
                    backgroundColor: 'rgba(125, 174, 163, 0.15)',
                    border: '1px solid #7daea3',
                    color: '#7daea3',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: isCapturingPhoto ? 'default' : 'pointer',
                    opacity: isCapturingPhoto ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <AppIcon name="camera" size={14} />
                  <span>{isCapturingPhoto ? 'Capturing...' : 'Snapshot'}</span>
                </button>

                {/* Video Recording Module (For Remote Client Nodes) */}
                {deviceSource !== 'server' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <select
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(Number(e.target.value))}
                      disabled={isRecordingVideo}
                      style={{
                        padding: '7px 8px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        fontSize: 12,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value={5}>5s</option>
                      <option value={10}>10s</option>
                      <option value={30}>30s</option>
                    </select>

                    <button
                      onClick={handleRecordVideo}
                      disabled={isRecordingVideo}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: radius.button,
                        backgroundColor: isRecordingVideo ? 'rgba(234, 105, 98, 0.25)' : 'rgba(211, 134, 155, 0.15)',
                        border: `1px solid ${isRecordingVideo ? '#ea6962' : '#d3869b'}`,
                        color: isRecordingVideo ? '#ea6962' : '#d3869b',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: isRecordingVideo ? 'default' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <AppIcon name="video" size={14} />
                      <span>{isRecordingVideo ? `Recording (${videoCountdown}s)` : 'Record Clip'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RECENT SNAPSHOTS FILMSTRIP (If captures exist) ── */}
          {snapshots.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--kuro-color-surface)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.card,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Recent Captures ({snapshots.length})
                </span>
                <button
                  onClick={() => setSnapshots([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: 11,
                    color: 'var(--kuro-color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {snapshots.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      position: 'relative',
                      width: 88,
                      height: 56,
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid var(--kuro-color-border)',
                      flexShrink: 0,
                      backgroundColor: '#000',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <img src={url} alt={`Snapshot ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Single Unified Control & Hardware Console ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Main Control Deck Card */}
          <div
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* 1. SELECT CAMERA LENS */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Select Lens / Camera
                </span>
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                  {devices.length} detected
                </span>
              </div>

              {loading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 12 }}>
                  Scanning camera nodes...
                </div>
              ) : error ? (
                <div style={{ padding: '12px', borderRadius: radius.button, backgroundColor: 'rgba(234, 105, 98, 0.1)', color: '#ea6962', fontSize: 12 }}>
                  {error}
                </div>
              ) : devices.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 12 }}>
                  No camera devices found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {devices.map((dev) => {
                    const isSelected = selectedDevice?.id === dev.id
                    const isFront = dev.type === 'front' || dev.facing === 'front'
                    const isUsb = dev.type === 'usb' || isWindowsNode
                    const badgeColor = isFront ? '#7daea3' : isUsb ? '#d8a657' : '#b8bb26'
                    const iconName: 'camera' | 'video' | 'monitor' = isUsb ? 'monitor' : 'camera'
                    const cleanName = dev.name.replace(/\s*\([^)]*\)/g, '').trim() || dev.name

                    return (
                      <div
                        key={dev.id}
                        onClick={() => handleDeviceChange(dev)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          backgroundColor: isSelected ? 'rgba(184, 187, 38, 0.1)' : 'var(--kuro-color-bg)',
                          border: isSelected ? `1px solid ${badgeColor}` : '1px solid var(--kuro-color-border)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              backgroundColor: `${badgeColor}1c`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: badgeColor,
                              flexShrink: 0,
                            }}
                          >
                            <AppIcon name={iconName} size={15} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kuro-color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cleanName}
                            </div>
                            <div style={{ fontSize: 10.5, color: isFront ? '#7daea3' : '#a89984', marginTop: 1 }}>
                              {isFront ? 'Front Lens' : isUsb ? 'Webcam Pipeline' : 'Rear Sensor'}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              backgroundColor: badgeColor,
                              boxShadow: `0 0 6px ${badgeColor}`,
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 2. STREAM SETTINGS (Resolution & Rotation) */}
            {selectedDevice && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--kuro-color-border)', paddingTop: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Stream Settings
                </span>

                {/* Resolution */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--kuro-color-text-muted)', marginBottom: 4 }}>
                    Stream Quality
                  </label>
                  {deviceSource === 'server' ? (
                    <select
                      value={resolution}
                      onChange={(e) => handleResolutionChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        fontSize: 12.5,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="1920x1080">1080p (Full HD Native)</option>
                      <option value="1280x720">720p (HD - Balanced)</option>
                      <option value="640x480">480p (SD Stream)</option>
                    </select>
                  ) : (
                    <select
                      value={resolution}
                      onChange={(e) => handleResolutionChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        fontSize: 12.5,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="1080p">1080p (Full HD)</option>
                      <option value="720p">720p (HD Balanced)</option>
                      <option value="480p">480p (SD Stream)</option>
                      <option value="360p">360p (Low Latency)</option>
                    </select>
                  )}
                </div>

                {/* Orientation / Rotation */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--kuro-color-text-muted)', marginBottom: 4 }}>
                    Orientation / Rotation
                  </label>
                  <select
                    value={orientationMode}
                    onChange={(e) => {
                      setOrientationMode(e.target.value)
                      prefsApi.savePreferences({ camera_default_orientation: e.target.value } as any).catch(() => {})
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: radius.button,
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      color: 'var(--kuro-color-text-primary)',
                      fontSize: 12.5,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="0">0° (Normal Landscape)</option>
                    <option value="90">90° (Portrait Vertical)</option>
                    <option value="180">180° (Inverted Landscape)</option>
                    <option value="270">270° (Portrait Inverted)</option>
                  </select>
                </div>
              </div>
            )}

            {/* 3. HARDWARE SPECS HUD */}
            {selectedDevice && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--kuro-color-border)', paddingTop: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Hardware Specs
                </span>

                <div
                  style={{
                    backgroundColor: 'var(--kuro-color-bg)',
                    borderRadius: 8,
                    border: '1px solid var(--kuro-color-border)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 11.5,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--kuro-color-text-muted)' }}>Driver Pipeline:</span>
                    <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)', textAlign: 'right' }}>
                      {selectedDevice.driver}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--kuro-color-text-muted)' }}>Device Node:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--kuro-color-primary, #b8bb26)', textAlign: 'right' }}>
                      {selectedDevice.path}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--kuro-color-text-muted)' }}>Live Mode:</span>
                    <span style={{ fontWeight: 600, color: '#7daea3', textAlign: 'right' }}>
                      {deviceSource === 'server' ? 'Direct WebSocket' : 'Encrypted NDK Relay'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
