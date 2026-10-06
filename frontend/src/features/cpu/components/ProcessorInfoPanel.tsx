import type { CPUInfo } from '@/types/status'
import { radius } from '@/design/radius'

interface ProcessorInfoPanelProps {
  cpu?: CPUInfo
}

export default function ProcessorInfoPanel({ cpu }: ProcessorInfoPanelProps) {
  const model = cpu?.model || 'ARM Cortex-A76'
  const arch = cpu?.architecture || 'aarch64'
  const cores = cpu?.physical_cores || cpu?.logical_cores || 8
  const governor = cpu?.governor || 'ondemand'

  const cacheL1 = cpu?.cache?.l1 || '64 KB / core'
  const cacheL2 = cpu?.cache?.l2 || '512 KB / core'
  const cacheL3 = cpu?.cache?.l3 || '4 MB shared'

  const formatNum = (num?: number, fallback = '12.4k') => {
    if (typeof num === 'number' && num > 0) {
      if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
      return `${num}`
    }
    return fallback
  }

  const ctxSwitches = formatNum(cpu?.interrupts?.context_switches, '12.4k')
  const irqs = formatNum(cpu?.interrupts?.interrupts, '4.1k')
  const softirqs = formatNum(cpu?.interrupts?.softirqs, '821')

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '18px 20px 14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
            PROCESSOR
          </span>
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            cpuinfo
          </span>
        </div>

        {/* Title / Model row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: '#A9B665',
              display: 'inline-block',
              boxShadow: '0 0 6px rgba(169, 182, 101, 0.4)',
            }}
          />
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--kuro-color-text-primary)',
              lineHeight: 1.2,
            }}
          >
            {model}
          </span>
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', marginBottom: 14, marginLeft: 15 }}>
          {arch} · rev 4 · {cores} cores
        </div>

        {/* Specifications list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingBottom: 14,
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Architecture</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              ARMv8.2-A
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Cache L1</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {cacheL1}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Cache L2</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {cacheL2}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Cache L3</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {cacheL3}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Governor</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {governor}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>—</span>
              <span style={{ color: 'var(--kuro-color-text-muted)' }}>Throttle</span>
            </div>
            <span style={{ color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              85°C
            </span>
          </div>
        </div>
      </div>

      {/* Interrupts Sub-section */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--kuro-color-text-muted)',
            marginBottom: 8,
          }}
        >
          INTERRUPTS (LAST 60S)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: 6,
              padding: '8px 4px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--kuro-color-text-primary)',
                fontFamily: 'var(--kuro-font-family-mono, monospace)',
                lineHeight: 1.1,
              }}
            >
              {ctxSwitches}
            </span>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', lineHeight: 1 }}>
              Ctx switch
            </span>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: 6,
              padding: '8px 4px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--kuro-color-text-primary)',
                fontFamily: 'var(--kuro-font-family-mono, monospace)',
                lineHeight: 1.1,
              }}
            >
              {irqs}
            </span>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', lineHeight: 1 }}>
              IRQs
            </span>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: 6,
              padding: '8px 4px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--kuro-color-text-primary)',
                fontFamily: 'var(--kuro-font-family-mono, monospace)',
                lineHeight: 1.1,
              }}
            >
              {softirqs}
            </span>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', lineHeight: 1 }}>
              Soft IRQ
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
