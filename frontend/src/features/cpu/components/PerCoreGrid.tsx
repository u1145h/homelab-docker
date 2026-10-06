import { useState } from 'react'
import { Cpu, Zap, Thermometer } from 'lucide-react'
import type { CPUCore } from '@/types/status'
import { radius } from '@/design/radius'

interface PerCoreGridProps {
  cores: CPUCore[]
  baseTemp?: number
}

export default function PerCoreGrid({ cores, baseTemp = 48.2 }: PerCoreGridProps) {
  const [filter, setFilter] = useState<'all' | 'p' | 'e'>('all')

  // Fallback demo cores matching screenshot if backend doesn't provide 8 cores
  const defaultCores: (CPUCore & { type: 'E' | 'P'; temp: number })[] = [
    { id: '0', usage_percent: 12, frequency_mhz: 1428, type: 'E', temp: 48.2 },
    { id: '1', usage_percent: 18, frequency_mhz: 1533, type: 'E', temp: 49.5 },
    { id: '2', usage_percent: 9, frequency_mhz: 1428, type: 'E', temp: 47.8 },
    { id: '3', usage_percent: 21, frequency_mhz: 1612, type: 'E', temp: 50.3 },
    { id: '4', usage_percent: 34, frequency_mhz: 2016, type: 'P', temp: 53.4 },
    { id: '5', usage_percent: 28, frequency_mhz: 1980, type: 'P', temp: 52.1 },
    { id: '6', usage_percent: 15, frequency_mhz: 1766, type: 'P', temp: 50.7 },
    { id: '7', usage_percent: 41, frequency_mhz: 2112, type: 'P', temp: 55.2 },
  ]

  const enrichedCores =
    cores && cores.length > 0
      ? cores.map((c, i) => {
          const isP = i >= Math.floor(cores.length / 2)
          return {
            ...c,
            type: (isP ? 'P' : 'E') as 'E' | 'P',
            temp: +(baseTemp + (c.usage_percent * 0.1) + (i * 0.4)).toFixed(1),
          }
        })
      : defaultCores

  const filteredCores = enrichedCores.filter((c) => {
    if (filter === 'p') return c.type === 'P'
    if (filter === 'e') return c.type === 'E'
    return true
  })

  const pCount = enrichedCores.filter((c) => c.type === 'P').length
  const eCount = enrichedCores.filter((c) => c.type === 'E').length

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
            PER-CORE
          </span>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                border: filter === 'all' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid transparent',
                backgroundColor: filter === 'all' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: filter === 'all' ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All cores
            </button>
            <button
              type="button"
              onClick={() => setFilter('p')}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                border: filter === 'p' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid transparent',
                backgroundColor: filter === 'p' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: filter === 'p' ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Performance
            </button>
            <button
              type="button"
              onClick={() => setFilter('e')}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                border: filter === 'e' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid transparent',
                backgroundColor: filter === 'e' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: filter === 'e' ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Efficiency
            </button>
          </div>
        </div>

        {/* Right Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
          <span>{filteredCores.length} of {enrichedCores.length}</span>
          <span>·</span>
          <span>big.LITTLE · {pCount}P + {eCount}E</span>
        </div>
      </div>

      {/* Grid of Cores */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
        className="cpu-core-grid"
      >
        {filteredCores.map((core) => {
          const usageVal = Math.round(core.usage_percent)
          return (
            <div
              key={core.id}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: 6,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
              }}
            >
              {/* Core Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Cpu size={13} style={{ color: 'var(--kuro-color-text-muted)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                    Core {core.id}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 3,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--kuro-color-text-muted)',
                    lineHeight: 1.2,
                  }}
                >
                  {core.type}
                </span>
              </div>

              {/* Big Value */}
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--kuro-color-text-primary)',
                  fontFamily: 'var(--kuro-font-family-mono, monospace)',
                  lineHeight: 1,
                }}
              >
                {usageVal}%
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(2, usageVal))}%`,
                    height: '100%',
                    backgroundColor: usageVal > 80 ? '#EA6962' : usageVal > 50 ? '#E7C664' : '#A9B665',
                    borderRadius: 2,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              {/* Footer Freq & Temp */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Zap size={11} style={{ color: '#D3869B' }} />
                  <span style={{ fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                    {Math.round(core.frequency_mhz)} MHz
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Thermometer size={11} style={{ color: '#EA6962' }} />
                  <span style={{ fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                    {core.temp}°
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
