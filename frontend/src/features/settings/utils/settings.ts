import type { SettingsCategory } from "../types"

export interface CategoryMeta {
  id: SettingsCategory
  label: string
  description: string
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "general",
    label: "General",
    description: "Server identity and storage paths",
  },
  {
    id: "docker",
    label: "Docker",
    description: "Docker daemon connection and timeouts",
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "WebSocket PTY session configuration",
  },
  {
    id: "history",
    label: "History",
    description: "Historical metric sampling and retention",
  },
]

export const CATEGORY_MAP: Record<SettingsCategory, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<SettingsCategory, CategoryMeta>

export function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`
  if (seconds >= 60) return `${(seconds / 60).toFixed(0)}m`
  return `${seconds}s`
}
