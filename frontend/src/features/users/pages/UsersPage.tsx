import { useState, useCallback } from 'react'
import { useUsers } from '../hooks/useUsers'
import { useUserMutations } from '../hooks/useUserMutations'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSnackbar } from '@/hooks/useSnackbar'
import UserSummaryCards from '../components/UserSummaryCards'
import UsersToolbar from '../components/UsersToolbar'
import UserTable from '../components/UserTable'
import UserDetailsPanel from '../components/UserDetailsPanel'
import RoleDistributionPanel from '../components/RoleDistributionPanel'
import UserFormDialog from '../components/UserFormDialog'
import PasswordResetDialog from '../components/PasswordResetDialog'
import DeleteConfirmDialog from '../components/DeleteConfirmDialog'
import TwoFactorSetupDialog from '../components/TwoFactorSetupDialog'
import { disableUser2FA } from '../api/users'
import type { UserResponse, CreateUserRequest, UpdateUserRequest } from '../types'
import { radius } from '@/design/radius'

export default function UsersPage() {
  useDocumentTitle('Users - HomeLab')
  const { showSnackbar } = useSnackbar()
  const {
    filtered,
    loading,
    error,
    search,
    setSearch,
    summary,
    refresh,
  } = useUsers()

  const ops = useUserMutations(refresh)

  const [selected, setSelected] = useState<UserResponse | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [passwordResetOpen, setPasswordResetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false)
  const [actionUser, setActionUser] = useState<UserResponse | null>(null)

  const handleSelect = useCallback((user: UserResponse) => {
    setSelected((prev) => prev?.id === user.id ? null : user)
  }, [])

  const openCreate = useCallback(() => {
    setFormMode('create')
    setActionUser(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((user: UserResponse) => {
    setFormMode('edit')
    setActionUser(user)
    setFormOpen(true)
  }, [])

  const openPasswordReset = useCallback((user: UserResponse) => {
    setActionUser(user)
    setPasswordResetOpen(true)
  }, [])

  const openDelete = useCallback((user: UserResponse) => {
    setActionUser(user)
    setDeleteOpen(true)
  }, [])

  const openSetup2FA = useCallback((user: UserResponse) => {
    setActionUser(user)
    setTwoFactorDialogOpen(true)
  }, [])

  const handleDisable2FA = useCallback(async (user: UserResponse) => {
    try {
      await disableUser2FA(user.id)
      showSnackbar(`Two-factor authentication disabled for @${user.username}.`, 'success')
      refresh()
      if (selected?.id === user.id) {
        setSelected((prev) => prev ? { ...prev, two_factor_enabled: false } : null)
      }
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to disable 2FA.', 'error')
    }
  }, [selected, refresh, showSnackbar])

  const handleFormSubmit = useCallback((data: CreateUserRequest | UpdateUserRequest) => {
    setFormOpen(false)
    if (formMode === 'create') {
      ops.createUser(data as CreateUserRequest)
    } else if (actionUser) {
      ops.updateUser(actionUser.id, data as UpdateUserRequest)
      if (selected?.id === actionUser.id) {
        setSelected({ ...actionUser, ...data } as UserResponse)
      }
    }
  }, [formMode, actionUser, selected, ops])

  const handleDelete = useCallback(async () => {
    setDeleteOpen(false)
    if (actionUser) {
      await ops.deleteUser(actionUser.id)
      if (selected?.id === actionUser.id) {
        setSelected(null)
      }
    }
  }, [actionUser, selected, ops])

  const handlePasswordReset = useCallback(async (password: string) => {
    setPasswordResetOpen(false)
    if (actionUser) {
      await ops.resetPassword(actionUser.id, password)
    }
  }, [actionUser, ops])

  return (
    <div className="users-page-root" style={{ display: 'flex', flexDirection: 'column' }}>
      <UserSummaryCards {...summary} />

      <div
        className="users-content-grid page-widget-gap"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          alignItems: 'flex-start',
        }}
      >
        <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <UsersToolbar
            search={search}
            onSearchChange={setSearch}
            onAddUser={openCreate}
          />
          
          {loading && filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11, backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card }}>
              Loading users...
            </div>
          ) : error ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--kuro-color-danger)', fontSize: 11, backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card }}>
              <p style={{ margin: '0 0 8px' }}>{error}</p>
              <button onClick={refresh} style={{ padding: '6px 12px', borderRadius: radius.button, border: '1px solid var(--kuro-color-border)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 11 }}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11, backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card }}>
              {search ? 'No matching users found.' : 'No users found.'}
            </div>
          ) : (
            <UserTable
              users={filtered}
              selected={selected}
              onSelect={handleSelect}
              onEdit={openEdit}
              onDelete={openDelete}
              onResetPassword={openPasswordReset}
              onSetup2FA={openSetup2FA}
              onDisable2FA={handleDisable2FA}
            />
          )}
        </div>

        <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column' }}>
          {selected && (
            <UserDetailsPanel
              user={selected}
              onClose={() => setSelected(null)}
              onEdit={() => openEdit(selected)}
              onDelete={() => openDelete(selected)}
              onResetPassword={() => openPasswordReset(selected)}
              onSetup2FA={() => openSetup2FA(selected)}
              onDisable2FA={() => handleDisable2FA(selected)}
            />
          )}
          <RoleDistributionPanel
            total={summary.total}
            admins={summary.admins}
            regular={summary.regular}
            clients={summary.clients}
            readonly={summary.readonly}
          />
        </div>
      </div>

      <UserFormDialog
        open={formOpen}
        mode={formMode}
        initial={actionUser ? {
          username: actionUser.username,
          role: actionUser.role,
          first_name: actionUser.first_name,
          last_name: actionUser.last_name,
        } : undefined}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        busy={ops.busy}
      />

      <PasswordResetDialog
        open={passwordResetOpen}
        username={actionUser?.username ?? ''}
        onClose={() => setPasswordResetOpen(false)}
        onSubmit={handlePasswordReset}
        busy={ops.busy}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        username={actionUser?.username ?? ''}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        busy={ops.busy}
      />

      <TwoFactorSetupDialog
        open={twoFactorDialogOpen}
        userId={actionUser?.id ?? ''}
        username={actionUser?.username ?? ''}
        onClose={() => setTwoFactorDialogOpen(false)}
        onSuccess={() => {
          showSnackbar(`Two-factor authentication enabled for @${actionUser?.username}.`, 'success')
          refresh()
          if (selected?.id === actionUser?.id) {
            setSelected((prev) => prev ? { ...prev, two_factor_enabled: true } : null)
          }
        }}
      />
    </div>
  )
}
