import type { ReactNode } from 'react'
import { Text } from '@/components/ui/typography'
import { Button } from '@/components/ui/actions'
import { AppIcon } from '@/components/ui/icons'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

export interface PageHeaderProps {
  title: string
  timestamp?: Date | number | null
  isRefreshing?: boolean
  onRefresh?: () => void
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  timestamp,
  isRefreshing,
  onRefresh,
  actions,
  className,
}: PageHeaderProps) {
  const timeStr = formatRelativeTime(timestamp ?? null)

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
        marginTop: 8,
      }}
    >
      <div>
        <Text as="h1" size={18} weight={600}>
          {title}
        </Text>
        {timeStr && (
          <Text color="secondary" size={11}>
            Updated {timeStr}
          </Text>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}
        {onRefresh && (
          <Button
            variant="secondary"
            size="small"
            onClick={onRefresh}
            disabled={isRefreshing}
            startIcon={
              <AppIcon
                name="refresh-cw"
                size={14}
                style={{ animation: isRefreshing ? 'kuro-spin 1s linear infinite' : undefined }}
              />
            }
          >
            Refresh
          </Button>
        )}
      </div>
    </div>
  )
}
