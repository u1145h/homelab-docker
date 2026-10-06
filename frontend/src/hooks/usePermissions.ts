import { filterNavByRole } from "@/navigation"
import type { NavItem } from "@/navigation"
import type { UserRole } from "@/navigation/permissions"

export function usePermissions(role: UserRole = "user") {
  function filterNav(items: NavItem[]): NavItem[] {
    return filterNavByRole(items, role)
  }

  return {
    role,
    isAdmin: role === "admin",
    isUser: role === "user",
    isReadonly: role === "readonly",
    filterNav,
  }
}
