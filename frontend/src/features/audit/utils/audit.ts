import type { AuditEntry, AuditAction } from "../types"
import { formatDateTime } from "@/utils/format"

export function formatTimestamp(iso: string): string {
  return formatDateTime(iso)
}

export function getActionColor(action: string): "default" | "primary" | "secondary" | "info" | "success" | "warning" | "error" {
  if (action.startsWith("user.")) return "primary"
  if (action.startsWith("container.") || action.startsWith("project.")) return "info"
  if (action.startsWith("session.")) return "secondary"
  if (action.startsWith("file.")) return "warning"
  return "default"
}

export function getStatusColor(status: "success" | "failure"): "success" | "error" {
  return status === "success" ? "success" : "error"
}

export function getActionGroup(action: AuditAction): string {
  const group = action.split(".")[0]
  const groupLabels: Record<string, string> = {
    user: "User",
    container: "Container",
    project: "Project",
    session: "Session",
    file: "File",
  }
  return groupLabels[group] ?? action
}

export function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    "user.create": "Create User",
    "user.update": "Update User",
    "user.delete": "Delete User",
    "user.login": "Login",
    "user.password_change": "Password Change",
    "container.start": "Start Container",
    "container.stop": "Stop Container",
    "container.restart": "Restart Container",
    "project.up": "Project Up",
    "project.down": "Project Down",
    "project.restart": "Project Restart",
    "session.open": "Session Open",
    "session.close": "Session Close",
    "session.timeout": "Session Timeout",
    "file.create": "Create File",
    "file.update": "Update File",
    "file.delete": "Delete File",
    "file.rename": "Rename File",
    "file.move": "Move File",
    "file.copy": "Copy File",
  }
  return labels[action] ?? action
}

export function filterEntries(entries: AuditEntry[], query: string): AuditEntry[] {
  if (!query.trim()) return entries
  const lower = query.toLowerCase()
  return entries.filter(
    (e) =>
      e.actor.toLowerCase().includes(lower) ||
      e.action.toLowerCase().includes(lower) ||
      (e.target && e.target.toLowerCase().includes(lower)) ||
      (e.message && e.message.toLowerCase().includes(lower)),
  )
}

export const DEFAULT_PAGE_SIZE = 100
