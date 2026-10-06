import { useState } from 'react'
import { useDocker } from '../hooks/useDocker'
import DockerSummary from '../components/DockerSummary'
import DockerToolbar from '../components/DockerToolbar'
import ContainerCard from '../components/ContainerCard'
import ContainerGroupCard from '../components/ContainerGroupCard'
import ContainerHealthPanel from '../components/ContainerHealthPanel'
import ImagesPanel from '../components/ImagesPanel'
import ConfirmDialog from '../components/ConfirmDialog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { groupContainers } from '../utils/docker'
import type { ContainerSummary, ContainerGroup } from '../types'
import { radius } from '@/design/radius'

type ConfirmAction = 'stop' | 'restart' | 'stopGroup' | 'restartGroup' | null

export default function DockerPage() {
  useDocumentTitle('Docker - HomeLab')

  const {
    containers,
    filteredContainers,
    loading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    busyIds,
    summary,
    handleStart,
    handleStop,
    handleRestart,
    refetch,
  } = useDocker()

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [pendingContainer, setPendingContainer] = useState<ContainerSummary | null>(null)
  const [pendingGroup, setPendingGroup] = useState<ContainerGroup | null>(null)

  const handleActionWithConfirm = (container: ContainerSummary, action: ConfirmAction) => {
    setPendingContainer(container)
    setConfirmAction(action)
  }

  const handleGroupActionWithConfirm = (group: ContainerGroup, action: ConfirmAction) => {
    setPendingGroup(group)
    setConfirmAction(action)
  }

  const handleStartGroup = (group: ContainerGroup) => {
    group.containers.forEach((c) => {
      if (c.state !== 'running') handleStart(c)
    })
  }

  const executeConfirmed = () => {
    if (confirmAction === 'stop' && pendingContainer) handleStop(pendingContainer)
    if (confirmAction === 'restart' && pendingContainer) handleRestart(pendingContainer)

    if (confirmAction === 'stopGroup' && pendingGroup) {
      pendingGroup.containers.forEach((c) => {
        if (c.state !== 'exited' && c.state !== 'dead') handleStop(c)
      })
    }
    if (confirmAction === 'restartGroup' && pendingGroup) {
      pendingGroup.containers.forEach((c) => {
        handleRestart(c)
      })
    }

    setConfirmAction(null)
    setPendingContainer(null)
    setPendingGroup(null)
  }

  const confirmTitle =
    confirmAction === 'stop' ? 'Stop Container' :
    confirmAction === 'restart' ? 'Restart Container' :
    confirmAction === 'stopGroup' ? 'Stop Stack' :
    confirmAction === 'restartGroup' ? 'Restart Stack' : ''

  const confirmMessage = pendingContainer
    ? `Are you sure you want to ${confirmAction} "${pendingContainer.name}"?`
    : pendingGroup
    ? `Are you sure you want to ${confirmAction === 'stopGroup' ? 'stop' : 'restart'} all containers in the "${pendingGroup.name}" stack?`
    : ''

  const groupedContainers = groupContainers(filteredContainers)

  // Loading state
  if (loading && filteredContainers.length === 0) {
    return (
      <div className="docker-page-root">
        <DockerSummary {...summary} />
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 60,
            backgroundColor: 'var(--kuro-color-surface)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.card,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
            Loading Docker containers…
          </span>
        </div>
      </div>
    )
  }

  // Error state (no cached data)
  if (error && filteredContainers.length === 0) {
    return (
      <div className="docker-page-root">
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 60,
            backgroundColor: 'var(--kuro-color-surface)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.card,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-danger)' }}>
            Failed to load containers
          </span>
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>{error}</span>
          <button
            onClick={() => refetch()}
            style={{
              marginTop: 4,
              padding: '6px 16px',
              fontSize: 11,
              fontFamily: 'inherit',
              fontWeight: 500,
              borderRadius: radius.button,
              border: '1px solid var(--kuro-color-border)',
              backgroundColor: 'var(--kuro-color-hover)',
              color: 'var(--kuro-color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="docker-page-root" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Stat cards */}
      <DockerSummary {...summary} />

      {/* Soft error banner (stale data case) */}
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 14px',
            backgroundColor: 'rgba(234,105,98,0.08)',
            border: '1px solid rgba(234,105,98,0.25)',
            borderRadius: radius.card,
            fontSize: 11,
            color: 'var(--kuro-color-danger)',
          }}
        >
          {error}
        </div>
      )}

      {/* Search + Filter toolbar */}
      <div>
        <DockerToolbar
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>

      {/* Main content — 2-column on desktop, single column on mobile */}
      <div
        className="docker-content-grid page-widget-gap"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          alignItems: 'start',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        {/* LEFT: Container list */}
        <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {groupedContainers.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 48,
                backgroundColor: 'var(--kuro-color-surface)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.card,
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                {search || filter !== 'all'
                  ? 'No containers match your search.'
                  : 'No Docker containers found.'}
              </span>
            </div>
          ) : (
            groupedContainers.map((item) => {
              if ('isGroup' in item) {
                return (
                  <ContainerGroupCard
                    key={`group-${item.name}`}
                    group={item}
                    busyIds={busyIds}
                    onStartGroup={handleStartGroup}
                    onStopGroup={(g) => handleGroupActionWithConfirm(g, 'stopGroup')}
                    onRestartGroup={(g) => handleGroupActionWithConfirm(g, 'restartGroup')}
                    onStartContainer={(c) => handleStart(c)}
                    onStopContainer={(c) => handleActionWithConfirm(c, 'stop')}
                    onRestartContainer={(c) => handleActionWithConfirm(c, 'restart')}
                    onContainerClick={() => {}}
                  />
                )
              }
              return (
                <ContainerCard
                  key={item.id}
                  container={item}
                  busy={busyIds.has(item.id)}
                  onStart={() => handleStart(item)}
                  onStop={() => handleActionWithConfirm(item, 'stop')}
                  onRestart={() => handleActionWithConfirm(item, 'restart')}
                  onClick={() => {}}
                />
              )
            })
          )}
        </div>

        {/* RIGHT: sidebar panels */}
        <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column' }}>
          <ContainerHealthPanel containers={containers} />
          <ImagesPanel containers={containers} />
        </div>
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmAction === 'stop' || confirmAction === 'stopGroup' ? 'Stop' : 'Restart'}
        onConfirm={executeConfirmed}
        onCancel={() => {
          setConfirmAction(null)
          setPendingContainer(null)
          setPendingGroup(null)
        }}
      />
    </div>
  )
}
