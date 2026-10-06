import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import {
  getNotificationSummary,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications,
  triggerTestNotification,
} from "../api/notifications"
import type { NotificationItem, NotificationSummary } from "../types/notification"
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  dispatchSystemNotification,
  syncNativeCredentials,
  type PermissionState,
} from "../services/notificationBridge"
import { getPreferences } from "../features/settings/api/preferences"
import type { UserPreferences } from "../features/settings/types"
import { DEFAULT_PREFERENCES } from "../features/settings/types"
import { authStorage } from "../utils/authStorage"
import { useSnackbar } from "../hooks/useSnackbar"
import { navigateTo } from "../utils/navigation"

function shouldNotifyUser(item: NotificationItem, prefs: UserPreferences): boolean {
  // 1. Category checks
  if (item.category === 'cpu' && prefs.notify_cpu === false) return false
  if (item.category === 'memory' && prefs.notify_memory === false) return false
  if (item.category === 'storage' && prefs.notify_storage === false) return false
  if (item.category === 'thermal' && prefs.notify_thermal === false) return false
  if (item.category === 'battery' && prefs.notify_battery === false) return false
  if (item.category === 'docker' && prefs.notify_docker === false) return false
  if (item.category === 'network' && prefs.notify_network === false) return false
  if (item.category === 'tailscale' && prefs.notify_tailscale === false) return false

  // 2. Minimum severity check
  if (prefs.min_severity === 'critical' && item.severity !== 'critical') return false
  if (prefs.min_severity === 'warning' && (item.severity === 'info' || item.severity === 'success')) return false

  // 3. Quiet hours check (22:00 - 07:00)
  if (prefs.quiet_hours && item.severity !== 'critical') {
    const hr = new Date().getHours()
    if (hr >= 22 || hr < 7) return false
  }

  return true
}

interface NotificationContextValue {
  summary: NotificationSummary | null
  unreadCount: number
  recent: NotificationItem[]
  loading: boolean
  permissionStatus: PermissionState
  isPermissionGranted: boolean
  refreshSummary: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteItem: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  sendTestAlert: (severity?: NotificationItem['severity'], title?: string, message?: string) => Promise<void>
  requestPermission: () => Promise<PermissionState>
  requestBrowserPermission: () => Promise<boolean>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<NotificationSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>(getNotificationPermissionStatus())
  const previousUnreadIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)
  const cachedPrefs = useRef<UserPreferences>(DEFAULT_PREFERENCES)
  const { showSnackbar } = useSnackbar()

  const fetchUserPrefs = useCallback(async () => {
    try {
      const p = await getPreferences()
      if (p) cachedPrefs.current = p
    } catch {
      // Keep default preferences if not reachable
    }
  }, [])

  const handleNotificationOpen = useCallback((id: string, actionUrl?: string) => {
    if (id) {
      markNotificationRead(id).catch(() => {})
      setSummary((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          unread_count: Math.max(0, prev.unread_count - 1),
          recent: prev.recent.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }
      })
    }
    if (actionUrl) {
      navigateTo(actionUrl)
    } else {
      navigateTo('/notifications')
    }
  }, [])

  // Listen to Android Native notification clicks
  useEffect(() => {
    const handleAndroidClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ actionUrl?: string; id?: string }>
      if (customEvent.detail) {
        handleNotificationOpen(customEvent.detail.id || '', customEvent.detail.actionUrl)
      }
    }

    window.addEventListener('kuro-notification-click', handleAndroidClick)
    return () => {
      window.removeEventListener('kuro-notification-click', handleAndroidClick)
    }
  }, [handleNotificationOpen])

  const refreshSummary = useCallback(async () => {
    try {
      const data = await getNotificationSummary(10)
      setSummary(data)

      // Check if new unread notifications arrived
      const currentUnreadIds = new Set(data.recent.filter((n) => !n.read).map((n) => n.id))
      if (!isFirstLoad.current) {
        for (const item of data.recent) {
          if (!item.read && !previousUnreadIds.current.has(item.id)) {
            // Apply account-specific rules and channel toggles
            if (shouldNotifyUser(item, cachedPrefs.current)) {
              dispatchSystemNotification(item, handleNotificationOpen, {
                playSound: cachedPrefs.current.notify_sound,
                notifyBrowser: cachedPrefs.current.notify_browser,
              })

              const alertSeverity: 'error' | 'warning' | 'success' | 'info' =
                item.severity === 'critical' ? 'error' : (item.severity as 'warning' | 'success' | 'info')

              showSnackbar(item.message, alertSeverity, {
                title: item.title,
                actionUrl: item.action_url || '/recent-activity',
                actionLabel: 'View in Notifications',
              })
            }
          }
        }
      }

      previousUnreadIds.current = currentUnreadIds
      isFirstLoad.current = false
    } catch {
      // Ignore network errors on background poll
    } finally {
      setLoading(false)
    }
  }, [handleNotificationOpen, showSnackbar])

  useEffect(() => {
    setLoading(true)
    fetchUserPrefs()
    refreshSummary()

    // Sync credentials with native Android 24/7 background service
    syncNativeCredentials(
      window.location.origin.startsWith('http') ? window.location.origin : undefined,
      authStorage.getToken() || ''
    )

    // Poll every 4 seconds for real-time notification sync
    const interval = setInterval(refreshSummary, 4000)
    // Refresh preferences every 30 seconds
    const prefsInterval = setInterval(fetchUserPrefs, 30000)
    return () => {
      clearInterval(interval)
      clearInterval(prefsInterval)
    }
  }, [refreshSummary, fetchUserPrefs])

  const markAsRead = async (id: string) => {
    setSummary((prev) => {
      if (!prev) return prev
      const updatedRecent = prev.recent.map((n) => (n.id === id ? { ...n, read: true } : n))
      const wasUnread = prev.recent.find((n) => n.id === id && !n.read)
      return {
        ...prev,
        unread_count: wasUnread ? Math.max(0, prev.unread_count - 1) : prev.unread_count,
        recent: updatedRecent,
      }
    })
    try {
      await markNotificationRead(id)
    } catch {
      refreshSummary()
    }
  }

  const markAllAsRead = async () => {
    setSummary((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        unread_count: 0,
        recent: prev.recent.map((n) => ({ ...n, read: true })),
      }
    })
    try {
      await markAllNotificationsRead()
    } catch {
      refreshSummary()
    }
  }

  const deleteItem = async (id: string) => {
    setSummary((prev) => {
      if (!prev) return prev
      const itemToDelete = prev.recent.find((n) => n.id === id)
      const updatedRecent = prev.recent.filter((n) => n.id !== id)
      return {
        ...prev,
        total_count: Math.max(0, prev.total_count - 1),
        unread_count: itemToDelete && !itemToDelete.read ? Math.max(0, prev.unread_count - 1) : prev.unread_count,
        recent: updatedRecent,
      }
    })
    try {
      await deleteNotification(id)
    } catch {
      refreshSummary()
    }
  }

  const clearAll = async () => {
    setSummary({
      unread_count: 0,
      total_count: 0,
      recent: [],
    })
    try {
      await clearNotifications()
    } catch {
      refreshSummary()
    }
  }

  const sendTestAlert = async (
    severity: NotificationItem['severity'] = 'info',
    title = 'Test Server Notification',
    message = 'This is a live test notification from HomeLab.'
  ) => {
    try {
      const item = await triggerTestNotification({ severity, title, message })
      // Dispatch immediately to system
      dispatchSystemNotification(item, handleNotificationOpen)

      const alertSeverity: 'error' | 'warning' | 'success' | 'info' =
        item.severity === 'critical' ? 'error' : (item.severity as 'warning' | 'success' | 'info')

      showSnackbar(item.message, alertSeverity, {
        title: item.title,
        actionUrl: item.action_url || '/recent-activity',
        actionLabel: 'View in Notifications',
      })

      setSummary((prev) => {
        if (!prev) return { unread_count: 1, total_count: 1, recent: [item] }
        return {
          unread_count: prev.unread_count + 1,
          total_count: prev.total_count + 1,
          recent: [item, ...prev.recent.slice(0, 9)],
        }
      })
    } catch {
      refreshSummary()
    }
  }

  const requestPermission = async (): Promise<PermissionState> => {
    const status = await requestNotificationPermission()
    setPermissionStatus(status)
    return status
  }

  const requestBrowserPermission = async (): Promise<boolean> => {
    const status = await requestPermission()
    return status === "granted"
  }

  return (
    <NotificationContext.Provider
      value={{
        summary,
        unreadCount: summary?.unread_count ?? 0,
        recent: summary?.recent ?? [],
        loading,
        permissionStatus,
        isPermissionGranted: permissionStatus === 'granted',
        refreshSummary,
        markAsRead,
        markAllAsRead,
        deleteItem,
        clearAll,
        sendTestAlert,
        requestPermission,
        requestBrowserPermission,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}

