import React, { useState } from 'react'
import { Popover } from '@mui/material'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'

export interface DateRange {
  startDate: string | null // YYYY-MM-DD
  endDate: string | null   // YYYY-MM-DD
}

export interface CalendarRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const PRESETS = [
  { label: 'All Time', getValue: () => ({ startDate: null, endDate: null }) },
  {
    label: 'Today',
    getValue: () => {
      const today = new Date().toISOString().split('T')[0]
      return { startDate: today, endDate: today }
    },
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const yesterday = d.toISOString().split('T')[0]
      return { startDate: yesterday, endDate: yesterday }
    },
  },
  {
    label: 'L 7D',
    getValue: () => {
      const end = new Date().toISOString().split('T')[0]
      const d = new Date()
      d.setDate(d.getDate() - 6)
      const start = d.toISOString().split('T')[0]
      return { startDate: start, endDate: end }
    },
  },
  {
    label: 'L 30D',
    getValue: () => {
      const end = new Date().toISOString().split('T')[0]
      const d = new Date()
      d.setDate(d.getDate() - 29)
      const start = d.toISOString().split('T')[0]
      return { startDate: start, endDate: end }
    },
  },
]

export function CalendarRangePicker({ value, onChange }: CalendarRangePickerProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  // Current calendar view month (defaults to current month or start date's month)
  const initialDate = value.startDate ? new Date(value.startDate) : new Date()
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())

  // Internal draft selection before applying
  const [draftStart, setDraftStart] = useState<string | null>(value.startDate)
  const [draftEnd, setDraftEnd] = useState<string | null>(value.endDate)
  const [hoverDate, setHoverDate] = useState<string | null>(null)

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
    setDraftStart(value.startDate)
    setDraftEnd(value.endDate)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleDateClick = (dateStr: string) => {
    if (!draftStart || (draftStart && draftEnd)) {
      // Start a new range
      setDraftStart(dateStr)
      setDraftEnd(null)
    } else if (draftStart && !draftEnd) {
      if (dateStr < draftStart) {
        setDraftStart(dateStr)
        setDraftEnd(draftStart)
      } else {
        setDraftEnd(dateStr)
      }
    }
  }

  const handleApply = () => {
    onChange({
      startDate: draftStart,
      endDate: draftEnd || draftStart,
    })
    handleClose()
  }

  const handleClear = () => {
    setDraftStart(null)
    setDraftEnd(null)
    onChange({ startDate: null, endDate: null })
    handleClose()
  }

  const handlePresetSelect = (preset: typeof PRESETS[number]) => {
    const range = preset.getValue()
    setDraftStart(range.startDate)
    setDraftEnd(range.endDate)
    onChange(range)
    handleClose()
  }

  // Generate calendar grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sunday

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  const formatDisplayLabel = () => {
    if (!value.startDate && !value.endDate) {
      return 'All Dates'
    }
    if (value.startDate && value.endDate && value.startDate === value.endDate) {
      const today = new Date().toISOString().split('T')[0]
      if (value.startDate === today) return 'Today'
      return value.startDate
    }
    if (value.startDate && value.endDate) {
      return `${value.startDate}  →  ${value.endDate}`
    }
    return value.startDate || 'Select Date'
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px',
          borderRadius: radius.button,
          border: '1px solid var(--kuro-color-border)',
          backgroundColor: value.startDate ? 'var(--kuro-color-hover)' : 'var(--kuro-color-surface)',
          color: value.startDate ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-secondary)',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--kuro-color-accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
        }}
      >
        <AppIcon name="clock" size={14} />
        <span>{formatDisplayLabel()}</span>
        <AppIcon name="chevron-down" size={12} />
      </button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              backgroundColor: 'var(--kuro-color-surface)',
              backgroundImage: 'none',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.modal,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
              mt: 1,
              p: 2,
              overflow: 'hidden',
            },
          },
        }}
      >
        {/* Quick presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {PRESETS.map((p) => {
            const range = p.getValue()
            const isSelected =
              draftStart === range.startDate && (draftEnd === range.endDate || (!draftEnd && !range.endDate))
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePresetSelect(p)}
                style={{
                  padding: '4px 8px',
                  borderRadius: radius.button,
                  border: isSelected
                    ? '1px solid var(--kuro-color-accent)'
                    : '1px solid var(--kuro-color-border)',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--kuro-color-background)',
                  color: isSelected ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Month Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            padding: '0 4px',
          }}
        >
          <button
            type="button"
            onClick={handlePrevMonth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: radius.button,
              border: '1px solid var(--kuro-color-border)',
              background: 'transparent',
              color: 'var(--kuro-color-text-primary)',
              cursor: 'pointer',
            }}
          >
            <AppIcon name="chevron-left" size={13} />
          </button>

          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
            {monthNames[viewMonth]} {viewYear}
          </span>

          <button
            type="button"
            onClick={handleNextMonth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: radius.button,
              border: '1px solid var(--kuro-color-border)',
              background: 'transparent',
              color: 'var(--kuro-color-text-primary)',
              cursor: 'pointer',
            }}
          >
            <AppIcon name="chevron-right" size={13} />
          </button>
        </div>

        {/* Day Header Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            marginBottom: 6,
            textAlign: 'center',
          }}
        >
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <span
              key={d}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--kuro-color-text-muted)',
                padding: '2px 0',
              }}
            >
              {d}
            </span>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            marginBottom: 14,
          }}
          onMouseLeave={() => setHoverDate(null)}
        >
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} style={{ height: 32 }} />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

            const isStart = draftStart === dateStr
            const isEnd = draftEnd === dateStr
            const isInRange =
              draftStart &&
              draftEnd &&
              dateStr >= draftStart &&
              dateStr <= draftEnd
            const isHoverRange =
              draftStart &&
              !draftEnd &&
              hoverDate &&
              dateStr >= (draftStart < hoverDate ? draftStart : hoverDate) &&
              dateStr <= (draftStart < hoverDate ? hoverDate : draftStart)

            let bg = 'transparent'
            let color = 'var(--kuro-color-text-primary)'
            let cellRadius: string | number = radius.badge

            if (isStart || isEnd) {
              bg = 'var(--kuro-color-accent, #a9b665)'
              color = '#ffffff'
            } else if (isInRange || isHoverRange) {
              bg = 'rgba(169, 182, 101, 0.2)'
              color = 'var(--kuro-color-accent, #a9b665)'
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDateClick(dateStr)}
                onMouseEnter={() => setHoverDate(dateStr)}
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: cellRadius,
                  border: 'none',
                  backgroundColor: bg,
                  color,
                  fontSize: 11,
                  fontWeight: isStart || isEnd ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background-color 0.1s ease',
                }}
              >
                {dayNum}
              </button>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--kuro-color-border)',
            paddingTop: 10,
          }}
        >
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '6px 10px',
              borderRadius: radius.button,
              border: 'none',
              background: 'transparent',
              color: 'var(--kuro-color-text-muted)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '6px 12px',
                borderRadius: radius.button,
                border: '1px solid var(--kuro-color-border)',
                background: 'transparent',
                color: 'var(--kuro-color-text-secondary)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              style={{
                padding: '6px 14px',
                borderRadius: radius.button,
                border: 'none',
                backgroundColor: 'var(--kuro-color-accent, #a9b665)',
                color: '#111314',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </Popover>
    </>
  )
}
