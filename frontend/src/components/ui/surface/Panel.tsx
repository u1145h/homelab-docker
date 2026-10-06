import type { ReactNode } from 'react'
import { Card, CardHeader, CardContent } from './Card'

export interface PanelProps {
  title?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
  accentColor?: string
  flush?: boolean
}

export function Panel({ title, action, children, className, accentColor, flush }: PanelProps) {
  return (
    <Card accentColor={accentColor} className={className} noPadding={flush}>
      {title && (
        <CardHeader action={action} className={flush ? 'panel-header-flush' : ''}>
          {title}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  )
}
