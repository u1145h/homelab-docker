import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useStatus } from '@/hooks/useStatus'
import StorageSummaryCards from '../components/StorageSummaryCards'
import CapacityMix from '../components/CapacityMix'
import IOThroughputChart from '../components/IOThroughputChart'
import MountsGrid from '../components/MountsGrid'
import BlockDevicesTable from '../components/BlockDevicesTable'
import FilesystemCache from '../components/FilesystemCache'
import { LoadingState, ErrorState } from '@/components/ui/feedback'

export default function StoragePage() {
  useDocumentTitle('Storage - HomeLab')
  const { data, isLoading, error, refetch } = useStatus()
  const storage = data?.storage

  if (isLoading && !storage) {
    return <LoadingState message="Loading storage info..." />
  }

  if (error && !storage) {
    return <ErrorState message={error.message || 'Failed to load storage info'} onRetry={refetch} />
  }

  if (!storage) {
    return null
  }

  return (
    <div className="storage-page-root">

      <StorageSummaryCards summary={storage.summary} />

        <div className="responsive-content-grid" style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr'
        }}>
          <CapacityMix mix={storage.capacity_mix} />
          <IOThroughputChart io={storage.io_throughput} />
        </div>

        <div className="responsive-content-grid" style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr'
        }}>
          <BlockDevicesTable devices={storage.block_devices || []} onRefresh={refetch} />
          <FilesystemCache cache={storage.filesystem_cache} />
        </div>

        <div>
          <MountsGrid mounts={storage.mounts || []} />
        </div>
    </div>
  )
}
