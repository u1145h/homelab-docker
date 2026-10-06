import type { ReactNode } from 'react'

export interface KeyValuePair {
  label: string
  value: string | number | ReactNode
}

export interface KeyValueTableProps {
  entries: KeyValuePair[]
  className?: string
}

export function KeyValueTable({ entries, className }: KeyValueTableProps) {
  return (
    <table className={className} style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {entries.map((entry, i) => (
          <tr key={i}>
            <td
              style={{
                padding: '8px 16px 8px 0',
                color: 'var(--kuro-color-text-secondary)',
                fontSize: 11,
                whiteSpace: 'nowrap',
                verticalAlign: 'top',
                width: 1,
              }}
            >
              {entry.label}
            </td>
            <td
              style={{
                padding: '8px 0',
                fontSize: 11,
                color: 'var(--kuro-color-text-primary)',
                wordBreak: 'break-all',
                fontFamily: 'var(--kuro-font-family-mono)',
              }}
            >
              {entry.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
