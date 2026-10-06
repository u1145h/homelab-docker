export interface AuditEntry {
  id: string
  action: AuditAction
  actor: string
  target?: string
  status: "success" | "warning" | "failure"
  message?: string
  metadata?: Record<string, unknown>
  timestamp: string
}

export type AuditAction =
  | "user.create"
  | "user.update"
  | "user.delete"
  | "user.login"
  | "user.password_change"
  | "container.start"
  | "container.stop"
  | "container.restart"
  | "project.up"
  | "project.down"
  | "project.restart"
  | "session.open"
  | "session.close"
  | "session.timeout"
  | "file.create"
  | "file.update"
  | "file.delete"
  | "file.rename"
  | "file.move"
  | "file.copy"

export interface AuditFilter {
  action?: AuditAction
  offset: number
  limit: number
}

export const VALID_ACTIONS: AuditAction[] = [
  "user.create",
  "user.update",
  "user.delete",
  "user.login",
  "user.password_change",
  "container.start",
  "container.stop",
  "container.restart",
  "project.up",
  "project.down",
  "project.restart",
  "session.open",
  "session.close",
  "session.timeout",
  "file.create",
  "file.update",
  "file.delete",
  "file.rename",
  "file.move",
  "file.copy",
]

export interface AuditConfig {
  retention_days: number
  storage_backend: string
  stream_targets: string
}
