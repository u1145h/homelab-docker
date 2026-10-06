import type { ContainerFilter } from '../types'
import { radius } from '@/design/radius'

const FILTERS: { value: ContainerFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'paused', label: 'Paused' },
  { value: 'restarting', label: 'Restarting' },
]

interface DockerToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  filter: ContainerFilter
  onFilterChange: (f: ContainerFilter) => void
}

export default function DockerToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
}: DockerToolbarProps) {
  return (
    <div
      className="docker-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Search input */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--kuro-color-text-muted)',
            pointerEvents: 'none',
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, image, or ID..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px 8px 34px',
            fontSize: 11,
            fontFamily: 'inherit',
            backgroundColor: 'var(--kuro-color-surface)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.input,
            color: 'var(--kuro-color-text-primary)',
            outline: 'none',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--kuro-color-accent)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
          }}
        />
      </div>

      {/* Filter tabs */}
      <div
        className="docker-toolbar-filters"
        style={{
          display: 'flex',
          gap: 4,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {FILTERS.map((f) => {
          const isActive = filter === f.value
          return (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: isActive ? 600 : 500,
                fontFamily: 'inherit',
                borderRadius: radius.button,
                border: '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: isActive ? 'var(--kuro-color-hover)' : 'transparent',
                color: isActive
                  ? 'var(--kuro-color-accent)'
                  : 'var(--kuro-color-text-secondary)',
                borderColor: isActive ? 'var(--kuro-color-border)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface)'
                  e.currentTarget.style.color = 'var(--kuro-color-text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--kuro-color-text-secondary)'
                }
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
