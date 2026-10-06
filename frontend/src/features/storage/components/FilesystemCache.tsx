import { formatBytes } from '@/utils/format'
import type { StorageFilesystemCache } from '@/types/status'
import { radius } from '@/design/radius'

interface FilesystemCacheProps {
  cache?: StorageFilesystemCache
}

export default function FilesystemCache({ cache }: FilesystemCacheProps) {
  if (!cache) return null

  const hasCacheData = cache.cached > 0 || cache.buffers > 0 || cache.dirty > 0 || cache.swap_total > 0

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
          Filesystem Cache
        </div>
        {hasCacheData && (
          <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            page cache
          </div>
        )}
      </div>

      {!hasCacheData ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>
          No result found
        </div>
      ) : (
        <>
          <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '16px 0', borderTop: '1px solid var(--kuro-color-border)', borderBottom: '1px solid var(--kuro-color-border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CACHED</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{formatBytes(cache.cached)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BUFFERS</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{formatBytes(cache.buffers)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--kuro-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DIRTY</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>{formatBytes(cache.dirty)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-success)', borderRadius: '1px' }} />
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Hit ratio</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: cache.hit_ratio ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)' }}>
                {cache.hit_ratio || "No result found"}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-accent)', borderRadius: '1px' }} />
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Swap</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                {formatBytes(cache.swap_used)} / {formatBytes(cache.swap_total)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-danger)', borderRadius: '1px' }} />
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Inodes</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: cache.inodes ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)' }}>
                {cache.inodes || "No result found"}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '2px', backgroundColor: 'var(--kuro-color-warning)', borderRadius: '1px' }} />
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Scheduler</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: cache.scheduler ? 'var(--kuro-color-text-primary)' : 'var(--kuro-color-text-muted)' }}>
                {cache.scheduler || "No result found"}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
