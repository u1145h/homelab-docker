import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from '@mui/material'
import { useStatus } from '@/hooks/useStatus'
import { PageContainer } from '@/components/shell'
import { DashboardHeader } from '../components/DashboardHeader'
import { RecentActivity } from '../components/RecentActivity'
import { CPUWidget } from '@/widgets/cpu/Component'
import { MemoryWidget } from '@/widgets/memory/Component'
import { StorageWidget } from '@/widgets/storage/Component'
import { NetworkWidget } from '@/widgets/network/Component'
import { DockerWidget } from '@/widgets/docker/Component'
import { ThermalWidget } from '@/widgets/thermal/Component'
import { BatteryWidget } from '@/widgets/battery/Component'
import { TailscaleWidget } from '@/widgets/tailscale/Component'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

function DashboardCard({
  children,
  onClick,
  style,
}: {
  children: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
}) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: 10,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = 'var(--kuro-color-accent, #a9b665)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.35)'
        } else {
          e.currentTarget.style.borderColor = 'var(--kuro-color-hover)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
        if (onClick) {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      {children}
    </div>
  )
}

function CardSkeleton() {
  return (
    <DashboardCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: 60, height: 14, backgroundColor: 'var(--kuro-color-hover)', borderRadius: 4 }} />
          <div style={{ width: 100, height: 12, backgroundColor: 'var(--kuro-color-hover)', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{ width: 118, height: 77, backgroundColor: 'var(--kuro-color-hover)', borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: '100%', height: 36, backgroundColor: 'var(--kuro-color-hover)', borderRadius: 4 }} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '40%', height: 12, backgroundColor: 'var(--kuro-color-hover)', borderRadius: 4 }} />
                <div style={{ width: '25%', height: 12, backgroundColor: 'var(--kuro-color-hover)', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}

function LoadingSkeleton() {
  const isTablet = useMediaQuery('(min-width: 768px)')
  return (
    <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className="page-widget-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', width: '100%' }}>
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>
      <div className="page-widget-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', width: '100%' }}>
        <div style={{ gridColumn: isTablet ? 'span 2' : 'span 1' }}><CardSkeleton /></div>
        <div style={{ gridColumn: 'span 1' }}><CardSkeleton /></div>
      </div>
      <div className="page-widget-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', width: '100%' }}>
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="page-widget-gap"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: 10,
        width: '100%',
      }}
    >
      <span style={{ fontSize: 40, lineHeight: 1 }}>&#9888;</span>
      <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>Failed to load dashboard</span>
      <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', textAlign: 'center', maxWidth: 400 }}>{message}</span>
      <button
        onClick={onRetry}
        style={{
          marginTop: 8,
          backgroundColor: 'var(--kuro-color-border)',
          border: '1px solid var(--kuro-color-hover)',
          borderRadius: 6,
          padding: '8px 20px',
          color: 'var(--kuro-color-text-primary)',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--kuro-color-border)' }}
      >
        Retry
      </button>
    </div>
  )
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard - HomeLab')
  const navigate = useNavigate()
  const { data: status, isLoading, isError, error, refetch } = useStatus()

  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isTablet = useMediaQuery('(min-width: 768px)')
  const padding = isDesktop ? 25 : isTablet ? 20 : 15

  if (isLoading && !status) {
    return (
      <PageContainer fullWidth padding={padding}>
        <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <DashboardHeader />
          <LoadingSkeleton />
        </div>
      </PageContainer>
    )
  }

  if (isError && !status) {
    return (
      <PageContainer fullWidth padding={padding}>
        <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <DashboardHeader />
          <ErrorState
            message={error instanceof Error ? error.message : 'Unable to reach the server.'}
            onRetry={refetch}
          />
        </div>
      </PageContainer>
    )
  }

  const s = status!

  return (
    <PageContainer fullWidth padding={padding}>
      <div className="page-widget-gap" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <DashboardHeader />

        <div
          className="page-widget-gap"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            width: '100%',
          }}
        >
          <DashboardCard onClick={() => navigate('/cpu')}>
            <CPUWidget data={s.cpu} />
          </DashboardCard>

          <DashboardCard onClick={() => navigate('/memory')}>
            <MemoryWidget data={s.memory} />
          </DashboardCard>

          <DashboardCard onClick={() => navigate('/storage')}>
            <StorageWidget data={s.storage} />
          </DashboardCard>
        </div>

        <div
          className="page-widget-gap"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            width: '100%',
          }}
        >
          <DashboardCard onClick={() => navigate('/network')} style={{ gridColumn: isTablet ? 'span 2' : 'span 1' }}>
            <NetworkWidget data={s.network} />
          </DashboardCard>

          <DashboardCard onClick={() => navigate('/docker')} style={{ gridColumn: 'span 1' }}>
            <DockerWidget data={s.docker} />
          </DashboardCard>
        </div>

        <div
          className="page-widget-gap"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            width: '100%',
          }}
        >
          <DashboardCard onClick={() => navigate('/thermal')}>
            <ThermalWidget data={s.thermal} />
          </DashboardCard>

          <DashboardCard onClick={() => navigate('/battery')}>
            <BatteryWidget data={s.battery} />
          </DashboardCard>

          <DashboardCard onClick={() => navigate('/network')}>
            <TailscaleWidget data={s.tailscale} />
          </DashboardCard>
        </div>

        <div style={{ width: '100%' }}>
          <RecentActivity />
        </div>
      </div>
    </PageContainer>
  )
}
