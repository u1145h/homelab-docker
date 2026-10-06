import { useMemo } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useStatus } from '@/hooks/useStatus'
import { PageContainer, PageHeader } from '@/components/shell'
import { Panel } from '@/components/ui/surface'
import { AutoGrid } from '@/components/ui/layout'
import { KeyValueTable } from '@/components/ui/display'
import { LoadingState, ErrorState } from '@/components/ui/feedback'
import { formatDateTime } from '@/utils/format'
import type { KeyValuePair } from '@/components/ui/display'

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

function formatDate(iso: string): string {
  return formatDateTime(iso)
}

export default function AboutPage() {
  useDocumentTitle('About - HomeLab')
  const { data: status, isLoading, isError, error, refetch } = useStatus()

  const serverEntries: KeyValuePair[] = useMemo(() => {
    if (!status) return []
    return [
      { label: 'Hostname', value: status.system.hostname },
      { label: 'Uptime', value: formatUptime(status.system.uptime) },
      { label: 'Boot Time', value: formatDate(status.system.boot_time) },
    ]
  }, [status])

  const osEntries: KeyValuePair[] = useMemo(() => {
    if (!status) return []
    return [
      { label: 'OS', value: status.system.os },
      { label: 'Kernel', value: status.system.kernel },
      { label: 'Architecture', value: status.system.arch },
    ]
  }, [status])

  const runtimeEntries: KeyValuePair[] = useMemo(() => {
    if (!status) return []
    return [
      { label: 'Go Version', value: status.system.go },
    ]
  }, [status])

  return (
    <PageContainer fullWidth padding={10}>
      <PageHeader title="About" />

      {isLoading && <LoadingState message="Loading system information..." />}

      {isError && !status && (
        <ErrorState
          title="Failed to load system information"
          message={error instanceof Error ? error.message : 'Unable to reach the server.'}
          onRetry={refetch}
        />
      )}

      {status && (
        <AutoGrid minItemWidth={320} gap={24}>
          <Panel title="Server">
            <KeyValueTable entries={serverEntries} />
          </Panel>
          <Panel title="Operating System">
            <KeyValueTable entries={osEntries} />
          </Panel>
          <Panel title="Runtime">
            <KeyValueTable entries={runtimeEntries} />
          </Panel>
        </AutoGrid>
      )}
    </PageContainer>
  )
}
