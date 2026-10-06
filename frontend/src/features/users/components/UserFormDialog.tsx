import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { TextInput, PasswordInput, Select } from '@/components/ui/forms'
import { Button } from '@/components/ui/actions'
import { radius } from '@/design/radius'
import type { UserRole, CreateUserRequest, UpdateUserRequest } from '../types'
import { VALID_ROLES } from '../utils/users'

interface UserFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: { username: string; role: UserRole; first_name?: string; last_name?: string }
  onClose: () => void
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => void
  busy?: boolean
}

export default function UserFormDialog({ open, mode, initial, onClose, onSubmit, busy }: UserFormDialogProps) {
  const [username, setUsername] = useState(initial?.username ?? '')
  const [firstName, setFirstName] = useState(initial?.first_name ?? '')
  const [lastName, setLastName] = useState(initial?.last_name ?? '')
  const [role, setRole] = useState<UserRole>(initial?.role ?? 'user')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open) {
      setUsername(initial?.username ?? '')
      setFirstName(initial?.first_name ?? '')
      setLastName(initial?.last_name ?? '')
      setRole(initial?.role ?? 'user')
      setPassword('')
    }
  }, [open, initial])

  const handleSubmit = () => {
    if (mode === 'create') {
      const payload: CreateUserRequest = {
        username: username.trim(),
        first_name: role === 'client' ? undefined : firstName.trim(),
        last_name: role === 'client' ? undefined : lastName.trim(),
        password,
        role,
      }
      onSubmit(payload)
    } else {
      const updates: UpdateUserRequest = {}
      if (username.trim() !== (initial?.username ?? '')) updates.username = username.trim()
      if (role !== 'client') {
        if (firstName.trim() !== (initial?.first_name ?? '')) updates.first_name = firstName.trim()
        if (lastName.trim() !== (initial?.last_name ?? '')) updates.last_name = lastName.trim()
      }
      if (role !== initial?.role) updates.role = role
      if (password.trim().length >= 8) updates.password = password.trim()
      if (Object.keys(updates).length === 0) return
      onSubmit(updates)
    }
  }

  const handleClose = () => {
    setUsername(initial?.username ?? '')
    setFirstName(initial?.first_name ?? '')
    setLastName(initial?.last_name ?? '')
    setRole(initial?.role ?? 'user')
    setPassword('')
    onClose()
  }

  const isClientRole = role === 'client'
  const namesValid = isClientRole || (firstName.trim() !== '' && lastName.trim() !== '')
  const hasFieldChanges = (
    username.trim() !== (initial?.username ?? '') ||
    (!isClientRole && (firstName.trim() !== (initial?.first_name ?? '') || lastName.trim() !== (initial?.last_name ?? ''))) ||
    role !== initial?.role
  )
  const isPasswordValid = password.length === 0 || password.length >= 8

  const canSubmit = mode === 'create'
    ? username.trim() !== '' && password.length >= 8 && namesValid
    : (isPasswordValid && namesValid && (hasFieldChanges || password.length >= 8))

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: radius.modal,
            bgcolor: 'var(--kuro-color-surface)',
            border: '1px solid var(--kuro-color-border)',
            backgroundImage: 'none',
          },
        },
      }}
    >
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
        {mode === 'create' ? 'Create User' : 'Edit User'}
      </DialogTitle>
      <DialogContent sx={{ fontSize: 11 }}>
        <TextInput
          autoFocus
          fullWidth
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
          sx={{ mb: 2, mt: 1 }}
        />

        {!isClientRole && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <TextInput
              fullWidth
              required
              label="First Name"
              placeholder="e.g. Ullas"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={firstName.trim() === ''}
              helperText={firstName.trim() === '' ? 'Required for this role' : ''}
              disabled={busy}
            />
            <TextInput
              fullWidth
              required
              label="Last Name"
              placeholder="e.g. Roy"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={lastName.trim() === ''}
              helperText={lastName.trim() === '' ? 'Required for this role' : ''}
              disabled={busy}
            />
          </div>
        )}

        <Select
          fullWidth
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          disabled={busy}
          options={VALID_ROLES.map((r) => ({
            value: r,
            label: r === 'client'
              ? 'Client (Companion Ghost Daemon Sync Only)'
              : r === 'user'
              ? 'User (Kuro Assistant App Only)'
              : r === 'readonly'
              ? 'Readonly (Status Monitor / Wall Dashboard)'
              : 'Admin (Full System Access)'
          }))}
          sx={{ mb: 2 }}
        />

        {mode === 'create' ? (
          <PasswordInput
            fullWidth
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText={password.length > 0 && password.length < 8 ? 'Minimum 8 characters' : ' '}
            error={password.length > 0 && password.length < 8}
            disabled={busy}
            sx={{ mt: 1 }}
          />
        ) : (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Change Password (Optional)
            </div>
            <PasswordInput
              fullWidth
              placeholder="Leave blank to keep current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText={password.length > 0 && password.length < 8 ? 'Minimum 8 characters required' : 'Leave empty if you do not wish to change the password'}
              error={password.length > 0 && password.length < 8}
              disabled={busy}
            />
          </div>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="ghost" onClick={handleClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit || busy}>
          {mode === 'create' ? 'Create' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
