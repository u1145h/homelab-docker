import { useState, useCallback, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Radio,
  Chip,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import DnsIcon from '@mui/icons-material/Dns'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import AndroidIcon from '@mui/icons-material/Android'
import LanguageIcon from '@mui/icons-material/Language'
import { useServer } from '@/contexts/ServerContext'
import { TextInput } from '@/components/ui/forms'
import { radius } from '@/design/radius'
import type { PingResult } from '@/utils/serverStorage'

export function ServerConnectionsSection() {
  const { profiles, activeProfile, isAndroidNative, setActiveServer, addProfile, deleteProfile, testServer, resetServerConfig } = useServer()

  const [addingNew, setAddingNew] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState<PingResult | null>(null)
  const [pingMap, setPingMap] = useState<Record<string, PingResult>>({})

  const runAllPings = useCallback(() => {
    for (const p of profiles) {
      testServer(p.url).then((res) => {
        setPingMap((prev) => ({ ...prev, [p.id]: res }))
      })
    }
  }, [profiles, testServer])

  useEffect(() => {
    runAllPings()
  }, [runAllPings])

  const handleTest = async () => {
    if (!url.trim()) return
    setTesting(true)
    setTestRes(null)
    const res = await testServer(url)
    setTestRes(res)
    setTesting(false)
  }

  const handleAdd = () => {
    if (!url.trim()) return
    const created = addProfile(name || url, url)
    setActiveServer(created.id)
    setName('')
    setUrl('')
    setTestRes(null)
    setAddingNew(false)
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DnsIcon style={{ color: 'var(--kuro-color-accent)', fontSize: 22 }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--kuro-color-text-h)' }}>
              Server Connections
            </h2>
          </div>
          <p style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', marginTop: 4, margin: '4px 0 0 0' }}>
            Manage server endpoints and switch target addresses (Public Domain, Tailscale, Direct Cable, or Custom)
          </p>
        </div>

        <Box style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isAndroidNative ? (
            <Chip
              icon={<AndroidIcon style={{ fontSize: 14, color: '#a9b665' }} />}
              label="Android App Active"
              size="small"
              style={{
                backgroundColor: 'rgba(169, 182, 101, 0.15)',
                color: 'var(--kuro-color-accent)',
                border: '1px solid rgba(169, 182, 101, 0.3)',
                fontWeight: 600,
                fontSize: 11,
              }}
            />
          ) : (
            <Chip
              icon={<LanguageIcon style={{ fontSize: 14, color: 'var(--kuro-color-text-secondary)' }} />}
              label="Web Client"
              size="small"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--kuro-color-text-secondary)',
                border: '1px solid var(--kuro-color-border)',
                fontSize: 11,
              }}
            />
          )}

          {isAndroidNative && (
            <Button
              size="small"
              variant="outlined"
              onClick={resetServerConfig}
              style={{
                borderColor: 'var(--kuro-color-border)',
                color: 'var(--kuro-color-accent)',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              Reconfigure Server
            </Button>
          )}
        </Box>
      </div>

      {/* Profiles Grid */}
      <Box style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {profiles.map((p) => {
          const isActive = activeProfile ? p.id === activeProfile.id : false
          const ping = pingMap[p.id]

          return (
            <Box
              key={p.id}
              onClick={() => setActiveServer(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 8,
                border: isActive ? '1px solid var(--kuro-color-accent)' : '1px solid var(--kuro-color-border)',
                backgroundColor: isActive ? 'rgba(169, 182, 101, 0.06)' : 'rgba(0, 0, 0, 0.15)',
                cursor: 'pointer',
                transition: 'border-color 150ms, background-color 150ms',
                gap: 10,
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            >
              <Box style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <Radio
                  checked={isActive}
                  onChange={() => setActiveServer(p.id)}
                  size="small"
                  style={{ color: isActive ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)', padding: 0, flexShrink: 0 }}
                />
                <Box style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2, flex: 1 }}>
                  <Box style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: isActive ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}
                      title={p.name}
                    >
                      {p.name}
                    </Typography>
                    {isActive && (
                      <Chip
                        label="ACTIVE TARGET"
                        size="small"
                        style={{
                          height: 18,
                          fontSize: 9,
                          fontWeight: 700,
                          backgroundColor: 'var(--kuro-color-accent)',
                          color: '#111314',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {p.isDefault && (
                      <Chip
                        label="PRESET"
                        size="small"
                        style={{
                          height: 18,
                          fontSize: 9,
                          fontWeight: 600,
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--kuro-color-text-secondary)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    style={{
                      fontSize: 11,
                      color: 'var(--kuro-color-text-secondary)',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                    title={p.url}
                  >
                    {p.url}
                  </Typography>
                </Box>
              </Box>

              <Box style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {ping ? (
                  ping.ok ? (
                    <Tooltip title={`Online (${ping.latencyMs} ms)`}>
                      <Chip
                        icon={<SignalCellularAltIcon style={{ fontSize: 13, color: 'var(--kuro-color-success)' }} />}
                        label={`${ping.latencyMs} ms`}
                        size="small"
                        style={{
                          height: 22,
                          fontSize: 11,
                          backgroundColor: 'rgba(169, 182, 101, 0.15)',
                          color: 'var(--kuro-color-success)',
                          border: '1px solid rgba(169, 182, 101, 0.3)',
                        }}
                      />
                    </Tooltip>
                  ) : (
                    <Tooltip title={`Offline: ${ping.error || 'Unreachable'}`}>
                      <Chip
                        icon={<ErrorIcon style={{ fontSize: 13, color: 'var(--kuro-color-danger)' }} />}
                        label="Offline"
                        size="small"
                        style={{
                          height: 22,
                          fontSize: 11,
                          backgroundColor: 'rgba(234, 105, 98, 0.15)',
                          color: 'var(--kuro-color-danger)',
                          border: '1px solid rgba(234, 105, 98, 0.3)',
                        }}
                      />
                    </Tooltip>
                  )
                ) : (
                  <CircularProgress size={14} style={{ color: 'var(--kuro-color-text-secondary)' }} />
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
                    <DeleteIcon style={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* Add New Profile Section */}
      {!addingNew ? (
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAddingNew(true)}
          style={{
            alignSelf: 'flex-start',
            borderRadius: radius.button,
            borderColor: 'var(--kuro-color-border)',
            color: 'var(--kuro-color-text-primary)',
            fontSize: 12,
            textTransform: 'none',
          }}
        >
          Add Custom Server Connection
        </Button>
      ) : (
        <Box
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--kuro-color-border)',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <Typography variant="subtitle2" style={{ fontWeight: 700, color: 'var(--kuro-color-accent)' }}>
            Add Custom Server Target
          </Typography>

          <Box style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Box style={{ flex: '1 1 200px' }}>
              <TextInput
                placeholder="Connection Name (e.g. Office LAN)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                size="small"
              />
            </Box>
            <Box style={{ flex: '2 1 300px' }}>
              <TextInput
                placeholder="Server URL (e.g. http://172.16.42.1:9876)"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setTestRes(null)
                }}
                fullWidth
                size="small"
              />
            </Box>
          </Box>

          {testRes && (
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: testRes.ok ? 'var(--kuro-color-success)' : 'var(--kuro-color-danger)',
              }}
            >
              {testRes.ok ? <CheckCircleIcon style={{ fontSize: 16 }} /> : <ErrorIcon style={{ fontSize: 16 }} />}
              {testRes.ok
                ? `Connection Successful! Response time: ${testRes.latencyMs} ms`
                : `Connection Failed: ${testRes.error || 'Server unreachable'}`}
            </Box>
          )}

          <Box style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              onClick={handleTest}
              disabled={!url.trim() || testing}
              style={{ color: 'var(--kuro-color-text-secondary)', fontSize: 12, textTransform: 'none' }}
            >
              {testing ? <CircularProgress size={14} /> : 'Test Connection'}
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
              onClick={handleAdd}
              disabled={!url.trim()}
              style={{
                backgroundColor: 'var(--kuro-color-accent)',
                color: '#111314',
                fontWeight: 600,
                fontSize: 12,
                textTransform: 'none',
              }}
            >
              Save & Activate
            </Button>
          </Box>
        </Box>
      )}
    </div>
  )
}
