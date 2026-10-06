import { useState, useEffect, useCallback, useMemo } from "react"
import * as auditApi from "../api/audit"
import { filterEntries, DEFAULT_PAGE_SIZE } from "../utils/audit"
import type { AuditEntry, AuditAction } from "../types"

export interface UseAuditReturn {
  entries: AuditEntry[]
  loading: boolean
  error: string | null
  search: string
  setSearch: (q: string) => void
  actionFilter: AuditAction | ""
  setActionFilter: (a: AuditAction | "") => void
  selected: AuditEntry | null
  setSelected: (e: AuditEntry | null) => void
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

export function useAudit(): UseAuditReturn {
  const [allEntries, setAllEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState<AuditAction | "">("")
  const [selected, setSelected] = useState<AuditEntry | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (startOffset: number, append: boolean) => {
    setError(null)
    if (!append) setLoading(true)
    try {
      const data = await auditApi.listAudit({
        action: actionFilter || undefined,
        offset: startOffset,
        limit: DEFAULT_PAGE_SIZE,
      })
      if (append) {
        setAllEntries((prev) => [...prev, ...data])
      } else {
        setAllEntries(data)
      }
      setHasMore(data.length === DEFAULT_PAGE_SIZE)
      setOffset(startOffset + data.length)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load audit events."
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      setAllEntries([])
      setOffset(0)
      setHasMore(true)
      setSelected(null)
      load(0, false)
    }, 0)
    return () => clearTimeout(timer)
  }, [load])

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await load(offset, true)
    }
  }, [loading, hasMore, load, offset])

  const refresh = useCallback(async () => {
    setAllEntries([])
    setOffset(0)
    setHasMore(true)
    setSelected(null)
    await load(0, false)
  }, [load])

  const entries = useMemo(() => filterEntries(allEntries, search), [allEntries, search])

  return {
    entries,
    loading,
    error,
    search,
    setSearch,
    actionFilter,
    setActionFilter,
    selected,
    setSelected,
    hasMore,
    loadMore,
    refresh,
  }
}
