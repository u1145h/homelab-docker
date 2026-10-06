import { NavigationItem } from '@/components/shell/Navigation'
import type { IconName } from '@/components/ui/icons'

export interface SidebarItemProps {
  icon: IconName
  title: string
  route: string
  collapsed?: boolean
  badge?: number
  external?: boolean
  onClick?: () => void
}

export function SidebarItem(props: SidebarItemProps) {
  return <NavigationItem {...props} />
}
