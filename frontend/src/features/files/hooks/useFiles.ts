import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import * as filesApi from "../api/files"
import { sortItems, filterItems } from "../utils/files"
import type { FileItem, DirectoryListing, SortField, SortDirection } from "../types"
import { loadFilesDefaults } from "../utils/filesDefaults"

// ── Session Storage helpers ──────────────────────────────────────────────────
const SK = {
  path:      "files_path",
  sort:      "files_sort_field",
  dir:       "files_sort_dir",
  hidden:    "files_show_hidden",
} as const

function ssGet<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw !== null) return JSON.parse(raw) as T
  } catch {}
  return fallback
}

function ssSet(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
// ────────────────────────────────────────────────────────────────────────────

export interface UseFilesReturn {
  directory: DirectoryListing | null
  items: FileItem[]
  currentPath: string
  loading: boolean
  error: string | null
  search: string
  setSearch: (q: string) => void
  sortField: SortField
  setSortField: (f: SortField) => void
  sortDirection: SortDirection
  setSortDirection: (d: SortDirection) => void
  showHidden: boolean
  setShowHidden: (val: boolean | ((prev: boolean) => boolean)) => void
  navigate: (path: string) => Promise<void>
  navigateUp: () => Promise<void>
  refresh: () => Promise<void>
  canGoUp: boolean
  extraHiddenPatterns: string[]
  defaultViewMode: 'table' | 'grid'
}

export function useFiles(): UseFilesReturn {
  // Load persistent defaults once (they only change when settings are saved)
  const defaults = useMemo(() => loadFilesDefaults(), [])

  const [directory, setDirectory] = useState<DirectoryListing | null>(null)
  // Priority: sessionStorage (last visited) → localStorage default → "/"
  const [currentPath, setCurrentPath] = useState(() => ssGet<string>(SK.path, defaults.defaultPath))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sortField, setSortFieldState] = useState<SortField>(() => ssGet<SortField>(SK.sort, "name"))
  const [sortDirection, setSortDirectionState] = useState<SortDirection>(() => ssGet<SortDirection>(SK.dir, "asc"))
  const [showHidden, setShowHiddenState] = useState<boolean>(() => ssGet<boolean>(SK.hidden, false))

  const pathRef = useRef(currentPath)

  // Persist sort/hidden prefs to sessionStorage whenever they change
  const setSortField = useCallback((f: SortField) => {
    setSortFieldState(f)
    ssSet(SK.sort, f)
  }, [])

  const setSortDirection = useCallback((d: SortDirection) => {
    setSortDirectionState(d)
    ssSet(SK.dir, d)
  }, [])

  const setShowHidden = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setShowHiddenState((prev) => {
      const next = typeof val === "function" ? val(prev) : val
      ssSet(SK.hidden, next)
      return next
    })
  }, [])

  const load = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    pathRef.current = path
    ssSet(SK.path, path)
    try {
      if (path === "/trash") {
        const trashItems = await filesApi.listTrash()
        const items: FileItem[] = trashItems.map((t) => ({
          name: t.name,
          path: t.id,
          type: t.type,
          size: t.size,
          modified: t.trashedAt,
          mode: t.originalPath ? `original: ${t.originalPath}` : "trash",
        }))
        setDirectory({
          path: "/trash",
          parent: "/",
          items,
        })
        setCurrentPath("/trash")
      } else {
        const data = await filesApi.listDirectory(path)
        setDirectory(data)
        setCurrentPath(data.path)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load directory."
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Load the stored path on mount (or "/" if none stored)
    const timer = setTimeout(() => load(pathRef.current), 0)
    return () => clearTimeout(timer)
  }, [load])

  const navigate = useCallback(async (path: string) => {
    await load(path)
  }, [load])

  const navigateUp = useCallback(async () => {
    if (directory) {
      await load(directory.parent)
    }
  }, [directory, load])

  const refresh = useCallback(async () => {
    await load(pathRef.current)
  }, [load])

  const canGoUp = directory !== null && directory.path !== "/"

  const items = useMemo(() => {
    const base = directory?.items ?? []
    const searched = filterItems(base, search)
    return sortItems(searched, sortField, sortDirection, showHidden, defaults.extraHiddenPatterns)
  }, [directory, search, sortField, sortDirection, showHidden, defaults])

  return {
    directory,
    items,
    currentPath,
    loading,
    error,
    search,
    setSearch,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    showHidden,
    setShowHidden,
    navigate,
    navigateUp,
    refresh,
    canGoUp,
    extraHiddenPatterns: defaults.extraHiddenPatterns,
    defaultViewMode: defaults.defaultViewMode,
  }
}

