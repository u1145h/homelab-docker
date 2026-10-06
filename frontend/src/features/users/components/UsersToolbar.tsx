import { radius } from '@/design/radius'

interface UsersToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  onAddUser: () => void
}

export default function UsersToolbar({
  search,
  onSearchChange,
  onAddUser,
}: UsersToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
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
          placeholder="Search users..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 12px 9px 34px',
            fontSize: 12,
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

      {/* Add User button */}
      <button
        onClick={onAddUser}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '9px 14px',
          fontSize: 11.5,
          fontWeight: 600,
          fontFamily: 'inherit',
          borderRadius: radius.button,
          border: '1px solid var(--kuro-color-border)',
          backgroundColor: 'var(--kuro-color-surface)',
          color: 'var(--kuro-color-text-primary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)'
          e.currentTarget.style.borderColor = 'var(--kuro-color-accent, #b8bb26)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface)'
          e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        Add User
      </button>
    </div>
  )
}
