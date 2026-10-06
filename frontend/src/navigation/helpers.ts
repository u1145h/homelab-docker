import type { NavItem } from "./types"
import { navigation } from "./config"

export function getNavItem(path: string): NavItem | undefined {
  return navigation.find((item) => item.path === path)
}

export function getNavGroupLabel(groupId: string): string {
  const labels: Record<string, string> = {
    monitoring: "Monitoring",
    management: "Management",
    system: "System",
  }
  return labels[groupId] ?? groupId
}
