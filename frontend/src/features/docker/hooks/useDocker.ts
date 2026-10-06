import { useState, useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSnackbar } from "@/hooks/useSnackbar"
import * as dockerApi from "../api/docker"
import { filterContainers } from "../utils/docker"
import type { ContainerSummary, ContainerDetail, ContainerFilter } from "../types"

export function useDocker() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<ContainerFilter>("all")
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ContainerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const { showSnackbar } = useSnackbar()

  const {
    data: containers = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["docker", "containers"],
    queryFn: dockerApi.getContainers,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 2,
  })

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const data = await dockerApi.getContainerDetail(id)
      setDetail(data)
    } catch {
      setDetail(null)
      showSnackbar("Failed to load container details.", "error")
    } finally {
      setDetailLoading(false)
    }
  }, [showSnackbar])

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    await loadDetail(id)
  }, [loadDetail])

  const closeDetail = useCallback(() => {
    setSelectedId(null)
    setDetail(null)
  }, [])

  const filteredContainers = useMemo(
    () => filterContainers(containers, search, filter),
    [containers, search, filter],
  )

  const summary = useMemo(() => {
    const total = containers.length
    const running = containers.filter((c) => c.state === "running").length
    const stopped = containers.filter((c) => c.state === "exited").length
    const paused = containers.filter((c) => c.state === "paused").length
    return { total, running, stopped, paused }
  }, [containers])

  const runAction = useCallback(
    async (id: string, name: string, action: () => Promise<void>, successMsg: string) => {
      setBusyIds((prev) => new Set(prev).add(id))
      try {
        await action()
        showSnackbar(`${name}: ${successMsg}`, "success")
        void refetch()
      } catch {
        showSnackbar(`${name}: action failed`, "error")
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        if (selectedId === id) {
          await loadDetail(id)
        }
      }
    },
    [refetch, loadDetail, selectedId, showSnackbar],
  )

  const handleStart = useCallback(
    (c: ContainerSummary) => runAction(c.id, c.name, () => dockerApi.startContainer(c.id), "Started"),
    [runAction],
  )

  const handleStop = useCallback(
    (c: ContainerSummary) => runAction(c.id, c.name, () => dockerApi.stopContainer(c.id), "Stopped"),
    [runAction],
  )

  const handleRestart = useCallback(
    (c: ContainerSummary) => runAction(c.id, c.name, () => dockerApi.restartContainer(c.id), "Restarted"),
    [runAction],
  )

  return {
    containers,
    filteredContainers,
    loading,
    error: error ? (error instanceof Error ? error.message : "Failed to load Docker containers.") : null,
    search,
    setSearch,
    filter,
    setFilter,
    busyIds,
    summary,
    selectedId,
    detail,
    detailLoading,
    openDetail,
    closeDetail,
    handleStart,
    handleStop,
    handleRestart,
    refetch,
  }
}
