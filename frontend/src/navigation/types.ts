import type { SvgIconComponent } from "@mui/icons-material"

export interface NavItem {
  label: string
  path: string
  icon: SvgIconComponent
  group: string
}

export interface NavGroup {
  id: string
  label: string
  order: number
}
