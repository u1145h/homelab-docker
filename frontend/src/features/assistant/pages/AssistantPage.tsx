import { useState } from 'react'
import { useMediaQuery } from '@mui/material'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AppIcon } from '@/components/ui/icons'
import { PageContainer } from '@/components/shell'
import { useAssistant } from '../hooks/useAssistant'
import ConnectedNodesTab from '../components/ConnectedNodesTab'
import ModelSettingsTab from '../components/ModelSettingsTab'
import MemoryManagerTab from '../components/MemoryManagerTab'
import ClientDataTab from '../components/ClientDataTab'
import ServerIntegrationsTab from '../components/ServerIntegrationsTab'

type TabType = 'model' | 'memories' | 'nodes' | 'client-data' | 'integrations'

export default function AssistantPage() {
  useDocumentTitle('Assistant - HomeLab')
  const {
    settings,
    nodes,
    memories,
    modelsData,
    engineStatus,
    pullingModel,
    pullProgress,
    startingEngine,
    loading,
    savingSettings,
    testingLLM,
    testResult,
    error,
    refresh,
    handlePullModel,
    handleDeleteModel,
    handleSetActiveModel,
    handleStartEngine,
    updateSettings,
    testLLM,
    addMemory,
    editMemory,
    removeMemory,
  } = useAssistant()

  const [activeTab, setActiveTab] = useState<TabType>('model')
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isTablet  = useMediaQuery('(min-width: 768px)')
  const isMobile  = useMediaQuery('(max-width: 640px)')
  const padding   = isDesktop ? 25 : isTablet ? 20 : 15

  const tabs = [
    { id: 'model'        as TabType, icon: 'sliders',  label: 'Model & Inference',              shortLabel: 'Model' },
    { id: 'memories'     as TabType, icon: 'sparkles', label: `Memories (${memories.length})`, shortLabel: 'Memory' },
    { id: 'nodes'        as TabType, icon: 'network',  label: `Connected Clients (${nodes.length})`, shortLabel: `Clients` },
    { id: 'client-data'  as TabType, icon: 'database', label: 'Client Data',                   shortLabel: 'Data' },
    { id: 'integrations' as TabType, icon: 'server',   label: 'Server Integrations',           shortLabel: 'Servers' },
  ]

  if (loading) {
    return (
      <PageContainer fullWidth padding={padding}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 300,
            gap: 12,
            color: 'var(--kuro-color-text-muted)',
          }}
        >
          <AppIcon name="rotate-cw" size={24} className="animate-spin" />
          <span style={{ fontSize: 13 }}>Loading Kuro Assistant subsystem...</span>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer fullWidth padding={padding}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15, width: '100%', minWidth: 0 }}>
        {/* Error Banner */}
        {error && (
          <div
            style={{
              backgroundColor: 'rgba(234, 105, 98, 0.1)',
              border: '1px solid rgba(234, 105, 98, 0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              color: 'var(--kuro-color-danger)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            <AppIcon name="alert-triangle" size={16} />
            <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{error}</span>
          </div>
        )}

        {/* Tab Bar — scrollable, never wraps */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderBottom: '1px solid var(--kuro-color-border)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            flexShrink: 0,
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 5 : 7,
                  padding: isMobile ? '10px 11px' : '10px 15px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? 'var(--kuro-color-primary)' : 'transparent'}`,
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)',
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <AppIcon name={tab.icon as any} size={14} />
                {isMobile ? tab.shortLabel : tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Contents */}
        {activeTab === 'nodes' && <ConnectedNodesTab nodes={nodes} onRefresh={refresh} />}
        {activeTab === 'model' && (
          <ModelSettingsTab
            settings={settings}
            modelsData={modelsData}
            engineStatus={engineStatus}
            pullingModel={pullingModel}
            pullProgress={pullProgress}
            startingEngine={startingEngine}
            saving={savingSettings}
            testing={testingLLM}
            testResult={testResult}
            onSave={updateSettings}
            onTestLLM={testLLM}
            onPullModel={handlePullModel}
            onDeleteModel={handleDeleteModel}
            onSetActiveModel={handleSetActiveModel}
            onStartEngine={handleStartEngine}
          />
        )}
        {activeTab === 'memories' && (
          <MemoryManagerTab
            memories={memories}
            onAddMemory={addMemory}
            onEditMemory={editMemory}
            onDeleteMemory={removeMemory}
          />
        )}
        {activeTab === 'client-data' && (
          <ClientDataTab
            nodes={nodes}
            onRefreshNodes={refresh}
          />
        )}
        {activeTab === 'integrations' && <ServerIntegrationsTab />}
      </div>
    </PageContainer>
  )
}
