import { Capacitor } from '@capacitor/core'

export interface ServerProfile {
  id: string
  name: string
  url: string
  isDefault?: boolean
}

export function isNativeMobileApp(): boolean {
  if (typeof window === 'undefined') return false
  const isCapacitorNative = Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios'
  const isAndroidBridge = Boolean((window as any).AndroidNotificationBridge)
  const isCapacitorScheme = window.location.protocol === 'capacitor:' || window.location.protocol === 'file:'
  return isCapacitorNative || isAndroidBridge || isCapacitorScheme
}

export interface ServerPreset {
  id: string
  name: string
  placeholderUrl: string
  description: string
}

export const GENERIC_SERVER_PRESETS: ServerPreset[] = [
  {
    id: 'public-domain',
    name: 'Public Domain',
    placeholderUrl: 'https://homelab.example.com',
    description: 'HTTPS domain endpoint',
  },
  {
    id: 'tailscale-vpn',
    name: 'Tailscale VPN',
    placeholderUrl: 'http://100.x.y.z:9876',
    description: 'Tailscale network IP & port 9876',
  },
  {
    id: 'local-lan',
    name: 'Local LAN / Direct Cable',
    placeholderUrl: 'http://192.168.1.100:9876',
    description: 'Local network IP & port 9876',
  },
]

export const DEFAULT_SERVER_PRESETS: ServerProfile[] = []

const STORAGE_PROFILES_KEY = 'homelab_server_profiles'
const STORAGE_ACTIVE_ID_KEY = 'homelab_active_server_id'

export function sanitizeUrl(rawUrl: string): string {
  let url = rawUrl.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`
  }
  return url.replace(/\/+$/, '')
}

export function hasConfiguredServer(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const activeId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY)
    if (!activeId || activeId.trim() === '') return false
    const profiles = getStoredProfiles()
    return profiles.some((p) => p.id === activeId && Boolean(p.url && p.url.trim()))
  } catch {
    return false
  }
}

export function getStoredProfiles(): ServerProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_PROFILES_KEY)
    if (!raw) return []
    const parsed: ServerProfile[] = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function saveStoredProfiles(profiles: ServerProfile[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(profiles))
  } catch (e) {
    console.error('Failed to save server profiles:', e)
  }
}

export function getActiveServerId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_ACTIVE_ID_KEY)
  } catch {
    return null
  }
}

export function setActiveServerId(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id) {
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_ID_KEY)
    }
  } catch (e) {
    console.error('Failed to save active server ID:', e)
  }
}

export function getActiveServerProfile(): ServerProfile | null {
  const profiles = getStoredProfiles()
  const activeId = getActiveServerId()
  if (!activeId) return null
  const found = profiles.find((p) => p.id === activeId)
  if (found) return found
  return profiles[0] || null
}

export interface PingResult {
  ok: boolean
  latencyMs?: number
  error?: string
}

export async function testServerConnection(url: string, timeoutMs = 4000): Promise<PingResult> {
  const cleanUrl = sanitizeUrl(url)
  const pingEndpoint = `${cleanUrl}/api/v1/status`
  const startTime = performance.now()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(pingEndpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    const latencyMs = Math.round(performance.now() - startTime)

    if (res.ok || res.status === 401) {
      return { ok: true, latencyMs }
    }
    return { ok: false, latencyMs, error: `HTTP ${res.status}` }
  } catch (err: unknown) {
    clearTimeout(timer)
    const latencyMs = Math.round(performance.now() - startTime)
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { ok: false, latencyMs, error: 'Connection timed out' }
      }
      return { ok: false, latencyMs, error: err.message || 'Unreachable' }
    }
    return { ok: false, latencyMs, error: 'Unreachable' }
  }
}
