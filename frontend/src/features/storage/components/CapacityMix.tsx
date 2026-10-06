import { formatBytes } from '@/utils/format'
import type { StorageCapacityMix } from '@/types/status'
import { radius } from '@/design/radius'

interface CapacityMixProps {
  mix?: StorageCapacityMix[]
}

export default function CapacityMix({ mix }: CapacityMixProps) {
  const hasData = mix && mix.length > 0 && mix.some((item) => item.total > 0)
  const total = hasData ? mix.reduce((acc, curr) => acc + curr.total, 0) : 0
  const used = hasData ? mix.reduce((acc, curr) => acc + curr.used, 0) : 0
  const usagePercent = total > 0 ? ((used / total) * 100).toFixed(0) : '0'

  return (
    <div style={{
      backgroundColor: 'var(--kuro-color-surface)',
      border: '1px solid var(--kuro-color-border)',
      borderRadius: radius.card,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      height: '100%'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
          Capacity Mix
        </div>
        {hasData && (
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            {usagePercent}% used
          </div>
        )}
      </div>

      {!hasData ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>
          No result found
        </div>
      ) : (
        <>
          {/* Progress Bar */}
          <div style={{ display: 'flex', height: '6px', borderRadius: radius.badge, overflow: 'hidden', backgroundColor: 'var(--kuro-color-border)' }}>
            {mix.map((item, i) => (
              <div key={i} style={{ width: `${total > 0 ? (item.total / total) * 100 : 0}%`, backgroundColor: item.color }} />
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mix.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '2px', backgroundColor: item.color, borderRadius: '1px' }} />
                  <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                  {item.used > 0 ? `${formatBytes(item.used)} / ${formatBytes(item.total)}` : formatBytes(item.total)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
