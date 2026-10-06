import type { ReactNode } from 'react'

export interface SidebarSectionProps {
  children?: ReactNode
  className?: string
}

export function SidebarSection({ children, className }: SidebarSectionProps) {
  return <div className={className}>{children}</div>
}
