import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Radio,
  IconButton,
  Chip,
  Box,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import DnsIcon from '@mui/icons-material/Dns'
import CloseIcon from '@mui/icons-material/Close'
import { useServer } from '@/contexts/ServerContext'
import { TextInput } from '@/components/ui/forms'
import type { PingResult } from '@/utils/serverStorage'

interface ServerSelectorModalProps {
  open: boolean
  onClose: () => void
}

export function ServerSelectorModal({ open, onClose }: ServerSelectorModalProps) {
  const { profiles, activeProfile, setActiveServer, addProfile, deleteProfile, testServer } = useServer()

  const [addingNew, setAddingNew] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileUrl, setNewProfileUrl] = useState('')
  const [testResult, setTestResult] = useState<PingResult | null>(null)
  const [testingNew, setTestingNew] = useState(false)
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({})

  // Test ping for all profiles on open
  const runPingTests = useCallback(async () => {
    for (const p of profiles) {
      testServer(p.url).then((res) => {
        setPingResults((prev) => ({ ...prev, [p.id]: res }))
      })
    }
  }, [profiles, testServer])

  useEffect(() => {
    if (open) {
      runPingTests()
    }
  }, [open, runPingTests])

  const handleSelectServer = (id: string) => {
    setActiveServer(id)
    onClose()
  }

  const handleTestNewServer = async () => {
    if (!newProfileUrl.trim()) return
    setTestingNew(true)
    setTestResult(null)
    const res = await testServer(newProfileUrl)
    setTestResult(res)
    setTestingNew(false)
  }

  const handleSaveNewServer = () => {
    if (!newProfileUrl.trim()) return
    const created = addProfile(newProfileName || newProfileUrl, newProfileUrl)
    setActiveServer(created.id)
    setAddingNew(false)
    setNewProfileName('')
    setNewProfileUrl('')
    setTestResult(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DnsIcon style={{ color: 'var(--kuro-color-accent)', fontSize: 20 }} />
          <Typography variant="subtitle1" style={{ fontWeight: 700, color: 'var(--kuro-color-text-h)' }}>
            Select Server Profile
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} style={{ color: 'var(--kuro-color-text-secondary)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent style={{ padding: 20 }}>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {profiles.map((p) => {
            const isSelected = activeProfile ? p.id === activeProfile.id : false
            const ping = pingResults[p.id]

            return (
              <Box
                key={p.id}
                onClick={() => handleSelectServer(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: isSelected ? '1px solid var(--kuro-color-accent)' : '1px solid var(--kuro-color-border)',
                  backgroundColor: isSelected ? 'rgba(169, 182, 101, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  transition: 'border-color 150ms, background-color 150ms',
                }}
              >
                <Box style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Radio
                    checked={isSelected}
                    onChange={() => handleSelectServer(p.id)}
                    size="small"
                    style={{ color: isSelected ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)', padding: 0 }}
                  />
                  <Box style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Typography
                        variant="body2"
                        style={{
                          fontWeight: 600,
                          color: isSelected ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-primary)',
                        }}
                      >
                        {p.name}
                      </Typography>
                      {isSelected && (
                        <Chip
                          label="ACTIVE"
                          size="small"
                          style={{
                            height: 18,
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: 'var(--kuro-color-accent)',
                            color: '#111314',
                          }}
                        />
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      style={{
                        fontSize: 11,
                        color: 'var(--kuro-color-text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontFamily: 'monospace',
                      }}
                    >
                      {p.url}
                    </Typography>
                  </Box>
                </Box>

                <Box style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {ping ? (
                    ping.ok ? (
                      <Tooltip title={`Online (${ping.latencyMs} ms)`}>
                        <Chip
                          icon={<SignalCellularAltIcon style={{ fontSize: 12, color: 'var(--kuro-color-success)' }} />}
                          label={`${ping.latencyMs} ms`}
                          size="small"
                          style={{
                            height: 20,
                            fontSize: 10,
                            backgroundColor: 'rgba(169, 182, 101, 0.15)',
                            color: 'var(--kuro-color-success)',
                            border: '1px solid rgba(169, 182, 101, 0.3)',
                          }}
                        />
                      </Tooltip>
                    ) : (
                      <Tooltip title={`Offline: ${ping.error || 'Unreachable'}`}>
                        <Chip
                          icon={<ErrorIcon style={{ fontSize: 12, color: 'var(--kuro-color-danger)' }} />}
                          label="Offline"
                          size="small"
                          style={{
                            height: 20,
                            fontSize: 10,
                            backgroundColor: 'rgba(234, 105, 98, 0.15)',
                            color: 'var(--kuro-color-danger)',
                            border: '1px solid rgba(234, 105, 98, 0.3)',
                          }}
                        />
                      </Tooltip>
                    )
                  ) : (
                    <CircularProgress size={12} style={{ color: 'var(--kuro-color-text-secondary)' }} />
                  )}

                  {!p.isDefault && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteProfile(p.id)
                      }}
                      style={{ color: 'var(--kuro-color-danger)', padding: 4 }}
                    >
                      <DeleteIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>
              </Box>
            )
          })}

          {!addingNew ? (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddingNew(true)}
              fullWidth
              style={{
                marginTop: 8,
                borderRadius: 8,
                borderColor: 'var(--kuro-color-border)',
                color: 'var(--kuro-color-text-primary)',
                fontSize: 13,
                textTransform: 'none',
              }}
            >
              Add Custom Server Profile
            </Button>
          ) : (
            <Box
              style={{
                marginTop: 8,
                padding: 14,
                borderRadius: 8,
                border: '1px solid var(--kuro-color-border)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <Typography variant="caption" style={{ fontWeight: 700, color: 'var(--kuro-color-accent)' }}>
                NEW SERVER PROFILE
              </Typography>

              <TextInput
                placeholder="Name (e.g. Home Wi-Fi / VPN)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                fullWidth
                size="small"
              />

              <TextInput
                placeholder="Server URL (e.g. http://192.168.1.100:9876)"
                value={newProfileUrl}
                onChange={(e) => {
                  setNewProfileUrl(e.target.value)
                  setTestResult(null)
                }}
                fullWidth
                size="small"
              />

              {testResult && (
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: testResult.ok ? 'var(--kuro-color-success)' : 'var(--kuro-color-danger)',
                  }}
                >
                  {testResult.ok ? <CheckCircleIcon style={{ fontSize: 16 }} /> : <ErrorIcon style={{ fontSize: 16 }} />}
                  {testResult.ok
                    ? `Connected! Latency: ${testResult.latencyMs} ms`
                    : `Connection Failed (${testResult.error || 'Unreachable'})`}
                </Box>
              )}

              <Box style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <Button
                  size="small"
                  onClick={handleTestNewServer}
                  disabled={!newProfileUrl.trim() || testingNew}
                  style={{ color: 'var(--kuro-color-text-secondary)', fontSize: 12, textTransform: 'none' }}
                >
                  {testingNew ? <CircularProgress size={14} /> : 'Test Connection'}
                </Button>

                <Button
                  size="small"
                  onClick={() => setAddingNew(false)}
                  style={{ color: 'var(--kuro-color-text-secondary)', fontSize: 12, textTransform: 'none' }}
                >
                  Cancel
                </Button>

                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSaveNewServer}
                  disabled={!newProfileUrl.trim()}
                  style={{
                    backgroundColor: 'var(--kuro-color-accent)',
                    color: '#111314',
                    fontWeight: 600,
                    fontSize: 12,
                    textTransform: 'none',
                  }}
                >
                  Save & Switch
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions style={{ padding: '12px 20px', borderTop: '1px solid var(--kuro-color-border)' }}>
        <Button size="small" onClick={onClose} style={{ color: 'var(--kuro-color-text-secondary)', fontSize: 13 }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
}
