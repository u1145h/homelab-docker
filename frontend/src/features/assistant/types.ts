export interface KuroHealth {
  status: string
  model: string
  provider: string
  nodes: number
}

export interface KuroSettings {
  enabled: boolean
  model: string
  provider: string
  base_url: string
  temperature: number
  max_tokens: number
  context_msgs: number
  memory_retrieve: number
  node_count?: number

  // Assistant mode: needle (ultra-fast agentic SLM), dual (cactus + air-gapped cloud), direct (fast on-device), or llm (local reasoning)
  assistant_mode?: 'needle' | 'dual' | 'direct' | 'llm' | 'cloud'

  // Cloud 3rd-party provider integration
  cloud_enabled?: boolean
  cloud_provider?: 'openai' | 'anthropic' | 'groq' | 'nvidia' | 'gemini' | 'cactus' | 'custom'
  cloud_model?: string
  cloud_base_url?: string
  cloud_api_key?: string // write-only (sent on PUT)
  has_cloud_api_key?: boolean // read from GET
  cloud_api_key_preview?: string // read from GET (e.g. sk-...****)
}


export interface KuroNode {
  id: string
  name: string
  platform: 'windows' | 'android' | 'linux' | 'macos' | 'ios' | string
  status: 'online' | 'offline' | 'idle' | 'busy' | string
  is_online?: boolean
  hostname: string
  ip_address: string
  cpu_usage: number
  ram_usage: number
  last_seen: string
  sync_interval_seconds?: number
  telemetry?: {
    cpu_percent?: number
    ram_used_gb?: number
    ram_total_gb?: number
    ram_percent?: number
    active_app?: string
    active_window?: string
    battery?: {
      level?: number
      is_charging?: boolean
      health?: string
      temperature?: number
      voltage?: number
      voltage_mv?: number
    }
    network?: {
      wifi_ssid?: string
      ip_address?: string
      network_type?: string
      link_speed_mbps?: number
    }
    storage?: {
      total_gb?: number
      used_gb?: number
      free_gb?: number
      percent?: number
    }
    hardware?: {
      model?: string
      manufacturer?: string
      brand?: string
      android_version?: string
      sdk_int?: number
      screen_on?: boolean
      ram_total_gb?: number
      ram_used_gb?: number
      admin_active?: boolean
      uptime_seconds?: number
    }
    drives?: Array<{ letter: string; used_gb: number; total_gb: number; free_gb: number }>
    timestamp?: string
  }
}

export interface KuroMemory {
  id: string
  username: string
  category: string
  content: string
  importance: number
  access_count: number
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  username: string
  title: string
  created_at: string
  updated_at: string
}

export interface MessageItem {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model_used?: string
  tool_calls?: string
  created_at: string
}

export interface ChatResponse {
  conversation_id?: string
  message_id?: string
  id?: string
  content?: string
  response?: string
  model_used: string
  is_error?: boolean
}

export interface LocalModelInfo {
  name: string
  size: number
  size_human: string
  modified_at: string
  format: string
  is_active: boolean
  family?: string
  param_size?: string
}

export interface DownloadCatalogItem {
  id: string
  name: string
  size: string
  ram: string
  description: string
  recommended?: boolean
}

export interface PullProgress {
  model: string
  status: string
  total: number
  completed: number
  percent: number
  error?: string
  done: boolean
}

export interface EngineStatus {
  running: boolean
  address: string
  binary: string
  error?: string
}

export interface ModelsData {
  installed: LocalModelInfo[]
  catalog: DownloadCatalogItem[]
  active: string
}

export interface DeviceCall {
  id: string
  node_id: string
  device_name?: string
  caller_name: string
  phone_number: string
  call_type: string
  duration: number
  timestamp: string
}

export interface DeviceMessage {
  id: string
  node_id: string
  device_name?: string
  sender_name: string
  phone_number: string
  message_body: string
  is_read: boolean
  message_type?: string
  is_sent?: boolean
  timestamp: string
}

export interface DeviceLocation {
  id: string
  node_id: string
  device_name?: string
  latitude: number
  longitude: number
  accuracy: number
  address: string
  wifi_ssid: string
  timestamp: string
}

export interface DeviceContact {
  id: string
  node_id: string
  device_name?: string
  name: string
  phone_numbers: string[]
  email?: string
  is_starred?: boolean
  last_contacted?: string
  created_at?: string
  updated_at?: string
}

export interface DiscoveredClientDevice {
  node_id: string
  display_name: string
  platform: string
  hostname?: string
  last_seen_at: string
  is_online: boolean
}

export interface DeviceNotificationRecord {
  id: string
  node_id?: string
  device_name?: string
  package_name: string
  app_label?: string
  app_name?: string
  title?: string
  text?: string
  sub_text?: string
  category?: string
  timestamp: string
  is_cleared?: boolean
  is_clearable?: boolean
  is_ongoing?: boolean
  media_preview_b64?: string
}

export interface InstalledApp {
  id?: string
  node_id?: string
  device_name?: string
  package_name: string
  app_name: string
  version_name?: string
  version_code?: number
  installed_at?: string
  last_updated?: string
  is_system_app?: boolean
  apk_size_bytes?: number
  icon_b64?: string
}

export interface ClientFileRoot {
  name: string
  path: string
  icon?: string
  is_primary?: boolean
}

export interface ClientFileItem {
  name: string
  path: string
  is_dir: boolean
  size: number
  last_modified: number
  permissions?: string
  mime_type?: string
  extension?: string
  is_hidden?: boolean
}

export interface ClientFilesResponse {
  current_path: string
  parent_path?: string | null
  files: ClientFileItem[]
  roots?: ClientFileRoot[]
  total_count?: number
  error?: string
}

export interface ClientDataResponse {
  calls: DeviceCall[]
  messages: DeviceMessage[]
  contacts?: DeviceContact[]
  notifications?: DeviceNotificationRecord[]
  installed_apps?: InstalledApp[]
  location: DeviceLocation | null
  locations: DeviceLocation[]
  devices?: DiscoveredClientDevice[]
  connected_nodes?: any[]
  snapshot?: any
  node_id?: string
}

export interface BaikalConfig {
  url: string
  username: string
  password?: string
  default_calendar: string
  reminder_calendar: string
  addressbook: string
}

export interface DiscoveredResource {
  name: string
  display_name: string
  href: string
  type: 'calendar' | 'addressbook'
}

export interface DiscoveryResult {
  success: boolean
  error?: string
  calendars: DiscoveredResource[]
  addressbooks: DiscoveredResource[]
}

export interface BaikalIntegrationState {
  enabled: boolean
  config: BaikalConfig
  has_password: boolean
}

export interface ImmichConfig {
  url: string
  api_key: string
  has_api_key?: boolean
}

export interface EvolutionStatus {
  active: boolean
  cycle_count: number
  last_run?: string
  last_assessment?: {
    allowed: boolean
    reason: string
    temperature_celsius: number
    battery_percentage: number
    is_charging: boolean
    cpu_load_percent: number
    recommended_interval: number
  }
  learned_runbooks: number
  synthesized_facts: number
}

export interface ImmichIntegrationState {
  enabled: boolean
  config: ImmichConfig
}

export interface PhotoCardItem {
  id: string
  thumbnail_url: string
  file_name: string
  taken_at?: string
  city?: string
  country?: string
  type: string
  is_favorite?: boolean
}

export interface PhotoGridData {
  title: string
  count: number
  person?: string
  search_query?: string
  immich_url?: string
  photos: PhotoCardItem[]
}

export interface AlbumCardItem {
  id: string
  name: string
  description?: string
  asset_count: number
  thumbnail_url?: string
}

export interface AlbumListData {
  count: number
  albums: AlbumCardItem[]
}

export interface CallCardItem {
  id: string
  caller_name: string
  phone_number: string
  call_type: 'incoming' | 'outgoing' | 'missed' | 'rejected' | string
  timestamp: string
  duration: number
  duration_formatted: string
}

export interface CallLogListData {
  calls: CallCardItem[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  next_offset: number
  node_id?: string
}

export interface MessageCardItem {
  id: string
  sender_name: string
  phone_number: string
  message_body: string
  is_read: boolean
  timestamp: string
}

export interface MessageListData {
  messages: MessageCardItem[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  next_offset: number
  node_id?: string
}

export interface PapraConfig {
  url: string
  api_token: string
}

export interface PapraIntegrationState {
  enabled: boolean
  config: PapraConfig
}


