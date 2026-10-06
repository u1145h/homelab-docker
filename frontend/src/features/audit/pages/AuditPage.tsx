import { useState, useEffect } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAudit } from '../hooks/useAudit'
import AuditSummaryCards from '../components/AuditSummaryCards'
import AuditTable from '../components/AuditTable'
import StatusMixWidget from '../components/StatusMixWidget'
import RetentionWidget from '../components/RetentionWidget'
import { getAuditConfig } from '../api/audit'
import type { AuditConfig } from '../types'
import { Button } from '@/components/ui/actions'
import { AppIcon } from '@/components/ui/icons'

export default function AuditPage() {
  useDocumentTitle('Audit Logs - HomeLab')
  const {
    entries,
    loading,
    hasMore,
    loadMore,
  } = useAudit()

  const [config, setConfig] = useState<AuditConfig | null>(null)

  useEffect(() => {
    getAuditConfig().then(setConfig).catch(console.error)
  }, [])

  // Calculate metrics for the last 24 hours (for demo purposes we just count all returned entries)
  const totalEvents = entries.length
  const successEvents = entries.filter(e => e.status === 'success').length
  const warningEvents = entries.filter(e => e.status === 'warning').length
  const failedEvents = entries.filter(e => e.status === 'failure').length

  return (
    <div className="audit-page-root">


      <AuditSummaryCards 
        total={totalEvents} 
        success={successEvents} 
        warning={warningEvents} 
        failed={failedEvents} 
      />

      <div className="responsive-content-grid" style={{
        display: 'grid',
        gridTemplateColumns: '3fr 2fr'
      }}>
        <StatusMixWidget 
          success={successEvents} 
          warning={warningEvents} 
          failed={failedEvents} 
        />
        <RetentionWidget config={config} />
      </div>

      <div>
        <AuditTable entries={entries} />
        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <Button variant="secondary" startIcon={<AppIcon name="chevron-down" size={18} />} onClick={loadMore} disabled={loading}>
              {loading ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
