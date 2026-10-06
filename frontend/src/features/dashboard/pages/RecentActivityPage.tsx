import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMediaQuery } from '@mui/material'
import { AppIcon } from '@/components/ui/icons'
import { PageContainer } from '@/components/shell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  getNotifications,
  deleteNotification,
  clearNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/api/notifications'
import { getActivities } from '@/api/activities'
import type { NotificationItem, NotificationSeverity, NotificationCategory } from '@/types/notification'
import type { ActivityEvent } from '@/types/activity'
import { CalendarRangePicker, type DateRange } from '@/features/notifications/components/CalendarRangePicker'
import { NotificationCard } from '@/features/notifications/components/NotificationCard'
import { radius } from '@/design/radius'
import {
  isAndroidNativeApp,
  isBatteryOptimizationIgnored,
  requestIgnoreBatteryOptimization,
} from '@/services/notificationBridge'

const SEVERITIES: { label: string; value: NotificationSeverity | '' }[] = [
  { label: 'All Severities', value: '' },
  { label: 'Critical', value: 'critical' },
  { label: 'Warning', value: 'warning' },
  { label: 'Info', value: 'info' },
  { label: 'Success', value: 'success' },
]

const CATEGORIES: { label: string; value: NotificationCategory | '' }[] = [
  { label: 'All Categories', value: '' },
  { label: 'System', value: 'system' },
  { label: 'Docker', value: 'docker' },
  { label: 'CPU', value: 'cpu' },
  { label: 'Memory', value: 'memory' },
  { label: 'Storage', value: 'storage' },
  { label: 'Network', value: 'network' },
  { label: 'Tailscale', value: 'tailscale' },
  { label: 'Thermal', value: 'thermal' },
  { label: 'Battery', value: 'battery' },
  { label: 'Auth', value: 'auth' },
  { label: 'Tasks', value: 'task' },
]

function mapActivityToNotification(act: ActivityEvent): NotificationItem {
  let severity: NotificationSeverity = 'info'
  if (act.type === 'error' || act.color === '#ef4444' || act.color === '#f87171') {
    severity = 'critical'
  } else if (act.type === 'warn' || act.color === '#f59e0b' || act.color === '#fbbf24') {
    severity = 'warning'
  } else if (act.color === '#10b981' || act.color === '#4ade80') {
    severity = 'success'
  }

  let category: NotificationCategory = 'system'
  if (act.type === 'docker' || act.icon === 'container' || act.icon === 'docker') {
    category = 'docker'
  } else if (act.type === 'battery' || act.icon === 'battery') {
    category = 'battery'
  } else if (act.type === 'wifi' || act.icon === 'wifi' || act.type === 'network') {
    category = 'network'
  } else if (act.type === 'storage' || act.icon === 'hard-drive') {
    category = 'storage'
  } else if (act.type === 'cpu') {
    category = 'cpu'
  } else if (act.type === 'memory') {
    category = 'memory'
  }

  return {
    id: `activity-${act.id}`,
    title: act.text,
    message: `System Event logged: ${act.text}`,
    severity,
    category,
    timestamp: act.timestamp,
    read: true,
  }
}

export function RecentActivityPage() {
  useDocumentTitle('Recent Activity - HomeLab')

  const {
    unreadCount,
    refreshSummary,
    permissionStatus,
    isPermissionGranted,
    requestPermission,
  } = useNotifications()

  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [batteryOptIgnored, setBatteryOptIgnored] = useState(isBatteryOptimizationIgnored())
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isTablet = useMediaQuery('(min-width: 768px)')
  const padding = isDesktop ? 25 : isTablet ? 20 : 12

  const handleRequestBatteryExemption = () => {
    requestIgnoreBatteryOptimization()
    setTimeout(() => {
      setBatteryOptIgnored(isBatteryOptimizationIgnored())
    }, 1500)
  }

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null })
  const [severity, setSeverity] = useState<NotificationSeverity | ''>('')
  const [category, setCategory] = useState<NotificationCategory | ''>('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [search, setSearch] = useState('')

  // Data state
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const pageSize = 30

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [notifRes, actRes] = await Promise.all([
        getNotifications({
          start_date: dateRange.startDate || undefined,
          end_date: dateRange.endDate || undefined,
          severity: severity || undefined,
          category: category || undefined,
          unread_only: unreadOnly || undefined,
          search: search.trim() || undefined,
          limit: 100,
          offset: 0,
        }).catch(() => ({ items: [], total: 0 })),
        getActivities(0, 100).catch(() => ({ events: [], total: 0 })),
      ])

      setNotifications(notifRes.items || [])
      setActivities(actRes.events || [])
    } finally {
      setLoading(false)
    }
  }, [dateRange, severity, category, unreadOnly, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleMarkRead = async (id: string) => {
    if (id.startsWith('activity-')) return
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    refreshSummary()
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    refreshSummary()
  }

  const handleDelete = async (id: string) => {
    if (id.startsWith('activity-')) {
      setActivities((prev) => prev.filter((a) => `activity-${a.id}` !== id))
      return
    }
    await deleteNotification(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    refreshSummary()
  }

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all notification history and recent activity logs?')) {
      await clearNotifications().catch(() => {})
      setNotifications([])
      setActivities([])
      refreshSummary()
    }
  }

  const handleEnablePermissions = async () => {
    await requestPermission()
  }

  const handleResetFilters = () => {
    setDateRange({ startDate: null, endDate: null })
    setSeverity('')
    setCategory('')
    setUnreadOnly(false)
    setSearch('')
    setPage(0)
  }

  // Merge & Sort Chronologically
  const mergedItems = useMemo(() => {
    const list: NotificationItem[] = [...notifications]

    // Map activity items into NotificationItem structure if unreadOnly is false
    if (!unreadOnly) {
      const mappedActivities = activities.map(mapActivityToNotification)
      const existingIds = new Set(list.map((n) => n.id))

      for (const actItem of mappedActivities) {
        if (!existingIds.has(actItem.id)) {
          // Apply local filter checks
          if (severity && actItem.severity !== severity) continue
          if (category && actItem.category !== category) continue
          if (search.trim()) {
            const q = search.toLowerCase()
            const matchText = (actItem.title + ' ' + actItem.message).toLowerCase()
            if (!matchText.includes(q)) continue
          }
          if (dateRange.startDate) {
            if (new Date(actItem.timestamp) < new Date(dateRange.startDate)) continue
          }
          if (dateRange.endDate) {
            if (new Date(actItem.timestamp) > new Date(dateRange.endDate)) continue
          }
          list.push(actItem)
        }
      }
    }

    // Sort by timestamp descending
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return list
  }, [notifications, activities, unreadOnly, severity, category, search, dateRange])

  // Paginated View
  const paginatedItems = useMemo(() => {
    const start = page * pageSize
    return mergedItems.slice(start, start + pageSize)
  }, [mergedItems, page, pageSize])

  // Group notifications by date
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: NotificationItem[] } = {}
    const todayStr = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    for (const item of paginatedItems) {
      const itemDateStr = item.timestamp.split('T')[0]
      let groupLabel = itemDateStr
      if (itemDateStr === todayStr) {
        groupLabel = 'Today'
      } else if (itemDateStr === yesterdayStr) {
        groupLabel = 'Yesterday'
      } else {
        const d = new Date(item.timestamp)
        groupLabel = d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      }

      if (!groups[groupLabel]) {
        groups[groupLabel] = []
      }
      groups[groupLabel].push(item)
    }

    return groups
  }, [paginatedItems])

  return (
    <PageContainer fullWidth padding={padding}>
      <div style={{ width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Permission Request Banner */}
        {!isPermissionGranted && !bannerDismissed && permissionStatus !== 'unsupported' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              padding: '12px 16px',
              borderRadius: radius.card,
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.card,
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60a5fa',
                }}
              >
                <AppIcon name="bell" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                  Enable Real-Time Server & Battery Notifications
                </div>
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                  Receive instant browser and native system alerts when power cables change, battery is low, or containers fail.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handleEnablePermissions}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: radius.button,
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <AppIcon name="check" size={14} />
                <span>Enable Notifications</span>
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss banner"
                style={{
                  padding: '6px 10px',
                  borderRadius: radius.button,
                  backgroundColor: 'transparent',
                  color: 'var(--kuro-color-text-muted)',
                  border: '1px solid var(--kuro-color-border)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Android 24/7 Background Notification Optimization Banner */}
        {isAndroidNativeApp() && !batteryOptIgnored && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              padding: '12px 16px',
              borderRadius: radius.card,
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.card,
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f59e0b',
                }}
              >
                <AppIcon name="battery" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                  Enable 24/7 Background Alert Monitoring
                </div>
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                  Allow HomeLab to run in the background without battery restrictions so you receive instant alerts even when the app is closed from Recents.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handleRequestBatteryExemption}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: radius.button,
                  backgroundColor: '#f59e0b',
                  color: '#000000',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <AppIcon name="shield" size={14} />
                <span>Allow Background Running</span>
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                Recent Activity
              </h1>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: radius.badge,
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
              Comprehensive timeline of all server events, activity logs, container triggers, and system notifications.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-accent)',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: 'var(--kuro-color-accent)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <AppIcon name="check-circle-2" size={13} />
                <span>Mark All as Read</span>
              </button>
            )}

            {mergedItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: radius.button,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <AppIcon name="trash-2" size={13} />
                <span>Clear History</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Control Bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 16,
            borderRadius: radius.card,
            border: '1px solid var(--kuro-color-border)',
            backgroundColor: 'var(--kuro-color-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Calendar Date Range Picker */}
            <CalendarRangePicker
              value={dateRange}
              onChange={(r) => {
                setDateRange(r)
                setPage(0)
              }}
            />

            {/* Severity Dropdown */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value as NotificationSeverity | '')
                  setPage(0)
                }}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  padding: '7px 28px 7px 12px',
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                  backgroundColor: severity ? 'var(--kuro-color-hover)' : 'var(--kuro-color-surface)',
                  color: 'var(--kuro-color-text-primary)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value} style={{ backgroundColor: 'var(--kuro-color-surface)' }}>
                    {s.label}
                  </option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: 'var(--kuro-color-text-muted)' }}>
                <AppIcon name="chevron-down" size={12} />
              </span>
            </div>

            {/* Category Dropdown */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as NotificationCategory | '')
                  setPage(0)
                }}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  padding: '7px 28px 7px 12px',
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                  backgroundColor: category ? 'var(--kuro-color-hover)' : 'var(--kuro-color-surface)',
                  color: 'var(--kuro-color-text-primary)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} style={{ backgroundColor: 'var(--kuro-color-surface)' }}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: 'var(--kuro-color-text-muted)' }}>
                <AppIcon name="chevron-down" size={12} />
              </span>
            </div>

            {/* Unread Only Toggle */}
            <button
              type="button"
              onClick={() => {
                setUnreadOnly((u) => !u)
                setPage(0)
              }}
              style={{
                padding: '7px 12px',
                borderRadius: radius.button,
                border: unreadOnly ? '1px solid var(--kuro-color-accent)' : '1px solid var(--kuro-color-border)',
                backgroundColor: unreadOnly ? 'rgba(99, 102, 241, 0.15)' : 'var(--kuro-color-surface)',
                color: unreadOnly ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Unread Only
            </button>

            {/* Keyword Search */}
            <div
              style={{
                flex: 1,
                minWidth: 180,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: radius.button,
                border: '1px solid var(--kuro-color-border)',
                backgroundColor: 'var(--kuro-color-background)',
              }}
            >
              <AppIcon name="search" size={14} style={{ color: 'var(--kuro-color-text-muted)' }} />
              <input
                type="text"
                placeholder="Search events and activities..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--kuro-color-text-primary)',
                  fontSize: 11,
                  outline: 'none',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--kuro-color-text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <AppIcon name="x" size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications & Activity Grouped List */}
        {loading && mergedItems.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--kuro-color-text-muted)' }}>
            <AppIcon name="loader-2" size={28} />
          </div>
        ) : mergedItems.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              borderRadius: radius.card,
              border: '1px dashed var(--kuro-color-border)',
              backgroundColor: 'var(--kuro-color-surface)',
              textAlign: 'center',
              gap: 12,
            }}
          >
            <AppIcon name="inbox" size={40} style={{ color: 'var(--kuro-color-text-muted)' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
              No activities or notifications found
            </div>
            <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', maxWidth: 360 }}>
              {dateRange.startDate || severity || category || search || unreadOnly
                ? 'Try clearing your filters or selecting a different date range.'
                : 'All server alerts, activity logs, and system events will appear here when activity occurs.'}
            </div>
            {(dateRange.startDate || severity || category || search || unreadOnly) && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  marginTop: 8,
                  padding: '6px 14px',
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                  backgroundColor: 'var(--kuro-color-hover)',
                  color: 'var(--kuro-color-text-primary)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {Object.entries(groupedItems).map(([dateLabel, dateItems]) => (
              <div key={dateLabel} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Date Section Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    color: 'var(--kuro-color-text-muted)',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <span>{dateLabel}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>({dateItems.length})</span>
                  <div style={{ flex: 1, height: 1, backgroundColor: 'var(--kuro-color-border)', opacity: 0.6 }} />
                </div>

                {/* Items in this date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dateItems.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onMarkRead={handleMarkRead}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Pagination summary */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                color: 'var(--kuro-color-text-muted)',
                fontSize: 11,
              }}
            >
              <span>
                Showing {paginatedItems.length} of {mergedItems.length} items
              </span>

              {mergedItems.length > pageSize && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: radius.button,
                      border: '1px solid var(--kuro-color-border)',
                      backgroundColor: 'var(--kuro-color-surface)',
                      color: page === 0 ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-text-primary)',
                      fontSize: 11,
                      cursor: page === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={(page + 1) * pageSize >= mergedItems.length}
                    onClick={() => setPage((p) => p + 1)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: radius.button,
                      border: '1px solid var(--kuro-color-border)',
                      backgroundColor: 'var(--kuro-color-surface)',
                      color: (page + 1) * pageSize >= mergedItems.length ? 'var(--kuro-color-text-muted)' : 'var(--kuro-color-text-primary)',
                      fontSize: 11,
                      cursor: (page + 1) * pageSize >= mergedItems.length ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
