import { useState, useEffect, useCallback, useMemo } from "react"
import * as usersApi from "../api/users"
import { filterUsers, computeSummary } from "../utils/users"
import type { UserResponse, UserFilter } from "../types"

export interface UseUsersReturn {
  users: UserResponse[]
  filtered: UserResponse[]
  loading: boolean
  error: string | null
  search: string
  setSearch: (q: string) => void
  filter: UserFilter
  setFilter: (f: UserFilter) => void
  summary: ReturnType<typeof computeSummary>
  refresh: () => Promise<void>
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<UserResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<UserFilter>("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await usersApi.listUsers()
      setUsers(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load users."
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  const filtered = useMemo(() => filterUsers(users, search, filter), [users, search, filter])
  const summary = useMemo(() => computeSummary(users), [users])

  return {
    users,
    filtered,
    loading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    summary,
    refresh: load,
  }
}
