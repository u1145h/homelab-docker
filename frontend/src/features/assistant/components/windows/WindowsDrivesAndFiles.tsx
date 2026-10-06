import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import {
  getClientFiles,
  getClientFileRoots,
  getClientFileContentUrl,
  deleteClientFile,
  mkdirClientFile,
} from '../../api/assistant'
import { useSnackbar } from '@/hooks/useSnackbar'
import type { KuroNode, ClientFileItem, ClientFileRoot } from '../../types'

interface WindowsDrivesAndFilesProps {
  node: KuroNode | null
  nodeId: string
  snapshot: any
  onRefresh?: () => void
}

const monoFont = 'var(--kuro-font-mono, "Space Mono", monospace)'

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(timestamp?: number | string): string {
  if (!timestamp) return '—'
  const date = typeof timestamp === 'number' ? new Date(timestamp > 1e11 ? timestamp : timestamp * 1000) : new Date(timestamp)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const WindowsDrivesAndFiles: React.FC<WindowsDrivesAndFilesProps> = ({
  node,
  nodeId,
  snapshot,
}) => {
  const { showSnackbar } = useSnackbar()

  // Telemetry Drives
  const telemetry = snapshot || node?.telemetry || {}
  const storageList: any[] = Array.isArray(telemetry?.storage)
    ? telemetry.storage
    : Array.isArray((node?.telemetry as any)?.storage)
    ? (node?.telemetry as any).storage
    : []

  // File Explorer State
  const [currentPath, setCurrentPath] = useState<string>('C:\\')
  const [pathInput, setPathInput] = useState<string>('C:\\')
  const [files, setFiles] = useState<ClientFileItem[]>([])
  const [roots, setRoots] = useState<ClientFileRoot[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [newFolderName, setNewFolderName] = useState<string>('')
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false)

  // Load roots
  const fetchRoots = useCallback(async () => {
    if (!nodeId) return
    try {
      const res = await getClientFileRoots(nodeId)
      if (res?.roots?.length) {
        setRoots(res.roots)
      }
    } catch {
      // Fallback to telemetry drives
    }
  }, [nodeId])

  // Load Directory
  const loadDirectory = useCallback(
    async (targetPath: string) => {
      if (!nodeId) return
      setLoading(true)
      try {
        const res = await getClientFiles(nodeId, targetPath)
        setFiles(res?.files || [])
        setCurrentPath(res?.current_path || targetPath)
        setPathInput(res?.current_path || targetPath)
      } catch (err: any) {
        showSnackbar(`Failed to open path: ${err?.message || 'Access Denied'}`, 'error')
      } finally {
        setLoading(false)
      }
    },
    [nodeId, showSnackbar]
  )

  useEffect(() => {
    fetchRoots()
    loadDirectory('C:\\')
  }, [fetchRoots, loadDirectory])

  // Navigate Up
  const handleNavigateUp = () => {
    const clean = currentPath.replace(/[\\/]+$/, '')
    const idx = Math.max(clean.lastIndexOf('\\'), clean.lastIndexOf('/'))
    if (idx > 2) {
      const parent = clean.substring(0, idx)
      loadDirectory(parent)
    } else if (clean.length > 3) {
      loadDirectory(clean.substring(0, 3)) // Return to C:\ root
    }
  }

  // Create Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !nodeId) return
    try {
      await mkdirClientFile(nodeId, currentPath, newFolderName.trim())
      showSnackbar(`Folder "${newFolderName}" created`, 'success')
      setNewFolderName('')
      setShowNewFolderModal(false)
      loadDirectory(currentPath)
    } catch (e: any) {
      showSnackbar(`Failed to create directory: ${e?.message || 'Error'}`, 'error')
    }
  }

  // Delete Item
  const handleDeleteItem = async (filePath: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from Windows?`)) return
    try {
      await deleteClientFile(nodeId, filePath)
      showSnackbar(`Deleted ${name}`, 'info')
      loadDirectory(currentPath)
    } catch (e: any) {
      showSnackbar(`Failed to delete: ${e?.message || 'Error'}`, 'error')
    }
  }

  const getFileIcon = (file: ClientFileItem) => {
    if (file.is_dir) return 'folder'
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (['exe', 'msi', 'bat', 'cmd', 'ps1'].includes(ext)) return 'terminal'
    if (['zip', 'rar', '7z', 'tar', 'gz', 'iso'].includes(ext)) return 'archive'
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg'].includes(ext)) return 'image'
    if (['mp3', 'flac', 'wav', 'aac', 'm4a'].includes(ext)) return 'music'
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return 'video'
    if (['pdf', 'docx', 'doc', 'txt', 'md', 'json', 'log'].includes(ext)) return 'file-text'
    return 'file'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 1. Windows Partition & Volume Deck ── */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface, #18191a)',
          border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
          borderRadius: radius.card,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: 'rgba(184, 187, 38, 0.15)',
                color: 'var(--kuro-color-primary, #b8bb26)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="hard-drive" size={16} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--kuro-color-text-primary)' }}>
              Windows Drive Partitions (NTFS / ReFS)
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            {storageList.length} {storageList.length === 1 ? 'Volume' : 'Volumes'} Detected
          </span>
        </div>

        {storageList.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {storageList.map((disk, idx) => {
              const total = disk.total_gb || 0
              const free = disk.free_gb || 0
              const used = total > free ? total - free : 0
              const pct = total > 0 ? Math.round((used / total) * 100) : 0
              const mountLetter = disk.mount || disk.name || `Drive ${idx + 1}`

              return (
                <div
                  key={mountLetter + idx}
                  onClick={() => loadDirectory(mountLetter.endsWith('\\') ? mountLetter : `${mountLetter}\\`)}
                  style={{
                    backgroundColor: currentPath.startsWith(mountLetter) ? 'rgba(184, 187, 38, 0.08)' : 'rgba(0,0,0,0.25)',
                    border: `1px solid ${currentPath.startsWith(mountLetter) ? 'var(--kuro-color-primary, #b8bb26)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: monoFont, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                      💽 {mountLetter}
                    </span>
                    <span style={{ fontFamily: monoFont, fontSize: 12, fontWeight: 700, color: pct > 85 ? '#ea6962' : '#8ec07c' }}>
                      {pct}% Used
                    </span>
                  </div>

                  <div style={{ width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, pct))}%`,
                        height: '100%',
                        backgroundColor: pct > 85 ? '#ea6962' : '#8ec07c',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                    <span>{used.toFixed(1)} GB used</span>
                    <span>{free.toFixed(1)} GB free</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)', textAlign: 'center', padding: '12px 0' }}>
            No disk partitions reported
          </div>
        )}
      </div>

      {/* ── 2. Windows Path Navigator & Quick Access Toolbar ── */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface, #18191a)',
          border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
          borderRadius: radius.card,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}
      >
        {/* Windows Quick Access Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>
            Quick Access:
          </span>
          {(() => {
            // Strictly filter out any Android or Unix paths
            const cleanRoots = roots.filter(
              (r) =>
                r.path &&
                !r.path.startsWith('/storage') &&
                !r.path.startsWith('/sdcard') &&
                !r.name.toLowerCase().includes('whatsapp') &&
                !r.name.toLowerCase().includes('internal storage') &&
                !r.name.toLowerCase().includes('dcim')
            )

            const displayList =
              cleanRoots.length > 0
                ? cleanRoots
                : [
                    { name: 'Desktop', path: 'Desktop' },
                    { name: 'Documents', path: 'Documents' },
                    { name: 'Downloads', path: 'Downloads' },
                    { name: 'Pictures', path: 'Pictures' },
                    { name: 'Music', path: 'Music' },
                    { name: 'Videos', path: 'Videos' },
                  ]

            return displayList.map((qa) => (
              <button
                key={qa.name + qa.path}
                onClick={() => loadDirectory(qa.path)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: currentPath.includes(qa.name) ? 'rgba(184, 187, 38, 0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${currentPath.includes(qa.name) ? 'var(--kuro-color-primary, #b8bb26)' : 'rgba(255,255,255,0.08)'}`,
                  color: currentPath.includes(qa.name) ? 'var(--kuro-color-primary, #b8bb26)' : 'var(--kuro-color-text-secondary, #a89984)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                📁 {qa.name}
              </button>
            ))
          })()}
        </div>

        {/* Path Input Bar & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleNavigateUp}
            title="Navigate Up"
            style={{
              padding: '8px 12px',
              borderRadius: radius.button,
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--kuro-color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <AppIcon name="arrow-up" size={15} />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              loadDirectory(pathInput)
            }}
            style={{ flex: 1, display: 'flex' }}
          >
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="C:\Path\To\Directory"
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: radius.button,
                color: 'var(--kuro-color-text-primary)',
                fontFamily: monoFont,
                fontSize: 12.5,
                outline: 'none',
              }}
            />
          </form>

          <button
            onClick={() => loadDirectory(currentPath)}
            title="Refresh Directory"
            style={{
              padding: '8px 12px',
              borderRadius: radius.button,
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--kuro-color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <AppIcon name="refresh-cw" size={15} />
          </button>

          <button
            onClick={() => setShowNewFolderModal(true)}
            title="New Folder"
            style={{
              padding: '8px 12px',
              borderRadius: radius.button,
              backgroundColor: 'var(--kuro-color-primary, #b8bb26)',
              border: 'none',
              color: '#14161b',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <AppIcon name="folder-plus" size={15} />
            <span>New Folder</span>
          </button>
        </div>

        {/* ── 3. File Explorer List / Table ── */}
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 8,
            overflow: 'hidden',
            maxHeight: 520,
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 13 }}>
              Loading Windows directory...
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 13 }}>
              This directory is empty or access is restricted
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--kuro-color-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>Name</th>
                  <th style={{ padding: '10px 14px', width: 120 }}>Size</th>
                  <th style={{ padding: '10px 14px', width: 160 }}>Date Modified</th>
                  <th style={{ padding: '10px 14px', width: 80, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.path || file.name}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* File Name & Click Handler */}
                    <td style={{ padding: '8px 14px' }}>
                      <div
                        onClick={() => {
                          if (file.is_dir) {
                            loadDirectory(file.path)
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: file.is_dir ? 'pointer' : 'default',
                          color: file.is_dir ? 'var(--kuro-color-primary, #b8bb26)' : 'var(--kuro-color-text-primary)',
                          fontWeight: file.is_dir ? 700 : 500,
                        }}
                      >
                        <AppIcon name={getFileIcon(file) as any} size={16} />
                        <span style={{ wordBreak: 'break-all' }}>{file.name}</span>
                      </div>
                    </td>

                    {/* Size */}
                    <td style={{ padding: '8px 14px', fontFamily: monoFont, color: 'var(--kuro-color-text-muted)', fontSize: 11.5 }}>
                      {file.is_dir ? '—' : formatBytes(file.size)}
                    </td>

                    {/* Date Modified */}
                    <td style={{ padding: '8px 14px', fontFamily: monoFont, color: 'var(--kuro-color-text-muted)', fontSize: 11.5 }}>
                      {formatDate(file.last_modified)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {!file.is_dir && (
                          <a
                            href={getClientFileContentUrl(nodeId, file.path, true)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download File"
                            style={{
                              color: 'var(--kuro-color-text-secondary)',
                              padding: 4,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <AppIcon name="download" size={14} />
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteItem(file.path, file.name)}
                          title="Delete"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--kuro-color-text-muted)',
                            padding: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <AppIcon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div
          onClick={() => setShowNewFolderModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--kuro-color-surface, #1e1e1e)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              width: '100%',
              maxWidth: 420,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
              Create New Folder on Windows
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder Name"
              autoFocus
              style={{
                padding: '8px 12px',
                borderRadius: radius.button,
                backgroundColor: 'var(--kuro-color-bg)',
                border: '1px solid var(--kuro-color-border)',
                color: 'var(--kuro-color-text-primary)',
                fontSize: 13,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowNewFolderModal(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: radius.button,
                  backgroundColor: 'transparent',
                  border: '1px solid var(--kuro-color-border)',
                  color: 'var(--kuro-color-text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                style={{
                  padding: '6px 14px',
                  borderRadius: radius.button,
                  backgroundColor: 'var(--kuro-color-primary, #b8bb26)',
                  border: 'none',
                  color: '#14161b',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default WindowsDrivesAndFiles
