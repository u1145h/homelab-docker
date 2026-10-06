import type { NotificationSeverity, NotificationCategory } from "../../types/notification"
import { formatDateTime } from "@/utils/format"

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 45) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`

  return formatDateTime(dateString)
}

export function formatFullDateTime(dateString: string): string {
  return formatDateTime(dateString)
}

export function getSeverityColor(severity: NotificationSeverity): {
  color: string
  bg: string
  border: string
  icon: 'alert-triangle' | 'x-circle' | 'check-circle' | 'info'
} {
  switch (severity) {
    case 'critical':
      return {
        color: '#f87171',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.25)',
        icon: 'x-circle',
      }
    case 'warning':
      return {
        color: '#fbbf24',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.25)',
        icon: 'alert-triangle',
      }
    case 'success':
      return {
        color: '#4ade80',
        bg: 'rgba(34, 197, 94, 0.12)',
        border: 'rgba(34, 197, 94, 0.25)',
        icon: 'check-circle',
      }
    case 'info':
    default:
      return {
        color: '#60a5fa',
        bg: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.25)',
        icon: 'info',
      }
  }
}

export function getCategoryIconName(category: NotificationCategory): any {
  switch (category) {
    case 'cpu':
      return 'cpu'
    case 'memory':
      return 'activity'
    case 'storage':
      return 'hard-drive'
    case 'thermal':
      return 'thermometer'
    case 'battery':
      return 'battery-full'
    case 'docker':
      return 'container'
    case 'network':
      return 'network'
    case 'tailscale':
      return 'wifi'
    case 'auth':
      return 'user'
    case 'task':
      return 'clock'
    case 'system':
    default:
      return 'server'
  }
}
