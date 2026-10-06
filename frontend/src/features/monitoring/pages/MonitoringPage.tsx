import { useMemo } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParams } from 'react-router-dom'
import { Tab, Tabs } from '@mui/material'
import { useStatus } from '@/hooks/useStatus'
import { buildMonitoringData } from '../utils/monitoring'
import { PageContainer, PageHeader } from '@/components/shell'
import { LoadingState, ErrorState } from '@/components/ui/feedback'
import { StatusBadge } from '@/components/ui/display'
import OverviewTab from '../components/OverviewTab'
import CpuTab from '../components/CpuTab'
import MemoryTab from '../components/MemoryTab'
import StorageTab from '../components/StorageTab'
import NetworkTab from '../components/NetworkTab'
import type { MonitoringTab } from '../types'

const tabOrder: MonitoringTab[] = ['overview', 'cpu', 'memory', 'storage', 'network']

const tabLabels: Record<MonitoringTab, string> = {
  overview: 'Overview',
  cpu: 'CPU',
  memory: 'Memory',
  storage: 'Storage',
  network: 'Network',
}

interface MonitoringPageProps {
  defaultTab?: MonitoringTab
}

function getHealthStatus(data: { overview: { cpuColor: string; memoryColor: string; storageColor: string; networkColor: string } }): { type: 'healthy' | 'warning' | 'danger'; text: string } {
  const colors = [data.overview.cpuColor, data.overview.memoryColor, data.overview.storageColor, data.overview.networkColor]
  if (colors.includes('error')) return { type: 'danger', text: 'System is degraded' }
  if (colors.includes('warning')) return { type: 'warning', text: 'System is healthy with warnings' }
  return { type: 'healthy', text: 'System is healthy' }
}

export default function MonitoringPage({ defaultTab = 'overview' }: MonitoringPageProps) {
  useDocumentTitle('Monitoring - HomeLab')
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as MonitoringTab | null
  const activeTab = tabParam && tabOrder.includes(tabParam) ? tabParam : defaultTab

  const { data: status, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useStatus()

  const monitoringData = useMemo(() => {
    if (!status) return null
    return buildMonitoringData(status)
  }, [status])

  const handleTabChange = (_: React.SyntheticEvent, value: number) => {
    const tab = tabOrder[value]
    setSearchParams(tab === defaultTab ? {} : { tab }, { replace: true })
  }

  const currentIndex = tabOrder.indexOf(activeTab)

  if (isLoading && !status) {
    return (
      <PageContainer fullWidth padding={10}>
        <LoadingState message="Loading monitoring data..." />
      </PageContainer>
    )
  }

  if (isError && !status) {
    return (
      <PageContainer fullWidth padding={10}>
        <ErrorState
          title="Failed to load monitoring data"
          message={error instanceof Error ? error.message : 'Unable to reach the server.'}
          onRetry={refetch}
        />
      </PageContainer>
    )
  }

  if (!monitoringData) {
    return (
      <PageContainer fullWidth padding={10}>
        <ErrorState
          title="No monitoring data available"
          message="The server did not return monitoring information."
          onRetry={refetch}
        />
      </PageContainer>
    )
  }

  const health = getHealthStatus(monitoringData)

  return (
    <PageContainer>
      <PageHeader
        title="Memory"
        timestamp={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        isRefreshing={isFetching}
        onRefresh={refetch}
      />

      <StatusBadge status={health.type} label={health.text} />

      <Tabs
        value={currentIndex >= 0 ? currentIndex : 0}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mt: 3, mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabOrder.map((tab) => (
          <Tab key={tab} label={tabLabels[tab]} />
        ))}
      </Tabs>

      {activeTab === 'overview' && <OverviewTab data={status!} />}
      {activeTab === 'cpu' && <CpuTab data={monitoringData} />}
      {activeTab === 'memory' && <MemoryTab data={monitoringData} />}
      {activeTab === 'storage' && <StorageTab data={monitoringData} />}
      {activeTab === 'network' && <NetworkTab data={monitoringData} />}
    </PageContainer>
  )
}
