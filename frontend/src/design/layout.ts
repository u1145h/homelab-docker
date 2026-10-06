export const layout = {
  sidebarWidth: 240,
  topbarHeight: 55,
  pagePadding: 32,
  sectionGap: 32,
  cardGap: 24,
  contentMaxWidth: 1400,
  sidebarCollapsedWidth: 0,
} as const

export type LayoutKey = keyof typeof layout
