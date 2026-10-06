import { formatDateTime } from './format'

export function formatRelativeTime(date: Date | number | null | undefined): string {
  if (date == null) return ''

  const now = Date.now()
  const then = typeof date === 'number' ? date : date.getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`

  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`

  return formatDateTime(then)
}
