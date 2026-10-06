import { StatusBadge } from '@/components/ui/display'
import type { UserResponse } from '../types'
import { formatTimestamp } from '../utils/users'
import { radius } from '@/design/radius'

interface UserTableProps {
  users: UserResponse[]
  selected: UserResponse | null
  onSelect: (user: UserResponse) => void
  onEdit: (user: UserResponse) => void
  onDelete: (user: UserResponse) => void
  onResetPassword: (user: UserResponse) => void
  onSetup2FA: (user: UserResponse) => void
  onDisable2FA: (user: UserResponse) => void
}

function roleToStatus(role: string): 'healthy' | 'info' | 'warning' | 'unknown' {
  if (role === 'admin') return 'healthy'
  if (role === 'user') return 'info'
  if (role === 'client') return 'unknown'
  return 'warning'
}

function getInitials(username: string) {
  return username.substring(0, 2).toUpperCase()
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function UserTable({
  users,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onResetPassword,
  onSetup2FA,
  onDisable2FA,
}: UserTableProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* 1. Desktop Table View (> 680px) */}
      <div className="users-desktop-table" style={{ overflowX: 'auto', width: '100%' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            whiteSpace: 'nowrap',
          }}
        >
          <thead>
            <tr>
              <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--kuro-color-border)', borderLeft: '3px solid transparent' }}>Username</th>
              <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--kuro-color-border)' }}>Role</th>
              <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--kuro-color-border)' }}>Created</th>
              <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--kuro-color-border)' }}>Updated</th>
              <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--kuro-color-border)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelected = selected?.id === user.id
              return (
                <tr
                  key={user.id}
                  onClick={() => onSelect(user)}
                  style={{
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderBottom: '1px solid var(--kuro-color-border)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <td
                    style={{
                      padding: '12px 20px',
                      borderLeft: isSelected ? '3px solid var(--kuro-color-accent)' : '3px solid transparent',
                      transition: 'border-left 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--kuro-color-text-primary)',
                        }}
                      >
                        {user.first_name ? user.first_name.substring(0, 1) + (user.last_name ? user.last_name.substring(0, 1) : '') : getInitials(user.username)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                          {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username}
                        </span>
                        {user.first_name && (
                          <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)', fontFamily: 'monospace' }}>
                            @{user.username}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StatusBadge status={roleToStatus(user.role)} label={user.role} />
                      {user.two_factor_enabled && (
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
                  </td>
                  
                  <td style={{ padding: '12px 20px', fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                    {formatTimestamp(user.created_at)}
                  </td>
                  
                  <td style={{ padding: '12px 20px', fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                    {relativeTime(user.updated_at)}
                  </td>
                  
                  <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                      <button
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(user)
                        }}
                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--kuro-color-text-secondary)', display: 'flex' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--kuro-color-text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--kuro-color-text-secondary)'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                      {user.role !== 'client' && (
                        <button
                          title={user.two_factor_enabled ? "2FA Enabled (Click to disable)" : "Setup 2FA"}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (user.two_factor_enabled) {
                              onDisable2FA(user)
                            } else {
                              onSetup2FA(user)
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 4,
                            cursor: 'pointer',
                            color: user.two_factor_enabled ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
                            display: 'flex',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = user.two_factor_enabled ? 'var(--kuro-color-danger)' : 'var(--kuro-color-text-primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = user.two_factor_enabled ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </button>
                      )}
                      <button
                        title="Reset Password"
                        onClick={(e) => {
                          e.stopPropagation()
                          onResetPassword(user)
                        }}
                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--kuro-color-text-secondary)', display: 'flex' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--kuro-color-text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--kuro-color-text-secondary)'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>
                      </button>
                      {user.role !== 'admin' && user.username !== 'admin' && (
                        <button
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(user)
                          }}
                          style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--kuro-color-danger)', display: 'flex' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 2. Mobile Cards View (<= 680px) */}
      <div className="users-mobile-cards" style={{ display: 'none', flexDirection: 'column', padding: 10, gap: 10 }}>
        {users.map((user) => {
          const isSelected = selected?.id === user.id
          return (
            <div
              key={user.id}
              onClick={() => onSelect(user)}
              style={{
                backgroundColor: isSelected ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                border: isSelected ? '1px solid var(--kuro-color-accent, #b8bb26)' : '1px solid var(--kuro-color-border)',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Header: User Avatar + Name + Role Badge + Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--kuro-color-text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(user.username)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.username}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <StatusBadge status={roleToStatus(user.role)} label={user.role} />
                  
                  {/* Action Icons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                    <button
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(user)
                      }}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--kuro-color-border)', borderRadius: 4, padding: '5px 6px', cursor: 'pointer', color: 'var(--kuro-color-text-secondary)', display: 'flex' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button
                      title="Reset Password"
                      onClick={(e) => {
                        e.stopPropagation()
                        onResetPassword(user)
                      }}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--kuro-color-border)', borderRadius: 4, padding: '5px 6px', cursor: 'pointer', color: 'var(--kuro-color-text-secondary)', display: 'flex' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>
                    </button>
                    <button
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(user)
                      }}
                      style={{ background: 'rgba(234, 105, 98, 0.1)', border: '1px solid rgba(234, 105, 98, 0.25)', borderRadius: 4, padding: '5px 6px', cursor: 'pointer', color: 'var(--kuro-color-danger)', display: 'flex' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-Info Meta: Created & Updated timestamps */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--kuro-color-text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
                <span>Created {formatTimestamp(user.created_at)}</span>
                <span>Updated {relativeTime(user.updated_at)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
