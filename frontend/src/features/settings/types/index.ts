export interface DockerSettings {
  socketPath: string
  requestTimeout: string
  actionTimeout: string
}

export interface TerminalSettings {
  defaultShell: string
  maxSessions: number
  idleTimeout: string
  defaultRows: number
  defaultCols: number
  maxOutputBuffer: number
  maxInputSize: number
  readBufferSize: number
  writeBufferSize: number
  allowedOrigins: string[]
}

export interface HistorySettings {
  dbPath: string
  samplingInterval: string
  retentionPeriod: string
  cleanupInterval: string
  maxQueryLimit: number
  defaultResolution: number
}

export interface Settings {
  username: string
  dataDir: string
  docker: DockerSettings
  terminal: TerminalSettings
  history: HistorySettings
}

export interface SettingsResponse {
  available: boolean
  settings: Settings | null
}

export type SettingsCategory = "general" | "docker" | "terminal" | "history"

export interface SettingsUpdate {
  docker?: Partial<DockerSettings>
  terminal?: Partial<TerminalSettings>
  history?: Partial<HistorySettings>
}

export const ALL_WIDGETS = [
  'cpu', 'memory', 'storage', 'network',
  'thermal', 'battery', 'docker', 'tailscale', 'activity',
] as const

export type WidgetId = typeof ALL_WIDGETS[number]

export interface SelectedDockerContainer {
  id: string
  name: string
  customLink?: string
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system'
  amoled: boolean
  visible_widgets: string[]
  files_default_path: string
  files_default_view_mode: 'table' | 'grid'
  files_extra_hidden_patterns: string[]
  docker_selected_containers: SelectedDockerContainer[]
  camera_default_orientation: '0' | '90' | '180' | '270' | '360' | 'landscape' | 'portrait' | string
  cpu_warn: number
  cpu_crit: number
  mem_warn: number
  mem_crit: number
  fs_warn: number
  fs_crit: number
  temp_warn: number
  temp_crit: number
  battery_low: number
  battery_crit: number
  notify_browser: boolean
  notify_sound: boolean
  min_severity: 'all' | 'warning' | 'critical'
  quiet_hours: boolean
  renotify_interval: string
  notify_cpu: boolean
  notify_memory: boolean
  notify_storage: boolean
  notify_thermal: boolean
  notify_battery: boolean
  notify_docker: boolean
  notify_network: boolean
  notify_tailscale: boolean
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  amoled: false,
  visible_widgets: [...ALL_WIDGETS],
  files_default_path: '/',
  files_default_view_mode: 'table',
  files_extra_hidden_patterns: [],
  docker_selected_containers: [],
  camera_default_orientation: '0',
  cpu_warn: 75,
  cpu_crit: 90,
  mem_warn: 80,
  mem_crit: 95,
  fs_warn: 85,
  fs_crit: 95,
  temp_warn: 70,
  temp_crit: 85,
  battery_low: 20,
  battery_crit: 10,
  notify_browser: true,
  notify_sound: true,
  min_severity: 'warning',
  quiet_hours: true,
  renotify_interval: '30m',
  notify_cpu: true,
  notify_memory: true,
  notify_storage: true,
  notify_thermal: true,
  notify_battery: true,
  notify_docker: true,
  notify_network: true,
  notify_tailscale: true,
}


