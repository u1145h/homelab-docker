import { useNavigate } from 'react-router-dom'
import { AppIcon } from '@/components/ui/icons'
import type { NotificationItem } from '@/types/notification'
import { formatRelativeTime, formatFullDateTime, getSeverityColor, getCategoryIconName } from '../utils'
import { radius } from '@/design/radius'

export interface NotificationCardProps {
  item: NotificationItem
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationCard({ item, onMarkRead, onDelete }: NotificationCardProps) {
  const navigate = useNavigate()
  const sev = getSeverityColor(item.severity)
  const catIcon = getCategoryIconName(item.category)

  const handleAction = () => {
    if (!item.read) {
      onMarkRead(item.id)
    }
    if (item.action_url) {
      navigate(item.action_url)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 18px',
        borderRadius: radius.card,
        border: '1px solid var(--kuro-color-border)',
        backgroundColor: item.read ? 'var(--kuro-color-surface)' : 'rgba(255, 255, 255, 0.02)',
        boxShadow: item.read ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--kuro-color-border-hover, #404040)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
      }}
    >
      {/* Severity Icon Badge */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.card,
          backgroundColor: sev.bg,
          border: `1px solid ${sev.border}`,
          color: sev.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <AppIcon name={sev.icon} size={16} />
      </div>

      {/* Main Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: item.read ? 500 : 700,
                color: 'var(--kuro-color-text-primary)',
              }}
            >
              {item.title}
            </span>

            {/* Category tag */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: radius.badge,
                backgroundColor: 'var(--kuro-color-hover)',
                color: 'var(--kuro-color-text-secondary)',
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              <AppIcon name={catIcon} size={11} />
              {item.category}
            </span>

            {/* Unread indicator */}
            {!item.read && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: radius.badge,
                  backgroundColor: sev.bg,
                  color: sev.color,
                  border: `1px solid ${sev.border}`,
                }}
              >
                NEW
              </span>
            )}
          </div>

          {/* Timestamp */}
          <span
            title={formatFullDateTime(item.timestamp)}
            style={{
              fontSize: 11,
              color: 'var(--kuro-color-text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {formatRelativeTime(item.timestamp)}
          </span>
        </div>

        {/* Message */}
        <p
          style={{
            margin: '4px 0 10px 0',
            fontSize: 11,
            color: 'var(--kuro-color-text-secondary)',
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}
        >
          {item.message}
        </p>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {item.action_url && (
            <button
              type="button"
              onClick={handleAction}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: radius.button,
                border: '1px solid var(--kuro-color-border)',
                backgroundColor: 'var(--kuro-color-surface)',
                color: 'var(--kuro-color-text-primary)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
                e.currentTarget.style.borderColor = 'var(--kuro-color-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface)'
                e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
              }}
            >
              <span>View Resource</span>
              <AppIcon name="external-link" size={12} />
            </button>
          )}

          {!item.read && (
            <button
              type="button"
              onClick={() => onMarkRead(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: radius.button,
                border: 'none',
                background: 'transparent',
                color: 'var(--kuro-color-accent)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <AppIcon name="check-circle" size={12} />
              Mark as read
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(item.id)}
            title="Delete notification"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: radius.button,
              border: 'none',
              background: 'transparent',
              color: 'var(--kuro-color-text-muted)',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--kuro-color-text-muted)'
            }}
          >
            <AppIcon name="trash-2" size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
