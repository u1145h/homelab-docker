import { useState, useEffect } from 'react'
import { Drawer, IconButton, CircularProgress } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { Heading, Text, Caption, Label } from '@/components/ui/typography'
import { Divider } from '@/components/ui/layout'
import { StatusBadge, KeyValueTable } from '@/components/ui/display'
import ContainerActions from './ContainerActions'
import ContainerIcon from './ContainerIcon'
import {
  detectContainerSlug,
  POPULAR_ICON_PRESETS,
} from '../utils/dockerIconResolver'
import {
  setCustomDockerIcon,
  removeCustomDockerIcon,
  useCustomDockerIcon,
} from '../utils/customDockerIcons'
import { radius } from '@/design/radius'
import type { ContainerDetail, ContainerSummary } from '../types'

interface ContainerDetailsDrawerProps {
  open: boolean
  container: ContainerSummary | null
  detail: ContainerDetail | null
  detailLoading: boolean
  busy: boolean
  onClose: () => void
  onStart: () => void
  onStop: () => void
  onRestart: () => void
}

function containerToStatus(state: string): 'healthy' | 'warning' | 'danger' | 'info' {
  if (state === 'running') return 'healthy'
  if (state === 'paused') return 'warning'
  if (state === 'restarting') return 'info'
  return 'danger'
}

export default function ContainerDetailsDrawer({
  open,
  container,
  detail,
  detailLoading,
  busy,
  onClose,
  onStart,
  onStop,
  onRestart,
}: ContainerDetailsDrawerProps) {
  const containerName = container?.name ?? ''
  const currentCustomIcon = useCustomDockerIcon(containerName)

  const [isEditingIcon, setIsEditingIcon] = useState(false)
  const [iconInputValue, setIconInputValue] = useState('')
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)

  // Sync input value whenever the container or custom icon changes
  useEffect(() => {
    setIconInputValue(currentCustomIcon || '')
    setIsEditingIcon(false)
    setSaveFeedback(null)
  }, [containerName, currentCustomIcon])

  const autoSlug = container ? detectContainerSlug(container) : ''
  const isCustomized = Boolean(currentCustomIcon)

  const handleSaveCustomIcon = () => {
    if (!containerName) return
    const trimmed = iconInputValue.trim()
    if (trimmed) {
      setCustomDockerIcon(containerName, trimmed)
      setSaveFeedback('Icon updated successfully')
    } else {
      removeCustomDockerIcon(containerName)
      setSaveFeedback('Reset to auto-detected icon')
    }
    setTimeout(() => {
      setSaveFeedback(null)
      setIsEditingIcon(false)
    }, 1200)
  }

  const handleResetToAuto = () => {
    if (!containerName) return
    removeCustomDockerIcon(containerName)
    setIconInputValue('')
    setSaveFeedback('Reverted to Walkxcode CDN icon')
    setTimeout(() => {
      setSaveFeedback(null)
      setIsEditingIcon(false)
    }, 1200)
  }

  const handlePresetSelect = (slug: string) => {
    setIconInputValue(slug)
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 460 },
          backgroundColor: 'var(--kuro-color-background)',
          color: 'var(--kuro-color-text-primary)',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.4)',
        },
      }}
    >
      <div style={{ padding: 24 }}>
        {/* Header with Container Icon & Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {container && (
              <ContainerIcon
                container={container}
                customIcon={currentCustomIcon}
                size={38}
                style={{
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  border: '1px solid var(--kuro-color-border)',
                }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <Heading level={3}>
                {container?.name ?? 'Details'}
              </Heading>
              {container && <StatusBadge status={containerToStatus(container.state)} label={container.state} />}
            </div>
          </div>
          <IconButton onClick={onClose} size="small" sx={{ color: 'var(--kuro-color-text-secondary)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        {/* Action Buttons */}
        {container && (
          <div style={{ marginBottom: 16 }}>
            <ContainerActions state={container.state} busy={busy} onStart={onStart} onStop={onStop} onRestart={onRestart} />
          </div>
        )}

        {/* Container Icon Customization Card */}
        {container && (
          <div
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              padding: 14,
              marginBottom: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                  Container Logo
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    padding: '2px 6px',
                    borderRadius: radius.button,
                    backgroundColor: isCustomized
                      ? 'rgba(var(--kuro-color-accent-rgb, 99, 102, 241), 0.12)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: isCustomized
                      ? 'var(--kuro-color-accent)'
                      : 'var(--kuro-color-text-muted)',
                    border: `1px solid ${
                      isCustomized ? 'var(--kuro-color-accent)' : 'var(--kuro-color-border)'
                    }`,
                  }}
                >
                  {isCustomized ? 'Custom Override' : `Walkxcode CDN (${autoSlug})`}
                </span>
              </div>

              {!isEditingIcon && (
                <button
                  onClick={() => setIsEditingIcon(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: radius.button,
                    border: '1px solid var(--kuro-color-border)',
                    backgroundColor: 'var(--kuro-color-background)',
                    color: 'var(--kuro-color-text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <EditIcon sx={{ fontSize: 13 }} />
                  Edit Icon
                </button>
              )}
            </div>

            {/* Icon Customizer Form */}
            {isEditingIcon ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Live Preview Box */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.button,
                      border: '1px dashed var(--kuro-color-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--kuro-color-background)',
                      flexShrink: 0,
                    }}
                  >
                    <ContainerIcon
                      container={container}
                      customIcon={iconInputValue || null}
                      size={32}
                    />
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                      Icon Slug or Direct Image URL:
                    </label>
                    <input
                      type="text"
                      value={iconInputValue}
                      onChange={(e) => setIconInputValue(e.target.value)}
                      placeholder="e.g. jellyfin, postgresql, or https://..."
                      style={{
                        padding: '6px 10px',
                        fontSize: 11,
                        borderRadius: radius.input,
                        border: '1px solid var(--kuro-color-border)',
                        backgroundColor: 'var(--kuro-color-background)',
                        color: 'var(--kuro-color-text-primary)',
                        outline: 'none',
                        fontFamily: 'inherit',
                        width: '100%',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--kuro-color-accent)')}
                      onBlur={(e) => (e.target.style.borderColor = 'var(--kuro-color-border)')}
                    />
                  </div>
                </div>

                {/* Preset Suggestions */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)', marginBottom: 6 }}>
                    Quick presets from CDN:
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                      maxHeight: 90,
                      overflowY: 'auto',
                      padding: 2,
                    }}
                  >
                    {POPULAR_ICON_PRESETS.slice(0, 18).map((preset) => (
                      <button
                        key={preset.slug}
                        type="button"
                        onClick={() => handlePresetSelect(preset.slug)}
                        style={{
                          padding: '2px 8px',
                          fontSize: 10,
                          borderRadius: radius.button,
                          border: `1px solid ${
                            iconInputValue.toLowerCase() === preset.slug
                              ? 'var(--kuro-color-accent)'
                              : 'var(--kuro-color-border)'
                          }`,
                          backgroundColor:
                            iconInputValue.toLowerCase() === preset.slug
                              ? 'rgba(var(--kuro-color-accent-rgb, 99, 102, 241), 0.15)'
                              : 'var(--kuro-color-background)',
                          color:
                            iconInputValue.toLowerCase() === preset.slug
                              ? 'var(--kuro-color-accent)'
                              : 'var(--kuro-color-text-secondary)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback message */}
                {saveFeedback && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: 'var(--kuro-color-success)',
                    }}
                  >
                    <CheckIcon sx={{ fontSize: 14 }} />
                    {saveFeedback}
                  </div>
                )}

                {/* Save / Reset / Cancel Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleSaveCustomIcon}
                    style={{
                      padding: '5px 14px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: radius.button,
                      border: 'none',
                      backgroundColor: 'var(--kuro-color-accent)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Save Icon
                  </button>

                  {isCustomized && (
                    <button
                      type="button"
                      onClick={handleResetToAuto}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 12px',
                        fontSize: 11,
                        fontWeight: 500,
                        borderRadius: radius.button,
                        border: '1px solid var(--kuro-color-border)',
                        backgroundColor: 'var(--kuro-color-background)',
                        color: 'var(--kuro-color-text-secondary)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <RestartAltIcon sx={{ fontSize: 13 }} />
                      Reset to Auto
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIconInputValue(currentCustomIcon || '')
                      setIsEditingIcon(false)
                    }}
                    style={{
                      padding: '5px 12px',
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: radius.button,
                      border: '1px solid transparent',
                      backgroundColor: 'transparent',
                      color: 'var(--kuro-color-text-muted)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <Divider />

        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <CircularProgress size={28} sx={{ color: 'var(--kuro-color-accent)' }} />
          </div>
        ) : detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div>
              <Label>Overview</Label>
              <KeyValueTable entries={[
                { label: 'Container ID', value: detail.id },
                { label: 'Image', value: detail.image },
                { label: 'Command', value: detail.command },
              ]} />
            </div>

            <Divider />

            <div>
              <Label>State</Label>
              <KeyValueTable entries={[
                { label: 'Status', value: detail.state.status },
                { label: 'PID', value: detail.state.pid > 0 ? String(detail.state.pid) : '--' },
                { label: 'Exit Code', value: detail.state.exitCode !== 0 ? String(detail.state.exitCode) : '0' },
                ...(detail.state.health ? [{ label: 'Health', value: detail.state.health.status }] : []),
              ]} />
            </div>

            {detail.ports && detail.ports.length > 0 && (
              <>
                <Divider />
                <div>
                  <Label>Ports</Label>
                  {detail.ports.map((p, i) => (
                    <Text key={i}>
                      {p.publicPort ? `${p.ip ?? '*'}:${p.publicPort} \u2192 ` : ''}{p.privatePort}/{p.type}
                    </Text>
                  ))}
                </div>
              </>
            )}

            {detail.mounts && detail.mounts.length > 0 && (
              <>
                <Divider />
                <div>
                  <Label>Mounts</Label>
                  {detail.mounts.map((m, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <Text>{m.source} &rarr; {m.destination}</Text>
                      <Caption>{m.type} &middot; {m.rw ? 'RW' : 'RO'}</Caption>
                    </div>
                  ))}
                </div>
              </>
            )}

            {detail.network && detail.network.length > 0 && (
              <>
                <Divider />
                <div>
                  <Label>Networks</Label>
                  {detail.network.map((n, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <Text>{n.name}</Text>
                      <Caption>IP: {n.ip || '--'} &middot; Gateway: {n.gateway || '--'}</Caption>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <Text color="secondary">No details available.</Text>
          </div>
        )}
      </div>
    </Drawer>
  )
}

