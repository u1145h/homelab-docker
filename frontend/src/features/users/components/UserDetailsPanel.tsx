import { useState, useEffect, useCallback } from 'react'
import { KeyValueTable, StatusBadge } from '@/components/ui/display'
import type { UserResponse, UserSession } from '../types'
import { formatTimestamp } from '../utils/users'
import type { KeyValuePair } from '@/components/ui/display'
import { radius } from '@/design/radius'
import { getUserSessions, revokeSingleSession, revokeAllUserSessions } from '../api/users'
import { useSnackbar } from '@/hooks/useSnackbar'

interface UserDetailsPanelProps {
  user: UserResponse
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onResetPassword: () => void
  onSetup2FA: () => void
  onDisable2FA: () => void
}

function roleToStatus(role: string): 'healthy' | 'info' | 'warning' | 'unknown' {
  if (role === 'admin') return 'healthy'
  if (role === 'user') return 'info'
  if (role === 'client') return 'unknown'
  return 'warning'
}

function getInitials(user: UserResponse) {
  if (user.role !== 'client' && user.first_name) {
    return user.first_name.substring(0, 1).toUpperCase() + (user.last_name ? user.last_name.substring(0, 1).toUpperCase() : '')
  }
  return user.username.substring(0, 2).toUpperCase()
}

function timeAgo(dateString?: string): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Never'
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 30) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

function DeviceIcon({ os, clientType }: { os?: string; clientType?: string }) {
  const lowerOS = (os || '').toLowerCase()
  const lowerClient = (clientType || '').toLowerCase()

  if (lowerOS.includes('android') || lowerClient.includes('android') || lowerOS.includes('iphone') || lowerOS.includes('ios')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
        <path d="M12 18h.01"/>
      </svg>
    )
  }
  if (lowerOS.includes('ipad') || lowerOS.includes('tablet')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
        <line x1="12" x2="12.01" y1="18" y2="18"/>
      </svg>
    )
  }
  if (lowerOS.includes('windows') || lowerOS.includes('mac') || lowerOS.includes('linux')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2"/>
        <line x1="8" x2="16" y1="21" y2="21"/>
        <line x1="12" x2="12" y1="17" y2="21"/>
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" x2="22" y1="12" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

export default function UserDetailsPanel({
  user,
  onClose,
  onEdit,
  onDelete,
  onResetPassword,
  onSetup2FA,
  onDisable2FA,
}: UserDetailsPanelProps) {
  const isClient = user.role === 'client'
  const { showSnackbar } = useSnackbar()

  const [activeTab, setActiveTab] = useState<'overview' | 'sessions'>('overview')
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [activeSessionsCount, setActiveSessionsCount] = useState(0)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const data = await getUserSessions(user.id)
      setSessions(data.sessions || [])
      setTotalSessions(data.total_count || 0)
      setActiveSessionsCount(data.active_count || 0)
    } catch {
      // Fallback silently if no sessions
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [user.id])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleRevokeSingle = async (sessionId: string) => {
    setRevokingId(sessionId)
    try {
      await revokeSingleSession(user.id, sessionId)
      showSnackbar('Session revoked successfully.', 'success')
      await fetchSessions()
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to revoke session.', 'error')
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAll = async () => {
    if (!window.confirm(`Revoke all active sessions for @${user.username}? The user will be logged out everywhere.`)) {
      return
    }
    try {
      await revokeAllUserSessions(user.id)
      showSnackbar(`All sessions for @${user.username} have been revoked.`, 'success')
      await fetchSessions()
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to revoke all sessions.', 'error')
    }
  }

  const entries: KeyValuePair[] = [
    { label: 'Username', value: <span style={{ fontFamily: 'monospace', fontSize: 11 }}>@{user.username}</span> },
    ...(!isClient && user.first_name ? [{ label: 'First Name', value: user.first_name }] : []),
    ...(!isClient && user.last_name ? [{ label: 'Last Name', value: user.last_name }] : []),
    ...(!isClient ? [{
      label: '2FA Status',
      value: (
        <span style={{ fontSize: 11, fontWeight: 600, color: user.two_factor_enabled ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-muted)' }}>
          {user.two_factor_enabled ? 'Enabled (Active)' : 'Disabled (Inactive)'}
        </span>
      ),
    }] : []),
    ...(user.last_login_at ? [{ label: 'Last Login', value: formatTimestamp(user.last_login_at) }] : []),
    { label: 'Total Sessions', value: `${totalSessions} logged in (${activeSessionsCount} active)` },
    { label: 'Created', value: formatTimestamp(user.created_at) },
    { label: 'Updated', value: formatTimestamp(user.updated_at) },
  ]

  const displayName = (!isClient && user.first_name)
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user.username

  const currentSession = sessions.find((s) => s.is_current)
  const otherSessions = sessions.filter((s) => !s.is_current)

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          User Profile
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--kuro-color-text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          title="Close details"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      {/* User Avatar & Info */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4, marginBottom: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--kuro-color-text-primary)',
            marginBottom: 8,
          }}
        >
          {getInitials(user)}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginBottom: 2, textAlign: 'center' }}>
          {displayName}
        </div>
        {!isClient && user.first_name && (
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: 'monospace', marginBottom: 6 }}>
            @{user.username}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: (!isClient && user.first_name) ? 0 : 4 }}>
          <StatusBadge status={roleToStatus(user.role)} label={user.role} />
          {!isClient && user.two_factor_enabled && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: 'rgba(169, 182, 101, 0.15)',
                color: 'var(--kuro-color-accent)',
                border: '1px solid rgba(169, 182, 101, 0.3)',
              }}
            >
              2FA
            </span>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: radius.button,
          padding: 3,
          marginBottom: 16,
          border: '1px solid var(--kuro-color-border)',
        }}
      >
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'overview' ? 'var(--kuro-color-surface-raised, #25282a)' : 'transparent',
            color: activeTab === 'overview' ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'sessions' ? 'var(--kuro-color-surface-raised, #25282a)' : 'transparent',
            color: activeTab === 'sessions' ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>Sessions</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 10,
              backgroundColor: activeSessionsCount > 0 ? 'rgba(169, 182, 101, 0.2)' : 'rgba(255,255,255,0.1)',
              color: activeSessionsCount > 0 ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-muted)',
            }}
          >
            {totalSessions}
          </span>
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <KeyValueTable entries={entries} />

          {/* 2FA Quick Action (Only for non-client accounts) */}
          {!isClient && (
            <div style={{ marginTop: 16 }}>
              {user.two_factor_enabled ? (
                <button
                  onClick={onDisable2FA}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: radius.button,
                    color: 'var(--kuro-color-danger, #ef4444)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Disable 2FA
                </button>
              ) : (
                <button
                  onClick={onSetup2FA}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(169, 182, 101, 0.12)',
                    border: '1px solid rgba(169, 182, 101, 0.28)',
                    borderRadius: radius.button,
                    color: 'var(--kuro-color-accent)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Setup 2FA for User
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={onEdit}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: 'var(--kuro-color-hover)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.button,
                color: 'var(--kuro-color-text-primary)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
            <button
              onClick={onResetPassword}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: 'var(--kuro-color-hover)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.button,
                color: 'var(--kuro-color-text-primary)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reset Password
            </button>
            {user.role !== 'admin' && user.username !== 'admin' && (
              <button
                onClick={onDelete}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 69, 58, 0.1)',
                  border: '1px solid rgba(255, 69, 58, 0.2)',
                  borderRadius: radius.button,
                  color: 'var(--kuro-color-danger)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
          </div>
        </>
      ) : (
        /* Sessions & Activity Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Summary stats & refresh */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              padding: '10px 14px',
            }}
          >
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--kuro-color-text-muted)', fontWeight: 600, letterSpacing: 0.5 }}>Total Logged In</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>{totalSessions}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--kuro-color-text-muted)', fontWeight: 600, letterSpacing: 0.5 }}>Active Now</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-accent)' }}>{activeSessionsCount}</div>
              </div>
            </div>

            <button
              onClick={fetchSessions}
              disabled={loadingSessions}
              style={{
                background: 'transparent',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.button,
                padding: '4px 8px',
                color: 'var(--kuro-color-text-secondary)',
                fontSize: 10,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
              Refresh
            </button>
          </div>

          {/* Current Active Session Card */}
          {currentSession && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Current Active Session
              </div>
              <div
                style={{
                  backgroundColor: 'rgba(169, 182, 101, 0.05)',
                  border: '1px solid rgba(169, 182, 101, 0.25)',
                  borderRadius: radius.card,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div
                      style={{
                        padding: 6,
                        borderRadius: 6,
                        backgroundColor: 'rgba(169, 182, 101, 0.15)',
                        color: 'var(--kuro-color-accent)',
                        display: 'flex',
                        flexShrink: 0,
                      }}
                    >
                      <DeviceIcon os={currentSession.os} clientType={currentSession.client_type} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentSession.device_name || currentSession.os || 'Current Device'}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 12,
                      backgroundColor: 'rgba(169, 182, 101, 0.15)',
                      color: 'var(--kuro-color-accent)',
                      border: '1px solid rgba(169, 182, 101, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--kuro-color-accent)', flexShrink: 0 }} />
                    Current
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 10 }}>Client</span>
                    <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 500, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%', textAlign: 'right' }}>
                      {currentSession.browser || currentSession.client_type || 'Web Browser'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 10 }}>IP Address</span>
                    <span style={{ color: 'var(--kuro-color-text-secondary)', fontFamily: 'monospace', fontSize: 10 }}>
                      {currentSession.ip_address || '127.0.0.1'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 10 }}>Signed in</span>
                    <span style={{ color: 'var(--kuro-color-text-secondary)', fontFamily: 'monospace', fontSize: 10 }}>{formatTimestamp(currentSession.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 10 }}>Last Active</span>
                    <span style={{ color: 'var(--kuro-color-accent)', fontWeight: 600, fontSize: 10 }}>{timeAgo(currentSession.last_active_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other Sessions List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Others ({otherSessions.length})
              </span>
              {otherSessions.some((s) => s.is_active) && (
                <button
                  onClick={handleRevokeAll}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--kuro-color-danger, #ef4444)',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Revoke All Others
                </button>
              )}
            </div>

            {loadingSessions && sessions.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>
                Loading session history...
              </div>
            ) : otherSessions.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 11, backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: radius.card, border: '1px dashed var(--kuro-color-border)' }}>
                No other sessions recorded for this user.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {otherSessions.map((session) => {
                  const isRevoked = !!session.revoked_at
                  const isActive = session.is_active && !isRevoked

                  return (
                    <div
                      key={session.id}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.card,
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        opacity: isActive ? 1 : 0.65,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div
                            style={{
                              padding: 5,
                              borderRadius: 5,
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              color: 'var(--kuro-color-text-secondary)',
                              display: 'flex',
                              flexShrink: 0,
                            }}
                          >
                            <DeviceIcon os={session.os} clientType={session.client_type} />
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {session.device_name || session.os || 'Device'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          {isActive ? (
                            session.is_online ? (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: 'rgba(169, 182, 101, 0.15)',
                                  color: 'var(--kuro-color-accent)',
                                  border: '1px solid rgba(169, 182, 101, 0.3)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--kuro-color-accent)', flexShrink: 0 }} />
                                Online
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                  color: 'var(--kuro-color-text-muted)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--kuro-color-text-muted)', flexShrink: 0 }} />
                                Offline
                              </span>
                            )
                          ) : (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                color: 'var(--kuro-color-danger, #ef4444)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Revoked
                            </span>
                          )}

                          {isActive && (
                            <button
                              onClick={() => handleRevokeSingle(session.id)}
                              disabled={revokingId === session.id}
                              style={{
                                background: 'transparent',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: 4,
                                padding: '2px 6px',
                                color: 'var(--kuro-color-danger, #ef4444)',
                                fontSize: 9,
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                              title="Revoke and log out this session"
                            >
                              {revokingId === session.id ? 'Revoking...' : 'Revoke'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 9, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--kuro-color-text-muted)' }}>Client</span>
                          <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%', textAlign: 'right' }}>
                            {session.browser || session.client_type || 'Client App'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--kuro-color-text-muted)' }}>IP Address</span>
                          <span style={{ color: 'var(--kuro-color-text-secondary)', fontFamily: 'monospace' }}>
                            {session.ip_address || 'Unknown IP'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--kuro-color-text-muted)' }}>Logged in</span>
                          <span style={{ color: 'var(--kuro-color-text-secondary)', fontFamily: 'monospace' }}>{formatTimestamp(session.created_at)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--kuro-color-text-muted)' }}>Last active</span>
                          <span style={{ color: isActive ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)', fontWeight: 500 }}>
                            {timeAgo(session.last_active_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

