import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { PasswordInput } from '@/components/ui/forms'
import { Button } from '@/components/ui/actions'
import { radius } from '@/design/radius'

interface PasswordResetDialogProps {
  open: boolean
  username: string
  onClose: () => void
  onSubmit: (password: string) => void
  busy?: boolean
}

export default function PasswordResetDialog({ open, username, onClose, onSubmit, busy }: PasswordResetDialogProps) {
  const [password, setPassword] = useState('')

  const handleSubmit = () => {
    if (password.length < 8) return
    onSubmit(password)
    setPassword('')
  }

  const handleClose = () => {
    setPassword('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
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
        Reset Password
      </DialogTitle>
      <DialogContent sx={{ fontSize: 11 }}>
        <div style={{ fontSize: 12, color: 'var(--kuro-color-text-secondary)', marginBottom: 12 }}>
          Set a new password for <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)', fontFamily: 'monospace' }}>@{username}</span>. Existing sessions on all devices will be automatically revoked.
        </div>
        <PasswordInput
          autoFocus
          fullWidth
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText={password.length > 0 && password.length < 8 ? 'Minimum 8 characters' : ' '}
          error={password.length > 0 && password.length < 8}
          disabled={busy}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="ghost" onClick={handleClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={password.length < 8 || busy}>
          {busy ? 'Resetting...' : 'Reset Password'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
