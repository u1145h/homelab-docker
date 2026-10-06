import type { NavItem } from "./types"

export type UserRole = "admin" | "user" | "readonly"

export const rolePermissions: Record<string, UserRole[]> = {
  dashboard: ["admin", "user", "readonly"],
  monitoring: ["admin", "user", "readonly"],
  management: ["admin", "user"],
  system: ["admin"],
}

export function filterNavByRole(items: NavItem[], role: UserRole): NavItem[] {
  const allowedGroups = Object.entries(rolePermissions)
    .filter(([, roles]) => roles.includes(role))
    .map(([group]) => group)

  return items.filter((item) => allowedGroups.includes(item.group))
}
