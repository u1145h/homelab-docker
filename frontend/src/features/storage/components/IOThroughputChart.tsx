import { AppIcon } from '@/components/ui/icons'
import type { StorageIOThroughput } from '@/types/status'
import { radius } from '@/design/radius'

interface IOThroughputChartProps {
  io?: StorageIOThroughput
}

export default function IOThroughputChart({ io }: IOThroughputChartProps) {
  const hasData = io && (io.read_mbps > 0 || io.write_mbps > 0 || io.iops > 0)

  return (
    <div style={{
      backgroundColor: 'var(--kuro-color-surface)',
      border: '1px solid var(--kuro-color-border)',
      borderRadius: radius.card,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      height: '100%'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase' }}>
          I/O Throughput
        </div>
        {hasData && (
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            last 60s
          </div>
        )}
      </div>

      {!hasData ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>
          No result found
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Read */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>
                  <AppIcon name="download" size={14} /> Read
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                  {io.read_mbps.toFixed(0)} MB/s
                </div>
              </div>
              <div style={{ height: '4px', borderRadius: radius.badge, backgroundColor: 'var(--kuro-color-border)', overflow: 'hidden' }}>
                <div style={{ width: '40%', height: '100%', backgroundColor: 'var(--kuro-color-success)' }} />
              </div>
            </div>

            {/* Write */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>
                  <AppIcon name="upload" size={14} /> Write
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                  {io.write_mbps.toFixed(0)} MB/s
                </div>
              </div>
              <div style={{ height: '4px', borderRadius: radius.badge, backgroundColor: 'var(--kuro-color-border)', overflow: 'hidden' }}>
                <div style={{ width: '20%', height: '100%', backgroundColor: 'var(--kuro-color-accent)' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-success)', borderRadius: '1px' }} />
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>IOPS</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                {io.iops.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-danger)', borderRadius: '1px' }} />
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Queue depth</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                {io.queue_depth.toFixed(1)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-warning)', borderRadius: '1px' }} />
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Await</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                {io.await.toFixed(1)} ms
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
