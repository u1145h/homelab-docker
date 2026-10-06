import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Button } from '@/components/ui/actions'
import { radius } from '@/design/radius'

interface DeleteConfirmDialogProps {
  open: boolean
  username: string
  onClose: () => void
  onConfirm: () => void
  busy?: boolean
}

export default function DeleteConfirmDialog({ open, username, onClose, onConfirm, busy }: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        Delete User
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
          Are you sure you want to delete &quot;{username}&quot;? This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
