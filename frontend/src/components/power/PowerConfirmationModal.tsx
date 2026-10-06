import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { AppIcon } from '@/components/ui/icons'
import { TextInput } from '@/components/ui/forms'
import { rebootServer } from '@/api/power'

interface PowerConfirmationModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PowerConfirmationModal({
  open,
  onClose,
  onSuccess,
}: PowerConfirmationModalProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPassword('')
      setShowPassword(false)
      setLoading(false)
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError('System password is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await rebootServer(password)
      onSuccess()
      onClose()
    } catch (err: any) {
      const msg = err.response?.data || err.message || 'Failed to authorize power action'
      setError(typeof msg === 'string' ? msg : 'Invalid root or administrative password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: {
          style: {
            backgroundColor: 'var(--kuro-color-surface)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: 12,
            backgroundImage: 'none',
          },
        },
      }}
    >
      <DialogTitle
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--kuro-color-border)',
        }}
      >
        <Box style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(230, 195, 132, 0.15)',
              color: 'var(--kuro-color-warning, #e6c384)',
            }}
          >
            <AppIcon name="rotate-cw" size={18} />
          </Box>
          <Typography variant="subtitle1" style={{ fontWeight: 700, color: 'var(--kuro-color-text-h)' }}>
            Reboot Server
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={loading} style={{ color: 'var(--kuro-color-text-secondary)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            severity="warning"
            style={{
              backgroundColor: 'rgba(230, 195, 132, 0.1)',
              color: 'var(--kuro-color-text-primary)',
              border: '1px solid rgba(230, 195, 132, 0.3)',
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            <Typography variant="body2" style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
              Are you sure you want to reboot the host system?
            </Typography>
            This action will restart the server node. Active web sessions, background jobs, terminal shell processes, and containerized workloads will be restarted.
          </Alert>

          <Box style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Typography variant="caption" style={{ fontWeight: 600, color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>
              SYSTEM ROOT / ADMIN PASSWORD
            </Typography>
            <Box style={{ position: 'relative' }}>
              <TextInput
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter root or administrative password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                fullWidth
                size="small"
                disabled={loading}
              />
              <IconButton
                size="small"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--kuro-color-text-secondary)',
                }}
              >
                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </Box>
          </Box>

          {error && (
            <Typography variant="caption" style={{ color: 'var(--kuro-color-danger)', fontSize: 11, fontWeight: 500 }}>
              {error}
            </Typography>
          )}
        </DialogContent>

        <DialogActions style={{ padding: '12px 20px', borderTop: '1px solid var(--kuro-color-border)' }}>
          <Button size="small" onClick={onClose} disabled={loading} style={{ color: 'var(--kuro-color-text-secondary)', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="small"
            variant="contained"
            disabled={loading || !password}
            style={{
              backgroundColor: 'var(--kuro-color-warning, #e6c384)',
              color: '#111314',
              fontWeight: 700,
              fontSize: 12,
              textTransform: 'none',
              minWidth: 100,
            }}
          >
            {loading ? (
              <CircularProgress size={16} style={{ color: '#111314' }} />
            ) : (
              'Reboot Now'
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
