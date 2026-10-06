import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Panel } from '@/components/ui/surface'
import { AppIcon } from '@/components/ui/icons'
import { SettingRow } from '../components/SettingRow'
import { SegmentedControl } from '../components/SegmentedControl'
import { radius } from '@/design/radius'
import { getContainers } from '@/features/docker/api/docker'
import ContainerIcon from '@/features/docker/components/ContainerIcon'
import type { UsePreferencesReturn } from '../hooks/usePreferences'
import type { SelectedDockerContainer } from '../types'

const VIEW_MODE_OPTIONS = [
  { label: 'List', value: 'table' as const },
  { label: 'Grid', value: 'grid' as const },
]

const ORIENTATION_OPTIONS = [
  { label: '0°', value: '0' },
  { label: '90°', value: '90' },
  { label: '180°', value: '180' },
  { label: '270°', value: '270' },
  { label: '360°', value: '360' },
]

// Common quick-add suggestions shown as chip buttons
const QUICK_PATTERNS = [
  '*.sh', '*.log', '*.bak', '*.tmp', '*.swp',
  'Desktop.ini', 'Thumbs.db', '*.DS_Store', '~*',
]

interface DefaultValuesSectionProps {
  prefHook: UsePreferencesReturn
}

export function DefaultValuesSection({ prefHook }: DefaultValuesSectionProps) {
  const { prefs, update } = prefHook

  const extraHiddenPatterns = prefs.files_extra_hidden_patterns || []
  const selectedContainers = prefs.docker_selected_containers || []

  const [patternInput, setPatternInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [selectedToAdd, setSelectedToAdd] = useState<string>('')

  // Query live docker containers list
  const { data: availableContainers = [], isLoading: loadingContainers } = useQuery({
    queryKey: ['docker', 'containers'],
    queryFn: getContainers,
    staleTime: 10_000,
    retry: 1,
  })

  // ── Files Handlers ────────────────────────────────────────────────────────
  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    update({ files_default_path: e.target.value || '/' })
  }

  const handleViewMode = (v: 'table' | 'grid') => {
    update({ files_default_view_mode: v })
  }

  const addPattern = useCallback((raw: string) => {
    const p = raw.trim()
    if (!p) return
    if (extraHiddenPatterns.includes(p)) {
      setInputError('Pattern already added')
      return
    }
    setInputError(null)
    setPatternInput('')
    update({ files_extra_hidden_patterns: [...extraHiddenPatterns, p] })
  }, [extraHiddenPatterns, update])

  const removePattern = useCallback((p: string) => {
    update({ files_extra_hidden_patterns: extraHiddenPatterns.filter((x) => x !== p) })
  }, [extraHiddenPatterns, update])

  const handlePatternKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPattern(patternInput)
    }
  }

  const unusedQuick = QUICK_PATTERNS.filter((p) => !extraHiddenPatterns.includes(p))

  // ── Docker Handlers ───────────────────────────────────────────────────────
  const handleAddContainer = () => {
    if (!selectedToAdd) return
    const container = availableContainers.find((c) => c.id === selectedToAdd || c.name === selectedToAdd)
    if (!container) return

    const cleanName = container.name.replace(/^\//, '')
    if (selectedContainers.some((sc) => sc.name === cleanName || sc.id === container.id)) return
    if (selectedContainers.length >= 6) return

    const newItem: SelectedDockerContainer = {
      id: container.id,
      name: cleanName,
      customLink: '',
    }

    update({ docker_selected_containers: [...selectedContainers, newItem] })
    setSelectedToAdd('')
  }

  const handleRemoveContainer = (index: number) => {
    const nextList = [...selectedContainers]
    nextList.splice(index, 1)
    update({ docker_selected_containers: nextList })
  }

  const handleMoveContainer = (index: number, direction: 'up' | 'down') => {
    const nextList = [...selectedContainers]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= nextList.length) return

    const temp = nextList[index]
    nextList[index] = nextList[targetIndex]
    nextList[targetIndex] = temp
    update({ docker_selected_containers: nextList })
  }

  const handleLinkChange = (index: number, url: string) => {
    const nextList = [...selectedContainers]
    nextList[index] = { ...nextList[index], customLink: url }
    update({ docker_selected_containers: nextList })
  }

  const unselectedContainers = availableContainers.filter(
    (c) =>
      !selectedContainers.some(
        (sc) => sc.id === c.id || sc.name === c.name.replace(/^\//, '')
      )
  )

  return (
    <>
      {/* ── FILES PAGE DEFAULT VALUES ────────────────────────────────────────── */}
      <Panel
        title="FILES PAGE"
        action={
          <span
            style={{
              fontSize: 11,
              color: 'var(--kuro-color-text-muted)',
              fontFamily: 'monospace',
            }}
          >
            account-level
          </span>
        }
        flush
      >
        {/* Default directory */}
        <SettingRow
          label="Default directory"
          hint="Directory opened on first visit of each browser session. Use an absolute path (e.g. /home/user)."
        >
          <input
            type="text"
            value={prefs.files_default_path || '/'}
            onChange={handlePathChange}
            placeholder="/"
            spellCheck={false}
            style={{
              width: 220,
              maxWidth: '100%',
              boxSizing: 'border-box',
              padding: '6px 10px',
              fontSize: 11,
              fontFamily: 'monospace',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.button,
              backgroundColor: 'var(--kuro-color-surface-elevated, var(--kuro-color-surface))',
              color: 'var(--kuro-color-text-primary)',
              outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--kuro-color-accent)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--kuro-color-border)')}
          />
        </SettingRow>

        {/* Default view mode */}
        <SettingRow
          label="Default view"
          hint="Whether to open the file browser in List or Grid mode."
        >
          <SegmentedControl
            options={VIEW_MODE_OPTIONS}
            value={prefs.files_default_view_mode || 'table'}
            onChange={handleViewMode}
            aria-label="Default view mode"
          />
        </SettingRow>

        {/* Extra hidden patterns */}
        <SettingRow
          stacked
          label="Extra hidden files"
          hint="Files and patterns hidden when 'Show hidden' is toggled off in the Files explorer (e.g. *.sh, Desktop.ini, ~*)."
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              width: '100%',
              backgroundColor: 'var(--kuro-color-surface-elevated, rgba(255, 255, 255, 0.02))',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              padding: 16,
              boxSizing: 'border-box',
            }}
          >
            {/* Header / Active tags counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)', letterSpacing: '0.02em' }}>
                Active Patterns
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  borderRadius: radius.badge,
                  backgroundColor: extraHiddenPatterns.length > 0 ? 'rgba(169, 182, 101, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: extraHiddenPatterns.length > 0 ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-muted)',
                  border: `1px solid ${extraHiddenPatterns.length > 0 ? 'rgba(169, 182, 101, 0.3)' : 'var(--kuro-color-border)'}`,
                }}
              >
                {extraHiddenPatterns.length} {extraHiddenPatterns.length === 1 ? 'pattern' : 'patterns'}
              </span>
            </div>

            {/* Current patterns list */}
            {extraHiddenPatterns.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 28 }}>
                {extraHiddenPatterns.map((p) => (
                  <span
                    key={p}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      borderRadius: radius.button,
                      backgroundColor: 'rgba(169, 182, 101, 0.12)',
                      border: '1px solid rgba(169, 182, 101, 0.28)',
                      color: 'var(--kuro-color-text-primary)',
                      fontWeight: 500,
                      transition: 'border-color 150ms, background-color 150ms',
                    }}
                  >
                    <span>{p}</span>
                    <button
                      onClick={() => removePattern(p)}
                      title={`Remove ${p}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: 'var(--kuro-color-text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        lineHeight: 1,
                        fontSize: 13,
                        fontWeight: 600,
                        transition: 'color 150ms, background-color 150ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--kuro-color-danger, #ef4444)'
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--kuro-color-text-muted)'
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: radius.button,
                  border: '1px dashed var(--kuro-color-border)',
                  fontSize: 11,
                  color: 'var(--kuro-color-text-muted)',
                  textAlign: 'center',
                }}
              >
                No custom hidden patterns. Standard hidden files (e.g. <code>.git</code>, <code>.env</code>) are hidden by default.
              </div>
            )}

            {/* Add pattern input bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', width: '100%' }}>
                <input
                  type="text"
                  value={patternInput}
                  onChange={(e) => { setPatternInput(e.target.value); setInputError(null) }}
                  onKeyDown={handlePatternKeyDown}
                  placeholder="Type pattern (e.g. *.sh, *.backup, temp_*) and press Enter..."
                  spellCheck={false}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '8px 12px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    border: `1px solid ${inputError ? 'var(--kuro-color-danger, #ef4444)' : 'var(--kuro-color-border)'}`,
                    borderRadius: radius.button,
                    backgroundColor: 'var(--kuro-color-surface)',
                    color: 'var(--kuro-color-text-primary)',
                    outline: 'none',
                    transition: 'border-color 150ms',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--kuro-color-accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = inputError ? 'var(--kuro-color-danger, #ef4444)' : 'var(--kuro-color-border)')}
                />
                <button
                  onClick={() => addPattern(patternInput)}
                  disabled={!patternInput.trim()}
                  style={{
                    padding: '8px 18px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: radius.button,
                    border: 'none',
                    backgroundColor: patternInput.trim() ? 'var(--kuro-color-accent)' : 'rgba(255, 255, 255, 0.05)',
                    color: patternInput.trim() ? '#000' : 'var(--kuro-color-text-muted)',
                    cursor: patternInput.trim() ? 'pointer' : 'default',
                    transition: 'background-color 150ms, color 150ms, opacity 150ms',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>+</span> Add Pattern
                </button>
              </div>
              {inputError && (
                <p style={{ fontSize: 11, color: 'var(--kuro-color-danger, #ef4444)', margin: '2px 0 0' }}>
                  {inputError}
                </p>
              )}
            </div>

            {/* Quick-add suggestions presets */}
            {unusedQuick.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6, borderTop: '1px solid var(--kuro-color-border)' }}>
                <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Quick Add Presets
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {unusedQuick.map((p) => (
                    <button
                      key={p}
                      onClick={() => addPattern(p)}
                      title={`Quick add ${p}`}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        borderRadius: radius.badge,
                        border: '1px solid var(--kuro-color-border)',
                        backgroundColor: 'var(--kuro-color-surface)',
                        color: 'var(--kuro-color-text-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'background-color 150ms, color 150ms, border-color 150ms, transform 100ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(169, 182, 101, 0.15)'
                        e.currentTarget.style.color = 'var(--kuro-color-accent)'
                        e.currentTarget.style.borderColor = 'var(--kuro-color-accent)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface)'
                        e.currentTarget.style.color = 'var(--kuro-color-text-secondary)'
                        e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
                      }}
                    >
                      <span style={{ color: 'var(--kuro-color-accent)', fontWeight: 700 }}>+</span> {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SettingRow>
      </Panel>

      {/* ── DOCKER HOMEPAGE WIDGET DEFAULT VALUES ─────────────────────────────── */}
      <Panel
        title="DOCKER HOMEPAGE WIDGET"
        action={
          <span
            style={{
              fontSize: 11,
              color: 'var(--kuro-color-text-muted)',
              fontFamily: 'monospace',
            }}
          >
            {`${selectedContainers.length} / 6 selected`}
          </span>
        }
      >
        <div>
          <p style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Select 1 to 6 containers to feature on the homepage Docker widget. Rearrange their display order and optionally attach a custom app launch URL to open it in a new tab when clicked.
          </p>

          {/* Selected Containers List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {selectedContainers.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  borderRadius: radius.card,
                  border: '1px dashed var(--kuro-color-border)',
                  backgroundColor: 'var(--kuro-color-surface-elevated, rgba(255,255,255,0.02))',
                  textAlign: 'center',
                  fontSize: 11,
                  color: 'var(--kuro-color-text-muted)',
                }}
              >
                No custom containers selected. The homepage widget currently displays auto-grouped containers.
              </div>
            ) : (
              selectedContainers.map((item, idx) => (
                <div
                  key={item.id || item.name}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: radius.card,
                    border: '1px solid var(--kuro-color-border)',
                    backgroundColor: 'var(--kuro-color-surface-elevated, var(--kuro-color-surface))',
                    minWidth: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
                    {/* Position Badge & Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: 'var(--kuro-color-accent)',
                          color: '#000',
                          flexShrink: 0,
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <div style={{ flexShrink: 0, display: 'inline-flex' }}>
                        <ContainerIcon container={item.name} size={22} />
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--kuro-color-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    </div>

                    {/* Controls: Reorder & Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => handleMoveContainer(idx, 'up')}
                        disabled={idx === 0}
                        title="Move Up"
                        style={{
                          padding: '4px 8px',
                          fontSize: 10,
                          borderRadius: radius.button,
                          border: '1px solid var(--kuro-color-border)',
                          backgroundColor: 'transparent',
                          color: 'var(--kuro-color-text-secondary)',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          opacity: idx === 0 ? 0.3 : 1,
                          flexShrink: 0,
                        }}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveContainer(idx, 'down')}
                        disabled={idx === selectedContainers.length - 1}
                        title="Move Down"
                        style={{
                          padding: '4px 8px',
                          fontSize: 10,
                          borderRadius: radius.button,
                          border: '1px solid var(--kuro-color-border)',
                          backgroundColor: 'transparent',
                          color: 'var(--kuro-color-text-secondary)',
                          cursor: idx === selectedContainers.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: idx === selectedContainers.length - 1 ? 0.3 : 1,
                          flexShrink: 0,
                        }}
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => handleRemoveContainer(idx)}
                        title="Remove"
                        style={{
                          padding: '2px 4px',
                          fontSize: 12,
                          borderRadius: radius.button,
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: 'var(--kuro-color-danger, #ef4444)',
                          cursor: 'pointer',
                          marginLeft: 2,
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <AppIcon name="x" size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Custom App Launch Link Input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap', minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', flexShrink: 0 }}>
                      App URL:
                    </span>
                    <input
                      type="text"
                      value={item.customLink || ''}
                      onChange={(e) => handleLinkChange(idx, e.target.value)}
                      placeholder="http://192.168.1.50:8080 or https://app.domain.com"
                      spellCheck={false}
                      style={{
                        flex: '1 1 180px',
                        minWidth: 0,
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.button,
                        backgroundColor: 'var(--kuro-color-surface)',
                        color: 'var(--kuro-color-text-primary)',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--kuro-color-accent)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--kuro-color-border)')}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add New Container Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)' }}>
              Add container to homepage widget
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
              <select
                value={selectedToAdd}
                onChange={(e) => setSelectedToAdd(e.target.value)}
                disabled={loadingContainers || selectedContainers.length >= 6}
                style={{
                  flex: '1 1 200px',
                  minWidth: 0,
                  maxWidth: '100%',
                  padding: '7px 10px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  border: '1px solid var(--kuro-color-border)',
                  borderRadius: radius.button,
                  backgroundColor: 'var(--kuro-color-surface-elevated, var(--kuro-color-surface))',
                  color: 'var(--kuro-color-text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">
                  {loadingContainers
                    ? 'Loading Docker containers...'
                    : unselectedContainers.length === 0
                    ? 'No remaining containers'
                    : 'Select a container...'}
                </option>
                {unselectedContainers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name.replace(/^\//, '')} ({c.state})
                  </option>
                ))}
              </select>

              <button
                onClick={handleAddContainer}
                disabled={!selectedToAdd || selectedContainers.length >= 6}
                style={{
                  flexShrink: 0,
                  padding: '7px 16px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: radius.button,
                  border: 'none',
                  backgroundColor:
                    selectedToAdd && selectedContainers.length < 6
                      ? 'var(--kuro-color-accent)'
                      : 'var(--kuro-color-surface-elevated, var(--kuro-color-border))',
                  color: selectedToAdd && selectedContainers.length < 6 ? '#000' : 'var(--kuro-color-text-muted)',
                  cursor: selectedToAdd && selectedContainers.length < 6 ? 'pointer' : 'default',
                  transition: 'background-color 150ms, color 150ms',
                }}
              >
                + Add
              </button>
            </div>
            {selectedContainers.length >= 6 && (
              <p style={{ fontSize: 10, color: 'var(--kuro-color-warning, #f59e0b)', margin: '4px 0 0' }}>
                Maximum limit of 6 containers reached for the widget grid.
              </p>
            )}
          </div>
        </div>
      </Panel>

      {/* ── CAMERA PAGE DEFAULT VALUES ─────────────────────────────────── */}
      <Panel
        title="CAMERA PAGE"
        action={
          <span
            style={{
              fontSize: 11,
              color: 'var(--kuro-color-text-muted)',
              fontFamily: 'monospace',
            }}
          >
            account-level
          </span>
        }
        flush
      >
        <SettingRow
          label="Default orientation"
          hint="The starting orientation mode of the camera feed viewer each time you open the camera page."
        >
          <SegmentedControl
            options={ORIENTATION_OPTIONS}
            value={
              prefs.camera_default_orientation === 'portrait'
                ? '90'
                : prefs.camera_default_orientation === 'landscape'
                ? '0'
                : prefs.camera_default_orientation || '0'
            }
            onChange={(v: string) => update({ camera_default_orientation: v })}
            aria-label="Default camera orientation"
          />
        </SettingRow>
      </Panel>
    </>
  )
}
