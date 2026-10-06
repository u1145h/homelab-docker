import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { WindowsWorkstationOverview } from './WindowsWorkstationOverview'
import { WindowsHardwareHud } from './WindowsHardwareHud'
import { WindowsDrivesAndFiles } from './WindowsDrivesAndFiles'
import { WindowsProcessManager } from './WindowsProcessManager'
import { WindowsServicesManager } from './WindowsServicesManager'
import { WindowsInstalledApps } from './WindowsInstalledApps'
import { WindowsNetworkAndPorts } from './WindowsNetworkAndPorts'
import { WindowsPowerAndEvents } from './WindowsPowerAndEvents'
import { WindowsQuickActions } from './WindowsQuickActions'
import type { KuroNode } from '../../types'

export interface WindowsClientViewProps {
  node: KuroNode | null
  nodeId: string
  snapshot: any
  onRefresh?: () => void
}

type WindowsSubTab =
  | 'overview'
  | 'hardware'
  | 'files'
  | 'processes'
  | 'services'
  | 'apps'
  | 'network'
  | 'power'
  | 'actions'

export const WindowsClientView: React.FC<WindowsClientViewProps> = ({
  node,
  nodeId,
  snapshot,
  onRefresh,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<WindowsSubTab>('overview')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Dedicated Windows Sub-Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          backgroundColor: 'var(--kuro-color-surface, #18191a)',
          border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
          borderRadius: 10,
          padding: 4,
          maxWidth: '100%',
          overflowX: 'auto',
          width: 'fit-content',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.25)',
          scrollbarWidth: 'none',
        }}
      >
        {[
          { id: 'overview' as const, icon: 'monitor', label: 'Overview' },
          { id: 'hardware' as const, icon: 'sliders', label: 'Audio & Hardware' },
          { id: 'files' as const, icon: 'folder', label: 'Drives & Files' },
          { id: 'processes' as const, icon: 'activity', label: 'Processes' },
          { id: 'services' as const, icon: 'settings', label: 'Services' },
          { id: 'apps' as const, icon: 'grid', label: 'Apps' },
          { id: 'network' as const, icon: 'wifi', label: 'Network & Ports' },
          { id: 'power' as const, icon: 'zap', label: 'Power & Events' },
          { id: 'actions' as const, icon: 'camera', label: 'Quick Actions' },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 13px',
                borderRadius: 7,
                border: 'none',
                backgroundColor: isActive ? 'var(--kuro-color-primary, #b8bb26)' : 'transparent',
                color: isActive ? '#14161b' : 'var(--kuro-color-text-secondary, #a89984)',
                fontWeight: isActive ? 700 : 600,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 2px 10px rgba(184, 187, 38, 0.35)' : 'none',
              }}
            >
              <AppIcon name={tab.icon as any} size={14} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── 1. Workstation Overview ── */}
      {activeSubTab === 'overview' && (
        <WindowsWorkstationOverview
          node={node}
          nodeId={nodeId}
          snapshot={snapshot}
          onRefresh={onRefresh}
        />
      )}

      {/* ── 2. Audio & Hardware HUD ── */}
      {activeSubTab === 'hardware' && (
        <WindowsHardwareHud
          node={node}
          nodeId={nodeId}
          snapshot={snapshot}
          onRefresh={onRefresh}
        />
      )}

      {/* ── 3. Drives & Files ── */}
      {activeSubTab === 'files' && (
        <WindowsDrivesAndFiles
          node={node}
          nodeId={nodeId}
          snapshot={snapshot}
          onRefresh={onRefresh}
        />
      )}

      {/* ── 4. Processes ── */}
      {activeSubTab === 'processes' && (
        <WindowsProcessManager
          node={node || undefined}
          nodeId={nodeId}
        />
      )}

      {/* ── 5. Services ── */}
      {activeSubTab === 'services' && (
        <WindowsServicesManager
          node={node || undefined}
          nodeId={nodeId}
        />
      )}

      {/* ── 6. Installed Apps ── */}
      {activeSubTab === 'apps' && (
        <WindowsInstalledApps
          node={node || undefined}
          nodeId={nodeId}
        />
      )}

      {/* ── 7. Network & Ports ── */}
      {activeSubTab === 'network' && (
        <WindowsNetworkAndPorts
          node={node || undefined}
          nodeId={nodeId}
        />
      )}

      {/* ── 8. Power & Events ── */}
      {activeSubTab === 'power' && (
        <WindowsPowerAndEvents
          node={node || undefined}
          nodeId={nodeId}
        />
      )}

      {/* ── 9. Quick Actions ── */}
      {activeSubTab === 'actions' && (
        <WindowsQuickActions
          node={node || undefined}
          nodeId={nodeId}
        />
      )}
    </div>
  )
}
export default WindowsClientView
