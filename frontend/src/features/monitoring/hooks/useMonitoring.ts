import { useMemo } from "react"
import { useStatus } from "@/hooks/useStatus"
import { buildMonitoringData } from "../utils/monitoring"
import type { MonitoringData } from "../types"

export function useMonitoring(): {
  data: MonitoringData | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  isFetching: boolean
  dataUpdatedAt: Date | null
} {
  const {
    data: status,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useStatus()

  const monitoringData = useMemo<MonitoringData | null>(() => {
    if (!status) return null
    return buildMonitoringData(status)
  }, [status])

  return {
    data: monitoringData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  }
}
