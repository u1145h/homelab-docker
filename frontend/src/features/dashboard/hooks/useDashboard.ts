import { useMemo } from "react"
import { useStatus } from "@/hooks/useStatus"
import { buildDashboardStats, buildSystemSummary } from "../utils/dashboard"
import type { DashboardData } from "../types"

export function useDashboard(): {
  data: DashboardData | null
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

  const dashboardData = useMemo<DashboardData | null>(() => {
    if (!status) return null
    return {
      stats: buildDashboardStats(status),
      system: buildSystemSummary(status),
      status,
      lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : new Date(),
    }
  }, [status, dataUpdatedAt])

  return {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  }
}
