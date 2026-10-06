import type { MemoryInfo } from '@/types/status'
import { formatBytes } from '@/utils/format'
import { radius } from '@/design/radius'

interface MemoryDetailsGridProps {
  memory: MemoryInfo
}

function GridPanel({ title, subtitle, children, rightAction }: { title: string, subtitle?: string, children: React.ReactNode, rightAction?: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: 'var(--kuro-color-surface)',
      border: '1px solid var(--kuro-color-border)',
      borderRadius: radius.card,
      padding: '18px 20px 14px',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>{title}</h3>
          {subtitle && <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>{subtitle}</span>}
        </div>
        {rightAction && <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>{rightAction}</div>}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string, value: string | React.ReactNode, color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--kuro-color-border)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
        {color && <div style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />}
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)', flexShrink: 0, marginLeft: 8 }}>{value}</span>
    </div>
  )
}

function KernelStat({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
        <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{value}</div>
    </div>
  )
}

export default function MemoryDetailsGrid({ memory }: MemoryDetailsGridProps) {
  const total = memory.total
  const usedPct = total > 0 ? (memory.used / total) * 100 : 0
  const buffersPct = total > 0 ? (memory.buffers / total) * 100 : 0
  const cachedPct = total > 0 ? (memory.cached / total) * 100 : 0
  const sharedPct = total > 0 ? (memory.shared / total) * 100 : 0
  const freePct = total > 0 ? (memory.free / total) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15, width: '100%', minWidth: 0 }}>
      
      {/* Composition & Swap Row */}
      <div className="responsive-content-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <GridPanel title="Composition" rightAction={`${formatBytes(total)} total`}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>{(total / 1024 / 1024 / 1024).toFixed(1)}</span>
            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>GB total</span>
          </div>
          
          <div style={{ display: 'flex', height: 6, borderRadius: radius.card, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ width: `${usedPct}%`, backgroundColor: '#3B82F6' }} />
            <div style={{ width: `${cachedPct}%`, backgroundColor: '#F59E0B' }} />
            <div style={{ width: `${buffersPct}%`, backgroundColor: '#26A69A' }} />
            <div style={{ width: `${sharedPct}%`, backgroundColor: '#8B5CF6' }} />
            <div style={{ width: `${freePct}%`, backgroundColor: 'var(--kuro-color-border)' }} />
          </div>

          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <StatRow label="Used" value={`${formatBytes(memory.used)} · ${usedPct.toFixed(0)}%`} color="#3B82F6" />
            <StatRow label="Cached" value={`${formatBytes(memory.cached)} · ${cachedPct.toFixed(0)}%`} color="#F59E0B" />
            <StatRow label="Buffers" value={`${formatBytes(memory.buffers)} · ${buffersPct.toFixed(0)}%`} color="#26A69A" />
            <StatRow label="Shared" value={`${formatBytes(memory.shared)} · ${sharedPct.toFixed(0)}%`} color="#8B5CF6" />
            <StatRow label="Free" value={`${formatBytes(memory.free)} · ${freePct.toFixed(0)}%`} color="var(--kuro-color-border)" />
          </div>
        </GridPanel>

        <GridPanel title="Swap" subtitle="zram · lz4" rightAction={`of ${formatBytes(memory.swap_total)}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>{formatBytes(memory.swap_used)}</span>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <StatRow label="Used" value={formatBytes(memory.swap_used)} color="#EF4444" />
            <StatRow label="Free" value={formatBytes(memory.swap_free)} />
            <StatRow label="Swappiness" value="100" />
            <StatRow label="Pressure" value="50" />
            <StatRow label="Compression" value="3.1x" />
          </div>
        </GridPanel>
      </div>

      {/* Kernel Memory & Modules Row */}
      <div className="responsive-content-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <GridPanel title="Kernel Memory" subtitle="slab · page tables · dirty">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(130px, 100%), 1fr))', gap: 12 }}>
            <KernelStat label="Slab" value={formatBytes(memory.slab)} color="#8B5CF6" />
            <KernelStat label="SReclaim" value={formatBytes(memory.sreclaimable)} color="#3B82F6" />
            <KernelStat label="SUnreclaim" value={formatBytes(memory.sunreclaim)} color="#F59E0B" />
            <KernelStat label="Page Tables" value={formatBytes(memory.page_tables)} color="#26A69A" />
            <KernelStat label="Kernel Stack" value={formatBytes(memory.kernel_stack)} color="#EF4444" />
            <KernelStat label="Dirty" value={formatBytes(memory.dirty)} color="#EC4899" />
            <KernelStat label="Writeback" value={formatBytes(memory.writeback)} color="#14B8A6" />
            <KernelStat label="Mapped" value={formatBytes(memory.mapped)} color="#6366F1" />
          </div>
        </GridPanel>

        <GridPanel title="Modules" subtitle="2 slots · 6 GB installed">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4CAF50' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>LPDDR4x @ 1866 MHz</span>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>dual channel · ecc off</span>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <StatRow label="Voltage" value="1.10 V" />
            <StatRow label="Channels" value="dual" />
            <StatRow label="ECC" value="disabled" />
            <StatRow label="OOM score" value="0" />
          </div>
        </GridPanel>
      </div>

    </div>
  )
}
