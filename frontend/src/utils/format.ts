export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return days > 0
    ? `${days}d ${hours}h ${minutes}m`
    : `${hours}h ${minutes}m`
}

/** Formats a date, ISO string, timestamp number, or date-time string into "YYYY-MM-DD  12:00 AM/PM" format. */
export function formatDateTime(input: string | number | Date | null | undefined): string {
  if (!input) return '—'
  let d: Date
  if (input instanceof Date) {
    d = input
  } else if (typeof input === 'number') {
    d = new Date(input < 1e11 ? input * 1000 : input)
  } else if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return '—'
    
    // Direct regex match for "YYYY-MM-DD HH:mm:ss" / "YYYY-MM-DD HH:mm" without timezone shifting
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
    if (match && match[4] !== undefined) {
      const [, year, month, day, hourStr, minStr] = match
      let hour = parseInt(hourStr, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      hour = hour % 12 || 12
      const hh = String(hour).padStart(2, '0')
      return `${year}-${month}-${day}  ${hh}:${minStr} ${ampm}`
    }

    const parsed = new Date(trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed)
    if (!isNaN(parsed.getTime())) {
      d = parsed
    } else {
      return trimmed
    }
  } else {
    return '—'
  }

  if (isNaN(d.getTime())) return typeof input === 'string' ? input : '—'

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  let hours = d.getHours()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  const hh = String(hours).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}  ${hh}:${mins} ${ampm}`
}

