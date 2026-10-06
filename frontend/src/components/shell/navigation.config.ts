import type { IconName } from '@/components/ui/icons'

export type Role = 'admin' | 'user' | 'readonly'

export interface NavItemConfig {
  id: string
  title: string
  icon: IconName
  route: string
  group: string
  badge?: number
  external?: boolean
  roles?: Role[]
}

export interface NavGroupConfig {
  id: string
  label: string
  order: number
}

export const navGroups: NavGroupConfig[] = [
  { id: 'monitoring', label: 'Monitoring', order: 0 },
  { id: 'assistant', label: 'Assistant', order: 1 },
  { id: 'management', label: 'Management', order: 2 },
  { id: 'system', label: 'System', order: 3 },
]

export const navigation: NavItemConfig[] = [
  // ── Monitoring (Admin & Readonly Wall Displays) ──
  { id: 'cpu', title: 'CPU', icon: 'cpu', route: '/cpu', group: 'monitoring', roles: ['admin', 'readonly'] },
  { id: 'memory', title: 'Memory', icon: 'activity', route: '/memory', group: 'monitoring', roles: ['admin', 'readonly'] },
  { id: 'storage', title: 'Storage', icon: 'hard-drive', route: '/storage', group: 'monitoring', roles: ['admin', 'readonly'] },
  { id: 'network', title: 'Network', icon: 'network', route: '/network', group: 'monitoring', roles: ['admin', 'readonly'] },
  { id: 'battery', title: 'Battery', icon: 'battery-full', route: '/battery', group: 'monitoring', roles: ['admin', 'readonly'] },
  { id: 'thermal', title: 'Thermal', icon: 'thermometer', route: '/thermal', group: 'monitoring', roles: ['admin', 'readonly'] },

  // ── Assistant (Admin only on web dashboard) ──
  { id: 'assistant-model', title: 'Model', icon: 'bot', route: '/assistant/model', group: 'assistant', roles: ['admin'] },
  { id: 'assistant-memories', title: 'Memories', icon: 'brain', route: '/assistant/memories', group: 'assistant', roles: ['admin'] },
  { id: 'assistant-clients', title: 'Clients', icon: 'network', route: '/assistant/clients', group: 'assistant', roles: ['admin'] },
  { id: 'assistant-integration', title: 'Integration', icon: 'server', route: '/assistant/integration', group: 'assistant', roles: ['admin'] },

  // ── Management (Admin only) ──
  { id: 'docker', title: 'Docker', icon: 'container', route: '/docker', group: 'management', roles: ['admin'] },
  { id: 'files', title: 'Files', icon: 'folder', route: '/files', group: 'management', roles: ['admin'] },
  { id: 'terminal', title: 'Terminal', icon: 'terminal', route: '/terminal', group: 'management', roles: ['admin'] },
  { id: 'camera', title: 'Camera', icon: 'camera', route: '/camera', group: 'management', roles: ['admin'] },

  // ── System (Admin & Readonly for Appearance/Widgets) ──
  { id: 'users', title: 'Users', icon: 'users', route: '/users', group: 'system', roles: ['admin'] },
  { id: 'audit', title: 'Audit', icon: 'file-text', route: '/audit', group: 'system', roles: ['admin'] },
  { id: 'settings', title: 'Settings', icon: 'settings', route: '/settings', group: 'system', roles: ['admin', 'readonly'] },
]

export function getNavItemsByGroup(groupId: string): NavItemConfig[] {
  return navigation.filter((item) => item.group === groupId)
}

export function getNavItem(id: string): NavItemConfig | undefined {
  return navigation.find((item) => item.id === id)
}

export function getNavGroupLabel(groupId: string): string {
  return navGroups.find((g) => g.id === groupId)?.label ?? groupId
}
