export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success'

export type NotificationCategory =
  | 'cpu'
  | 'memory'
  | 'storage'
  | 'thermal'
  | 'battery'
  | 'docker'
  | 'network'
  | 'tailscale'
  | 'auth'
  | 'system'
  | 'task'

export interface NotificationItem {
  id: string
  timestamp: string // ISO string
  severity: NotificationSeverity
  category: NotificationCategory
  title: string
  message: string
  read: boolean
  action_url?: string
}

export interface NotificationSummary {
  unread_count: number
  total_count: number
  recent: NotificationItem[]
}

export interface NotificationFilters {
  start_date?: string
  end_date?: string
  severity?: NotificationSeverity
  category?: NotificationCategory
  unread_only?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface NotificationListResponse {
  items: NotificationItem[]
  total: number
  unread_count: number
}
