import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Folder,
  FolderPlus,
  File,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  ArrowUp,
  RotateCw,
  UploadCloud,
  Download,
  Eye,
  Trash2,
  Edit2,
  Search,
  HardDrive,
  Server,
  Check,
  AlertCircle,
  Copy,
  ChevronRight,
  Grid,
  List,
  X,
} from 'lucide-react'
import { formatDateTime } from '@/utils/format'
import * as api from '../api/assistant'
import type { ClientFileItem, ClientFileRoot, ClientFilesResponse } from '../types'

interface ClientFtpFileManagerProps {
  nodeId: string
  deviceName?: string
  platform?: string
}

const monoFont = "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace"
const radius = { card: 12, button: 8, input: 8, pill: 20 }

export const ClientFtpFileManager: React.FC<ClientFtpFileManagerProps> = ({
  nodeId,
  deviceName: _deviceName = 'Device',
  platform: _platform = 'android',
}) => {
  const [currentPath, setCurrentPath] = useState<string>('/storage/emulated/0')
  const [addressInput, setAddressInput] = useState<string>('/storage/emulated/0')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [files, setFiles] = useState<ClientFileItem[]>([])
  const [roots, setRoots] = useState<ClientFileRoot[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table')
  const [copiedPath, setCopiedPath] = useState<boolean>(false)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [hoveredRoot, setHoveredRoot] = useState<string | null>(null)

  // Modals state
  const [previewFile, setPreviewFile] = useState<ClientFileItem | null>(null)
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState<boolean>(false)

  const [uploading, setUploading] = useState<boolean>(false)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState<boolean>(false)

  const [newFolderOpen, setNewFolderOpen] = useState<boolean>(false)
  const [newFolderName, setNewFolderName] = useState<string>('')
  const [actionLoading, setActionLoading] = useState<boolean>(false)

  const [renameFile, setRenameFile] = useState<ClientFileItem | null>(null)
  const [renameNewName, setRenameNewName] = useState<string>('')

  const [deleteTarget, setDeleteTarget] = useState<ClientFileItem | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch directory listing
  const fetchDirectory = useCallback(
    async (path: string) => {
      setLoading(true)
      setError(null)
      try {
        const res: ClientFilesResponse = await api.getClientFiles(nodeId, path)
        if (res.error) {
          setError(res.error)
        } else {
          setCurrentPath(res.current_path)
          setAddressInput(res.current_path)
          setParentPath(res.parent_path ?? null)
          setFiles(res.files || [])
          if (res.roots && res.roots.length > 0) {
            setRoots(res.roots)
          }
        }
      } catch (err: any) {
        let msg = 'Failed to connect to device filesystem'
        const raw = err.response?.data
        if (typeof raw === 'object' && raw?.error) {
          msg = raw.error
        } else if (typeof raw === 'string' && raw.trim()) {
          try {
            const parsed = JSON.parse(raw)
            msg = parsed.error || raw
          } catch {
            msg = raw
          }
        } else if (err.message) {
          msg = err.message
        }
        if (msg.includes('not connected') || msg.includes('timed out') || msg.includes('502') || msg.includes('Bad Gateway')) {
          msg = `Device (${nodeId || 'Android'}) is currently offline or unreachable over live WebSocket. Ensure Kuro Assistant / Ghost is running and connected on your device.`
        }
        setError(msg)
      } finally {
        setLoading(false)
      }
    },
    [nodeId]
  )

  // Fetch roots on load
  useEffect(() => {
    let isMounted = true
    api
      .getClientFileRoots(nodeId)
      .then((res) => {
        if (isMounted && res.roots && res.roots.length > 0) {
          setRoots(res.roots)
        }
      })
      .catch(() => {
        if (isMounted) {
          setRoots([
            { name: 'Internal Storage', path: '/storage/emulated/0', icon: 'hard-drive', is_primary: true },
            { name: 'Downloads', path: '/storage/emulated/0/Download', icon: 'folder' },
            { name: 'Camera (DCIM)', path: '/storage/emulated/0/DCIM/Camera', icon: 'camera' },
            { name: 'Pictures', path: '/storage/emulated/0/Pictures', icon: 'image' },
            { name: 'Documents', path: '/storage/emulated/0/Documents', icon: 'file-text' },
            { name: 'Music', path: '/storage/emulated/0/Music', icon: 'music' },
            { name: 'Movies', path: '/storage/emulated/0/Movies', icon: 'film' },
            { name: 'WhatsApp Media', path: '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media', icon: 'layers' },
          ])
        }
      })
    return () => {
      isMounted = false
    }
  }, [nodeId])

  // Initial fetch
  useEffect(() => {
    fetchDirectory(currentPath)
  }, [fetchDirectory])

  // Navigate to target path
  const handleNavigate = (path: string) => {
    if (!path) return
    fetchDirectory(path)
  }

  // Go to parent directory
  const handleGoUp = () => {
    if (parentPath) {
      handleNavigate(parentPath)
    } else {
      const parts = currentPath.replace(/\/$/, '').split('/')
      if (parts.length > 1) {
        parts.pop()
        const up = parts.join('/') || '/'
        handleNavigate(up)
      }
    }
  }

  // Handle direct address bar submit
  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (addressInput.trim()) {
      handleNavigate(addressInput.trim())
    }
  }

  // Copy current FTP path
  const handleCopyPath = () => {
    navigator.clipboard.writeText(currentPath)
    setCopiedPath(true)
    setTimeout(() => setCopiedPath(false), 2000)
  }

  // Filtered files
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files
    const q = searchQuery.toLowerCase().trim()
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.extension && f.extension.toLowerCase().includes(q)) ||
        (f.mime_type && f.mime_type.toLowerCase().includes(q))
    )
  }, [files, searchQuery])

  // Format file size
  const formatSize = (bytes: number, isDir: boolean) => {
    if (isDir) return '<DIR>'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  // Format date
  const formatDate = (ms: number) => {
    return formatDateTime(ms)
  }

  // File Icon helper with vibrant theme colors
  const getFileIcon = (file: ClientFileItem, size = 16) => {
    if (file.is_dir) return <Folder size={size} style={{ color: '#fabd2f', flexShrink: 0 }} />
    const ext = file.extension?.toLowerCase() || ''
    const mime = file.mime_type?.toLowerCase() || ''

    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
      return <ImageIcon size={size} style={{ color: '#7dcfff', flexShrink: 0 }} />
    }
    if (mime.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov', 'avi', '3gp'].includes(ext)) {
      return <Film size={size} style={{ color: '#bb9af7', flexShrink: 0 }} />
    }
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
      return <Music size={size} style={{ color: '#9ece6a', flexShrink: 0 }} />
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return <Archive size={size} style={{ color: '#ff9e64', flexShrink: 0 }} />
    }
    if (['txt', 'log', 'json', 'xml', 'md', 'html', 'css', 'js', 'ts', 'yaml', 'yml', 'py', 'go', 'kt', 'java'].includes(ext)) {
      return <FileText size={size} style={{ color: '#7aa2f7', flexShrink: 0 }} />
    }
    return <File size={size} style={{ color: 'var(--kuro-color-text-muted, #71717a)', flexShrink: 0 }} />
  }

  // Handle file preview
  const handleOpenPreview = async (file: ClientFileItem) => {
    setPreviewFile(file)
    setPreviewTextContent(null)
    const ext = file.extension?.toLowerCase() || ''
    const mime = file.mime_type?.toLowerCase() || ''

    const isText =
      mime.startsWith('text/') ||
      ['txt', 'log', 'json', 'xml', 'md', 'html', 'css', 'js', 'ts', 'yaml', 'yml', 'py', 'go', 'kt', 'java', 'ini', 'conf', 'gradle', 'properties'].includes(
        ext
      )

    if (isText) {
      setPreviewLoading(true)
      try {
        const url = api.getClientFileContentUrl(nodeId, file.path)
        const res = await fetch(url)
        const text = await res.text()
        setPreviewTextContent(text)
      } catch (err) {
        setPreviewTextContent('Failed to load text preview.')
      } finally {
        setPreviewLoading(false)
      }
    }
  }

  // Handle File Upload
  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    setError(null)
    setUploadSuccess(null)
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        await api.uploadClientFile(nodeId, currentPath, file)
      }
      setUploadSuccess(`Successfully uploaded ${fileList.length} file(s) to device`)
      setTimeout(() => setUploadSuccess(null), 4000)
      fetchDirectory(currentPath)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'File upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Handle New Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    setActionLoading(true)
    setError(null)
    try {
      await api.mkdirClientFile(nodeId, currentPath, newFolderName.trim())
      setNewFolderOpen(false)
      setNewFolderName('')
      fetchDirectory(currentPath)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create folder')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Rename
  const handleExecuteRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameFile || !renameNewName.trim()) return
    setActionLoading(true)
    setError(null)
    try {
      await api.renameClientFile(nodeId, renameFile.path, renameNewName.trim())
      setRenameFile(null)
      setRenameNewName('')
      fetchDirectory(currentPath)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to rename file')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Delete
  const handleExecuteDelete = async () => {
    if (!deleteTarget) return
    setActionLoading(true)
    setError(null)
    try {
      await api.deleteClientFile(nodeId, deleteTarget.path)
      setDeleteTarget(null)
      fetchDirectory(currentPath)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete file')
    } finally {
      setActionLoading(false)
    }
  }

  // Breadcrumbs builder
  const breadcrumbs = useMemo(() => {
    const segments = currentPath.split('/').filter(Boolean)
    const crumbs: { name: string; path: string }[] = [{ name: 'root', path: '/' }]
    let acc = ''
    for (const seg of segments) {
      acc += `/${seg}`
      crumbs.push({ name: seg, path: acc })
    }
    return crumbs
  }, [currentPath])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: '100%',
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        handleUploadFiles(e.dataTransfer.files)
      }}
    >
      {/* Hidden File Input for Clean Upload Trigger */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        onChange={(e) => handleUploadFiles(e.target.files)}
      />

      {/* ─── 1. Main Navigation Card (Address Bar, Roots, & Actions) ─── */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface, #14171d)',
          border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
          borderRadius: radius.card,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Top Control Bar: FTP Address + Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {/* FTP Protocol Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              backgroundColor: 'rgba(166, 209, 137, 0.1)',
              border: '1px solid rgba(166, 209, 137, 0.2)',
              borderRadius: radius.input,
              color: 'var(--kuro-color-primary, #a6d189)',
              fontSize: 12,
              fontFamily: monoFont,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <Server size={13} style={{ color: 'var(--kuro-color-primary, #a6d189)' }} />
            <span>ftp://{nodeId.substring(0, 8)}</span>
          </div>

          {/* Editable Path Input */}
          <form
            onSubmit={handleAddressSubmit}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              minWidth: 240,
              position: 'relative',
            }}
          >
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="/storage/emulated/0/..."
              style={{
                width: '100%',
                backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                borderRadius: radius.input,
                padding: '7px 75px 7px 12px',
                fontSize: 12.5,
                fontFamily: monoFont,
                color: 'var(--kuro-color-text-primary, #e2e8f0)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--kuro-color-primary, #a6d189)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--kuro-color-border, rgba(255, 255, 255, 0.08))')}
            />
            <div style={{ position: 'absolute', right: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={handleCopyPath}
                title="Copy Path"
                style={{
                  background: 'none',
                  border: 'none',
                  color: copiedPath ? '#a6d189' : 'var(--kuro-color-text-muted, #71717a)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 4,
                }}
              >
                {copiedPath ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button
                type="submit"
                style={{
                  padding: '4px 10px',
                  backgroundColor: 'var(--kuro-color-primary, #a6d189)',
                  color: '#14171d',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
              >
                Go
              </button>
            </div>
          </form>

          {/* Action Toolbar Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Up Button */}
            <button
              type="button"
              onClick={handleGoUp}
              disabled={currentPath === '/' || loading}
              title="Go Up to parent folder"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                borderRadius: radius.button,
                color: 'var(--kuro-color-text-primary, #e2e8f0)',
                fontSize: 12,
                fontWeight: 600,
                cursor: currentPath === '/' || loading ? 'not-allowed' : 'pointer',
                opacity: currentPath === '/' || loading ? 0.4 : 1,
                transition: 'background-color 0.15s',
              }}
            >
              <ArrowUp size={14} />
              <span>Up</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchDirectory(currentPath)}
              disabled={loading}
              title="Refresh directory"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '7px 10px',
                backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                borderRadius: radius.button,
                color: 'var(--kuro-color-text-primary, #e2e8f0)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                backgroundColor: 'var(--kuro-color-primary, #a6d189)',
                color: '#14171d',
                border: 'none',
                borderRadius: radius.button,
                fontSize: 12,
                fontWeight: 700,
                cursor: uploading || loading ? 'not-allowed' : 'pointer',
                opacity: uploading || loading ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(166, 209, 137, 0.25)',
              }}
            >
              <UploadCloud size={15} />
              <span>{uploading ? 'Uploading...' : 'Upload'}</span>
            </button>

            {/* New Folder Button */}
            <button
              type="button"
              onClick={() => {
                setNewFolderName('')
                setNewFolderOpen(true)
              }}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                borderRadius: radius.button,
                color: 'var(--kuro-color-text-primary, #e2e8f0)',
                fontSize: 12,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <FolderPlus size={14} style={{ color: '#fabd2f' }} />
              <span>New Folder</span>
            </button>
          </div>
        </div>

        {/* Interactive Breadcrumb Trail */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            overflowX: 'auto',
            paddingTop: 8,
            borderTop: '1px solid var(--kuro-color-border-subtle, rgba(255, 255, 255, 0.04))',
            fontSize: 11.5,
          }}
        >
          <HardDrive size={13} style={{ color: 'var(--kuro-color-primary, #a6d189)', marginRight: 4, flexShrink: 0 }} />
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <React.Fragment key={crumb.path}>
                {idx > 0 && <ChevronRight size={11} style={{ color: 'var(--kuro-color-text-muted, #71717a)', flexShrink: 0 }} />}
                <button
                  type="button"
                  onClick={() => handleNavigate(crumb.path)}
                  style={{
                    background: isLast ? 'rgba(166, 209, 137, 0.12)' : 'none',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 6px',
                    color: isLast ? 'var(--kuro-color-primary, #a6d189)' : 'var(--kuro-color-text-secondary, #94a3b8)',
                    fontWeight: isLast ? 700 : 500,
                    fontFamily: monoFont,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {/* Quick Storage Bookmarks Chips */}
        {roots.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              paddingTop: 4,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted, #71717a)', fontWeight: 600, flexShrink: 0, marginRight: 2 }}>
              Quick:
            </span>
            {roots.map((root) => {
              const isActive = currentPath.startsWith(root.path)
              const isHovered = hoveredRoot === root.path
              return (
                <button
                  key={root.path}
                  type="button"
                  onClick={() => handleNavigate(root.path)}
                  onMouseEnter={() => setHoveredRoot(root.path)}
                  onMouseLeave={() => setHoveredRoot(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 9px',
                    borderRadius: radius.pill,
                    backgroundColor: isActive
                      ? 'rgba(166, 209, 137, 0.15)'
                      : isHovered
                      ? 'var(--kuro-color-surface-hover, #1a1e26)'
                      : 'var(--kuro-color-bg, #0d0f12)',
                    border: isActive
                      ? '1px solid rgba(166, 209, 137, 0.3)'
                      : '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                    color: isActive ? 'var(--kuro-color-primary, #a6d189)' : 'var(--kuro-color-text-secondary, #94a3b8)',
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Folder size={11} style={{ color: isActive ? 'var(--kuro-color-primary, #a6d189)' : '#fabd2f' }} />
                  <span>{root.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            backgroundColor: 'rgba(235, 111, 146, 0.12)',
            border: '1px solid rgba(235, 111, 146, 0.3)',
            borderRadius: radius.card,
            color: '#eb6f92',
            fontSize: 12.5,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button"
            onClick={() => fetchDirectory(currentPath)}
            style={{
              background: 'rgba(235, 111, 146, 0.2)',
              border: '1px solid rgba(235, 111, 146, 0.4)',
              borderRadius: 4,
              color: '#eb6f92',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#eb6f92', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            backgroundColor: 'rgba(166, 209, 137, 0.12)',
            border: '1px solid rgba(166, 209, 137, 0.3)',
            borderRadius: radius.card,
            color: 'var(--kuro-color-primary, #a6d189)',
            fontSize: 12.5,
          }}
        >
          <Check size={16} style={{ flexShrink: 0 }} />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* ─── 2. Search, Stats & View Mode Switcher ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '0 4px',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            minWidth: 220,
            maxWidth: 320,
            flex: 1,
          }}
        >
          <Search size={13} style={{ position: 'absolute', left: 10, color: 'var(--kuro-color-text-muted, #71717a)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files in folder..."
            style={{
              width: '100%',
              backgroundColor: 'var(--kuro-color-surface, #14171d)',
              border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
              borderRadius: radius.input,
              padding: '6px 28px 6px 30px',
              fontSize: 12,
              color: 'var(--kuro-color-text-primary, #e2e8f0)',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 8,
                background: 'none',
                border: 'none',
                color: 'var(--kuro-color-text-muted, #71717a)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 2,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Items Count & Grid/Table Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--kuro-color-text-muted, #71717a)', fontFamily: monoFont }}>
            {filteredFiles.length} item{filteredFiles.length === 1 ? '' : 's'}
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--kuro-color-surface, #14171d)',
              border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
              borderRadius: radius.button,
              padding: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: viewMode === 'table' ? 'var(--kuro-color-primary, #a6d189)' : 'transparent',
                color: viewMode === 'table' ? '#14171d' : 'var(--kuro-color-text-muted, #71717a)',
                fontWeight: 600,
                fontSize: 11.5,
                cursor: 'pointer',
              }}
            >
              <List size={13} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: viewMode === 'grid' ? 'var(--kuro-color-primary, #a6d189)' : 'transparent',
                color: viewMode === 'grid' ? '#14171d' : 'var(--kuro-color-text-muted, #71717a)',
                fontWeight: 600,
                fontSize: 11.5,
                cursor: 'pointer',
              }}
            >
              <Grid size={13} />
              <span>Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 3. Main File Browser Container ─── */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface, #14171d)',
          border: isDragOver
            ? '2px dashed var(--kuro-color-primary, #a6d189)'
            : '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
          borderRadius: radius.card,
          overflow: 'hidden',
          minHeight: 380,
          position: 'relative',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        }}
      >
        {isDragOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(166, 209, 137, 0.08)',
              backdropFilter: 'blur(4px)',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: 'var(--kuro-color-primary, #a6d189)',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <UploadCloud size={42} />
            <span>Drop files here to upload to {currentPath}</span>
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 320,
              gap: 12,
              color: 'var(--kuro-color-text-muted, #71717a)',
            }}
          >
            <RotateCw size={26} className="animate-spin" style={{ color: 'var(--kuro-color-primary, #a6d189)' }} />
            <span style={{ fontSize: 13 }}>Reading directory contents from device...</span>
          </div>
        ) : filteredFiles.length === 0 && !parentPath ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 320,
              gap: 10,
              color: 'var(--kuro-color-text-muted, #71717a)',
            }}
          >
            <Folder size={36} style={{ color: 'var(--kuro-color-border, rgba(255, 255, 255, 0.15))' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Folder is empty</span>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                    borderBottom: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                    color: 'var(--kuro-color-text-muted, #71717a)',
                    fontSize: 11.5,
                  }}
                >
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, width: 100 }}>Size</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, width: 130 }}>Type</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, width: 160 }}>Last Modified</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, width: 120 }}>Permissions</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, width: 120, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Parent Directory Link */}
                {parentPath && (
                  <tr
                    onClick={handleGoUp}
                    onMouseEnter={() => setHoveredRow('parent-dir')}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--kuro-color-border-subtle, rgba(255, 255, 255, 0.04))',
                      backgroundColor: hoveredRow === 'parent-dir' ? 'var(--kuro-color-surface-hover, #1a1e26)' : 'transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '9px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Folder size={15} style={{ color: '#fabd2f', flexShrink: 0 }} />
                        <span style={{ color: 'var(--kuro-color-text-secondary, #94a3b8)', fontWeight: 600, fontFamily: monoFont }}>
                          .. [Parent Directory]
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: monoFont, color: 'var(--kuro-color-text-muted, #71717a)', fontSize: 11 }}>
                      &lt;DIR&gt;
                    </td>
                    <td style={{ padding: '9px 14px', color: 'var(--kuro-color-text-muted, #71717a)', fontSize: 11 }}>Directory</td>
                    <td style={{ padding: '9px 14px', color: 'var(--kuro-color-text-muted, #71717a)', fontSize: 11 }}>—</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                          border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                          borderRadius: 4,
                          fontSize: 10.5,
                          fontFamily: monoFont,
                          color: 'var(--kuro-color-text-muted, #71717a)',
                        }}
                      >
                        drwxr-xr-x
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 11, color: 'var(--kuro-color-text-muted, #71717a)' }}>
                      Go Up
                    </td>
                  </tr>
                )}

                {/* Files List */}
                {filteredFiles.map((file) => {
                  const isHovered = hoveredRow === file.path
                  return (
                    <tr
                      key={file.path}
                      onClick={() => (file.is_dir ? handleNavigate(file.path) : handleOpenPreview(file))}
                      onMouseEnter={() => setHoveredRow(file.path)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--kuro-color-border-subtle, rgba(255, 255, 255, 0.04))',
                        backgroundColor: isHovered ? 'var(--kuro-color-surface-hover, #1a1e26)' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Name */}
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {getFileIcon(file, 16)}
                          <span
                            style={{
                              color: file.is_dir ? 'var(--kuro-color-text-primary, #e2e8f0)' : 'var(--kuro-color-text-secondary, #94a3b8)',
                              fontWeight: file.is_dir ? 600 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 320,
                            }}
                          >
                            {file.name}
                          </span>
                        </div>
                      </td>

                      {/* Size */}
                      <td style={{ padding: '9px 14px', fontFamily: monoFont, fontSize: 11.5, color: 'var(--kuro-color-text-muted, #71717a)' }}>
                        {formatSize(file.size, file.is_dir)}
                      </td>

                      {/* Type */}
                      <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--kuro-color-text-muted, #71717a)', textTransform: 'capitalize' }}>
                        {file.is_dir ? 'Folder' : file.extension ? `${file.extension.toUpperCase()} File` : 'File'}
                      </td>

                      {/* Last Modified */}
                      <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--kuro-color-text-muted, #71717a)' }}>
                        {formatDate(file.last_modified)}
                      </td>

                      {/* Permissions */}
                      <td style={{ padding: '9px 14px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                            border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontFamily: monoFont,
                            color: 'var(--kuro-color-text-muted, #71717a)',
                          }}
                        >
                          {file.permissions || (file.is_dir ? 'drwxr-xr-x' : '-rw-r--r--')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 4,
                            opacity: isHovered ? 1 : 0.6,
                            transition: 'opacity 0.15s ease',
                          }}
                        >
                          {!file.is_dir && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenPreview(file)
                                }}
                                title="Preview File"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--kuro-color-text-muted, #71717a)',
                                  cursor: 'pointer',
                                  padding: 4,
                                  borderRadius: 4,
                                  display: 'flex',
                                }}
                              >
                                <Eye size={14} />
                              </button>
                              <a
                                href={api.getClientFileContentUrl(nodeId, file.path, true)}
                                download={file.name}
                                title="Download File"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  color: 'var(--kuro-color-primary, #a6d189)',
                                  padding: 4,
                                  display: 'flex',
                                  textDecoration: 'none',
                                }}
                              >
                                <Download size={14} />
                              </a>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRenameFile(file)
                              setRenameNewName(file.name)
                            }}
                            title="Rename"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--kuro-color-text-muted, #71717a)',
                              cursor: 'pointer',
                              padding: 4,
                              borderRadius: 4,
                              display: 'flex',
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(file)
                            }}
                            title="Delete"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#eb6f92',
                              cursor: 'pointer',
                              padding: 4,
                              borderRadius: 4,
                              display: 'flex',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 12,
              padding: 14,
            }}
          >
            {parentPath && (
              <div
                onClick={handleGoUp}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 8px',
                  backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                  border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                  borderRadius: radius.card,
                  cursor: 'pointer',
                  textAlign: 'center',
                  gap: 6,
                }}
              >
                <Folder size={32} style={{ color: '#fabd2f' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>..</span>
                <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)' }}>Parent Directory</span>
              </div>
            )}
            {filteredFiles.map((file) => (
              <div
                key={file.path}
                onClick={() => (file.is_dir ? handleNavigate(file.path) : handleOpenPreview(file))}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 8px',
                  backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                  border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                  borderRadius: radius.card,
                  cursor: 'pointer',
                  textAlign: 'center',
                  gap: 6,
                  transition: 'background-color 0.15s ease',
                }}
              >
                {getFileIcon(file, 30)}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--kuro-color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                >
                  {file.name}
                </span>
                <span style={{ fontSize: 10, fontFamily: monoFont, color: 'var(--kuro-color-text-muted)' }}>
                  {formatSize(file.size, file.is_dir)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 4. In-Browser Media & Document Preview Modal ─── */}
      {previewFile && (
        <div
          onClick={() => {
            setPreviewFile(null)
            setPreviewTextContent(null)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
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
              backgroundColor: 'var(--kuro-color-surface, #14171d)',
              border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
              borderRadius: radius.card,
              maxWidth: 800,
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {getFileIcon(previewFile, 16)}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--kuro-color-text-primary, #e2e8f0)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {previewFile.name}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: monoFont, color: 'var(--kuro-color-text-muted, #71717a)' }}>
                    {formatSize(previewFile.size, false)} • {previewFile.path}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={api.getClientFileContentUrl(nodeId, previewFile.path, true)}
                  download={previewFile.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    backgroundColor: 'var(--kuro-color-primary, #a6d189)',
                    color: '#14171d',
                    borderRadius: radius.button,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewFile(null)
                    setPreviewTextContent(null)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--kuro-color-text-muted, #71717a)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Viewer */}
            <div
              style={{
                padding: 16,
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
              }}
            >
              {previewLoading ? (
                <RotateCw size={24} className="animate-spin" style={{ color: 'var(--kuro-color-primary, #a6d189)' }} />
              ) : previewFile.mime_type?.startsWith('image/') ||
                ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(previewFile.extension?.toLowerCase() || '') ? (
                <img
                  src={api.getClientFileContentUrl(nodeId, previewFile.path)}
                  alt={previewFile.name}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 8 }}
                />
              ) : previewFile.mime_type?.startsWith('video/') ||
                ['mp4', 'webm', 'mkv', 'mov'].includes(previewFile.extension?.toLowerCase() || '') ? (
                <video
                  src={api.getClientFileContentUrl(nodeId, previewFile.path)}
                  controls
                  style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 8 }}
                />
              ) : previewFile.mime_type?.startsWith('audio/') ||
                ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(previewFile.extension?.toLowerCase() || '') ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24 }}>
                  <Music size={40} style={{ color: '#9ece6a' }} />
                  <audio src={api.getClientFileContentUrl(nodeId, previewFile.path)} controls style={{ width: '100%', maxWidth: 400 }} />
                </div>
              ) : previewTextContent !== null ? (
                <pre
                  style={{
                    width: '100%',
                    fontSize: 12,
                    fontFamily: monoFont,
                    color: 'var(--kuro-color-text-primary, #e2e8f0)',
                    backgroundColor: 'var(--kuro-color-surface, #14171d)',
                    padding: 14,
                    borderRadius: 8,
                    border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                    overflowX: 'auto',
                    maxHeight: '60vh',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {previewTextContent}
                </pre>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--kuro-color-text-muted)' }}>
                  <File size={36} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>No in-browser preview available for this file type.</span>
                  <span style={{ fontSize: 11 }}>Use the download button to view it locally.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. New Folder Modal ─── */}
      {newFolderOpen && (
        <div
          onClick={() => setNewFolderOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateFolder}
            style={{
              backgroundColor: 'var(--kuro-color-surface, #14171d)',
              border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
              borderRadius: radius.card,
              maxWidth: 420,
              width: '100%',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                <FolderPlus size={16} style={{ color: '#fabd2f' }} />
                <span>Create New Folder</span>
              </div>
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--kuro-color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--kuro-color-text-muted)' }}>
              Folder will be created in: <span style={{ fontFamily: monoFont, color: 'var(--kuro-color-text-secondary)' }}>{currentPath}</span>
            </div>

            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder Name"
              style={{
                width: '100%',
                backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                borderRadius: radius.input,
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--kuro-color-text-primary)',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 6 }}>
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                  border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                  borderRadius: radius.button,
                  color: 'var(--kuro-color-text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !newFolderName.trim()}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'var(--kuro-color-primary, #a6d189)',
                  color: '#14171d',
                  border: 'none',
                  borderRadius: radius.button,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: actionLoading || !newFolderName.trim() ? 'not-allowed' : 'pointer',
                  opacity: actionLoading || !newFolderName.trim() ? 0.5 : 1,
                }}
              >
                {actionLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── 6. Rename Modal ─── */}
      {renameFile && (
        <div
          onClick={() => setRenameFile(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleExecuteRename}
            style={{
              backgroundColor: 'var(--kuro-color-surface, #14171d)',
              border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
              borderRadius: radius.card,
              maxWidth: 420,
              width: '100%',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                <Edit2 size={15} style={{ color: '#fabd2f' }} />
                <span>Rename Item</span>
              </div>
              <button
                type="button"
                onClick={() => setRenameFile(null)}
                style={{ background: 'none', border: 'none', color: 'var(--kuro-color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
              >
                <X size={16} />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
              placeholder="New Name"
              style={{
                width: '100%',
                backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                borderRadius: radius.input,
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--kuro-color-text-primary)',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 6 }}>
              <button
                type="button"
                onClick={() => setRenameFile(null)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                  border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                  borderRadius: radius.button,
                  color: 'var(--kuro-color-text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !renameNewName.trim()}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'var(--kuro-color-primary, #a6d189)',
                  color: '#14171d',
                  border: 'none',
                  borderRadius: radius.button,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: actionLoading || !renameNewName.trim() ? 'not-allowed' : 'pointer',
                  opacity: actionLoading || !renameNewName.trim() ? 0.5 : 1,
                }}
              >
                {actionLoading ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── 7. Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
              backgroundColor: 'var(--kuro-color-surface, #14171d)',
              border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
              borderRadius: radius.card,
              maxWidth: 420,
              width: '100%',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#eb6f92' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Confirm Deletion</span>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--kuro-color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to delete <span style={{ fontWeight: 700, color: 'var(--kuro-color-text-primary)', fontFamily: monoFont }}>{deleteTarget.name}</span> from the device? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 6 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: 'var(--kuro-color-bg, #0d0f12)',
                  border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
                  borderRadius: radius.button,
                  color: 'var(--kuro-color-text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={actionLoading}
                style={{
                  padding: '6px 16px',
                  backgroundColor: '#eb6f92',
                  color: '#fff',
                  border: 'none',
                  borderRadius: radius.button,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
