import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { AppIcon, type IconName } from '@/components/ui/icons'
import { getActivities } from '@/api/activities'
import { getNotifications } from '@/api/notifications'
import { formatRelativeTime, getSeverityColor, getCategoryIconName } from '@/features/notifications/utils'

interface MergedWidgetItem {
  id: string
  title: string
  subtext?: string
  icon: IconName
  color: string
  timestamp: string
  actionUrl?: string
  read?: boolean
}

export function RecentActivity() {
  const navigate = useNavigate()

  const { data: actData, isLoading: actLoading, isError: actError } = useQuery({
    queryKey: ['widget-activities'],
    queryFn: () => getActivities(0, 10),
    refetchInterval: 5000,
    staleTime: 4000,
  })

  const { data: notifData, isLoading: notifLoading, isError: notifError } = useQuery({
    queryKey: ['widget-notifications'],
    queryFn: () => getNotifications({ limit: 10 }),
    refetchInterval: 5000,
    staleTime: 4000,
  })

  const isLoading = actLoading && notifLoading
  const isError = actError && notifError

  const items = useMemo<MergedWidgetItem[]>(() => {
    const list: MergedWidgetItem[] = []

    // 1. Notifications
    if (notifData?.items) {
      for (const n of notifData.items) {
        const sev = getSeverityColor(n.severity)
        const catIcon = getCategoryIconName(n.category)
        list.push({
          id: n.id,
          title: n.title,
          subtext: n.message !== n.title ? n.message : undefined,
          icon: (catIcon || sev.icon) as IconName,
          color: sev.color,
          timestamp: n.timestamp,
          actionUrl: n.action_url,
          read: n.read,
        })
      }
    }

    // 2. Activities
    if (actData?.events) {
      const existingIds = new Set(list.map((item) => item.id))
      for (const a of actData.events) {
        const actId = `activity-${a.id}`
        if (!existingIds.has(actId)) {
          list.push({
            id: actId,
            title: a.text,
            icon: (a.icon as IconName) || 'activity',
            color: a.color || 'var(--kuro-color-accent)',
            timestamp: a.timestamp,
            read: true,
          })
        }
      }
    }

    // Sort descending by timestamp
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return list.slice(0, 5)
  }, [actData, notifData])

  const handleItemClick = (item: MergedWidgetItem) => {
    if (item.actionUrl) {
      navigate(item.actionUrl)
    } else {
      navigate('/recent-activity')
    }
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: 10,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', letterSpacing: '0.5px' }}>
          RECENT ACTIVITY
        </span>
        <Link
          to="/recent-activity"
          style={{
            fontSize: 11,
            color: 'var(--kuro-color-text-secondary)',
            fontFamily: 'var(--kuro-font-family-mono, monospace)',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--kuro-color-text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--kuro-color-text-secondary)' }}
        >
          View More
        </Link>
      </div>

      {/* List Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isLoading ? (
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', textAlign: 'center', padding: '12px 0' }}>
            Loading...
          </div>
        ) : isError ? (
          <div style={{ fontSize: 11, color: 'var(--kuro-color-danger)', textAlign: 'center', padding: '12px 0' }}>
            Failed to load recent activity
          </div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', textAlign: 'center', padding: '12px 0' }}>
            No recent activity or notifications
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingBottom: idx < items.length - 1 ? 12 : 0,
                borderBottom: idx < items.length - 1 ? '1px solid var(--kuro-color-border)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: `${item.color}26`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AppIcon name={item.icon} size={14} style={{ color: item.color }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: item.read === false ? 700 : 500,
                        color: 'var(--kuro-color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </span>
                    {item.read === false && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: item.color,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                  {item.subtext && (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--kuro-color-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.subtext}
                    </span>
                  )}
                </div>
              </div>

              <span
                style={{
                  fontSize: 11,
                  color: 'var(--kuro-color-text-secondary)',
                  fontFamily: 'var(--kuro-font-family-mono, monospace)',
                  flexShrink: 0,
                }}
              >
                {formatRelativeTime(item.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
