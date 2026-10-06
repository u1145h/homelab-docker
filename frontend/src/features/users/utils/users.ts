import type { UserResponse, UserRole, UserFilter } from "../types"

export function filterUsers(users: UserResponse[], query: string, filter: UserFilter): UserResponse[] {
  let filtered = users

  if (filter !== "all") {
    filtered = filtered.filter((u) => u.role === filter)
  }

  if (query.trim()) {
    const lower = query.toLowerCase()
    filtered = filtered.filter(
      (u) =>
        u.username.toLowerCase().includes(lower) ||
        u.role.toLowerCase().includes(lower),
    )
  }

  return filtered
}

export function getRoleColor(role: UserRole): "primary" | "success" | "default" {
  switch (role) {
    case "admin":
      return "primary"
    case "user":
      return "success"
    case "client":
    case "readonly":
      return "default"
  }
}

export function computeSummary(users: UserResponse[]) {
  const total = users.length
  const admins = users.filter((u) => u.role === "admin").length
  const regular = users.filter((u) => u.role === "user").length
  const clients = users.filter((u) => u.role === "client").length
  const readonly = users.filter((u) => u.role === "readonly").length
  return { total, admins, regular, clients, readonly }
}

import { formatDateTime } from "@/utils/format"

export function formatTimestamp(iso: string): string {
  return formatDateTime(iso)
}

export const VALID_ROLES: UserRole[] = ["admin", "user", "client", "readonly"]
