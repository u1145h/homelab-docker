import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AppIcon } from '@/components/ui/icons'
import { Star, Bell, Package, X } from 'lucide-react'
import { radius } from '@/design/radius'
import { useSnackbar } from '@/hooks/useSnackbar'
import { formatDateTime } from '@/utils/format'
import LocationMapView from './LocationMapView'
import { ClientFtpFileManager } from './ClientFtpFileManager'
import { ClientHardwareTab } from './ClientHardwareTab'
import { ClientUtilityTab } from './ClientUtilityTab'
import { ClientQuickSettingsTiles } from './ClientQuickSettingsTiles'
import { WindowsClientView } from './windows/WindowsClientView'
import { CalendarRangePicker } from '@/features/notifications/components/CalendarRangePicker'
import type { KuroNode, DeviceMessage, ClientDataResponse } from '../types'
import * as api from '../api/assistant'

interface ClientDataTabProps {
  nodes: KuroNode[]
  onRefreshNodes?: () => void
}

type SubCategory = 'calls' | 'messages' | 'contacts' | 'notifications' | 'apps' | 'files' | 'location' | 'hardware' | 'utility'

const monoFont = 'var(--kuro-font-mono, "SF Mono", monospace)'

interface SMSThread {
  id: string
  contactName: string
  phoneNumber: string
  deviceName?: string
  messages: DeviceMessage[]
  lastMessage: DeviceMessage
  unreadCount: number
}

function normalizePhoneNumber(phone: string): string {
  if (!phone) return ''
  return phone.replace(/[^\d+]/g, '').trim()
}

function matchesPhoneNumber(p1: string, p2: string): boolean {
  if (!p1 || !p2) return false
  const n1 = normalizePhoneNumber(p1)
  const n2 = normalizePhoneNumber(p2)
  if (n1 === n2) return true

  const d1 = p1.replace(/\D/g, '')
  const d2 = p2.replace(/\D/g, '')
  if (!d1 || !d2) return false
  if (d1 === d2) return true

  // Suffix matching (minimum 7 digits for subscriber phone numbers)
  if (d1.length >= 7 && d2.length >= 7) {
    if (d1.endsWith(d2) || d2.endsWith(d1)) return true
    const s1 = d1.slice(-7)
    const s2 = d2.slice(-7)
    if (s1 === s2) return true
  }
  return false
}

export default function ClientDataTab({ nodes, onRefreshNodes }: ClientDataTabProps) {
  const { showSnackbar } = useSnackbar()
  const [searchParams] = useSearchParams()
  const initialNodeParam = searchParams.get('node') || searchParams.get('node_id') || searchParams.get('client') || ''

  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialNodeParam)
  const [activeCategory, setActiveCategory] = useState<SubCategory>('calls')
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // Keep selectedNodeId in sync if URL query parameter changes
  useEffect(() => {
    const nodeParam = searchParams.get('node') || searchParams.get('node_id') || searchParams.get('client') || ''
    if (nodeParam !== selectedNodeId) {
      setSelectedNodeId(nodeParam)
    }
  }, [searchParams, selectedNodeId])

  const [clientData, setClientData] = useState<ClientDataResponse>({
    calls: [],
    messages: [],
    contacts: [],
    location: null,
    locations: [],
    snapshot: null,
  })

  // Search / Filters / View Modes / Pagination
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [callFilter, setCallFilter] = useState<string>('all')
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [callViewMode, setCallViewMode] = useState<'table' | 'cards'>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table')
  const [callPage, setCallPage] = useState<number>(1)
  const [callsPerPage, setCallsPerPage] = useState<number>(50)
  const [locationViewMode, setLocationViewMode] = useState<'map' | 'list'>('map')
  type TimelineFilter = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom'
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Contacts state
  const [contactSearchQuery, setContactSearchQuery] = useState<string>('')
  const [contactViewMode, setContactViewMode] = useState<'cards' | 'table'>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table')
  const [contactPage, setContactPage] = useState<number>(1)
  const [contactsPerPage] = useState<number>(40)

  // SMS Chat App state
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [smsSearchQuery, setSmsSearchQuery] = useState<string>('')
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) || null, [nodes, selectedNodeId])
  const isWindows = useMemo(() => {
    if (selectedNode?.platform?.toLowerCase() === 'windows') return true
    if (selectedNodeId.toLowerCase().includes('win')) return true
    if ((clientData.snapshot as any)?.platform === 'windows') return true
    return false
  }, [selectedNode, selectedNodeId, clientData.snapshot])

  // ── 1. Live Calling Monitor State ──
  const [callTimerSec, setCallTimerSec] = useState<number>(0)
  const activeCallInfo = useMemo(() => {
    // Check selected node or any connected node telemetry
    const targetNode = selectedNode || nodes.find((n) => (n.telemetry as any)?.call_state?.state && (n.telemetry as any)?.call_state?.state !== 'idle')
    const telemetryCallState = (targetNode?.telemetry as any)?.call_state || (clientData.snapshot as any)?.call_state
    if (telemetryCallState && telemetryCallState.state && telemetryCallState.state !== 'idle') {
      return {
        state: telemetryCallState.state as 'ringing' | 'active',
        callerName: telemetryCallState.caller_name || '',
        phoneNumber: telemetryCallState.phone_number || '',
        durationSeconds: telemetryCallState.duration_seconds || 0,
        deviceName: targetNode?.name || targetNode?.hostname || 'Android Device',
      }
    }
    for (const n of nodes) {
      const cs = (n.telemetry as any)?.call_state
      if (cs && cs.state && cs.state !== 'idle') {
        return {
          state: cs.state as 'ringing' | 'active',
          callerName: cs.caller_name || '',
          phoneNumber: cs.phone_number || '',
          durationSeconds: cs.duration_seconds || 0,
          deviceName: n.name || n.hostname || 'Android Device',
        }
      }
    }
    return null
  }, [nodes, selectedNode, clientData.snapshot])

  useEffect(() => {
    if (!activeCallInfo || activeCallInfo.state !== 'active') {
      setCallTimerSec(0)
      return
    }
    setCallTimerSec(activeCallInfo.durationSeconds || 0)
    const timer = setInterval(() => {
      setCallTimerSec((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [activeCallInfo?.state, activeCallInfo?.durationSeconds])

  // ── 2. Notification History State & Advanced Filters ──
  const [notificationSearch, setNotificationSearch] = useState<string>('')
  const [notificationAppFilter, setNotificationAppFilter] = useState<string>('all')
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<'all' | 'active' | 'cleared'>('all')
  const [notificationStartDate, setNotificationStartDate] = useState<string>('')
  const [notificationEndDate, setNotificationEndDate] = useState<string>('')
  const [notificationMediaOnly, setNotificationMediaOnly] = useState<boolean>(false)
  const [notificationSortOrder, setNotificationSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [notificationViewMode, setNotificationViewMode] = useState<'cards' | 'compact'>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'compact')
  const [notificationPage, setNotificationPage] = useState<number>(1)
  const [notificationsPerPage] = useState<number>(25)
  const [mediaPreviewModal, setMediaPreviewModal] = useState<{
    title: string
    subtitle?: string
    imageB64?: string
    url?: string
  } | null>(null)

  // ── Location Filter Calculations ──
  const filteredLocations = useMemo(() => {
    const rawLocations = clientData.locations || []
    if (!rawLocations.length) return []
    if (timelineFilter === 'all') return rawLocations

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
    const yesterdayStart = todayStart - 86400000
    const yesterdayEnd = todayStart - 1

    const dayOfWeek = now.getDay()
    const diffToMonday = (dayOfWeek + 6) % 7
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).getTime()

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime()

    return rawLocations.filter((loc) => {
      if (!loc.timestamp) return true
      let locTime = 0
      if (typeof loc.timestamp === 'number') {
        locTime = loc.timestamp > 1e11 ? loc.timestamp : loc.timestamp * 1000
      } else {
        locTime = new Date(loc.timestamp).getTime()
      }
      if (isNaN(locTime) || locTime === 0) return true

      switch (timelineFilter) {
        case 'today':
          return locTime >= todayStart && locTime <= todayEnd
        case 'yesterday':
          return locTime >= yesterdayStart && locTime <= yesterdayEnd
        case 'this_week':
          return locTime >= weekStart && locTime <= todayEnd
        case 'this_month':
          return locTime >= monthStart && locTime <= todayEnd
        case 'this_year':
          return locTime >= yearStart && locTime <= todayEnd
        case 'custom': {
          let matches = true
          if (customStartDate) {
            const start = new Date(customStartDate + 'T00:00:00').getTime()
            if (!isNaN(start)) matches = matches && locTime >= start
          }
          if (customEndDate) {
            const end = new Date(customEndDate + 'T23:59:59').getTime()
            if (!isNaN(end)) matches = matches && locTime <= end
          }
          return matches
        }
        default:
          return true
      }
    })
  }, [clientData.locations, timelineFilter, customStartDate, customEndDate])

  const filteredCurrentLocation = useMemo(() => {
    if (timelineFilter === 'all') return clientData.location
    return filteredLocations.length > 0 ? filteredLocations[0] : null
  }, [clientData.location, filteredLocations, timelineFilter])

  // ── Client-Scoped Contact Map (strictly isolated per client device) ──
  const contactsByNode = useMemo(() => {
    const map = new Map<string, typeof clientData.contacts>()
    for (const c of clientData.contacts || []) {
      const node = c.node_id || selectedNodeId || '__default__'
      if (!map.has(node)) {
        map.set(node, [])
      }
      map.get(node)!.push(c)
    }
    return map
  }, [clientData.contacts, selectedNodeId])

  // Helper to resolve contact name for a given node and phone number
  const resolveContactName = useCallback(
    (nodeId: string | undefined, phoneNumber: string | undefined, fallbackName?: string): string => {
      const targetNode = nodeId || selectedNodeId || '__default__'
      const nodeContacts = contactsByNode.get(targetNode) || (targetNode !== '__default__' ? contactsByNode.get('__default__') || [] : [])

      if (phoneNumber && nodeContacts.length > 0) {
        for (const contact of nodeContacts) {
          if (!contact.name) continue
          for (const rawPhone of contact.phone_numbers || []) {
            if (matchesPhoneNumber(rawPhone, phoneNumber)) {
              return contact.name.trim()
            }
          }
        }
      }

      if (fallbackName && fallbackName.trim() && fallbackName.trim() !== 'Unknown Contact' && fallbackName.trim() !== 'Unknown Caller') {
        return fallbackName.trim()
      }

      return fallbackName || phoneNumber || 'Unknown Contact'
    },
    [contactsByNode, selectedNodeId]
  )

  // 1. Clean & Deduplicate Raw Notifications
  const uniqueNotifications = useMemo(() => {
    const raw = clientData.notifications || []
    const seen = new Set<string>()
    const list: typeof raw = []

    for (const item of raw) {
      if (!item.package_name && !item.title && !item.text && !item.sub_text) continue
      const pkg = (item.package_name || '').toLowerCase().trim()
      const title = (item.title || '').toLowerCase().trim()
      const text = (item.text || '').toLowerCase().trim()
      const subText = (item.sub_text || '').toLowerCase().trim()
      const ts = (item.timestamp || '').trim().slice(0, 16)
      const contentKey = `content:${pkg}|${title}|${text}|${subText}|${ts}`

      if (item.id && seen.has(`id:${item.id}`)) continue
      if (seen.has(contentKey)) continue

      if (item.id) seen.add(`id:${item.id}`)
      seen.add(contentKey)
      list.push(item)
    }
    return list
  }, [clientData.notifications])

  const notificationApps = useMemo(() => {
    const apps = new Map<string, { label: string; count: number }>()
    for (const n of uniqueNotifications) {
      const pkg = n.package_name || 'unknown'
      const label = n.app_label || pkg
      const existing = apps.get(pkg)
      if (existing) {
        existing.count++
      } else {
        apps.set(pkg, { label, count: 1 })
      }
    }
    return Array.from(apps.entries())
      .map(([pkg, info]) => ({ pkg, ...info }))
      .sort((a, b) => b.count - a.count)
  }, [uniqueNotifications])

  // Notification stats
  const notificationStats = useMemo(() => {
    const list = uniqueNotifications
    const total = list.length
    const active = list.filter((n) => !n.is_cleared).length
    const cleared = list.filter((n) => n.is_cleared).length
    const withMedia = list.filter((n) => Boolean(n.media_preview_b64)).length
    const appsCount = notificationApps.length
    return { total, active, cleared, withMedia, appsCount }
  }, [uniqueNotifications, notificationApps])

  const filteredNotifications = useMemo(() => {
    const q = notificationSearch.toLowerCase().trim()

    // Compute Date Range Boundaries from CalendarRangePicker
    let minTimestampMs: number | null = null
    let maxTimestampMs: number | null = null

    if (notificationStartDate) {
      const start = new Date(notificationStartDate + 'T00:00:00')
      if (!isNaN(start.getTime())) minTimestampMs = start.getTime()
    }
    if (notificationEndDate) {
      const end = new Date(notificationEndDate + 'T23:59:59.999')
      if (!isNaN(end.getTime())) maxTimestampMs = end.getTime()
    }

    const parseNotificationTime = (ts?: string): number => {
      if (!ts) return 0
      const clean = ts.trim()
      if (/^\d{10,13}$/.test(clean)) {
        const num = Number(clean)
        return num < 1e11 ? num * 1000 : num
      }
      const d = new Date(clean)
      if (!isNaN(d.getTime())) return d.getTime()
      const d2 = new Date(clean.replace(' ', 'T'))
      if (!isNaN(d2.getTime())) return d2.getTime()
      return 0
    }

    const result = uniqueNotifications.filter((n) => {
      // Search match
      const matchSearch =
        !q ||
        (n.app_label && n.app_label.toLowerCase().includes(q)) ||
        (n.package_name && n.package_name.toLowerCase().includes(q)) ||
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.text && n.text.toLowerCase().includes(q)) ||
        (n.sub_text && n.sub_text.toLowerCase().includes(q))

      // App Package match
      const matchApp = notificationAppFilter === 'all' || n.package_name === notificationAppFilter

      // Status match
      const matchStatus =
        notificationStatusFilter === 'all' ||
        (notificationStatusFilter === 'cleared' ? n.is_cleared : !n.is_cleared)

      // Media match
      const matchMedia = !notificationMediaOnly || Boolean(n.media_preview_b64)

      // Date Range match
      let matchDate = true
      if (minTimestampMs !== null || maxTimestampMs !== null) {
        const notifTimeMs = parseNotificationTime(n.timestamp)
        if (notifTimeMs > 0) {
          if (minTimestampMs !== null && notifTimeMs < minTimestampMs) {
            matchDate = false
          }
          if (maxTimestampMs !== null && notifTimeMs > maxTimestampMs) {
            matchDate = false
          }
        }
      }

      return matchSearch && matchApp && matchStatus && matchMedia && matchDate
    })

    // Sort order
    result.sort((a, b) => {
      const timeA = parseNotificationTime(a.timestamp)
      const timeB = parseNotificationTime(b.timestamp)
      if (timeA && timeB) {
        return notificationSortOrder === 'newest' ? timeB - timeA : timeA - timeB
      }
      return notificationSortOrder === 'newest'
        ? (b.timestamp || '').localeCompare(a.timestamp || '')
        : (a.timestamp || '').localeCompare(b.timestamp || '')
    })

    // Deduplicate notifications by ID & content/timestamp signature
    const seen = new Set<string>()
    const deduplicated: typeof result = []
    for (const item of result) {
      const pkg = (item.package_name || '').toLowerCase().trim()
      const title = (item.title || '').toLowerCase().trim()
      const text = (item.text || '').toLowerCase().trim()
      const subText = (item.sub_text || '').toLowerCase().trim()
      const ts = (item.timestamp || '').trim().slice(0, 16)
      const contentKey = `content:${pkg}|${title}|${text}|${subText}|${ts}`

      if (item.id && seen.has(`id:${item.id}`)) continue
      if (seen.has(contentKey)) continue

      if (item.id) seen.add(`id:${item.id}`)
      seen.add(contentKey)
      deduplicated.push(item)
    }

    return deduplicated
  }, [
    clientData.notifications,
    notificationSearch,
    notificationAppFilter,
    notificationStatusFilter,
    notificationStartDate,
    notificationEndDate,
    notificationMediaOnly,
    notificationSortOrder,
  ])

  const totalNotificationPages = notificationsPerPage === 0
    ? 1
    : Math.max(1, Math.ceil(filteredNotifications.length / notificationsPerPage))

  const paginatedNotifications = useMemo(() => {
    if (notificationsPerPage === 0) return filteredNotifications
    const start = (notificationPage - 1) * notificationsPerPage
    return filteredNotifications.slice(start, start + notificationsPerPage)
  }, [filteredNotifications, notificationPage, notificationsPerPage])

  const activeNotificationFiltersCount = useMemo(() => {
    let count = 0
    if (notificationSearch.trim()) count++
    if (notificationAppFilter !== 'all') count++
    if (notificationStatusFilter !== 'all') count++
    if (notificationStartDate || notificationEndDate) count++
    if (notificationMediaOnly) count++
    return count
  }, [
    notificationSearch,
    notificationAppFilter,
    notificationStatusFilter,
    notificationStartDate,
    notificationEndDate,
    notificationMediaOnly,
  ])

  const handleResetNotificationFilters = () => {
    setNotificationSearch('')
    setNotificationAppFilter('all')
    setNotificationStatusFilter('all')
    setNotificationStartDate('')
    setNotificationEndDate('')
    setNotificationMediaOnly(false)
    setNotificationSortOrder('newest')
    setNotificationPage(1)
  }

  // ── 3. Installed Apps State & Advanced Analysis ──
  const [appsSearch, setAppsSearch] = useState<string>('')
  const [appsTypeFilter, setAppsTypeFilter] = useState<'all' | 'user' | 'system'>('all')
  const [appsSortBy, setAppsSortBy] = useState<'name' | 'size' | 'updated' | 'installed'>('name')
  const [appsSortOrder, setAppsSortOrder] = useState<'asc' | 'desc'>('asc')
  const [appsViewMode, setAppsViewMode] = useState<'grid' | 'table'>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table')
  const [appsPage, setAppsPage] = useState<number>(1)
  const [appsPerPage] = useState<number>(36)

  // Installed Apps Stats & Storage Analysis
  const appsStats = useMemo(() => {
    const list = clientData.installed_apps || []
    const total = list.length
    const userApps = list.filter((a) => !a.is_system_app).length
    const systemApps = list.filter((a) => a.is_system_app).length
    const totalSizeBytes = list.reduce((acc, a) => acc + (a.apk_size_bytes || 0), 0)
    const userSizeBytes = list.filter((a) => !a.is_system_app).reduce((acc, a) => acc + (a.apk_size_bytes || 0), 0)
    const systemSizeBytes = list.filter((a) => a.is_system_app).reduce((acc, a) => acc + (a.apk_size_bytes || 0), 0)
    return {
      total,
      userApps,
      systemApps,
      totalSizeBytes,
      userSizeBytes,
      systemSizeBytes,
    }
  }, [clientData.installed_apps])

  // Map of package_name -> icon_b64 from installed apps
  const appIconMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const app of clientData.installed_apps || []) {
      if (app.package_name && app.icon_b64) {
        map.set(app.package_name, app.icon_b64)
      }
    }
    return map
  }, [clientData.installed_apps])

  const filteredApps = useMemo(() => {
    const q = appsSearch.toLowerCase().trim()
    const list = [...(clientData.installed_apps || [])].filter((app) => {
      const matchSearch =
        !q ||
        (app.app_name && app.app_name.toLowerCase().includes(q)) ||
        (app.package_name && app.package_name.toLowerCase().includes(q)) ||
        (app.version_name && app.version_name.toLowerCase().includes(q))

      const matchType =
        appsTypeFilter === 'all' ||
        (appsTypeFilter === 'user' ? !app.is_system_app : !!app.is_system_app)

      return matchSearch && matchType
    })

    list.sort((a, b) => {
      let cmp = 0
      if (appsSortBy === 'name') {
        cmp = (a.app_name || a.package_name || '').localeCompare(b.app_name || b.package_name || '')
      } else if (appsSortBy === 'size') {
        cmp = (a.apk_size_bytes || 0) - (b.apk_size_bytes || 0)
      } else if (appsSortBy === 'updated') {
        cmp = (a.last_updated || a.installed_at || '').localeCompare(b.last_updated || b.installed_at || '')
      } else if (appsSortBy === 'installed') {
        cmp = (a.installed_at || a.last_updated || '').localeCompare(b.installed_at || b.last_updated || '')
      }
      return appsSortOrder === 'asc' ? cmp : -cmp
    })

    return list
  }, [clientData.installed_apps, appsSearch, appsTypeFilter, appsSortBy, appsSortOrder])

  const totalAppPages = appsPerPage === 0 ? 1 : Math.max(1, Math.ceil(filteredApps.length / appsPerPage))
  const paginatedApps = useMemo(() => {
    if (appsPerPage === 0) return filteredApps
    const start = (appsPage - 1) * appsPerPage
    return filteredApps.slice(start, start + appsPerPage)
  }, [filteredApps, appsPage, appsPerPage])

  // ── Active Node & Client Target Computation ──
  const activeTargetNode = nodes.find((n) => n.id === selectedNodeId) || nodes.find((n) => n.status === 'online') || nodes[0]
  const activeTargetNodeId = activeTargetNode?.id || selectedNodeId || ''
  const activeDeviceName = activeTargetNode?.name || activeTargetNode?.hostname || 'Device'
  const activePlatform = activeTargetNode?.platform || 'android'

  // Formatting helpers
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null || bytes <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatTimerDuration = (totalSec: number) => {
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }


  // Live Location Tracking state & Smart ADB Location Lifecycle
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false)
  const [isTogglingLiveTrack, setIsTogglingLiveTrack] = useState<boolean>(false)
  const autoGpsByNode = useRef<Map<string, boolean>>(new Map())

  // Real-time GPS polling when live tracking is active
  useEffect(() => {
    if (!isLiveTracking) return

    const timer = setInterval(async () => {
      try {
        const freshData = selectedNodeId
          ? await api.getNodeData(selectedNodeId)
          : await api.getClientData()

        if (freshData && freshData.location) {
          setClientData((prev) => ({
            ...prev,
            location: freshData.location,
            locations: freshData.locations?.length ? freshData.locations : prev.locations,
          }))
        }
      } catch (e) {
        console.error('Failed to fetch live location update:', e)
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [isLiveTracking, selectedNodeId])

  const handleToggleLiveTrack = async () => {
    const targetNodeId = selectedNodeId || (nodes.find((n) => n.status === 'online')?.id)
    if (!targetNodeId) {
      showSnackbar('Please select an online device to start live location tracking', 'warning')
      return
    }

    const nextState = !isLiveTracking
    setIsTogglingLiveTrack(true)
    try {
      if (nextState) {
        // ── 1. Starting Live Track: Check ADB Permission & Location Status ──
        let autoEnabled = false
        try {
          const sysStatus = await api.getNodeSystemStatus(targetNodeId).catch(() => null)
          const hasAdb = !!sysStatus?.permissions?.write_secure_settings
          const isLocOff = sysStatus?.toggles ? !sysStatus.toggles.location : false

          if (hasAdb && isLocOff) {
            // Turn Location ON automatically via ADB
            await api.setNodeSystemSetting(targetNodeId, 'location', true).catch(() => {})
            autoGpsByNode.current.set(targetNodeId, true)
            autoEnabled = true
          } else {
            autoGpsByNode.current.delete(targetNodeId)
          }
        } catch {
          // Graceful fallback: continue starting tracking without error
          autoGpsByNode.current.delete(targetNodeId)
        }

        await api.toggleLiveLocationTracking(targetNodeId, true, 2000)
        setIsLiveTracking(true)
        showSnackbar(
          autoEnabled
            ? 'Live GPS tracking active! (Device location auto-enabled via ADB)'
            : 'Live GPS tracking active! Streaming coordinates from device...',
          'success'
        )
      } else {
        // ── 2. Stopping Live Track: Restore Location if it was auto-enabled ──
        await api.toggleLiveLocationTracking(targetNodeId, false)
        setIsLiveTracking(false)

        const wasAutoEnabled = autoGpsByNode.current.get(targetNodeId) === true
        if (wasAutoEnabled) {
          try {
            await api.setNodeSystemSetting(targetNodeId, 'location', false).catch(() => {})
          } catch {}
          autoGpsByNode.current.delete(targetNodeId)
          showSnackbar('Live GPS tracking stopped (Device location turned off)', 'info')
        } else {
          showSnackbar('Live GPS tracking stopped', 'info')
        }
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || e?.message || 'Failed to toggle live tracking'
      showSnackbar(errMsg, 'error')
    } finally {
      setIsTogglingLiveTrack(false)
    }
  }

  const scrollToBottom = useCallback((smooth = true) => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      })
    }
  }, [])

  // ── Import & Export Refs & Handlers for Location and Notifications ──
  const locationFileInputRef = useRef<HTMLInputElement>(null)
  const notificationFileInputRef = useRef<HTMLInputElement>(null)
  const [isImportingLocation, setIsImportingLocation] = useState<boolean>(false)
  const [isImportingNotification, setIsImportingNotification] = useState<boolean>(false)

  // ── Location Export & Import ──
  const handleExportLocations = (format: 'json' | 'gpx' | 'csv' = 'json') => {
    const locs = clientData.locations && clientData.locations.length > 0
      ? clientData.locations
      : clientData.location ? [clientData.location] : []

    if (locs.length === 0) {
      showSnackbar('No GPS location records to export', 'warning')
      return
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeNodeName = (activeDeviceName || 'device').replace(/[^a-zA-Z0-9_-]/g, '_')

    if (format === 'json') {
      const exportPayload = {
        app: 'Kuro Homelab Assistant',
        export_type: 'gps_locations',
        device_id: activeTargetNodeId,
        device_name: activeDeviceName,
        exported_at: new Date().toISOString(),
        total_records: locs.length,
        current_location: clientData.location,
        locations: locs,
      }
      const jsonStr = JSON.stringify(exportPayload, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kuro_locations_${safeNodeName}_${timestamp}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSnackbar(`Exported ${locs.length} GPS location records (JSON)`, 'success')
    } else if (format === 'gpx') {
      let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Kuro Assistant" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>Kuro Location History - ${activeDeviceName}</name>\n    <trkseg>\n`
      for (const l of locs) {
        if (l.latitude && l.longitude) {
          gpx += `      <trkpt lat="${l.latitude}" lon="${l.longitude}">\n`
          if (l.accuracy) gpx += `        <ele>0</ele>\n`
          if (l.timestamp) gpx += `        <time>${new Date(l.timestamp).toISOString()}</time>\n`
          if (l.address) gpx += `        <name><![CDATA[${l.address}]]></name>\n`
          gpx += `      </trkpt>\n`
        }
      }
      gpx += `    </trkseg>\n  </trk>\n</gpx>`
      const blob = new Blob([gpx], { type: 'application/gpx+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kuro_locations_${safeNodeName}_${timestamp}.gpx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSnackbar(`Exported ${locs.length} GPS location records (GPX)`, 'success')
    } else if (format === 'csv') {
      const headers = ['latitude', 'longitude', 'accuracy', 'address', 'wifi_ssid', 'timestamp']
      const rows = locs.map((l) => [
        l.latitude,
        l.longitude,
        l.accuracy || 0,
        `"${(l.address || '').replace(/"/g, '""')}"`,
        `"${(l.wifi_ssid || '').replace(/"/g, '""')}"`,
        `"${l.timestamp || ''}"`,
      ])
      const csvStr = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      const blob = new Blob([csvStr], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kuro_locations_${safeNodeName}_${timestamp}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSnackbar(`Exported ${locs.length} GPS location records (CSV)`, 'success')
    }
  }

  const handleLocationImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImportingLocation(true)
    try {
      const text = await file.text()
      const fileName = file.name.toLowerCase()
      let parsedLocations: any[] = []

      if (fileName.endsWith('.json') || fileName.endsWith('.geojson')) {
        const json = JSON.parse(text)
        if (Array.isArray(json)) {
          parsedLocations = json
        } else if (Array.isArray(json.locations)) {
          parsedLocations = json.locations
        } else if (json.latitude && json.longitude) {
          parsedLocations = [json]
        } else if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
          parsedLocations = json.features.map((f: any) => ({
            latitude: f.geometry?.coordinates?.[1],
            longitude: f.geometry?.coordinates?.[0],
            address: f.properties?.name || f.properties?.address,
            timestamp: f.properties?.time || f.properties?.timestamp,
          }))
        }
      } else if (fileName.endsWith('.gpx')) {
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(text, 'text/xml')
        const trkpts = Array.from(xmlDoc.getElementsByTagName('trkpt'))
        const wpts = Array.from(xmlDoc.getElementsByTagName('wpt'))
        const allPts = [...trkpts, ...wpts]
        parsedLocations = allPts.map((pt) => {
          const lat = parseFloat(pt.getAttribute('lat') || '0')
          const lon = parseFloat(pt.getAttribute('lon') || '0')
          const time = pt.getElementsByTagName('time')[0]?.textContent || ''
          const name = pt.getElementsByTagName('name')[0]?.textContent || ''
          return { latitude: lat, longitude: lon, timestamp: time, address: name }
        })
      } else if (fileName.endsWith('.csv')) {
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length > 1) {
          const header = lines[0].toLowerCase().split(',').map((h) => h.replace(/["\s]/g, ''))
          const latIdx = header.findIndex((h) => h.includes('lat'))
          const lonIdx = header.findIndex((h) => h.includes('lon') || h.includes('lng'))
          const timeIdx = header.findIndex((h) => h.includes('time') || h.includes('date'))
          const addrIdx = header.findIndex((h) => h.includes('addr'))
          const accIdx = header.findIndex((h) => h.includes('acc'))
          const ssidIdx = header.findIndex((h) => h.includes('ssid') || h.includes('wifi'))

          if (latIdx >= 0 && lonIdx >= 0) {
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim())
              const lat = parseFloat(cols[latIdx])
              const lon = parseFloat(cols[lonIdx])
              if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
                parsedLocations.push({
                  latitude: lat,
                  longitude: lon,
                  timestamp: timeIdx >= 0 ? cols[timeIdx] : '',
                  address: addrIdx >= 0 ? cols[addrIdx] : '',
                  accuracy: accIdx >= 0 ? parseFloat(cols[accIdx]) : 0,
                  wifi_ssid: ssidIdx >= 0 ? cols[ssidIdx] : '',
                })
              }
            }
          }
        }
      }

      // Filter and sanitize valid coordinates
      const validLocations = parsedLocations.filter(
        (l) => typeof l?.latitude === 'number' && typeof l?.longitude === 'number' &&
               !isNaN(l.latitude) && !isNaN(l.longitude) &&
               l.latitude >= -90 && l.latitude <= 90 &&
               l.longitude >= -180 && l.longitude <= 180 &&
               (l.latitude !== 0 || l.longitude !== 0)
      )

      if (validLocations.length === 0) {
        showSnackbar('No valid GPS coordinates found in imported file', 'error')
        return
      }

      // Rebind to target device
      const boundLocations = validLocations.map((l) => ({
        ...l,
        node_id: activeTargetNodeId,
        device_name: activeDeviceName,
      }))

      const res = await api.importClientData(activeTargetNodeId, {
        type: 'locations',
        locations: boundLocations,
      })

      // Optimistically merge into local state
      setClientData((prev) => {
        const merged = [...boundLocations, ...(prev.locations || [])]
        return {
          ...prev,
          locations: merged,
          location: boundLocations[0] || prev.location,
        }
      })

      showSnackbar(res.message || `Successfully imported ${boundLocations.length} GPS location records into ${activeDeviceName}!`, 'success')
    } catch (err: any) {
      console.error('Import locations error:', err)
      showSnackbar(`Failed to import locations: ${err.message || 'Invalid file format'}`, 'error')
    } finally {
      setIsImportingLocation(false)
      if (locationFileInputRef.current) locationFileInputRef.current.value = ''
    }
  }

  // ── Notifications Export & Import ──
  const handleExportNotifications = (format: 'json' | 'csv' = 'json') => {
    const notifs = filteredNotifications.length > 0
      ? filteredNotifications
      : clientData.notifications || []

    if (notifs.length === 0) {
      showSnackbar('No notification records to export', 'warning')
      return
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeNodeName = (activeDeviceName || 'device').replace(/[^a-zA-Z0-9_-]/g, '_')

    if (format === 'json') {
      const exportPayload = {
        app: 'Kuro Homelab Assistant',
        export_type: 'notifications',
        device_id: activeTargetNodeId,
        device_name: activeDeviceName,
        exported_at: new Date().toISOString(),
        total_records: notifs.length,
        notifications: notifs,
      }
      const jsonStr = JSON.stringify(exportPayload, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kuro_notifications_${safeNodeName}_${timestamp}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSnackbar(`Exported ${notifs.length} notifications (JSON)`, 'success')
    } else if (format === 'csv') {
      const headers = ['ID', 'Package Name', 'App Name', 'Title', 'Text', 'Sub Text', 'Category', 'Timestamp', 'Is Clearable', 'Is Ongoing']
      const rows = notifs.map((n) => [
        `"${(n.id || '').replace(/"/g, '""')}"`,
        `"${(n.package_name || '').replace(/"/g, '""')}"`,
        `"${(n.app_label || n.app_name || '').replace(/"/g, '""')}"`,
        `"${(n.title || '').replace(/"/g, '""')}"`,
        `"${(n.text || '').replace(/"/g, '""')}"`,
        `"${(n.sub_text || '').replace(/"/g, '""')}"`,
        `"${(n.category || '').replace(/"/g, '""')}"`,
        `"${(n.timestamp || '').replace(/"/g, '""')}"`,
        (n.is_clearable ?? !n.is_cleared) ? 'true' : 'false',
        n.is_ongoing ? 'true' : 'false',
      ])
      const csvStr = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      const blob = new Blob([csvStr], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kuro_notifications_${safeNodeName}_${timestamp}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSnackbar(`Exported ${notifs.length} notifications (CSV)`, 'success')
    }
  }

  const handleNotificationImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImportingNotification(true)
    try {
      const text = await file.text()
      const fileName = file.name.toLowerCase()
      let parsedNotifs: any[] = []

      if (fileName.endsWith('.json')) {
        const json = JSON.parse(text)
        if (Array.isArray(json)) {
          parsedNotifs = json
        } else if (Array.isArray(json.notifications)) {
          parsedNotifs = json.notifications
        } else if (json.title || json.text || json.package_name) {
          parsedNotifs = [json]
        }
      } else if (fileName.endsWith('.csv')) {
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length > 1) {
          const header = lines[0].toLowerCase().split(',').map((h) => h.replace(/["\s]/g, ''))
          const titleIdx = header.findIndex((h) => h.includes('title'))
          const textIdx = header.findIndex((h) => h.includes('text') || h.includes('message') || h.includes('body'))
          const pkgIdx = header.findIndex((h) => h.includes('pkg') || h.includes('package'))
          const appIdx = header.findIndex((h) => h.includes('app'))
          const timeIdx = header.findIndex((h) => h.includes('time') || h.includes('date'))

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim())
            parsedNotifs.push({
              title: titleIdx >= 0 ? cols[titleIdx] : '',
              text: textIdx >= 0 ? cols[textIdx] : '',
              package_name: pkgIdx >= 0 ? cols[pkgIdx] : 'imported.app',
              app_name: appIdx >= 0 ? cols[appIdx] : 'Imported Notification',
              timestamp: timeIdx >= 0 ? cols[timeIdx] : new Date().toISOString(),
            })
          }
        }
      }

      const validNotifs = parsedNotifs.filter(
        (n) => n && (n.title || n.text || n.package_name || n.app_name)
      )

      if (validNotifs.length === 0) {
        showSnackbar('No valid notifications found in imported file', 'error')
        return
      }

      // Rebind to target device
      const boundNotifs = validNotifs.map((n) => ({
        ...n,
        node_id: activeTargetNodeId,
        device_name: activeDeviceName,
      }))

      const res = await api.importClientData(activeTargetNodeId, {
        type: 'notifications',
        notifications: boundNotifs,
      })

      // Optimistically merge into local state
      setClientData((prev) => ({
        ...prev,
        notifications: [...boundNotifs, ...(prev.notifications || [])],
      }))

      showSnackbar(res.message || `Successfully imported ${boundNotifs.length} notifications into ${activeDeviceName}!`, 'success')
    } catch (err: any) {
      console.error('Import notifications error:', err)
      showSnackbar(`Failed to import notifications: ${err.message || 'Invalid file format'}`, 'error')
    } finally {
      setIsImportingNotification(false)
      if (notificationFileInputRef.current) notificationFileInputRef.current.value = ''
    }
  }

  const handleChatScroll = useCallback(() => {
    if (!chatScrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollBottom(!isNearBottom)
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const loadData = useCallback(async (nodeId: string, isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)

      if (isManualRefresh) {
        // 1. Dispatch WebSocket trigger to the client device to collect fresh telemetry & data immediately
        if (nodeId) {
          await api.triggerNodeSync(nodeId).catch(() => {})
        } else {
          await api.triggerSyncAllNodes().catch(() => {})
        }
        // 2. Allow connected device enough time to gather hardware sensors, call logs, SMS, GPS fix, and POST back to server
        await new Promise((r) => setTimeout(r, 1200))
        // 3. Refresh parent nodes array so that top header info (battery, storage, network, last sync timestamp) is updated
        onRefreshNodes?.()
      }

      const res = nodeId
        ? await api.getNodeData(nodeId, false)
        : await api.getClientData(false)

      setClientData(res)
      if (isManualRefresh) {
        showSnackbar('Client data & telemetry synced from device', 'success')
      }
    } catch (err: any) {
      console.error('Failed to load client data:', err)
      showSnackbar(err.message || 'Failed to fetch client data', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showSnackbar, onRefreshNodes])

  useEffect(() => {
    loadData(selectedNodeId)
  }, [selectedNodeId, loadData])

  // Reset pagination on filter or search
  useEffect(() => {
    setCallPage(1)
  }, [searchQuery, callFilter, selectedNodeId])

  // Filtered Calls with Client-Scoped Contact Resolution
  const filteredCalls = useMemo(() => {
    return (clientData.calls || [])
      .map((c) => {
        const resolvedName = resolveContactName(c.node_id, c.phone_number, c.caller_name)
        return {
          ...c,
          caller_name: resolvedName,
        }
      })
      .filter((c) => {
        const q = searchQuery.toLowerCase().trim()
        const matchSearch =
          !q ||
          (c.caller_name && c.caller_name.toLowerCase().includes(q)) ||
          (c.phone_number && c.phone_number.includes(q)) ||
          (c.device_name && c.device_name.toLowerCase().includes(q)) ||
          (c.timestamp && c.timestamp.includes(q))
        const matchType =
          callFilter === 'all' ||
          (c.call_type && c.call_type.toLowerCase() === callFilter.toLowerCase())
        return matchSearch && matchType
      })
  }, [clientData.calls, searchQuery, callFilter, resolveContactName])

  // Paginated Calls
  const totalCallPages = Math.max(1, Math.ceil(filteredCalls.length / (callsPerPage === 0 ? filteredCalls.length || 1 : callsPerPage)))
  const paginatedCalls = useMemo(() => {
    if (callsPerPage === 0) return filteredCalls
    const start = (callPage - 1) * callsPerPage
    return filteredCalls.slice(start, start + callsPerPage)
  }, [filteredCalls, callPage, callsPerPage])

  // Group SMS Messages into Threads (WhatsApp Web style) with Client-Scoped Contact Resolution
  const smsThreads = useMemo(() => {
    const rawMessages = clientData.messages || []
    const map = new Map<string, SMSThread>()

    for (const msg of rawMessages) {
      const rawNum = (msg.phone_number || '').trim()
      const cleanNum = rawNum.replace(/[\s\-()]/g, '')
      const targetNode = msg.node_id || selectedNodeId
      const resolvedContactName = resolveContactName(targetNode, msg.phone_number, msg.sender_name)
      const nodeScope = msg.node_id || selectedNodeId || '__node__'
      const key = `${nodeScope}|${cleanNum || (msg.sender_name || '').trim() || 'unknown'}`

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          contactName: resolvedContactName || rawNum || 'Unknown Contact',
          phoneNumber: rawNum,
          deviceName: msg.device_name || msg.node_id,
          messages: [],
          lastMessage: msg,
          unreadCount: 0,
        })
      }

      const thread = map.get(key)!
      thread.messages.push(msg)
      if (resolvedContactName && resolvedContactName !== 'Unknown Contact' && resolvedContactName !== rawNum) {
        thread.contactName = resolvedContactName
      }
      if (!thread.phoneNumber && rawNum) {
        thread.phoneNumber = rawNum
      }
      if (msg.device_name && !thread.deviceName) {
        thread.deviceName = msg.device_name
      }
      if (!msg.is_read) {
        thread.unreadCount++
      }
    }

    const threads = Array.from(map.values()).map((t) => {
      t.messages.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
      t.lastMessage = t.messages[t.messages.length - 1]
      return t
    })

    threads.sort((a, b) => (b.lastMessage.timestamp > a.lastMessage.timestamp ? 1 : -1))
    return threads
  }, [clientData.messages, selectedNodeId, resolveContactName])

  // Filtered SMS Threads based on search
  const filteredSmsThreads = useMemo(() => {
    const q = smsSearchQuery.toLowerCase().trim()
    if (!q) return smsThreads
    return smsThreads.filter((t) => {
      return (
        t.contactName.toLowerCase().includes(q) ||
        t.phoneNumber.includes(q) ||
        (t.deviceName && t.deviceName.toLowerCase().includes(q)) ||
        t.messages.some((m) => m.message_body && m.message_body.toLowerCase().includes(q))
      )
    })
  }, [smsThreads, smsSearchQuery])

  // Active selected SMS Thread
  const activeThread = useMemo(() => {
    if (selectedThreadId) {
      return smsThreads.find((t) => t.id === selectedThreadId) || null
    }
    // On desktop, auto-preview first chat if none selected
    if (!isMobile && filteredSmsThreads.length > 0) {
      return filteredSmsThreads[0]
    }
    return null
  }, [selectedThreadId, filteredSmsThreads, smsThreads, isMobile])

  // Filtered & Paginated Contacts
  const filteredContacts = useMemo(() => {
    const list = clientData.contacts || []
    if (!contactSearchQuery.trim()) return list
    const q = contactSearchQuery.toLowerCase()
    return list.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone_numbers && c.phone_numbers.some((num) => num.includes(q))) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.device_name && c.device_name.toLowerCase().includes(q)) ||
        c.node_id.toLowerCase().includes(q)
      )
    })
  }, [clientData.contacts, contactSearchQuery])

  const totalContactPages = Math.ceil(filteredContacts.length / contactsPerPage) || 1
  const paginatedContacts = useMemo(() => {
    const start = (contactPage - 1) * contactsPerPage
    return filteredContacts.slice(start, start + contactsPerPage)
  }, [filteredContacts, contactPage, contactsPerPage])

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    showSnackbar(`Copied ${label} to clipboard`, 'success')
  }

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return '0s'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const formatCallType = (type: string) => {
    const t = (type || 'UNKNOWN').toUpperCase()
    switch (t) {
      case 'INCOMING':
        return { label: 'Incoming', color: '#8ec07c', bg: 'rgba(142, 192, 124, 0.14)', icon: 'phone-incoming' }
      case 'OUTGOING':
        return { label: 'Outgoing', color: '#83a598', bg: 'rgba(131, 165, 152, 0.14)', icon: 'phone-outgoing' }
      case 'MISSED':
        return { label: 'Missed', color: '#fb4934', bg: 'rgba(251, 73, 52, 0.14)', icon: 'phone-missed' }
      case 'REJECTED':
      case 'BLOCKED':
        return { label: 'Blocked', color: '#fe8019', bg: 'rgba(254, 128, 25, 0.14)', icon: 'phone-off' }
      default:
        return { label: t, color: 'var(--kuro-color-text-muted)', bg: 'rgba(255, 255, 255, 0.05)', icon: 'phone' }
    }
  }

  useEffect(() => {
    if (activeThread?.id) {
      const timer = setTimeout(() => {
        scrollToBottom(false)
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [activeThread?.id, scrollToBottom])

  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>

      {/* ── Empty State: No node selected ── */}
      {!selectedNodeId ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 24px',
            borderRadius: radius.card,
            backgroundColor: 'var(--kuro-color-surface)',
            border: '1px dashed var(--kuro-color-border)',
            textAlign: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: 'rgba(184, 187, 38, 0.1)',
              border: '1px solid rgba(184, 187, 38, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppIcon name="smartphone" size={24} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginBottom: 6 }}>
              No Device Selected
            </div>
            <div style={{ fontSize: 13, color: 'var(--kuro-color-text-muted)', maxWidth: 380 }}>
              Select a connected device from the Clients list to view its telemetry, call logs, SMS, notifications, installed apps, and location.
            </div>
          </div>
          <button
            onClick={() => navigate('/assistant/clients')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'var(--kuro-color-primary)',
              color: '#14161b',
              border: 'none',
              borderRadius: radius.button,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <AppIcon name="arrow-left" size={14} />
            <span>Go to Clients</span>
          </button>
        </div>
      ) : (
        <>

      {/* ── Scoped Client Header ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '2px 0 6px 0',
          width: '100%',
        }}
      >
        {/* Top row: icon + name/badges + refresh button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            {/* Device icon */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: 'rgba(184, 187, 38, 0.12)',
                border: '1px solid rgba(184, 187, 38, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--kuro-color-primary, #b8bb26)',
              }}
            >
              <AppIcon name={isWindows ? 'monitor' : 'smartphone'} size={18} />
            </div>

            {/* Device name + badges row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--kuro-color-text-primary)',
                  letterSpacing: -0.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedNode?.name || selectedNode?.hostname || selectedNodeId}
              </span>

              {/* Platform badge */}
              {selectedNode?.platform && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    padding: '2px 7px',
                    borderRadius: 4,
                    backgroundColor: 'rgba(131, 165, 152, 0.15)',
                    color: '#83a598',
                    border: '1px solid rgba(131, 165, 152, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  {selectedNode.platform}
                </span>
              )}

              {/* Online status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: selectedNode?.is_online ? '#8ec07c' : '#ea6962',
                    boxShadow: selectedNode?.is_online
                      ? '0 0 6px rgba(142,192,124,0.7)'
                      : '0 0 6px rgba(234,105,98,0.6)',
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-muted)' }}>
                  {selectedNode?.is_online ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: refresh button */}
          <button
            onClick={() => loadData(selectedNodeId, true)}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              backgroundColor: 'var(--kuro-color-surface, #1e1e1e)',
              border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.12))',
              color: 'var(--kuro-color-text-primary, #ebdbb2)',
              borderRadius: radius.button,
              padding: '7px 13px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: refreshing ? 'wait' : 'pointer',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!refreshing) {
                e.currentTarget.style.borderColor = 'var(--kuro-color-primary, #b8bb26)'
                e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface-hover, rgba(255,255,255,0.05))'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.22)'
              }
            }}
            onMouseLeave={(e) => {
              if (!refreshing) {
                e.currentTarget.style.borderColor = 'var(--kuro-color-border, rgba(255,255,255,0.12))'
                e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface, #1e1e1e)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'
              }
            }}
          >
            <AppIcon name="rotate-cw" size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* ── Node ID & Last Sync — full-width info bar below the title row ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '3px 0',
            fontFamily: monoFont,
          }}
        >
          <span style={{ fontSize: 10.5, color: 'var(--kuro-color-primary, #b8bb26)', fontWeight: 600 }}>
            {selectedNodeId}
          </span>
          {selectedNode?.last_seen && (
            <>
              <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)', opacity: 0.5 }}>•</span>
              <span style={{ fontSize: 10.5, color: 'var(--kuro-color-text-muted)', fontWeight: 500 }}>
                Last sync: {formatDateTime(selectedNode.last_seen)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Active Calling Status Live Monitor Banner ── */}
      {activeCallInfo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: radius.card,
            backgroundColor:
              activeCallInfo.state === 'ringing'
                ? 'rgba(254, 128, 25, 0.12)'
                : 'rgba(16, 185, 129, 0.12)',
            border:
              activeCallInfo.state === 'ringing'
                ? '1px solid rgba(254, 128, 25, 0.45)'
                : '1px solid rgba(16, 185, 129, 0.45)',
            boxShadow:
              activeCallInfo.state === 'ringing'
                ? '0 0 20px rgba(254, 128, 25, 0.2)'
                : '0 0 20px rgba(16, 185, 129, 0.2)',
            animation: 'pulse 2s infinite',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  activeCallInfo.state === 'ringing' ? '#fe8019' : '#10b981',
                color: '#14161b',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}
            >
              <AppIcon name="phone-call" size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    color:
                      activeCallInfo.state === 'ringing' ? '#fe8019' : '#10b981',
                  }}
                >
                  {activeCallInfo.state === 'ringing' ? 'Incoming Call Ringing' : 'Call In Progress'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--kuro-color-text-secondary)',
                  }}
                >
                  {activeCallInfo.deviceName}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginTop: 2 }}>
                {activeCallInfo.callerName || activeCallInfo.phoneNumber || 'Unknown Caller'}
                {activeCallInfo.callerName && activeCallInfo.phoneNumber && (
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--kuro-color-text-muted)', marginLeft: 8 }}>
                    ({activeCallInfo.phoneNumber})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {activeCallInfo.state === 'active' && (
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#10b981',
                  padding: '4px 10px',
                  borderRadius: radius.button,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                {formatTimerDuration(callTimerSec)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 1. If Windows Node: Render Dedicated Windows Workstation Dashboard ── */}
      {isWindows && !loading && (
        <WindowsClientView
          node={selectedNode}
          nodeId={selectedNodeId}
          snapshot={clientData.snapshot}
          onRefresh={() => loadData(selectedNodeId, true)}
        />
      )}

      {/* ── 2. Android Quick Settings Tiles (Always accessible on top of sub-category options) ── */}
      {!isWindows && selectedNodeId && !loading && (
        <ClientQuickSettingsTiles nodeId={selectedNodeId} />
      )}

      {/* ── 3. If Mobile/Android Node: Render Mobile Sub-Category Capsule Tabs ── */}
      {!isWindows && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
            borderRadius: 10,
            padding: 4,
            overflowX: 'auto',
            maxWidth: '100%',
            width: 'fit-content',
            boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.25)',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {[
            { id: 'calls' as SubCategory, icon: 'phone-call', label: 'Call Logs' },
            { id: 'messages' as SubCategory, icon: 'message-square', label: 'SMS Messages' },
            { id: 'contacts' as SubCategory, icon: 'users', label: 'Contacts' },
            { id: 'notifications' as SubCategory, icon: 'bell', label: 'Notifications' },
            { id: 'apps' as SubCategory, icon: 'grid', label: 'Installed Apps' },
            { id: 'files' as SubCategory, icon: 'folder', label: 'Files & Media' },
            { id: 'location' as SubCategory, icon: 'map-pin', label: 'GPS & Location' },
            { id: 'hardware' as SubCategory, icon: 'sliders', label: 'Audio & Hardware' },
            ...(!isWindows ? [{ id: 'utility' as SubCategory, icon: 'shield', label: 'Permissions' }] : []),
          ].map((tab) => {
            const isActive = activeCategory === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveCategory(tab.id)
                  setSearchQuery('')
                  setContactSearchQuery('')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 7,
                  border: 'none',
                  backgroundColor: isActive ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                  color: isActive ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 2px 10px rgba(184, 187, 38, 0.35)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover, rgba(255, 255, 255, 0.05))'
                    e.currentTarget.style.color = 'var(--kuro-color-text-primary, #ebdbb2)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--kuro-color-text-secondary, #a89984)'
                  }
                }}
              >
                <AppIcon name={tab.icon as any} size={15} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 220,
            gap: 10,
            color: 'var(--kuro-color-text-muted)',
          }}
        >
          <AppIcon name="rotate-cw" size={22} className="animate-spin" />
          <span style={{ fontSize: 13 }}>Fetching synchronized client logs...</span>
        </div>
      )}

      {!loading && !isWindows && (
        <>
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* 1. CALL LOGS TAB */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'calls' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Search, Filter & View Controls */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  width: '100%',
                }}
              >
                {/* Row 1: Search Box + View Switcher */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                  }}
                >
                  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      placeholder="Search by caller, phone number, date..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.button,
                        padding: '8px 12px 8px 34px',
                        fontSize: 13,
                        color: 'var(--kuro-color-text-primary)',
                        outline: 'none',
                      }}
                    />
                    <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--kuro-color-text-muted)' }}>
                      <AppIcon name="search" size={14} />
                    </div>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--kuro-color-text-muted)',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      >
                        <AppIcon name="x" size={13} />
                      </button>
                    )}
                  </div>

                  {/* Icon-Only View Switcher */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      backgroundColor: 'var(--kuro-color-surface, #18191a)',
                      padding: 3,
                      borderRadius: 8,
                      border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => setCallViewMode('table')}
                      title="Table View"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 30,
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: callViewMode === 'table' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                        color: callViewMode === 'table' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: callViewMode === 'table' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                      }}
                    >
                      <AppIcon name="list" size={16} />
                    </button>
                    <button
                      onClick={() => setCallViewMode('cards')}
                      title="Card Grid View"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 30,
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: callViewMode === 'cards' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                        color: callViewMode === 'cards' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: callViewMode === 'cards' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                      }}
                    >
                      <AppIcon name="grid" size={16} />
                    </button>
                  </div>
                </div>

                {/* Row 2: Filter Pills - Full-width Single Horizontal Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    width: '100%',
                    paddingBottom: 2,
                  }}
                >
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'incoming', label: 'Incoming' },
                    { id: 'outgoing', label: 'Outgoing' },
                    { id: 'missed', label: 'Missed' },
                  ].map((filter) => {
                    const isSel = callFilter === filter.id
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setCallFilter(filter.id)}
                        style={{
                          flex: '1 0 auto',
                          textAlign: 'center',
                          padding: '7px 16px',
                          borderRadius: 7,
                          border: `1px solid ${isSel ? 'var(--kuro-color-primary, #b8bb26)' : 'var(--kuro-color-border, rgba(255,255,255,0.09))'}`,
                          backgroundColor: isSel ? 'rgba(184, 187, 38, 0.12)' : 'var(--kuro-color-surface, #1e1e1e)',
                          color: isSel ? 'var(--kuro-color-primary, #b8bb26)' : 'var(--kuro-color-text-secondary, #a89984)',
                          fontSize: 12.5,
                          fontWeight: isSel ? 700 : 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                          boxShadow: isSel ? '0 0 10px rgba(184, 187, 38, 0.15)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSel) {
                            e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface-hover, rgba(255,255,255,0.05))'
                            e.currentTarget.style.color = 'var(--kuro-color-text-primary, #ebdbb2)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSel) {
                            e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface, #1e1e1e)'
                            e.currentTarget.style.color = 'var(--kuro-color-text-secondary, #a89984)'
                          }
                        }}
                      >
                        {filter.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Empty State */}
              {filteredCalls.length === 0 ? (
                <div
                  style={{
                    padding: '48px 20px',
                    textAlign: 'center',
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.card,
                    color: 'var(--kuro-color-text-muted)',
                    fontSize: 13,
                  }}
                >
                  <AppIcon name="phone-off" size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>No call logs match your query</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try clearing your search query or changing filters.</div>
                </div>
              ) : callViewMode === 'table' ? (
                /* ── RESPONSIVE HORIZONTAL-SCROLL TABLE VIEW ── */
                <div
                  style={{
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.card,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        minWidth: 760,
                        borderCollapse: 'collapse',
                        textAlign: 'left',
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--kuro-color-border)',
                            backgroundColor: 'var(--kuro-color-bg)',
                            color: 'var(--kuro-color-text-muted)',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          <th style={{ padding: '12px 16px', width: '30%' }}>Contact / Caller</th>
                          <th style={{ padding: '12px 14px', width: '25%' }}>Phone Number</th>
                          <th style={{ padding: '12px 14px', width: '18%' }}>Call Type</th>
                          <th style={{ padding: '12px 14px', width: '12%' }}>Duration</th>
                          <th style={{ padding: '12px 16px', width: '15%', textAlign: 'right' }}>Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedCalls.map((call, idx) => {
                          const info = formatCallType(call.call_type)
                          return (
                            <tr
                              key={call.id || `${call.phone_number}-${call.timestamp}-${idx}`}
                              style={{
                                borderBottom: '1px solid var(--kuro-color-border)',
                                transition: 'background-color 0.12s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface-hover)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              {/* Caller / Contact Name */}
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 30,
                                      height: 30,
                                      borderRadius: '50%',
                                      backgroundColor: info.bg,
                                      color: info.color,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {(call.caller_name || '?')[0].toUpperCase()}
                                  </div>
                                  <div style={{ fontWeight: 700, color: 'var(--kuro-color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                                    {call.caller_name || 'Unknown Contact'}
                                  </div>
                                </div>
                              </td>

                              {/* Phone Number */}
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontFamily: monoFont, fontSize: 12.5, color: 'var(--kuro-color-text-primary)' }}>
                                    {call.phone_number}
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(call.phone_number, 'phone number')}
                                    title="Copy number"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--kuro-color-text-muted)',
                                      cursor: 'pointer',
                                      padding: 3,
                                      borderRadius: 4,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <AppIcon name="copy" size={12} />
                                  </button>
                                </div>
                              </td>

                              {/* Call Type Badge */}
                              <td style={{ padding: '12px 14px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '3px 8px',
                                    borderRadius: radius.button,
                                    backgroundColor: info.bg,
                                    color: info.color,
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  <AppIcon name={info.icon as any} size={11} />
                                  <span>{info.label}</span>
                                </span>
                              </td>

                              {/* Duration */}
                              <td style={{ padding: '12px 14px' }}>
                                <span
                                  style={{
                                    fontFamily: monoFont,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: call.duration > 0 ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)',
                                  }}
                                >
                                  {formatDuration(call.duration)}
                                </span>
                              </td>

                              {/* Timestamp */}
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--kuro-color-text-muted)', fontSize: 11.5, fontFamily: monoFont }}>
                                {formatDateTime(call.timestamp)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ── TABLE PAGINATION FOOTER ── */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      padding: '12px 18px',
                      borderTop: '1px solid var(--kuro-color-border)',
                      backgroundColor: 'var(--kuro-color-bg)',
                      fontSize: 12,
                      color: 'var(--kuro-color-text-muted)',
                    }}
                  >
                    {/* Record Count info */}
                    <div>
                      Showing{' '}
                      <strong style={{ color: 'var(--kuro-color-text-primary)' }}>
                        {filteredCalls.length === 0 ? 0 : (callPage - 1) * (callsPerPage === 0 ? filteredCalls.length : callsPerPage) + 1}
                      </strong>{' '}
                      to{' '}
                      <strong style={{ color: 'var(--kuro-color-text-primary)' }}>
                        {callsPerPage === 0 ? filteredCalls.length : Math.min(callPage * callsPerPage, filteredCalls.length)}
                      </strong>{' '}
                      of <strong style={{ color: 'var(--kuro-color-text-primary)' }}>{filteredCalls.length}</strong> calls
                    </div>

                    {/* Rows per page & Navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Rows:</span>
                        <select
                          value={callsPerPage}
                          onChange={(e) => {
                            setCallsPerPage(Number(e.target.value))
                            setCallPage(1)
                          }}
                          style={{
                            backgroundColor: 'var(--kuro-color-surface)',
                            border: '1px solid var(--kuro-color-border)',
                            color: 'var(--kuro-color-text-primary)',
                            borderRadius: radius.button,
                            padding: '4px 8px',
                            fontSize: 12,
                            outline: 'none',
                          }}
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={250}>250</option>
                          <option value={0}>All</option>
                        </select>
                      </div>

                      {/* Page Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => setCallPage(1)}
                          disabled={callPage <= 1}
                          style={{
                            padding: '4px 8px',
                            borderRadius: radius.button,
                            border: '1px solid var(--kuro-color-border)',
                            backgroundColor: 'var(--kuro-color-surface)',
                            color: callPage <= 1 ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-text-primary)',
                            cursor: callPage <= 1 ? 'not-allowed' : 'pointer',
                            opacity: callPage <= 1 ? 0.5 : 1,
                            fontSize: 11,
                          }}
                        >
                          First
                        </button>
                        <button
                          onClick={() => setCallPage((p) => Math.max(1, p - 1))}
                          disabled={callPage <= 1}
                          style={{
                            padding: '4px 8px',
                            borderRadius: radius.button,
                            border: '1px solid var(--kuro-color-border)',
                            backgroundColor: 'var(--kuro-color-surface)',
                            color: callPage <= 1 ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-text-primary)',
                            cursor: callPage <= 1 ? 'not-allowed' : 'pointer',
                            opacity: callPage <= 1 ? 0.5 : 1,
                            fontSize: 11,
                          }}
                        >
                          Prev
                        </button>

                        <span style={{ padding: '0 6px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                          {callPage} / {totalCallPages}
                        </span>

                        <button
                          onClick={() => setCallPage((p) => Math.min(totalCallPages, p + 1))}
                          disabled={callPage >= totalCallPages}
                          style={{
                            padding: '4px 8px',
                            borderRadius: radius.button,
                            border: '1px solid var(--kuro-color-border)',
                            backgroundColor: 'var(--kuro-color-surface)',
                            color: callPage >= totalCallPages ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-text-primary)',
                            cursor: callPage >= totalCallPages ? 'not-allowed' : 'pointer',
                            opacity: callPage >= totalCallPages ? 0.5 : 1,
                            fontSize: 11,
                          }}
                        >
                          Next
                        </button>
                        <button
                          onClick={() => setCallPage(totalCallPages)}
                          disabled={callPage >= totalCallPages}
                          style={{
                            padding: '4px 8px',
                            borderRadius: radius.button,
                            border: '1px solid var(--kuro-color-border)',
                            backgroundColor: 'var(--kuro-color-surface)',
                            color: callPage >= totalCallPages ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-text-primary)',
                            cursor: callPage >= totalCallPages ? 'not-allowed' : 'pointer',
                            opacity: callPage >= totalCallPages ? 0.5 : 1,
                            fontSize: 11,
                          }}
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── CARDS GRID VIEW ── */
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                    {paginatedCalls.map((call, idx) => {
                      const info = formatCallType(call.call_type)
                      return (
                        <div
                          key={call.id || `${call.phone_number}-${call.timestamp}-${idx}`}
                          style={{
                            backgroundColor: 'var(--kuro-color-surface)',
                            border: '1px solid var(--kuro-color-border)',
                            borderRadius: radius.card,
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: '50%',
                                  backgroundColor: info.bg,
                                  color: info.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <AppIcon name={info.icon as any} size={15} />
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {call.caller_name || 'Unknown Contact'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)', fontFamily: monoFont, marginTop: 2 }}>
                                  {call.phone_number}
                                </div>
                              </div>
                            </div>

                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: radius.button,
                                backgroundColor: info.bg,
                                color: info.color,
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {info.label}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--kuro-color-border)', fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{formatDuration(call.duration)}</span>
                            <span>{formatDateTime(call.timestamp)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Cards Pagination */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 }}>
                    <button
                      onClick={() => setCallPage((p) => Math.max(1, p - 1))}
                      disabled={callPage <= 1}
                      style={{ padding: '6px 12px', borderRadius: radius.button, border: '1px solid var(--kuro-color-border)', backgroundColor: 'var(--kuro-color-surface)', color: 'var(--kuro-color-text-primary)', cursor: callPage <= 1 ? 'not-allowed' : 'pointer', opacity: callPage <= 1 ? 0.5 : 1 }}
                    >
                      Prev Page
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)', fontWeight: 600 }}>
                      Page {callPage} of {totalCallPages} ({filteredCalls.length} calls)
                    </span>
                    <button
                      onClick={() => setCallPage((p) => Math.min(totalCallPages, p + 1))}
                      disabled={callPage >= totalCallPages}
                      style={{ padding: '6px 12px', borderRadius: radius.button, border: '1px solid var(--kuro-color-border)', backgroundColor: 'var(--kuro-color-surface)', color: 'var(--kuro-color-text-primary)', cursor: callPage >= totalCallPages ? 'not-allowed' : 'pointer', opacity: callPage >= totalCallPages ? 0.5 : 1 }}
                    >
                      Next Page
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* 2. SMS MESSAGES TAB (WhatsApp Mobile & Web Style Chat App) */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'messages' && (
            <div
              style={{
                display: 'flex',
                height: isMobile ? 'calc(100vh - 190px)' : 'calc(100vh - 210px)',
                minHeight: 600,
                backgroundColor: 'var(--kuro-color-surface)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.card,
                overflow: 'hidden',
                width: '100%',
                position: 'relative',
              }}
            >
              {/* ── 1. THREADS LIST PANEL (Full width on mobile when no thread is selected, 320px on desktop) ── */}
              {(!isMobile || !selectedThreadId) && (
                <div
                  style={{
                    width: isMobile ? '100%' : '320px',
                    maxWidth: isMobile ? '100%' : '360px',
                    minWidth: isMobile ? '100%' : '280px',
                    borderRight: isMobile ? 'none' : '1px solid var(--kuro-color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--kuro-color-surface)',
                    flexShrink: 0,
                    height: '100%',
                  }}
                >
                  {/* Search Bar & Header */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--kuro-color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      backgroundColor: 'var(--kuro-color-bg)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                        Chats
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 7px',
                          borderRadius: 10,
                          backgroundColor: 'rgba(215, 153, 33, 0.12)',
                          color: 'var(--kuro-color-primary)',
                          fontWeight: 600,
                        }}
                      >
                        {smsThreads.length} chats • {(clientData.messages || []).length} SMS
                      </span>
                    </div>

                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="text"
                        placeholder="Search chats by name, number, text..."
                        value={smsSearchQuery}
                        onChange={(e) => setSmsSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--kuro-color-surface)',
                          border: '1px solid var(--kuro-color-border)',
                          borderRadius: radius.button,
                          padding: '7px 10px 7px 30px',
                          fontSize: 12,
                          color: 'var(--kuro-color-text-primary)',
                          outline: 'none',
                        }}
                      />
                      <div style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--kuro-color-text-muted)' }}>
                        <AppIcon name="search" size={13} />
                      </div>
                      {smsSearchQuery && (
                        <button
                          onClick={() => setSmsSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--kuro-color-text-muted)',
                            cursor: 'pointer',
                            padding: 2,
                          }}
                        >
                          <AppIcon name="x" size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable Threads List */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {filteredSmsThreads.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 12 }}>
                        <AppIcon name="message-square" size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                        <div>No conversations found</div>
                      </div>
                    ) : (
                      filteredSmsThreads.map((thread) => {
                        const isSelected = activeThread?.id === thread.id
                        return (
                          <div
                            key={thread.id}
                            onClick={() => setSelectedThreadId(thread.id)}
                            style={{
                              padding: '12px 14px',
                              borderBottom: '1px solid var(--kuro-color-border)',
                              backgroundColor: isSelected && !isMobile ? 'rgba(215, 153, 33, 0.12)' : 'transparent',
                              borderLeft: isSelected && !isMobile ? '3px solid var(--kuro-color-primary)' : '3px solid transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              transition: 'background-color 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected || isMobile) e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface-hover)'
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected || isMobile) e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            {/* Avatar with Initials */}
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(215, 153, 33, 0.16)',
                                color: 'var(--kuro-color-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 14,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {(thread.contactName || '?')[0].toUpperCase()}
                            </div>

                            {/* Thread Meta */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <div
                                  style={{
                                    fontSize: 13.5,
                                    fontWeight: 700,
                                    color: 'var(--kuro-color-text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {thread.contactName}
                                </div>
                                <span style={{ fontSize: 10.5, color: 'var(--kuro-color-text-muted)', flexShrink: 0, fontFamily: monoFont }}>
                                  {thread.lastMessage?.timestamp ? formatDateTime(thread.lastMessage.timestamp) : ''}
                                </span>
                              </div>

                              {/* Snippet + Count */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 3 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--kuro-color-text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {thread.lastMessage?.is_sent || thread.lastMessage?.message_type === 'sent' ? (
                                    <span style={{ color: 'var(--kuro-color-primary)', fontWeight: 600, marginRight: 4 }}>You:</span>
                                  ) : null}
                                  {thread.lastMessage?.message_body || 'No messages'}
                                </div>

                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: '1px 6px',
                                    borderRadius: 10,
                                    backgroundColor: 'var(--kuro-color-bg)',
                                    color: 'var(--kuro-color-text-muted)',
                                    flexShrink: 0,
                                    fontWeight: 600,
                                  }}
                                >
                                  {thread.messages.length}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ── 2. CHAT CONVERSATION SCREEN (Full width on mobile when a thread is selected, flex: 1 on desktop) ── */}
              {(!isMobile || selectedThreadId) && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--kuro-color-bg)',
                    minWidth: 0,
                    height: '100%',
                    position: 'relative',
                  }}
                >
                  {activeThread ? (
                    <>
                      {/* Active Chat Header */}
                      <div
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid var(--kuro-color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          backgroundColor: 'var(--kuro-color-surface)',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          {isMobile && (
                            <button
                              onClick={() => setSelectedThreadId(null)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--kuro-color-text-primary)',
                                cursor: 'pointer',
                                padding: 4,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <AppIcon name="chevron-left" size={18} />
                            </button>
                          )}

                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              backgroundColor: 'rgba(215, 153, 33, 0.18)',
                              color: 'var(--kuro-color-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {(activeThread.contactName || '?')[0].toUpperCase()}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: 'var(--kuro-color-text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {activeThread.contactName}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: monoFont }}>
                                {activeThread.phoneNumber}
                              </span>
                              <button
                                onClick={() => copyToClipboard(activeThread.phoneNumber, 'phone number')}
                                title="Copy number"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--kuro-color-text-muted)',
                                  cursor: 'pointer',
                                  padding: 1,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                              >
                                <AppIcon name="copy" size={11} />
                              </button>
                              <span>•</span>
                              <span style={{ fontSize: 10.5, color: 'var(--kuro-color-text-muted)' }}>
                                {activeThread.messages.length} msgs
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Header Action: Export Chat */}
                        <button
                          onClick={() =>
                            copyToClipboard(
                              activeThread.messages
                                .map((m) => {
                                  const senderLabel = m.is_sent || m.message_type === 'sent' ? 'You' : resolveContactName(m.node_id || selectedNodeId, m.phone_number, m.sender_name || activeThread.contactName)
                                  return `[${formatDateTime(m.timestamp)}] ${senderLabel}: ${m.message_body}`
                                })
                                .join('\n\n'),
                              'chat transcript'
                            )
                          }
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: 'var(--kuro-color-bg)',
                            border: '1px solid var(--kuro-color-border)',
                            borderRadius: radius.button,
                            padding: '5px 10px',
                            color: 'var(--kuro-color-text-primary)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <AppIcon name="copy" size={12} />
                          <span>Export</span>
                        </button>
                      </div>

                      {/* Chat Bubble Stream */}
                      <div
                        ref={chatScrollRef}
                        onScroll={handleChatScroll}
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          padding: '16px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        {activeThread.messages.map((msg, idx) => {
                          const isSent = msg.is_sent || msg.message_type === 'sent' || msg.message_type === 'outbox'
                          return (
                            <div
                              key={msg.id || `${msg.phone_number}-${msg.timestamp}-${idx}`}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignSelf: isSent ? 'flex-end' : 'flex-start',
                                maxWidth: isMobile ? '88%' : '75%',
                                backgroundColor: isSent
                                  ? 'rgba(169, 182, 101, 0.16)'
                                  : 'var(--kuro-color-surface)',
                                border: isSent
                                  ? '1px solid rgba(169, 182, 101, 0.38)'
                                  : '1px solid var(--kuro-color-border)',
                                borderRadius: isSent
                                  ? '14px 14px 2px 14px'
                                  : '14px 14px 14px 2px',
                                padding: '10px 14px',
                                gap: 6,
                                boxShadow: isSent
                                  ? '0 1px 4px rgba(0, 0, 0, 0.15)'
                                  : '0 1px 3px rgba(0, 0, 0, 0.1)',
                              }}
                            >
                              {/* Message Text */}
                              <div
                                style={{
                                  fontSize: 13,
                                  color: 'var(--kuro-color-text-primary)',
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {msg.message_body}
                              </div>

                              {/* Message Footer */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: isSent ? 'flex-end' : 'flex-start',
                                  gap: 6,
                                  fontSize: 10,
                                  color: 'var(--kuro-color-text-muted)',
                                  fontFamily: monoFont,
                                }}
                              >
                                {isSent && (
                                  <span
                                    style={{
                                      color: 'var(--kuro-color-primary)',
                                      fontWeight: 600,
                                      fontSize: 9.5,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.4px',
                                    }}
                                  >
                                    You
                                  </span>
                                )}
                                <span>{formatDateTime(msg.timestamp)}</span>
                                {isSent && (
                                  <AppIcon
                                    name="check-check"
                                    size={12}
                                    style={{ color: 'var(--kuro-color-primary)', display: 'inline-block' }}
                                  />
                                )}
                                <button
                                  onClick={() => copyToClipboard(msg.message_body, 'SMS message text')}
                                  title="Copy text"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--kuro-color-text-muted)',
                                    cursor: 'pointer',
                                    padding: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    marginLeft: 2,
                                  }}
                                >
                                  <AppIcon name="copy" size={10} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Floating Scroll to Bottom Button */}
                      {showScrollBottom && (
                        <button
                          onClick={() => scrollToBottom(true)}
                          title="Scroll to latest messages"
                          aria-label="Scroll to bottom"
                          style={{
                            position: 'absolute',
                            bottom: 50,
                            right: 20,
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            backgroundColor: 'var(--kuro-color-surface)',
                            border: '1px solid var(--kuro-color-border)',
                            color: 'var(--kuro-color-primary)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 10,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
                            e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)'
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.65)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface)'
                            e.currentTarget.style.transform = 'translateY(0) scale(1)'
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.5)'
                          }}
                        >
                          <AppIcon name="arrow-down" size={17} />
                        </button>
                      )}

                      {/* Chat Footer: Read-Only Info Note */}
                      <div
                        style={{
                          padding: '8px 14px',
                          borderTop: '1px solid var(--kuro-color-border)',
                          backgroundColor: 'var(--kuro-color-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          fontSize: 11,
                          color: 'var(--kuro-color-text-muted)',
                        }}
                      >
                        <AppIcon name="smartphone" size={12} style={{ color: 'var(--kuro-color-primary)' }} />
                        <span>
                          <strong>{activeThread.deviceName || 'Device'}</strong> SMS Archive • Read-Only
                        </span>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        color: 'var(--kuro-color-text-muted)',
                        padding: 20,
                      }}
                    >
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(215, 153, 33, 0.1)',
                          color: 'var(--kuro-color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AppIcon name="message-square" size={24} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                        Kuro SMS Messenger
                      </div>
                      <div style={{ fontSize: 12, maxWidth: 300, textAlign: 'center' }}>
                        Select a conversation thread to browse synchronized messages.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* 3. CONTACTS TAB */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'contacts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Controls Bar: Search, View Mode, Counter */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.button,
                      padding: '7px 12px',
                      flex: 1,
                      maxWidth: isMobile ? '100%' : 400,
                    }}
                  >
                    <AppIcon name="search" size={14} style={{ color: 'var(--kuro-color-text-muted)', flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="Search contacts by name, number, email..."
                      value={contactSearchQuery}
                      onChange={(e) => {
                        setContactSearchQuery(e.target.value)
                        setContactPage(1)
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--kuro-color-text-primary)',
                        fontSize: 13,
                        outline: 'none',
                        width: '100%',
                      }}
                    />
                    {contactSearchQuery && (
                      <button
                        onClick={() => setContactSearchQuery('')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--kuro-color-text-muted)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <AppIcon name="x" size={12} />
                      </button>
                    )}
                  </div>

                  {!isMobile && (
                    <span style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)', whiteSpace: 'nowrap' }}>
                      Showing {filteredContacts.length} of {clientData.contacts?.length || 0} contacts
                    </span>
                  )}
                </div>

                {/* View Mode Toggle: Cards / Table */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    backgroundColor: 'var(--kuro-color-surface, #18191a)',
                    border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
                    borderRadius: 8,
                    padding: 3,
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() => setContactViewMode('cards')}
                    title="Cards View"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: isMobile ? '6px 10px' : '6px 12px',
                      height: 30,
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: contactViewMode === 'cards' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                      color: contactViewMode === 'cards' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                      fontSize: 12,
                      fontWeight: contactViewMode === 'cards' ? 700 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: contactViewMode === 'cards' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                    }}
                  >
                    <AppIcon name="grid" size={isMobile ? 15 : 13} />
                    {!isMobile && 'Cards'}
                  </button>
                  <button
                    onClick={() => setContactViewMode('table')}
                    title="Table View"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: isMobile ? '6px 10px' : '6px 12px',
                      height: 30,
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: contactViewMode === 'table' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                      color: contactViewMode === 'table' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                      fontSize: 12,
                      fontWeight: contactViewMode === 'table' ? 700 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: contactViewMode === 'table' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                    }}
                  >
                    <AppIcon name="list" size={isMobile ? 15 : 13} />
                    {!isMobile && 'Table'}
                  </button>
                </div>
              </div>

              {/* Empty state */}
              {filteredContacts.length === 0 ? (
                <div
                  style={{
                    padding: '48px 20px',
                    textAlign: 'center',
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.card,
                    color: 'var(--kuro-color-text-muted)',
                    fontSize: 13,
                  }}
                >
                  <AppIcon name="users" size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)', marginBottom: 4 }}>
                    No Contacts Found
                  </div>
                  <div>
                    {contactSearchQuery
                      ? `No contacts matching "${contactSearchQuery}"`
                      : 'No contacts synced yet. Click "Refresh" or grant Contacts permission in the Android app.'}
                  </div>
                </div>
              ) : contactViewMode === 'cards' ? (
                /* Cards View */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                    gap: 12,
                  }}
                >
                  {paginatedContacts.map((contact) => {
                    const initials = (contact.name || '?')
                      .split(' ')
                      .filter(Boolean)
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()

                    return (
                      <div
                        key={contact.id || contact.name}
                        style={{
                          backgroundColor: 'var(--kuro-color-surface)',
                          border: '1px solid var(--kuro-color-border)',
                          borderRadius: radius.card,
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          transition: 'border-color 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(215, 153, 33, 0.15)',
                                color: 'var(--kuro-color-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 13,
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 13.5,
                                  color: 'var(--kuro-color-text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {contact.name || 'Unnamed Contact'}
                              </div>
                              {contact.email && (
                                <div
                                  style={{
                                    fontSize: 11.5,
                                    color: 'var(--kuro-color-text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {contact.email}
                                </div>
                              )}
                            </div>
                          </div>

                          {contact.is_starred && (
                            <span title="Starred / Favorite Contact" style={{ color: '#fabd2f', display: 'flex', alignItems: 'center' }}>
                              <Star size={14} style={{ fill: '#fabd2f' }} />
                            </span>
                          )}
                        </div>

                        {/* Phone Numbers List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {contact.phone_numbers && contact.phone_numbers.length > 0 ? (
                            contact.phone_numbers.map((phone, pIdx) => (
                              <div
                                key={pIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 12,
                                  fontFamily: monoFont,
                                  color: 'var(--kuro-color-text-primary)',
                                  backgroundColor: 'var(--kuro-color-bg)',
                                  padding: '4px 8px',
                                  borderRadius: radius.button,
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {phone}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <button
                                    onClick={() => copyToClipboard(phone, 'Phone Number')}
                                    title="Copy Phone Number"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--kuro-color-text-muted)',
                                      cursor: 'pointer',
                                      padding: 2,
                                    }}
                                  >
                                    <AppIcon name="copy" size={12} />
                                  </button>
                                  <a
                                    href={`tel:${phone}`}
                                    title="Call Number"
                                    style={{
                                      color: 'var(--kuro-color-primary)',
                                      display: 'flex',
                                      padding: 2,
                                    }}
                                  >
                                    <AppIcon name="phone" size={12} />
                                  </a>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ fontSize: 11.5, color: 'var(--kuro-color-text-muted)' }}>
                              No phone numbers recorded
                            </div>
                          )}
                        </div>

                        {/* Card footer */}
                        {contact.last_contacted && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              paddingTop: 6,
                              borderTop: '1px solid var(--kuro-color-border)',
                              fontSize: 11,
                              color: 'var(--kuro-color-text-muted)',
                            }}
                          >
                            <span>Last: {formatDateTime(contact.last_contacted)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Table View */
                <div
                  style={{
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.card,
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--kuro-color-bg)', borderBottom: '1px solid var(--kuro-color-border)', color: 'var(--kuro-color-text-muted)' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 600, width: '30%' }}>Name</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, width: '35%' }}>Phone Numbers</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, width: '25%' }}>Email</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, width: '10%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedContacts.map((contact) => (
                        <tr
                          key={contact.id || contact.name}
                          style={{ borderBottom: '1px solid var(--kuro-color-border)' }}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {contact.is_starred && <Star size={12} style={{ color: '#fabd2f', fill: '#fabd2f' }} />}
                              <span>{contact.name || 'Unnamed'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: monoFont }}>
                            {contact.phone_numbers?.join(', ') || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--kuro-color-text-secondary)' }}>
                            {contact.email || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            {contact.phone_numbers && contact.phone_numbers[0] && (
                              <button
                                onClick={() => copyToClipboard(contact.phone_numbers[0], 'Phone Number')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--kuro-color-text-muted)',
                                  cursor: 'pointer',
                                  padding: '2px 6px',
                                }}
                                title="Copy Number"
                              >
                                <AppIcon name="copy" size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {totalContactPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.card,
                    padding: '10px 16px',
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ color: 'var(--kuro-color-text-muted)' }}>
                    Page {contactPage} of {totalContactPages}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => setContactPage((p) => Math.max(1, p - 1))}
                      disabled={contactPage <= 1}
                      style={{
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        borderRadius: radius.button,
                        padding: '5px 10px',
                        cursor: contactPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: contactPage <= 1 ? 0.5 : 1,
                      }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setContactPage((p) => Math.min(totalContactPages, p + 1))}
                      disabled={contactPage >= totalContactPages}
                      style={{
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        borderRadius: radius.button,
                        padding: '5px 10px',
                        cursor: contactPage >= totalContactPages ? 'not-allowed' : 'pointer',
                        opacity: contactPage >= totalContactPages ? 0.5 : 1,
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* 4. GPS & LOCATION TAB */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'location' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Location Controls Header: View Mode Switcher + OpenStreetMap Export */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      backgroundColor: 'var(--kuro-color-surface, #18191a)',
                      border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
                      borderRadius: 8,
                      padding: 3,
                    }}
                  >
                    <button
                      onClick={() => setLocationViewMode('map')}
                      title="Map View"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: isMobile ? '6px 9px' : '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: locationViewMode === 'map' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                        color: locationViewMode === 'map' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                        fontSize: 12,
                        fontWeight: locationViewMode === 'map' ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: locationViewMode === 'map' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                      }}
                    >
                      <AppIcon name="map" size={14} />
                      {!isMobile && <span>Map</span>}
                    </button>

                    <button
                      onClick={() => setLocationViewMode('list')}
                      title="History View"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: isMobile ? '6px 9px' : '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: locationViewMode === 'list' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                        color: locationViewMode === 'list' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                        fontSize: 12,
                        fontWeight: locationViewMode === 'list' ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: locationViewMode === 'list' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                      }}
                    >
                      <AppIcon name="list" size={14} />
                      {!isMobile && <span>History</span>}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Calendar Date Range Picker Widget */}
                  <CalendarRangePicker
                    value={{
                      startDate: customStartDate || null,
                      endDate: customEndDate || null,
                    }}
                    onChange={(range) => {
                      if (!range.startDate && !range.endDate) {
                        setCustomStartDate('')
                        setCustomEndDate('')
                        setTimelineFilter('all')
                      } else {
                        setCustomStartDate(range.startDate || '')
                        setCustomEndDate(range.endDate || '')
                        setTimelineFilter('custom')
                      }
                    }}
                  />

                  {/* External Map Open Button */}
                  <a
                    href={
                      (filteredCurrentLocation && filteredCurrentLocation.latitude !== 0)
                        ? `https://www.openstreetmap.org/?mlat=${filteredCurrentLocation.latitude}&mlon=${filteredCurrentLocation.longitude}#map=17/${filteredCurrentLocation.latitude}/${filteredCurrentLocation.longitude}`
                        : (clientData.location && clientData.location.latitude !== 0)
                        ? `https://www.openstreetmap.org/?mlat=${clientData.location.latitude}&mlon=${clientData.location.longitude}#map=17/${clientData.location.latitude}/${clientData.location.longitude}`
                        : (filteredLocations.length > 0 && filteredLocations[0].latitude !== 0)
                        ? `https://www.openstreetmap.org/?mlat=${filteredLocations[0].latitude}&mlon=${filteredLocations[0].longitude}#map=17/${filteredLocations[0].latitude}/${filteredLocations[0].longitude}`
                        : 'https://www.openstreetmap.org/'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open location in external map"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      color: 'var(--kuro-color-text-secondary)',
                      borderRadius: radius.button,
                      padding: isMobile ? '6px 10px' : '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <AppIcon name="external-link" size={isMobile ? 14 : 13} />
                    {!isMobile && <span>Open</span>}
                  </a>

                  {/* Import Location Button */}
                  <input
                    ref={locationFileInputRef}
                    type="file"
                    accept=".json,.geojson,.gpx,.csv"
                    style={{ display: 'none' }}
                    onChange={handleLocationImportFile}
                  />
                  <button
                    onClick={() => locationFileInputRef.current?.click()}
                    disabled={isImportingLocation}
                    title="Import GPS Locations (.json, .gpx, .csv)"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      color: 'var(--kuro-color-text-primary, #ebdbb2)',
                      borderRadius: radius.button,
                      padding: isMobile ? '6px 10px' : '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isImportingLocation ? 'not-allowed' : 'pointer',
                      opacity: isImportingLocation ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <AppIcon name={isImportingLocation ? "rotate-cw" : "upload"} size={isMobile ? 14 : 13} className={isImportingLocation ? "animate-spin" : ""} />
                    {!isMobile && <span>{isImportingLocation ? 'Importing...' : 'Import'}</span>}
                  </button>

                  {/* Export Location Button */}
                  <button
                    onClick={() => handleExportLocations('json')}
                    title="Export GPS Locations as JSON"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      color: 'var(--kuro-color-primary, #b8bb26)',
                      borderRadius: radius.button,
                      padding: isMobile ? '6px 10px' : '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <AppIcon name="download" size={isMobile ? 14 : 13} />
                    {!isMobile && <span>Export</span>}
                  </button>
                </div>
              </div>

              {/* ── 1. MAP VIEW ── */}
              {locationViewMode === 'map' && (
                <LocationMapView
                  currentLocation={filteredCurrentLocation}
                  locations={filteredLocations}
                  height={650}
                  isLiveTracking={isLiveTracking}
                  onToggleLiveTrack={handleToggleLiveTrack}
                  isTogglingLiveTrack={isTogglingLiveTrack}
                />
              )}

              {/* ── 2. HISTORY VIEW (Telemetry Summary Card & Log) ── */}
              {locationViewMode === 'list' && (
                <>
                  {/* Latest Coordinates Card */}
                  {clientData.location ? (
                    <div
                      style={{
                        backgroundColor: 'var(--kuro-color-surface)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.card,
                        padding: isMobile ? 12 : 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isMobile ? 10 : 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AppIcon name="map-pin" size={16} style={{ color: 'var(--kuro-color-primary)' }} />
                          <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                            Latest Device Position
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: isMobile ? 9.5 : 10.5,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 6,
                              backgroundColor: 'rgba(142, 192, 124, 0.15)',
                              color: '#8ec07c',
                              border: '1px solid rgba(142, 192, 124, 0.3)',
                            }}
                          >
                            ACTIVE TELEMETRY
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: isMobile ? 8 : 10,
                        }}
                      >
                        <div style={{ backgroundColor: 'var(--kuro-color-bg)', padding: isMobile ? '8px 10px' : '10px 12px', borderRadius: radius.button }}>
                          <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--kuro-color-text-muted)' }}>Coordinates</div>
                          <div style={{ fontSize: isMobile ? 11.5 : 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginTop: 2, fontFamily: monoFont, wordBreak: 'break-all' }}>
                            {clientData.location.latitude.toFixed(5)}, {clientData.location.longitude.toFixed(5)}
                          </div>
                        </div>

                        <div style={{ backgroundColor: 'var(--kuro-color-bg)', padding: isMobile ? '8px 10px' : '10px 12px', borderRadius: radius.button }}>
                          <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--kuro-color-text-muted)' }}>Accuracy Radius</div>
                          <div style={{ fontSize: isMobile ? 11.5 : 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginTop: 2 }}>
                            ±{clientData.location.accuracy ? clientData.location.accuracy.toFixed(1) : '5.0'} m
                          </div>
                        </div>

                        <div style={{ backgroundColor: 'var(--kuro-color-bg)', padding: isMobile ? '8px 10px' : '10px 12px', borderRadius: radius.button }}>
                          <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--kuro-color-text-muted)' }}>Wi-Fi SSID</div>
                          <div style={{ fontSize: isMobile ? 11.5 : 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {clientData.location.wifi_ssid || 'Cellular / Hotspot'}
                          </div>
                        </div>

                        <div style={{ backgroundColor: 'var(--kuro-color-bg)', padding: isMobile ? '8px 10px' : '10px 12px', borderRadius: radius.button }}>
                          <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--kuro-color-text-muted)' }}>Recorded Timestamp</div>
                          <div style={{ fontSize: isMobile ? 11 : 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginTop: 2, lineHeight: 1.3 }}>
                            {formatDateTime(clientData.location.timestamp)}
                          </div>
                        </div>
                      </div>

                      {clientData.location.address && (
                        <div style={{ backgroundColor: 'var(--kuro-color-bg)', padding: isMobile ? '8px 10px' : '10px 12px', borderRadius: radius.button, fontSize: 12 }}>
                          <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--kuro-color-text-muted)', marginBottom: 2 }}>Physical Address:</div>
                          <div style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, fontSize: isMobile ? 11.5 : 12, lineHeight: 1.4 }}>
                            {clientData.location.address}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        backgroundColor: 'var(--kuro-color-surface)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.card,
                        color: 'var(--kuro-color-text-muted)',
                        fontSize: 13,
                      }}
                    >
                      <AppIcon name="map-pin" size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <div>No GPS location records have been synchronized yet.</div>
                    </div>
                  )}

                  {/* Location History Log */}
                  {filteredLocations && filteredLocations.length > 0 && (
                    <div
                      style={{
                        backgroundColor: 'var(--kuro-color-surface)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.card,
                        padding: isMobile ? 12 : 16,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                          Recent GPS Sync History ({filteredLocations.length}{filteredLocations.length !== (clientData.locations?.length || 0) ? ` / ${clientData.locations?.length || 0}` : ''})
                        </div>
                        <span style={{ fontSize: 10.5, color: 'var(--kuro-color-text-muted)' }}>
                          100% Local Private Storage
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
                        {filteredLocations.map((loc, idx) => (
                          <div
                            key={loc.id || idx}
                            style={{
                              backgroundColor: 'var(--kuro-color-bg)',
                              borderRadius: radius.button,
                              padding: isMobile ? '10px 12px' : '10px 14px',
                              display: 'flex',
                              flexDirection: isMobile ? 'column' : 'row',
                              alignItems: isMobile ? 'stretch' : 'center',
                              justifyContent: 'space-between',
                              gap: isMobile ? 6 : 10,
                              fontSize: 12,
                              border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.06))',
                            }}
                          >
                            {/* Main/Top row: Index badge, coordinates, accuracy & map link */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontFamily: monoFont,
                                    fontWeight: 700,
                                    fontSize: 11,
                                    color: 'var(--kuro-color-primary, #b8bb26)',
                                    backgroundColor: 'rgba(184, 187, 38, 0.12)',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    flexShrink: 0,
                                  }}
                                >
                                  #{idx + 1}
                                </span>
                                <span style={{ fontFamily: monoFont, fontWeight: 600, fontSize: isMobile ? 11.5 : 12, color: 'var(--kuro-color-text-primary)' }}>
                                  {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                                </span>
                                {loc.accuracy && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      color: 'var(--kuro-color-text-muted)',
                                      backgroundColor: 'var(--kuro-color-surface)',
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                      border: '1px solid var(--kuro-color-border)',
                                      flexShrink: 0,
                                    }}
                                  >
                                    ±{loc.accuracy.toFixed(0)}m
                                  </span>
                                )}
                              </div>

                              <a
                                href={`https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=17/${loc.latitude}/${loc.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View on OpenStreetMap"
                                style={{
                                  color: 'var(--kuro-color-text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 4,
                                  borderRadius: 4,
                                  backgroundColor: isMobile ? 'var(--kuro-color-surface)' : 'transparent',
                                  flexShrink: 0,
                                }}
                              >
                                <AppIcon name="external-link" size={13} />
                              </a>
                            </div>

                            {/* Address row */}
                            {loc.address && (
                              <div
                                style={{
                                  color: 'var(--kuro-color-text-secondary, #a89984)',
                                  fontSize: 11,
                                  lineHeight: 1.35,
                                  wordBreak: 'break-word',
                                }}
                              >
                                {loc.address}
                              </div>
                            )}

                            {/* Timestamp row */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 10.5,
                                color: 'var(--kuro-color-text-muted)',
                                fontFamily: monoFont,
                                borderTop: isMobile ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                                paddingTop: isMobile ? 4 : 0,
                                flexShrink: 0,
                              }}
                            >
                              <AppIcon name="clock" size={11} />
                              <span>{formatDateTime(loc.timestamp)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* 5. NOTIFICATIONS TAB */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* ── Top Metrics & Active Filter Summary Bar ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  width: '100%',
                }}
              >
                {/* Total Stats Counter */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--kuro-color-text-primary)',
                    padding: '4px 8px',
                    borderRadius: 6,
                    backgroundColor: 'var(--kuro-color-bg)',
                    border: '1px solid var(--kuro-color-border)',
                  }}
                >
                  <AppIcon name="bell" size={13} />
                  <span>Total: {notificationStats.total}</span>
                </div>

                {/* Import & Export Notification Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    ref={notificationFileInputRef}
                    type="file"
                    accept=".json,.csv"
                    style={{ display: 'none' }}
                    onChange={handleNotificationImportFile}
                  />
                  <button
                    onClick={() => notificationFileInputRef.current?.click()}
                    disabled={isImportingNotification}
                    title="Import Notifications (.json, .csv)"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 10px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--kuro-color-text-primary, #ebdbb2)',
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.button,
                      cursor: isImportingNotification ? 'not-allowed' : 'pointer',
                      opacity: isImportingNotification ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <AppIcon name={isImportingNotification ? "rotate-cw" : "upload"} size={12} className={isImportingNotification ? "animate-spin" : ""} />
                    <span>{isImportingNotification ? 'Importing...' : 'Import'}</span>
                  </button>

                  <button
                    onClick={() => handleExportNotifications('json')}
                    title="Export Notifications as JSON"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 10px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--kuro-color-primary, #b8bb26)',
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.button,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <AppIcon name="download" size={12} />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              {/* ── Row 1: Search, App Package Dropdown, Status Pills & Media Toggle ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  width: '100%',
                }}
              >
                {/* Search input with clear button */}
                <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : 1, width: isMobile ? '100%' : 'auto', minWidth: isMobile ? '100%' : 240 }}>
                  <input
                    type="text"
                    placeholder="Search notifications by title, app, text, package..."
                    value={notificationSearch}
                    onChange={(e) => {
                      setNotificationSearch(e.target.value)
                      setNotificationPage(1)
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      color: 'var(--kuro-color-text-primary)',
                      borderRadius: radius.button,
                      padding: '8px 32px 8px 34px',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--kuro-color-text-muted)',
                      pointerEvents: 'none',
                    }}
                  >
                    <AppIcon name="search" size={14} />
                  </div>
                  {notificationSearch && (
                    <button
                      onClick={() => {
                        setNotificationSearch('')
                        setNotificationPage(1)
                      }}
                      title="Clear search"
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--kuro-color-text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppIcon name="x" size={13} />
                    </button>
                  )}
                </div>

                {/* App Package Filter Dropdown */}
                <div style={{ width: isMobile ? '100%' : 'auto', minWidth: isMobile ? '100%' : 200, flex: isMobile ? '1 1 100%' : undefined }}>
                  <select
                    value={notificationAppFilter}
                    onChange={(e) => {
                      setNotificationAppFilter(e.target.value)
                      setNotificationPage(1)
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--kuro-color-surface)',
                      border: `1px solid ${notificationAppFilter !== 'all' ? 'var(--kuro-color-primary)' : 'var(--kuro-color-border)'}`,
                      color: 'var(--kuro-color-text-primary)',
                      borderRadius: radius.button,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: notificationAppFilter !== 'all' ? 600 : 400,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">All Applications ({uniqueNotifications.length})</option>
                    {notificationApps.map((a) => (
                      <option key={a.pkg} value={a.pkg}>
                        {a.label} ({a.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter & Media Attachment Filter Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isMobile ? 'space-between' : 'flex-start',
                    width: isMobile ? '100%' : 'auto',
                    gap: 10,
                  }}
                >
                  {/* Status Filter (All, Active, Cleared) */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 3,
                      backgroundColor: 'var(--kuro-color-surface)',
                      border: '1px solid var(--kuro-color-border)',
                      padding: 3,
                      borderRadius: radius.button,
                    }}
                  >
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'active', label: 'Active' },
                        { id: 'cleared', label: 'Cleared' },
                      ] as const
                    ).map((st) => {
                      const isSelected = notificationStatusFilter === st.id
                      return (
                        <button
                          key={st.id}
                          onClick={() => {
                            setNotificationStatusFilter(st.id)
                            setNotificationPage(1)
                          }}
                          style={{
                            padding: isMobile ? '6px 14px' : '5px 11px',
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 500,
                            backgroundColor: isSelected ? 'var(--kuro-color-primary)' : 'transparent',
                            color: isSelected ? '#14161b' : 'var(--kuro-color-text-secondary)',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {st.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Media Attachment Filter Toggle */}
                  <button
                    onClick={() => {
                      setNotificationMediaOnly((prev) => !prev)
                      setNotificationPage(1)
                    }}
                    title="Filter notifications with attached picture / thumbnail preview"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      fontSize: 12.5,
                      fontWeight: notificationMediaOnly ? 700 : 500,
                      backgroundColor: notificationMediaOnly ? 'rgba(131, 165, 152, 0.2)' : 'var(--kuro-color-surface)',
                      border: `1px solid ${notificationMediaOnly ? '#83a598' : 'var(--kuro-color-border)'}`,
                      color: notificationMediaOnly ? '#83a598' : 'var(--kuro-color-text-secondary)',
                      borderRadius: radius.button,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    <AppIcon name="image" size={13} />
                    <span>Media Only {notificationStats.withMedia > 0 ? `(${notificationStats.withMedia})` : ''}</span>
                  </button>
                </div>
              </div>

              {/* ── Row 2: Date Filters, Sort Order & View Mode ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  width: '100%',
                }}
              >
                {/* Left: Calendar Date Range Picker Widget */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CalendarRangePicker
                    value={{
                      startDate: notificationStartDate || null,
                      endDate: notificationEndDate || null,
                    }}
                    onChange={(range) => {
                      setNotificationStartDate(range.startDate || '')
                      setNotificationEndDate(range.endDate || '')
                      setNotificationPage(1)
                    }}
                  />
                </div>

                {/* Right: Sort Order, View Mode & Per Page */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Sort Order Toggle (Desktop only) */}
                  {!isMobile && (
                    <button
                      onClick={() => {
                        setNotificationSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
                        setNotificationPage(1)
                      }}
                      title={notificationSortOrder === 'newest' ? 'Sorted by newest first' : 'Sorted by oldest first'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        borderRadius: radius.button,
                        cursor: 'pointer',
                      }}
                    >
                      <AppIcon name={notificationSortOrder === 'newest' ? 'arrow-down' : 'arrow-up'} size={12} />
                      <span>{notificationSortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
                    </button>
                  )}

                  {/* View Mode Toggle: List (Compact) vs Grid (Cards) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      backgroundColor: 'var(--kuro-color-surface, #18191a)',
                      border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
                      borderRadius: 8,
                      padding: 3,
                    }}
                  >
                    <button
                      onClick={() => setNotificationViewMode('compact')}
                      title="List / Compact View"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: isMobile ? '6px 9px' : '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: notificationViewMode === 'compact' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                        color: notificationViewMode === 'compact' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                        fontSize: 12,
                        fontWeight: notificationViewMode === 'compact' ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: notificationViewMode === 'compact' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                      }}
                    >
                      <AppIcon name="list" size={14} />
                      {!isMobile && <span>List</span>}
                    </button>

                    <button
                      onClick={() => setNotificationViewMode('cards')}
                      title="Grid / Cards View"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: isMobile ? '6px 9px' : '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: notificationViewMode === 'cards' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                        color: notificationViewMode === 'cards' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                        fontSize: 12,
                        fontWeight: notificationViewMode === 'cards' ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: notificationViewMode === 'cards' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                      }}
                    >
                      <AppIcon name="grid" size={14} />
                      {!isMobile && <span>Grid</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Notification Records Display (Cards vs Compact Table) ── */}
              {paginatedNotifications.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '50px 20px',
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.card,
                    color: 'var(--kuro-color-text-muted)',
                    fontSize: 13,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--kuro-color-text-muted)',
                    }}
                  >
                    <AppIcon name="bell" size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)', marginBottom: 4 }}>
                      No Notifications Found
                    </div>
                    <div>No notification records match the current filter criteria.</div>
                  </div>
                  {activeNotificationFiltersCount > 0 && (
                    <button
                      onClick={handleResetNotificationFilters}
                      style={{
                        padding: '8px 16px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        backgroundColor: 'var(--kuro-color-primary)',
                        color: '#14161b',
                        border: 'none',
                        borderRadius: radius.button,
                        cursor: 'pointer',
                      }}
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : notificationViewMode === 'cards' ? (
                /* ── DETAILED CARDS VIEW ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {paginatedNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      style={{
                        display: 'flex',
                        gap: 14,
                        padding: 14,
                        backgroundColor: 'var(--kuro-color-surface)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.card,
                        alignItems: 'flex-start',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--kuro-color-border-hover, rgba(255,255,255,0.2))'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
                      }}
                    >
                      {/* App Avatar */}
                      {appIconMap.get(notif.package_name) ? (
                        <img
                          src={
                            appIconMap.get(notif.package_name)!.startsWith('data:')
                              ? appIconMap.get(notif.package_name)!
                              : `data:image/webp;base64,${appIconMap.get(notif.package_name)}`
                          }
                          alt={notif.app_label || notif.package_name}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                            border: '1px solid var(--kuro-color-border)',
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            if (e.currentTarget.nextElementSibling) {
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'
                            }
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(184, 187, 38, 0.15)',
                          color: 'var(--kuro-color-primary)',
                          display: appIconMap.get(notif.package_name) ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 15,
                          flexShrink: 0,
                          border: '1px solid rgba(184, 187, 38, 0.25)',
                        }}
                      >
                        {notif.app_label ? notif.app_label.charAt(0).toUpperCase() : <Bell size={13} />}
                      </div>

                      {/* Content Area */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                              {notif.app_label || notif.package_name}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: monoFont }}>
                              {notif.package_name}
                            </span>
                            {notif.is_cleared ? (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                  color: 'var(--kuro-color-text-muted)',
                                }}
                              >
                                Cleared
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor: 'rgba(142, 192, 124, 0.15)',
                                  color: '#8ec07c',
                                  border: '1px solid rgba(142, 192, 124, 0.3)',
                                }}
                              >
                                Active
                              </span>
                            )}
                            {notif.media_preview_b64 && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor: 'rgba(131, 165, 152, 0.15)',
                                  color: '#83a598',
                                  border: '1px solid rgba(131, 165, 152, 0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <AppIcon name="image" size={10} />
                                Media Attached
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: monoFont }}>
                              {formatDateTime(notif.timestamp)}
                            </span>
                            <button
                              onClick={() => {
                                const fullText = [notif.app_label, notif.title, notif.text, notif.sub_text].filter(Boolean).join(' - ')
                                copyToClipboard(fullText, 'notification text')
                              }}
                              title="Copy notification text"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--kuro-color-text-muted)',
                                cursor: 'pointer',
                                padding: 2,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--kuro-color-primary)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--kuro-color-text-muted)')}
                            >
                              <AppIcon name="copy" size={12} />
                            </button>
                          </div>
                        </div>

                        {notif.title && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginBottom: 3 }}>
                            {notif.title}
                          </div>
                        )}
                        {notif.text && (
                          <div style={{ fontSize: 12.5, color: 'var(--kuro-color-text-secondary)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                            {notif.text}
                          </div>
                        )}
                        {notif.sub_text && (
                          <div style={{ fontSize: 11.5, color: 'var(--kuro-color-text-muted)', marginTop: 4 }}>
                            {notif.sub_text}
                          </div>
                        )}
                      </div>

                      {/* Media Preview Thumbnail (If captured) */}
                      {notif.media_preview_b64 && (
                        <div
                          onClick={() =>
                            setMediaPreviewModal({
                              title: notif.title || notif.app_label || 'Notification',
                              subtitle: notif.text,
                              imageB64: notif.media_preview_b64,
                            })
                          }
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            flexShrink: 0,
                            border: '1px solid var(--kuro-color-border)',
                            backgroundColor: '#000',
                          }}
                          title="Click to view full media preview"
                        >
                          <img
                            src={`data:image/jpeg;base64,${notif.media_preview_b64}`}
                            alt="Notification media preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: 'rgba(0,0,0,0.35)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              opacity: 0,
                              transition: 'opacity 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                          >
                            <AppIcon name="external-link" size={14} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* ── COMPACT TABLE VIEW ── */
                <div
                  style={{
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.card,
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--kuro-color-bg)', borderBottom: '1px solid var(--kuro-color-border)' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 180 }}>App</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)' }}>Title & Content</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 90 }}>Status</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 80 }}>Media</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 150 }}>Timestamp</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 60, textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedNotifications.map((notif, idx) => (
                        <tr
                          key={notif.id || idx}
                          style={{
                            borderBottom: idx === paginatedNotifications.length - 1 ? 'none' : '1px solid var(--kuro-color-border)',
                            transition: 'background-color 0.12s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {appIconMap.get(notif.package_name) ? (
                                <img
                                  src={
                                    appIconMap.get(notif.package_name)!.startsWith('data:')
                                      ? appIconMap.get(notif.package_name)!
                                      : `data:image/webp;base64,${appIconMap.get(notif.package_name)}`
                                  }
                                  alt={notif.app_label || notif.package_name}
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                    border: '1px solid var(--kuro-color-border)',
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              ) : null}
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                                  {notif.app_label || notif.package_name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: monoFont, marginTop: 1 }}>
                                  {notif.package_name}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                            {notif.title && (
                              <div style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)', marginBottom: 2 }}>
                                {notif.title}
                              </div>
                            )}
                            <div style={{ color: 'var(--kuro-color-text-secondary)', fontSize: 12, lineHeight: 1.35 }}>
                              {notif.text}
                            </div>
                            {notif.sub_text && (
                              <div style={{ color: 'var(--kuro-color-text-muted)', fontSize: 11, marginTop: 2 }}>
                                {notif.sub_text}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                            {notif.is_cleared ? (
                              <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--kuro-color-text-muted)' }}>
                                Cleared
                              </span>
                            ) : (
                              <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(142, 192, 124, 0.15)', color: '#8ec07c' }}>
                                Active
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                            {notif.media_preview_b64 ? (
                              <button
                                onClick={() =>
                                  setMediaPreviewModal({
                                    title: notif.title || notif.app_label || 'Notification',
                                    subtitle: notif.text,
                                    imageB64: notif.media_preview_b64,
                                  })
                                }
                                title="View attached image"
                                style={{
                                  padding: '2px 6px',
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(131, 165, 152, 0.15)',
                                  border: '1px solid rgba(131, 165, 152, 0.3)',
                                  color: '#83a598',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <AppIcon name="image" size={11} />
                                View
                              </button>
                            ) : (
                              <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>—</span>
                            )}
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'top', fontFamily: monoFont, fontSize: 11.5, color: 'var(--kuro-color-text-muted)' }}>
                            {formatDateTime(notif.timestamp)}
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'top', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                const fullText = [notif.app_label, notif.title, notif.text, notif.sub_text].filter(Boolean).join(' - ')
                                copyToClipboard(fullText, 'notification text')
                              }}
                              title="Copy text"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--kuro-color-text-muted)',
                                cursor: 'pointer',
                                padding: 4,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--kuro-color-primary)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--kuro-color-text-muted)')}
                            >
                              <AppIcon name="copy" size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Pagination Controls ── */}
              {totalNotificationPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: radius.card,
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)' }}>
                    Showing {(notificationPage - 1) * notificationsPerPage + 1} -{' '}
                    {Math.min(notificationPage * notificationsPerPage, filteredNotifications.length)} of {filteredNotifications.length}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      disabled={notificationPage <= 1}
                      onClick={() => setNotificationPage(1)}
                      title="First Page"
                      style={{
                        padding: '5px 10px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: notificationPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: notificationPage <= 1 ? 0.4 : 1,
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      First
                    </button>

                    <button
                      disabled={notificationPage <= 1}
                      onClick={() => setNotificationPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '5px 12px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: notificationPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: notificationPage <= 1 ? 0.4 : 1,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Previous
                    </button>

                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 12, fontWeight: 600 }}>
                      Page {notificationPage} of {totalNotificationPages}
                    </span>

                    <button
                      disabled={notificationPage >= totalNotificationPages}
                      onClick={() => setNotificationPage((p) => Math.min(totalNotificationPages, p + 1))}
                      style={{
                        padding: '5px 12px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: notificationPage >= totalNotificationPages ? 'not-allowed' : 'pointer',
                        opacity: notificationPage >= totalNotificationPages ? 0.4 : 1,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Next
                    </button>

                    <button
                      disabled={notificationPage >= totalNotificationPages}
                      onClick={() => setNotificationPage(totalNotificationPages)}
                      title="Last Page"
                      style={{
                        padding: '5px 10px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: notificationPage >= totalNotificationPages ? 'not-allowed' : 'pointer',
                        opacity: notificationPage >= totalNotificationPages ? 0.4 : 1,
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* 6. INSTALLED APPS TAB */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'apps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* ── Search, Type Filter, Sort & View Controls ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: isMobile ? 'wrap' : 'nowrap',
                  width: '100%',
                }}
              >
                {/* Desktop Only: Total Stats Counter */}
                {!isMobile && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--kuro-color-text-primary)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <AppIcon name="grid" size={13} />
                    <span>Total Apps: {appsStats.total}</span>
                  </div>
                )}

                {/* Search Input with Clear Button */}
                <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : 1, width: isMobile ? '100%' : 'auto', minWidth: isMobile ? 0 : 200 }}>
                  <input
                    type="text"
                    placeholder="Search apps by name, package, version..."
                    value={appsSearch}
                    onChange={(e) => {
                      setAppsSearch(e.target.value)
                      setAppsPage(1)
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      color: 'var(--kuro-color-text-primary)',
                      borderRadius: radius.button,
                      padding: '8px 32px 8px 34px',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--kuro-color-text-muted)',
                      pointerEvents: 'none',
                    }}
                  >
                    <AppIcon name="search" size={14} />
                  </div>
                  {appsSearch && (
                    <button
                      onClick={() => {
                        setAppsSearch('')
                        setAppsPage(1)
                      }}
                      title="Clear search"
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--kuro-color-text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppIcon name="x" size={13} />
                    </button>
                  )}
                </div>

                {/* Mobile Row: Total Apps + Sort Dropdown in same row */}
                {isMobile && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--kuro-color-text-primary)',
                        padding: '6px 10px',
                        borderRadius: 6,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <AppIcon name="grid" size={13} />
                      <span>Total Apps: {appsStats.total}</span>
                    </div>

                    <div style={{ flex: 1, minWidth: 140, maxWidth: 200 }}>
                      <select
                        value={`${appsSortBy}-${appsSortOrder}`}
                        onChange={(e) => {
                          const [sb, so] = e.target.value.split('-') as [any, any]
                          setAppsSortBy(sb)
                          setAppsSortOrder(so)
                          setAppsPage(1)
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--kuro-color-surface)',
                          border: '1px solid var(--kuro-color-border)',
                          color: 'var(--kuro-color-text-primary)',
                          borderRadius: radius.button,
                          padding: '6px 10px',
                          fontSize: 12,
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="name-asc">Name (A to Z)</option>
                        <option value="name-desc">Name (Z to A)</option>
                        <option value="size-desc">Size (Largest first)</option>
                        <option value="size-asc">Size (Smallest first)</option>
                        <option value="updated-desc">Recently Updated</option>
                        <option value="installed-desc">Recently Installed</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Desktop Sort Dropdown */}
                {!isMobile && (
                  <div style={{ width: 'auto', minWidth: 170, flexShrink: 0 }}>
                    <select
                      value={`${appsSortBy}-${appsSortOrder}`}
                      onChange={(e) => {
                        const [sb, so] = e.target.value.split('-') as [any, any]
                        setAppsSortBy(sb)
                        setAppsSortOrder(so)
                        setAppsPage(1)
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--kuro-color-surface)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        borderRadius: radius.button,
                        padding: '8px 12px',
                        fontSize: 13,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="name-asc">Name (A to Z)</option>
                      <option value="name-desc">Name (Z to A)</option>
                      <option value="size-desc">Size (Largest first)</option>
                      <option value="size-asc">Size (Smallest first)</option>
                      <option value="updated-desc">Recently Updated</option>
                      <option value="installed-desc">Recently Installed</option>
                    </select>
                  </div>
                )}

                {/* Type Filter Pills & View Mode Switcher Container */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isMobile ? 'space-between' : 'flex-start',
                    width: isMobile ? '100%' : 'auto',
                    gap: 10,
                  }}
                >
                  {/* Filter Type Pills */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 3,
                      backgroundColor: 'var(--kuro-color-surface)',
                      border: '1px solid var(--kuro-color-border)',
                      padding: 3,
                      borderRadius: radius.button,
                    }}
                  >
                    {(
                      [
                        { id: 'all', label: `All (${appsStats.total})` },
                        { id: 'user', label: `User (${appsStats.userApps})` },
                        { id: 'system', label: `System (${appsStats.systemApps})` },
                      ] as const
                    ).map((t) => {
                      const isSelected = appsTypeFilter === t.id
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setAppsTypeFilter(t.id)
                            setAppsPage(1)
                          }}
                          style={{
                            padding: isMobile ? '6px 12px' : '5px 11px',
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 500,
                            backgroundColor: isSelected ? 'var(--kuro-color-primary)' : 'transparent',
                            color: isSelected ? '#14161b' : 'var(--kuro-color-text-secondary)',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* View Mode Toggle: Table (List) vs Grid */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      backgroundColor: 'var(--kuro-color-surface, #18191a)',
                      border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
                      borderRadius: 8,
                      padding: 3,
                    }}
                  >
                    <button
                      onClick={() => setAppsViewMode('table')}
                      title="Compact Table View"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: isMobile ? '6px 9px' : '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: appsViewMode === 'table' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                        color: appsViewMode === 'table' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                        fontSize: 12,
                        fontWeight: appsViewMode === 'table' ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: appsViewMode === 'table' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                      }}
                    >
                      <AppIcon name="list" size={14} />
                      {!isMobile && <span>Table</span>}
                    </button>

                    <button
                      onClick={() => setAppsViewMode('grid')}
                      title="Grid Card View"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: isMobile ? '6px 9px' : '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: appsViewMode === 'grid' ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                        color: appsViewMode === 'grid' ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                        fontSize: 12,
                        fontWeight: appsViewMode === 'grid' ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: appsViewMode === 'grid' ? '0 2px 6px rgba(184, 187, 38, 0.35)' : 'none',
                      }}
                    >
                      <AppIcon name="grid" size={14} />
                      {!isMobile && <span>Grid</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Apps Inventory Rendering (Grid vs Table) ── */}
              {paginatedApps.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '50px 20px',
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.card,
                    color: 'var(--kuro-color-text-muted)',
                    fontSize: 13,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--kuro-color-text-muted)',
                    }}
                  >
                    <AppIcon name="grid" size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)', marginBottom: 4 }}>
                      No Installed Apps Found
                    </div>
                    <div>No applications match the current search or type filter.</div>
                  </div>
                  {(appsSearch.trim() || appsTypeFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setAppsSearch('')
                        setAppsTypeFilter('all')
                        setAppsPage(1)
                      }}
                      style={{
                        padding: '8px 16px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        backgroundColor: 'var(--kuro-color-primary)',
                        color: '#14161b',
                        border: 'none',
                        borderRadius: radius.button,
                        cursor: 'pointer',
                      }}
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              ) : appsViewMode === 'grid' ? (
                /* ── GRID CARD VIEW ── */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                    gap: 12,
                  }}
                >
                  {paginatedApps.map((app, idx) => (
                    <div
                      key={app.package_name || idx}
                      style={{
                        padding: 14,
                        backgroundColor: 'var(--kuro-color-surface)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.card,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--kuro-color-border-hover, rgba(255,255,255,0.2))'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
                      }}
                    >
                      {/* App Header & Avatar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {app.icon_b64 ? (
                          <img
                            src={app.icon_b64.startsWith('data:') ? app.icon_b64 : `data:image/webp;base64,${app.icon_b64}`}
                            alt={app.app_name}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              flexShrink: 0,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                              border: '1px solid var(--kuro-color-border)',
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              if (e.currentTarget.nextElementSibling) {
                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'
                              }
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: app.is_system_app ? 'rgba(255,255,255,0.06)' : 'rgba(184, 187, 38, 0.15)',
                            color: app.is_system_app ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-primary)',
                            display: app.icon_b64 ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 14,
                            flexShrink: 0,
                            border: `1px solid ${app.is_system_app ? 'rgba(255,255,255,0.1)' : 'rgba(184, 187, 38, 0.25)'}`,
                          }}
                        >
                          {app.app_name ? app.app_name.charAt(0).toUpperCase() : <Package size={13} />}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 700,
                              color: 'var(--kuro-color-text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={app.app_name}
                          >
                            {app.app_name || app.package_name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--kuro-color-text-muted)',
                              fontFamily: monoFont,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title={app.package_name}
                          >
                            <span>{app.package_name}</span>
                            <button
                              onClick={() => copyToClipboard(app.package_name, 'package name')}
                              title="Copy package name"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--kuro-color-text-muted)',
                                cursor: 'pointer',
                                padding: 1,
                                display: 'inline-flex',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--kuro-color-primary)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--kuro-color-text-muted)')}
                            >
                              <AppIcon name="copy" size={10} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* App Metadata & Badges */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          color: 'var(--kuro-color-text-secondary)',
                          borderTop: '1px solid rgba(255,255,255,0.05)',
                          paddingTop: 8,
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: app.is_system_app ? 'rgba(255, 255, 255, 0.06)' : 'rgba(184, 187, 38, 0.15)',
                            color: app.is_system_app ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-primary)',
                            border: `1px solid ${app.is_system_app ? 'rgba(255, 255, 255, 0.1)' : 'rgba(184, 187, 38, 0.3)'}`,
                          }}
                        >
                          {app.is_system_app ? 'System App' : 'User App'}
                        </span>

                        <span style={{ fontFamily: monoFont }}>
                          v{app.version_name || '1.0'} {app.version_code ? `(${app.version_code})` : ''}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          color: 'var(--kuro-color-text-muted)',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                          {formatBytes(app.apk_size_bytes)}
                        </span>
                        {app.last_updated && <span>Updated: {app.last_updated.split(' ')[0]}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── COMPACT TABLE VIEW ── */
                <div
                  style={{
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.card,
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--kuro-color-bg)', borderBottom: '1px solid var(--kuro-color-border)' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)' }}>Application</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)' }}>Package Name</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 110 }}>Type</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 120 }}>Version</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 100 }}>APK Size</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 130 }}>Last Updated</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--kuro-color-text-muted)', width: 50, textAlign: 'center' }}>Copy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedApps.map((app, idx) => (
                        <tr
                          key={app.package_name || idx}
                          style={{
                            borderBottom: idx === paginatedApps.length - 1 ? 'none' : '1px solid var(--kuro-color-border)',
                            transition: 'background-color 0.12s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '10px 14px', verticalAlign: 'middle', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {app.icon_b64 ? (
                                <img
                                  src={app.icon_b64.startsWith('data:') ? app.icon_b64 : `data:image/webp;base64,${app.icon_b64}`}
                                  alt={app.app_name}
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                    border: '1px solid var(--kuro-color-border)',
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                    if (e.currentTarget.nextElementSibling) {
                                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'
                                    }
                                  }}
                                />
                              ) : null}
                              <div
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  backgroundColor: app.is_system_app ? 'rgba(255,255,255,0.06)' : 'rgba(184, 187, 38, 0.15)',
                                  color: app.is_system_app ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-primary)',
                                  display: app.icon_b64 ? 'none' : 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: 11,
                                  flexShrink: 0,
                                }}
                              >
                                {app.app_name ? app.app_name.charAt(0).toUpperCase() : <Package size={12} />}
                              </div>
                              <span>{app.app_name || app.package_name}</span>
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'middle', fontFamily: monoFont, fontSize: 11.5, color: 'var(--kuro-color-text-muted)' }}>
                            {app.package_name}
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: 4,
                                backgroundColor: app.is_system_app ? 'rgba(255, 255, 255, 0.06)' : 'rgba(184, 187, 38, 0.15)',
                                color: app.is_system_app ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-primary)',
                              }}
                            >
                              {app.is_system_app ? 'System' : 'User'}
                            </span>
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'middle', fontFamily: monoFont, fontSize: 11.5 }}>
                            v{app.version_name || '1.0'}
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'middle', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                            {formatBytes(app.apk_size_bytes)}
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'middle', fontSize: 11.5, color: 'var(--kuro-color-text-muted)' }}>
                            {app.last_updated ? app.last_updated.split(' ')[0] : '—'}
                          </td>

                          <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'center' }}>
                            <button
                              onClick={() => copyToClipboard(app.package_name, 'package name')}
                              title="Copy package name"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--kuro-color-text-muted)',
                                cursor: 'pointer',
                                padding: 4,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--kuro-color-primary)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--kuro-color-text-muted)')}
                            >
                              <AppIcon name="copy" size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Apps Pagination ── */}
              {totalAppPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: radius.card,
                    backgroundColor: 'var(--kuro-color-surface)',
                    border: '1px solid var(--kuro-color-border)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)' }}>
                    Showing {(appsPage - 1) * appsPerPage + 1} -{' '}
                    {Math.min(appsPage * appsPerPage, filteredApps.length)} of {filteredApps.length}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      disabled={appsPage <= 1}
                      onClick={() => setAppsPage(1)}
                      title="First Page"
                      style={{
                        padding: '5px 10px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: appsPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: appsPage <= 1 ? 0.4 : 1,
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      First
                    </button>

                    <button
                      disabled={appsPage <= 1}
                      onClick={() => setAppsPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '5px 12px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: appsPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: appsPage <= 1 ? 0.4 : 1,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Previous
                    </button>

                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 12, fontWeight: 600 }}>
                      Page {appsPage} of {totalAppPages}
                    </span>

                    <button
                      disabled={appsPage >= totalAppPages}
                      onClick={() => setAppsPage((p) => Math.min(totalAppPages, p + 1))}
                      style={{
                        padding: '5px 12px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: appsPage >= totalAppPages ? 'not-allowed' : 'pointer',
                        opacity: appsPage >= totalAppPages ? 0.4 : 1,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Next
                    </button>

                    <button
                      disabled={appsPage >= totalAppPages}
                      onClick={() => setAppsPage(totalAppPages)}
                      title="Last Page"
                      style={{
                        padding: '5px 10px',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: appsPage >= totalAppPages ? 'not-allowed' : 'pointer',
                        opacity: appsPage >= totalAppPages ? 0.4 : 1,
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* 7. MEDIA & FILES EXPLORER TAB (FTP CLIENT FILE MANAGER) */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'files' && (
            <ClientFtpFileManager
              nodeId={activeTargetNodeId}
              deviceName={activeDeviceName}
              platform={activePlatform}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* 8. HARDWARE CONTROLS TAB (CAMERA & MICROPHONE) */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'hardware' && (
            <ClientHardwareTab
              nodeId={activeTargetNodeId}
              deviceName={activeDeviceName}
              platform={activePlatform}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* 9. ANDROID PERMISSIONS & SECURITY DIAGNOSTICS TAB */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'utility' && (
            <ClientUtilityTab
              nodeId={activeTargetNodeId}
              deviceName={activeDeviceName}
              platform={activePlatform}
              clientData={clientData}
            />
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MEDIA PREVIEW MODAL (NOTIFICATIONS) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mediaPreviewModal && (
        <div
          onClick={() => setMediaPreviewModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
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
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              maxWidth: 600,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--kuro-color-border)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                  {mediaPreviewModal.title}
                </div>
                {mediaPreviewModal.subtitle && (
                  <div style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)', marginTop: 2 }}>
                    {mediaPreviewModal.subtitle}
                  </div>
                )}
              </div>
              <button
                onClick={() => setMediaPreviewModal(null)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--kuro-color-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 18, display: 'flex', justifyContent: 'center', backgroundColor: '#000' }}>
              {mediaPreviewModal.imageB64 && (
                <img
                  src={`data:image/jpeg;base64,${mediaPreviewModal.imageB64}`}
                  alt="Notification Media Preview"
                  style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }}
                />
              )}
            </div>
          </div>
        </div>
      )}

        </>
      )}
    </div>
  )
}
