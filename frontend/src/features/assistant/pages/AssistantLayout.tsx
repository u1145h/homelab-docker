import React from 'react'
import { useMediaQuery } from '@mui/material'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AppIcon } from '@/components/ui/icons'
import { PageContainer } from '@/components/shell'
import { useAssistant } from '../hooks/useAssistant'

interface AssistantLayoutProps {
  title: string
  children: (context: ReturnType<typeof useAssistant>) => React.ReactNode
}

export default function AssistantLayout({ title, children }: AssistantLayoutProps) {
  useDocumentTitle(`${title} - HomeLab Assistant`)
  const assistantContext = useAssistant()
  const {
    loading,
    error,
  } = assistantContext

  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isTablet  = useMediaQuery('(min-width: 768px)')
  const padding   = isDesktop ? 25 : isTablet ? 20 : 15

  if (loading && assistantContext.nodes.length === 0 && !assistantContext.settings) {
    return (
      <PageContainer fullWidth padding={padding}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 300,
            gap: 12,
            color: 'var(--kuro-color-text-muted)',
          }}
        >
          <AppIcon name="rotate-cw" size={24} className="animate-spin" />
          <span style={{ fontSize: 13 }}>Loading Kuro Assistant subsystem...</span>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer fullWidth padding={padding}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15, width: '100%', minWidth: 0 }}>
        {/* Error Banner if any */}
        {error && (
          <div
            style={{
              backgroundColor: 'rgba(234, 105, 98, 0.1)',
              border: '1px solid rgba(234, 105, 98, 0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              color: 'var(--kuro-color-danger)',
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AppIcon name="alert-triangle" size={16} />
              <span>{error}</span>
            </div>
            <button
              onClick={() => assistantContext.refresh()}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--kuro-color-danger)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Page Content */}
        {children(assistantContext)}
      </div>
    </PageContainer>
  )
}
