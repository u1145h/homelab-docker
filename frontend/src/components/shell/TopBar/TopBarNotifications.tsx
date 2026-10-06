import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popover, LinearProgress } from '@mui/material'
import { AppIcon } from '@/components/ui/icons'
import { useNotifications } from '@/contexts/NotificationContext'
import { useUploads } from '@/contexts/UploadContext'
import { formatRelativeTime, getSeverityColor } from '@/features/notifications/utils'
import { radius } from '@/design/radius'

export function TopBarNotifications() {
  const navigate = useNavigate()
  const {
    unreadCount,
    recent,
    markAsRead,
    markAllAsRead,
    isPermissionGranted,
    permissionStatus,
    requestPermission,
  } = useNotifications()
  const { tasks, isUploading, overallProgress, clearCompleted } = useUploads()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleItemClick = (id: string, actionUrl?: string) => {
    markAsRead(id)
    handleClose()
    if (actionUrl) {
      navigate(actionUrl)
    }
  }

  const handleViewAll = () => {
    handleClose()
    navigate('/recent-activity')
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        title={isUploading ? `Uploading files (${overallProgress}%)` : "Notifications"}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: radius.button,
          border: 'none',
          background: open ? 'var(--kuro-color-hover)' : 'transparent',
          color: isUploading ? 'var(--kuro-color-accent)' : unreadCount > 0 ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
          e.currentTarget.style.color = 'var(--kuro-color-text-primary)'
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = isUploading ? 'var(--kuro-color-accent)' : unreadCount > 0 ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-secondary)'
          }
        }}
      >
        <AppIcon name={isUploading ? "upload" : "bell"} size={18} />

        {isUploading ? (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--kuro-color-accent)',
              boxShadow: '0 0 0 2px var(--kuro-color-background)',
            }}
          />
        ) : unreadCount > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '16px',
              textAlign: 'center',
              boxShadow: '0 0 0 2px var(--kuro-color-background)',
              pointerEvents: 'none',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: 560,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--kuro-color-surface)',
              backgroundImage: 'none',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: '12px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
              mt: 1,
              overflow: 'hidden',
            },
          },
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--kuro-color-border)',
            backgroundColor: 'var(--kuro-color-background)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 10,
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--kuro-color-accent)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
              >
                <AppIcon name="check-circle-2" size={13} />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Upload Progress Floating Panel inside Notifications Dropdown */}
        {tasks.length > 0 && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--kuro-color-background)',
              borderBottom: '1px solid var(--kuro-color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                <AppIcon name="upload" size={14} style={{ color: isUploading ? 'var(--kuro-color-accent)' : 'var(--kuro-color-success)' }} />
                <span>{isUploading ? `Uploading (${overallProgress}%)` : `Uploads Finished (${tasks.length})`}</span>
              </div>
              <button
                type="button"
                onClick={clearCompleted}
                style={{
                  fontSize: 11,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--kuro-color-text-muted)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Clear
              </button>
            </div>

            <LinearProgress
              variant="determinate"
              value={overallProgress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'var(--kuro-color-surface)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: isUploading ? 'var(--kuro-color-accent)' : 'var(--kuro-color-success)',
                  borderRadius: 3,
                },
              }}
            />

            <div style={{ maxHeight: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {tasks.map((task) => (
                <div key={task.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220, color: 'var(--kuro-color-text-primary)' }}>
                      {task.filename}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 500, color: task.status === 'error' ? '#ef4444' : task.status === 'completed' ? 'var(--kuro-color-success)' : 'var(--kuro-color-accent)' }}>
                      {task.status === 'uploading' ? `${task.progress}%` : task.status === 'completed' ? 'Done' : 'Failed'}
                    </span>
                  </div>
                  <LinearProgress
                    variant="determinate"
                    value={task.progress}
                    color={task.status === 'error' ? 'error' : task.status === 'completed' ? 'success' : 'primary'}
                    sx={{ height: 3, borderRadius: 1.5 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Permission Request Prompt (if not granted) */}
        {!isPermissionGranted && permissionStatus !== 'unsupported' && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              borderBottom: '1px solid var(--kuro-color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
              Get browser & phone alerts for battery & server events.
            </div>
            <button
              type="button"
              onClick={async () => {
                await requestPermission()
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 4,
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Enable
            </button>
          </div>
        )}

        {/* Notifications List (Last 10) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 380,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {recent.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--kuro-color-text-muted)',
                gap: 8,
              }}
            >
              <AppIcon name="inbox" size={32} />
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>
                No notifications yet
              </div>
              <div style={{ fontSize: 12 }}>
                Server alerts and events will appear here.
              </div>
            </div>
          ) : (
            recent.slice(0, 10).map((item) => {
              const sev = getSeverityColor(item.severity)
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item.id, item.action_url)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--kuro-color-border)',
                    backgroundColor: item.read ? 'transparent' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)' }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = item.read ? 'transparent' : 'rgba(255, 255, 255, 0.03)'
                  }}
                >
                  {/* Severity icon pill */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
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
                    <AppIcon name={sev.icon} size={15} />
                  </div>

                  {/* Body content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: item.read ? 500 : 600,
                          color: item.read ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--kuro-color-text-muted)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--kuro-color-text-secondary)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.message}
                    </div>
                  </div>

                  {/* Unread indicator dot */}
                  {!item.read && (
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: sev.color,
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer: View All Notifications Button */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--kuro-color-border)',
            backgroundColor: 'var(--kuro-color-background)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={handleViewAll}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: radius.button,
              border: '1px solid var(--kuro-color-border)',
              backgroundColor: 'var(--kuro-color-surface)',
              color: 'var(--kuro-color-text-primary)',
              fontSize: 13,
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
            View All Notifications
            <AppIcon name="chevron-right" size={14} />
          </button>
        </div>
      </Popover>
    </>
  )
}
