import { useState, useEffect } from 'react'
import { useStatus } from '@/hooks/useStatus'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import MemorySummaryCards from '../components/MemorySummaryCards'
import MemoryCharts, { type MemoryChartDataPoint } from '../components/MemoryCharts'
import MemoryDetailsGrid from '../components/MemoryDetailsGrid'
import TopProcessesTable from '@/features/cpu/components/TopProcessesTable'

export default function MemoryPage() {
  useDocumentTitle('Memory - HomeLab')
  const { data: status, isLoading: loading } = useStatus()
  
  const [chartData, setChartData] = useState<MemoryChartDataPoint[]>([])

  useEffect(() => {
    if (!status || !status.memory) return

    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    const newPoint: MemoryChartDataPoint = {
      time: timeStr,
      used: status.memory.used || 0,
      buffers: status.memory.buffers || 0,
      cached: status.memory.cached || 0,
      swap: status.memory.swap_used || 0,
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChartData(prev => {
      const next = [...prev, newPoint]
      // Keep last 60 points
      if (next.length > 60) return next.slice(next.length - 60)
      return next
    })
  }, [status])

  if (loading && !status) {
    return <div style={{ padding: 24, color: 'var(--kuro-color-text-muted)' }}>Loading Memory stats...</div>
  }

  if (!status || !status.memory) {
    return <div style={{ padding: 24, color: 'var(--kuro-color-text-muted)' }}>Memory stats unavailable</div>
  }

  const { memory, processes } = status

  return (
    <div className="memory-page-root">
      <MemorySummaryCards memory={memory} />
      <MemoryCharts data={chartData} current={memory} />
      <MemoryDetailsGrid memory={memory} />
      <TopProcessesTable processes={processes?.top_memory || processes?.top || []} title="TOP PROCESSES BY MEMORY" hideUserColumn />
    </div>
  )
}
