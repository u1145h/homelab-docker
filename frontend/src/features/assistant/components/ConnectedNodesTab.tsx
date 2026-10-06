import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import { deleteConnectedNode, triggerNodeSync, triggerSyncAllNodes, updateConnectedNode } from '../api/assistant'
import { useSnackbar } from '@/hooks/useSnackbar'
import { formatDateTime } from '@/utils/format'
import type { KuroNode } from '../types'

interface ConnectedNodesTabProps {
  nodes: KuroNode[]
  onRefresh: () => void
}

type DataHandlingOption = 'merge' | 'delete' | 'keep'

export default function ConnectedNodesTab({ nodes, onRefresh }: ConnectedNodesTabProps) {
  const navigate = useNavigate()
  const { showSnackbar } = useSnackbar()
  const [selectedNode, setSelectedNode] = useState<KuroNode | null>(null)

  // Edit device modal state
  const [editingNode, setEditingNode] = useState<KuroNode | null>(null)
  const [editDeviceName, setEditDeviceName] = useState('')
  const [editSyncInterval, setEditSyncInterval] = useState(900)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Delete modal state
  const [deletingNode, setDeletingNode] = useState<KuroNode | null>(null)
  const [dataOption, setDataOption] = useState<DataHandlingOption>('delete')
  const [mergeTargetId, setMergeTargetId] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Syncing state
  const [syncingNodeId, setSyncingNodeId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await triggerSyncAllNodes().catch(() => {})
      showSnackbar('Sync signal dispatched to all connected clients. Refreshing...', 'info')
      await new Promise((r) => setTimeout(r, 1200))
      onRefresh()
    } catch {
      onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deletingNode && !isDeleting) setDeletingNode(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deletingNode, isDeleting])

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'windows':
        return 'monitor'
      case 'android':
      case 'ios':
        return 'smartphone'
      case 'linux':
        return 'terminal'
      case 'macos':
      case 'darwin':
        return 'monitor'
      default:
        return 'box'
    }
  }

  const formatSyncTimes = (lastSeen?: string, timestamp?: string, syncIntervalSec: number = 900) => {
    const ts = timestamp || lastSeen
    const intervalMins = Math.max(1, Math.round(syncIntervalSec / 60))
    if (!ts) return { lastSync: 'Never recorded', nextSync: `Periodic (~${intervalMins}m)` }

    const d = new Date(ts)
    const isInvalid = isNaN(d.getTime())
    if (isInvalid) return { lastSync: ts, nextSync: `Periodic (~${intervalMins}m)` }

    const now = Date.now()
    const diffSec = Math.max(0, Math.floor((now - d.getTime()) / 1000))
    let rel = 'Just now'
    if (diffSec >= 60 && diffSec < 3600) {
      rel = `${Math.floor(diffSec / 60)}m ago`
    } else if (diffSec >= 3600 && diffSec < 86400) {
      rel = `${Math.floor(diffSec / 3600)}h ago`
    } else if (diffSec >= 86400) {
      rel = `${Math.floor(diffSec / 86400)}d ago`
    }

    const lastSyncStr = formatDateTime(d)

    const nextSyncDate = new Date(d.getTime() + syncIntervalSec * 1000)
    const nextDiffSec = Math.floor((nextSyncDate.getTime() - now) / 1000)
    let nextSyncStr = formatDateTime(nextSyncDate)
    if (nextDiffSec > 0) {
      const nextMins = Math.ceil(nextDiffSec / 60)
      nextSyncStr = `in ~${nextMins}m (${nextSyncStr})`
    } else {
      nextSyncStr = `imminent (${nextSyncStr})`
    }

    return {
      lastSync: `${lastSyncStr} (${rel})`,
      nextSync: nextSyncStr,
    }
  }



  const handleSyncNode = async (node: KuroNode, e: React.MouseEvent) => {
    e.stopPropagation()
    setSyncingNodeId(node.id)
    try {
      await triggerNodeSync(node.id)
      showSnackbar(`Sync signal dispatched to ${node.name || node.id}. Updating...`, 'info')
      await new Promise((r) => setTimeout(r, 1200))
      onRefresh()
      showSnackbar(`Device ${node.name || node.id} updated with latest telemetry`, 'success')
    } catch (err: any) {
      showSnackbar(err?.message || 'Failed to sync client device', 'error')
      onRefresh()
    } finally {
      setSyncingNodeId(null)
    }
  }

  const handleOpenDeleteModal = (node: KuroNode, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingNode(node)
    setDeleteError(null)
    const otherNodes = nodes.filter((n) => n.id !== node.id)
    if (otherNodes.length > 0) {
      setMergeTargetId(otherNodes[0].id)
      setDataOption('merge')
    } else {
      setDataOption('delete')
      setMergeTargetId('')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingNode) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteConnectedNode(deletingNode.id, {
        delete_data: dataOption === 'delete',
        merge_target_id: dataOption === 'merge' ? mergeTargetId : undefined,
      })
      if (selectedNode?.id === deletingNode.id) {
        setSelectedNode(null)
      }
      setDeletingNode(null)
      onRefresh()
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete client device.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenEditModal = (node: KuroNode, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNode(node)
    setEditDeviceName(node.name || node.hostname || '')
    setEditSyncInterval(node.sync_interval_seconds || 900)
  }

  const handleSaveEdit = async () => {
    if (!editingNode) return
    setIsSavingEdit(true)
    try {
      await updateConnectedNode(editingNode.id, {
        name: editDeviceName.trim(),
        sync_interval_seconds: Number(editSyncInterval) || 900,
      })
      showSnackbar(`Device name updated to "${editDeviceName.trim() || editingNode.id}"`, 'success')
      setEditingNode(null)
      onRefresh()
    } catch (err: any) {
      showSnackbar(err?.message || 'Failed to update device name', 'error')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const otherNodes = deletingNode ? nodes.filter((n) => n.id !== deletingNode.id) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
            Clients
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--kuro-color-text-muted)' }}>
            Devices currently authenticated and connected to Kuro via Named Pipe & WebSocket Hub
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Icon-only Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refresh"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              backgroundColor: 'var(--kuro-color-bg)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.button,
              color: 'var(--kuro-color-text-primary)',
              cursor: isRefreshing ? 'wait' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <AppIcon name="rotate-cw" size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* View All Button */}
          <button
            onClick={() => navigate('/assistant/clients/data')}
            title="View telemetry, call logs, SMS, and GPS for all connected clients"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'var(--kuro-color-bg)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.button,
              padding: '8px 14px',
              color: 'var(--kuro-color-text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <AppIcon name="database" size={14} />
            <span>View All</span>
          </button>
        </div>
      </div>

      {/* Nodes list */}
      {nodes.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface)',
            border: '1px dashed var(--kuro-color-border)',
            borderRadius: radius.card,
            padding: 40,
            textAlign: 'center',
            color: 'var(--kuro-color-text-muted)',
          }}
        >
          <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 12 }}>
            <AppIcon name="network" size={24} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>No Client Nodes Connected</div>
          <div style={{ fontSize: 12, marginTop: 4, maxWidth: 420, margin: '4px auto 0' }}>
            Run the Kuro Desktop Client or Background Service on your Windows PC, Android phone, or Linux desktop to connect them here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {nodes.map((node) => {
            const isOnline = Boolean(node.is_online ?? (node.status === 'online'))
            const battery = node.telemetry?.battery
            const network = node.telemetry?.network
            const storage = node.telemetry?.storage
            const hardware = node.telemetry?.hardware
            const syncTimes = formatSyncTimes(node.last_seen, node.telemetry?.timestamp, node.sync_interval_seconds)
            const isSyncing = syncingNodeId === node.id

            const storageUsed = storage?.used_gb ?? (node.telemetry?.drives?.[0]?.used_gb)
            const storageTotal = storage?.total_gb ?? (node.telemetry?.drives?.[0]?.total_gb)
            const storageFree = storage?.free_gb ?? (node.telemetry?.drives?.[0]?.free_gb)
            const storagePercent = storage?.percent ?? (storageUsed && storageTotal ? (storageUsed / storageTotal) * 100 : 0)

            return (
              <div
                key={node.id}
                onClick={() => navigate(`/assistant/clients/data?node=${encodeURIComponent(node.id)}`)}
                title={`View telemetry, call logs, SMS, and GPS for ${node.name || node.hostname || node.id}`}
                style={{
                  backgroundColor: 'var(--kuro-color-surface)',
                  border: '1px solid var(--kuro-color-border)',
                  borderRadius: radius.card,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s ease',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--kuro-color-primary)'
                  e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.32)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.18)'
                }}
              >
                {/* 1. Node Top Header & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: radius.button,
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        color: 'var(--kuro-color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <AppIcon name={getPlatformIcon(node.platform) as any} size={19} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)', lineHeight: 1.2 }}>
                        {node.name || node.hostname || node.id}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                        {node.id} • {node.platform.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Online / Offline Status Dot */}
                    <div
                      title={isOnline ? `Device Online (${node.status})` : `Device Offline (Last seen: ${syncTimes.lastSync})`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: isOnline ? 'rgba(142, 192, 124, 0.14)' : 'rgba(234, 105, 98, 0.14)',
                        border: `1px solid ${isOnline ? 'rgba(142, 192, 124, 0.35)' : 'rgba(234, 105, 98, 0.35)'}`,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: isOnline ? 'var(--kuro-color-success, #8ec07c)' : 'var(--kuro-color-danger, #ea6962)',
                          boxShadow: isOnline
                            ? '0 0 8px rgba(142, 192, 124, 0.7)'
                            : '0 0 8px rgba(234, 105, 98, 0.6)',
                        }}
                      />
                    </div>

                    {/* Edit Device Name Action */}
                    <button
                      onClick={(e) => handleOpenEditModal(node, e)}
                      title="Edit Device Name"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: 6,
                        padding: '4px 7px',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                    >
                      <AppIcon name="edit-2" size={13} />
                    </button>

                    {/* Sync Now Action */}
                    <button
                      onClick={(e) => handleSyncNode(node, e)}
                      title="Sync telemetry now"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: 6,
                        padding: '4px 7px',
                        color: 'var(--kuro-color-text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <AppIcon name="rotate-cw" size={13} className={isSyncing ? 'animate-spin' : ''} />
                    </button>

                    {/* Delete Client Button */}
                    <button
                      onClick={(e) => handleOpenDeleteModal(node, e)}
                      title="Delete client and logout device"
                      style={{
                        background: 'rgba(234, 105, 98, 0.1)',
                        border: '1px solid rgba(234, 105, 98, 0.25)',
                        borderRadius: 6,
                        padding: '4px 7px',
                        color: 'var(--kuro-color-danger)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(234, 105, 98, 0.22)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(234, 105, 98, 0.1)')}
                    >
                      <AppIcon name="trash-2" size={13} />
                    </button>
                  </div>
                </div>

                {/* 2. Device Hardware & OS Specs Badges */}
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 6 }}>

                  {/* Android Version */}
                  {/* OS / Android Version */}
                  {hardware?.android_version && (
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        backgroundColor: 'rgba(142, 192, 124, 0.1)',
                        border: '1px solid rgba(142, 192, 124, 0.25)',
                        padding: '3px 6px',
                        borderRadius: 5,
                        fontSize: 9.5,
                        color: '#8EC07C',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Android {hardware.android_version}
                    </span>
                  )}

                  {/* Screen Status */}
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      backgroundColor: hardware?.screen_on !== false ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${hardware?.screen_on !== false ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)'}`,
                      padding: '3px 6px',
                      borderRadius: 5,
                      fontSize: 9.5,
                      color: hardware?.screen_on !== false ? 'var(--kuro-color-success)' : 'var(--kuro-color-text-muted)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {hardware?.screen_on !== false ? '● Screen Active' : '○ Screen Locked'}
                  </span>

                  {/* Device Admin Status */}
                  {hardware?.admin_active && (
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        backgroundColor: 'rgba(231, 138, 78, 0.12)',
                        border: '1px solid rgba(231, 138, 78, 0.3)',
                        padding: '3px 6px',
                        borderRadius: 5,
                        fontSize: 9.5,
                        color: '#E78A4E',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AppIcon name="shield" size={11} />
                        <span>Admin Active</span>
                      </span>
                    </span>
                  )}
                </div>

                {/* 3. Internal Storage Usage Bar (Real Storage) */}
                {storageTotal && storageTotal > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: 'var(--kuro-color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AppIcon name="hard-drive" size={11} /> Internal Storage
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                        {storageUsed?.toFixed(1) || '0'} / {storageTotal.toFixed(1)} GB ({storagePercent.toFixed(0)}%)
                      </span>
                    </div>
                    <div style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(storagePercent, 100)}%`,
                          backgroundColor: storagePercent > 85 ? 'var(--kuro-color-danger)' : 'var(--kuro-color-primary)',
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    {storageFree !== undefined && (
                      <div style={{ fontSize: 9.5, color: 'var(--kuro-color-text-muted)', textAlign: 'right' }}>
                        {storageFree.toFixed(1)} GB free
                      </div>
                    )}
                  </div>
                ) : null}

                {/* 4. Migrated Hardware Telemetry Grid (Battery, Network & Power) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: radius.button,
                    padding: '8px 10px',
                  }}
                >
                  {/* Battery Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#8EC07C', fontWeight: 700 }}>
                      <AppIcon name="battery-charging" size={12} />
                      <span>Battery</span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                      {battery?.level ?? 100}%{' '}
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--kuro-color-text-muted)' }}>
                        {battery?.is_charging ? 'Charging' : 'Discharging'}
                      </span>
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--kuro-color-text-muted)' }}>
                      {battery?.temperature ? `${battery.temperature}°C` : 'Optimal'} • {battery?.health || 'Good'}
                      {battery?.voltage_mv ? ` (${(battery.voltage_mv / 1000).toFixed(2)}V)` : ''}
                    </div>
                  </div>

                  {/* Network / Uplink Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#83A598', fontWeight: 700 }}>
                      <AppIcon name="wifi" size={12} />
                      <span>Network Uplink</span>
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: 'var(--kuro-color-text-primary)',
                        maxWidth: 150,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={network?.wifi_ssid || 'HomeLab / Tailscale'}
                    >
                      {network?.wifi_ssid || 'Tailscale'}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--kuro-color-text-muted)', fontFamily: 'monospace' }}>
                      {network?.network_type || 'WIFI'} • {network?.ip_address || node.ip_address || 'Local'}
                      {network?.link_speed_mbps ? ` (${network.link_speed_mbps} Mbps)` : ''}
                    </div>
                  </div>
                </div>

                {/* 5. Active App / Window (if available) */}
                {node.telemetry?.active_app && (
                  <div
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: radius.button,
                      padding: '5px 8px',
                      fontSize: 10.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: 'var(--kuro-color-text-muted)',
                    }}
                  >
                    <span>Active App:</span>
                    <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.telemetry.active_app}
                    </span>
                  </div>
                )}

                {/* 6. Sync Information Footer (Last Sync & Next Sync) */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    fontSize: 10.5,
                    color: 'var(--kuro-color-text-muted)',
                    borderTop: '1px solid var(--kuro-color-border-subtle)',
                    paddingTop: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Last Sync:</span>
                    <strong style={{ color: 'var(--kuro-color-text-secondary)', fontWeight: 600 }}>
                      {syncTimes.lastSync}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Next Sync:</span>
                    <span style={{ color: 'var(--kuro-color-primary)', fontWeight: 600 }}>
                      {syncTimes.nextSync}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Client & Data Management Confirmation Modal */}
      {deletingNode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !isDeleting && setDeletingNode(null)}
        >
          <div
            style={{
              backgroundColor: '#141516',
              border: '1px solid #232528',
              borderRadius: radius.modal || 16,
              maxWidth: 520,
              width: '100%',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(234, 105, 98, 0.12)',
                  color: 'var(--kuro-color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AppIcon name="trash-2" size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                  Delete Client: {deletingNode.name || deletingNode.hostname || deletingNode.id}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--kuro-color-text-muted)', fontFamily: 'monospace' }}>
                  Node ID: {deletingNode.id} • {deletingNode.platform.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Warning Banner */}
            <div
              style={{
                backgroundColor: 'rgba(234, 105, 98, 0.08)',
                border: '1px solid rgba(234, 105, 98, 0.25)',
                borderRadius: radius.card,
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--kuro-color-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AppIcon name="alert-triangle" size={18} />
              <span>
                <strong>Remote Logout:</strong> Deleting this client will immediately disconnect and log out the client app from the connected device.
              </span>
            </div>

            {/* Error Message */}
            {deleteError && (
              <div
                style={{
                  backgroundColor: 'rgba(234, 105, 98, 0.15)',
                  border: '1px solid var(--kuro-color-danger)',
                  borderRadius: radius.card,
                  padding: '10px 14px',
                  fontSize: 12,
                  color: 'var(--kuro-color-danger)',
                }}
              >
                {deleteError}
              </div>
            )}

            {/* Data Management Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                What would you like to do with the data collected by this client?
              </label>

              {/* Option 1: Merge Data */}
              <div
                onClick={() => otherNodes.length > 0 && setDataOption('merge')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '12px 14px',
                  borderRadius: radius.card,
                  border: `1px solid ${dataOption === 'merge' ? 'var(--kuro-color-primary)' : 'var(--kuro-color-border)'}`,
                  backgroundColor: dataOption === 'merge' ? 'rgba(169, 182, 101, 0.06)' : 'var(--kuro-color-surface)',
                  cursor: otherNodes.length > 0 ? 'pointer' : 'not-allowed',
                  opacity: otherNodes.length > 0 ? 1 : 0.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="radio"
                    name="dataOption"
                    checked={dataOption === 'merge'}
                    disabled={otherNodes.length === 0}
                    onChange={() => setDataOption('merge')}
                    style={{ accentColor: 'var(--kuro-color-primary)' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                      Merge data into another client device
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                      Reassign calls, SMS messages, location logs, and snapshots to another device.
                    </div>
                  </div>
                </div>

                {dataOption === 'merge' && otherNodes.length > 0 && (
                  <div style={{ paddingLeft: 24, marginTop: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      Select Target Client:
                    </label>
                    <select
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#0F0F0F',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.button,
                        padding: '8px 10px',
                        color: 'var(--kuro-color-text-primary)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    >
                      {otherNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name || n.hostname || n.id} ({n.platform.toUpperCase()}) — {n.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Option 2: Delete Data */}
              <div
                onClick={() => setDataOption('delete')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: radius.card,
                  border: `1px solid ${dataOption === 'delete' ? 'var(--kuro-color-danger)' : 'var(--kuro-color-border)'}`,
                  backgroundColor: dataOption === 'delete' ? 'rgba(234, 105, 98, 0.06)' : 'var(--kuro-color-surface)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="dataOption"
                  checked={dataOption === 'delete'}
                  onChange={() => setDataOption('delete')}
                  style={{ accentColor: 'var(--kuro-color-danger)', marginTop: 2 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                    Delete all collected data
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                    Permanently wipe all call records, SMS logs, locations, and telemetry snapshots for this client.
                  </div>
                </div>
              </div>

              {/* Option 3: Keep Unlinked Data */}
              <div
                onClick={() => setDataOption('keep')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: radius.card,
                  border: `1px solid ${dataOption === 'keep' ? 'var(--kuro-color-primary)' : 'var(--kuro-color-border)'}`,
                  backgroundColor: dataOption === 'keep' ? 'rgba(169, 182, 101, 0.06)' : 'var(--kuro-color-surface)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="dataOption"
                  checked={dataOption === 'keep'}
                  onChange={() => setDataOption('keep')}
                  style={{ accentColor: 'var(--kuro-color-primary)', marginTop: 2 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                    Keep historical logs without device binding
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                    Remove the client credentials and logout the device, but keep collected records in history.
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6, borderTop: '1px solid var(--kuro-color-border)', paddingTop: 14 }}>
              <button
                disabled={isDeleting}
                onClick={() => setDeletingNode(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--kuro-color-text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{
                  padding: '8px 18px',
                  borderRadius: radius.button,
                  border: 'none',
                  backgroundColor: 'var(--kuro-color-danger)',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isDeleting ? (
                  <>
                    <AppIcon name="rotate-cw" size={13} className="animate-spin" />
                    Logging out & Deleting...
                  </>
                ) : (
                  <>
                    <AppIcon name="trash-2" size={13} />
                    Delete & Logout Device
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Device Name & Configuration Modal */}
      {editingNode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !isSavingEdit && setEditingNode(null)}
        >
          <div
            style={{
              backgroundColor: '#141516',
              border: '1px solid #232528',
              borderRadius: radius.modal || 16,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--kuro-color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AppIcon name="edit-2" size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                  Edit Device Name
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--kuro-color-text-muted)' }}>
                  Customize display name for this connected client device.
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Immutable Node ID Badge */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>
                  CLIENT NODE ID (IMMUTABLE)
                </label>
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--kuro-color-border-subtle)',
                    borderRadius: radius.button,
                    padding: '8px 12px',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: 'var(--kuro-color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{editingNode.id}</span>
                  <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AppIcon name="shield" size={12} /> Read-only ID
                  </span>
                </div>
              </div>

              {/* Editable Device Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>
                  DEVICE NAME (DISPLAY ALIAS)
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. My S24 Ultra, Living Room Tablet"
                  value={editDeviceName}
                  onChange={(e) => setEditDeviceName(e.target.value)}
                  disabled={isSavingEdit}
                  style={{
                    width: '100%',
                    backgroundColor: '#0F0F0F',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '9px 12px',
                    color: 'var(--kuro-color-text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit()
                  }}
                />
              </div>

              {/* Telemetry Sync Interval */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>
                  DYNAMIC SYNC INTERVAL
                </label>
                <select
                  value={editSyncInterval}
                  onChange={(e) => setEditSyncInterval(Number(e.target.value))}
                  disabled={isSavingEdit}
                  style={{
                    width: '100%',
                    backgroundColor: '#0F0F0F',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '8px 10px',
                    color: 'var(--kuro-color-text-primary)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                >
                  <option value={300}>Every 5 minutes (Real-time)</option>
                  <option value={900}>Every 15 minutes (Default / Battery Optimized)</option>
                  <option value={1800}>Every 30 minutes</option>
                  <option value={3600}>Every 1 hour</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6, borderTop: '1px solid var(--kuro-color-border)', paddingTop: 14 }}>
              <button
                disabled={isSavingEdit}
                onClick={() => setEditingNode(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--kuro-color-text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isSavingEdit ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                disabled={isSavingEdit || !editDeviceName.trim()}
                onClick={handleSaveEdit}
                style={{
                  padding: '8px 18px',
                  borderRadius: radius.button,
                  border: 'none',
                  backgroundColor: 'var(--kuro-color-primary)',
                  color: '#141516',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isSavingEdit || !editDeviceName.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isSavingEdit ? (
                  <>
                    <AppIcon name="rotate-cw" size={13} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <AppIcon name="check" size={13} />
                    Save Device Name
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
