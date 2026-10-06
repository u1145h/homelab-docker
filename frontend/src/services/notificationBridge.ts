import type { NotificationItem } from '../types/notification'

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

declare global {
  interface Window {
    AndroidNotificationBridge?: {
      hasNotificationPermission: () => boolean
      requestNotificationPermission: () => void
      sendNotification: (
        id: string,
        title: string,
        message: string,
        severity: string,
        category: string,
        actionUrl: string
      ) => void
      syncCredentials: (serverUrl: string, token: string) => void
      isBatteryOptimizationIgnored: () => boolean
      requestIgnoreBatteryOptimization: () => void
      isBackgroundSyncEnabled: () => boolean
      setBackgroundSyncEnabled: (enabled: boolean) => void
    }
  }
}

/**
 * Checks if the application is running inside the native Android WebView container
 */
export function isAndroidNativeApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AndroidNotificationBridge)
}

/**
 * Synchronizes the server endpoint and auth token to Android Native SharedPreferences
 * so the 24/7 background service can monitor notifications even when the app is closed.
 */
export function syncNativeCredentials(serverUrl?: string, token?: string) {
  if (typeof window === 'undefined' || !window.AndroidNotificationBridge) return
  try {
    const url = serverUrl || (window.location.origin.startsWith('http') ? window.location.origin : '')
    if (!url) return
    window.AndroidNotificationBridge.syncCredentials(url, token || '')
  } catch (e) {
    console.warn('Failed to sync credentials with native Android service:', e)
  }
}

/**
 * Checks if battery optimization is ignored for 24/7 background reliability
 */
export function isBatteryOptimizationIgnored(): boolean {
  if (typeof window === 'undefined' || !window.AndroidNotificationBridge) return true
  try {
    return window.AndroidNotificationBridge.isBatteryOptimizationIgnored()
  } catch {
    return true
  }
}

/**
 * Prompts user to disable battery optimization for HomeLab
 */
export function requestIgnoreBatteryOptimization(): void {
  if (typeof window === 'undefined' || !window.AndroidNotificationBridge) return
  try {
    window.AndroidNotificationBridge.requestIgnoreBatteryOptimization()
  } catch (e) {
    console.warn('Failed to request battery optimization exemption:', e)
  }
}

/**
 * Checks if background service monitoring is enabled
 */
export function isBackgroundSyncEnabled(): boolean {
  if (typeof window === 'undefined' || !window.AndroidNotificationBridge) return false
  try {
    return window.AndroidNotificationBridge.isBackgroundSyncEnabled()
  } catch {
    return true
  }
}

/**
 * Toggles background service monitoring on/off
 */
export function setBackgroundSyncEnabled(enabled: boolean): void {
  if (typeof window === 'undefined' || !window.AndroidNotificationBridge) return
  try {
    window.AndroidNotificationBridge.setBackgroundSyncEnabled(enabled)
  } catch (e) {
    console.warn('Failed to toggle background sync:', e)
  }
}

/**
 * Checks current notification permission across Android and Web Browser
 */
export function getNotificationPermissionStatus(): PermissionState {
  if (typeof window === 'undefined') return 'unsupported'

  if (window.AndroidNotificationBridge) {
    try {
      const hasPerm = window.AndroidNotificationBridge.hasNotificationPermission()
      return hasPerm ? 'granted' : 'default'
    } catch {
      return 'default'
    }
  }

  if ('Notification' in window) {
    return Notification.permission as PermissionState
  }

  return 'unsupported'
}

/**
 * Prompts user for notification permission
 */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof window === 'undefined') return 'unsupported'

  // Android Native Bridge
  if (window.AndroidNotificationBridge) {
    try {
      window.AndroidNotificationBridge.requestNotificationPermission()
      // Brief delay for system dialog
      await new Promise((r) => setTimeout(r, 400))
      return getNotificationPermissionStatus()
    } catch {
      return 'default'
    }
  }

  // Web Browser Notification API
  if ('Notification' in window) {
    try {
      const result = await Notification.requestPermission()
      return result as PermissionState
    } catch {
      return 'denied'
    }
  }

  return 'unsupported'
}

/**
 * Synthesizes an alert chime using Web Audio API
 */
export function playNotificationSound(severity: NotificationItem['severity'] = 'info') {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    if (severity === 'critical') {
      // Urgent dual-tone alert (880Hz -> 660Hz)
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.15)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc.start(now)
      osc.stop(now + 0.35)
    } else if (severity === 'warning') {
      // Warning chime (587Hz -> 784Hz)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now)
      osc.frequency.setValueAtTime(783.99, now + 0.1)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc.start(now)
      osc.stop(now + 0.3)
    } else {
      // Subtle pleasant harmonic ping (523.25Hz -> 659.25Hz)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now)
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    }

    setTimeout(() => {
      ctx.close().catch(() => {})
    }, 500)
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export interface DispatchNotificationOptions {
  playSound?: boolean
  notifyBrowser?: boolean
}

/**
 * Dispatches a system/browser/Android notification
 */
export function dispatchSystemNotification(
  item: NotificationItem,
  onOpen?: (id: string, actionUrl?: string) => void,
  options?: DispatchNotificationOptions
) {
  if (typeof window === 'undefined') return

  // Play audio chime if enabled
  if (options?.playSound !== false) {
    playNotificationSound(item.severity)
  }

  // 1. Android Native Bridge
  if (window.AndroidNotificationBridge) {
    try {
      window.AndroidNotificationBridge.sendNotification(
        item.id,
        item.title,
        item.message,
        item.severity,
        item.category,
        item.action_url || ''
      )
      return
    } catch (e) {
      console.warn('Failed to send notification via AndroidNotificationBridge:', e)
    }
  }

  // 2. HTML5 Web Browser Notification
  if (options?.notifyBrowser !== false && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(item.title, {
        body: item.message,
        icon: '/notification-icon.png',
        badge: '/notification-badge.png',
        tag: item.id,
      })

      notif.onclick = (e) => {
        e.preventDefault()
        window.focus()
        if (onOpen) {
          onOpen(item.id, item.action_url)
        }
        notif.close()
      }
    } catch {
      // Ignore constructor errors on webviews that don't support new Notification()
    }
  }
}
