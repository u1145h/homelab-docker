import client from '@/api/client'
import type {
  KuroHealth,
  KuroSettings,
  KuroNode,
  KuroMemory,
  Conversation,
  MessageItem,
  ChatResponse,
} from '../types'

export interface TestLLMResult {
  ok: boolean
  latency_ms: number
  base_url: string
  model: string
  status?: string
  error?: string
}

export async function getAssistantHealth(): Promise<KuroHealth> {
  const { data } = await client.get<KuroHealth>('/kuro/health')
  return data
}

export async function getAssistantSettings(): Promise<KuroSettings> {
  const { data } = await client.get<KuroSettings>('/kuro/settings')
  return data
}

export async function updateAssistantSettings(settings: Partial<KuroSettings>): Promise<void> {
  await client.put('/kuro/settings', settings)
}

export async function testLLMConnection(payload: {
  base_url?: string
  model?: string
  provider?: string
  api_key?: string
}): Promise<TestLLMResult> {
  const { data } = await client.post<TestLLMResult>('/kuro/test-llm', payload)
  return data
}

export async function getConnectedNodes(): Promise<KuroNode[]> {
  const { data } = await client.get<{ nodes: KuroNode[] }>('/kuro/nodes')
  return data.nodes || []
}

export async function updateConnectedNode(
  nodeId: string,
  payload: { name: string; node_id?: string; sync_interval_seconds?: number }
): Promise<{ success: boolean; node_id: string; display_name: string; sync_interval_seconds?: number }> {
  const { data } = await client.put(`/kuro/nodes/${nodeId}`, payload)
  return data
}

export async function deleteConnectedNode(
  nodeId: string,
  options?: { delete_data?: boolean; merge_target_id?: string }
): Promise<void> {
  await client.delete(`/kuro/nodes/${nodeId}`, { data: options })
}

export async function triggerNodeSync(nodeId: string): Promise<{ synced: boolean; node_id: string; message: string }> {
  const { data } = await client.post(`/kuro/nodes/${encodeURIComponent(nodeId)}/sync-trigger`, {})
  return data
}

export async function getNodeSnapshot(nodeId: string): Promise<any> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/snapshot`)
  return data
}

export async function getMemories(): Promise<KuroMemory[]> {
  const { data } = await client.get<{ memories: KuroMemory[] }>('/kuro/memories')
  return data.memories || []
}

export async function createMemory(payload: { category: string; content: string; importance: number }): Promise<KuroMemory> {
  const { data } = await client.post<KuroMemory>('/kuro/memories', payload)
  return data
}

export async function updateMemory(id: string, payload: { category: string; content: string; importance: number }): Promise<void> {
  await client.put(`/kuro/memories/${id}`, payload)
}

export async function deleteMemory(id: string): Promise<void> {
  await client.delete(`/kuro/memories/${id}`)
}

export async function getConversations(): Promise<Conversation[]> {
  const { data } = await client.get<{ conversations: Conversation[] }>('/kuro/conversations')
  return data.conversations || []
}

export async function updateConversationTitle(id: string, title: string): Promise<Conversation> {
  const { data } = await client.put<Conversation>(`/kuro/conversations/${id}`, { title })
  return data
}

export async function deleteConversation(id: string): Promise<void> {
  await client.delete(`/kuro/conversations/${id}`)
}

export async function getConversationMessages(id: string): Promise<MessageItem[]> {
  const { data } = await client.get<{ messages: MessageItem[] }>(`/kuro/conversations/${id}/messages`)
  return data.messages || []
}

export async function createConversation(title?: string): Promise<Conversation> {
  const { data } = await client.post<Conversation>('/kuro/conversations', { title: title || 'New Conversation' })
  return data
}

export async function sendPlaygroundMessage(
  conversationId: string,
  content: string,
  nodeId: string = 'web-dashboard'
): Promise<ChatResponse> {
  const { data } = await client.post<ChatResponse>(`/kuro/conversations/${conversationId}/messages`, {
    content,
    input_mode: 'text',
    node_id: nodeId,
  })
  return data
}

export async function getModelsData(): Promise<{
  installed: import('../types').LocalModelInfo[]
  catalog: import('../types').DownloadCatalogItem[]
  active: string
}> {
  const { data } = await client.get('/kuro/models')
  return data
}

export async function pullModel(model: string): Promise<{ status: string; model: string }> {
  const { data } = await client.post('/kuro/models/pull', { model })
  return data
}

export async function getPullProgress(model: string): Promise<import('../types').PullProgress> {
  const { data } = await client.get('/kuro/models/pull/status', { params: { model } })
  return data
}

export async function deleteModel(name: string): Promise<{ deleted: boolean }> {
  const { data } = await client.delete(`/kuro/models/${encodeURIComponent(name)}`)
  return data
}

export async function setActiveModel(model: string): Promise<{ success: boolean; model: string }> {
  const { data } = await client.post('/kuro/models/active', { model })
  return data
}

export async function getEngineStatus(): Promise<import('../types').EngineStatus> {
  const { data } = await client.get('/kuro/engine/status')
  return data
}

export async function startLocalEngine(): Promise<{ status: string }> {
  const { data } = await client.post('/kuro/engine/start')
  return data
}

export async function getClientData(refresh = false): Promise<import('../types').ClientDataResponse> {
  const { data } = await client.get('/kuro/client-data', { params: refresh ? { refresh: true } : undefined })
  return data
}

export async function importClientData(
  nodeId: string,
  payload: { type: 'locations' | 'notifications'; items?: any[]; locations?: any[]; notifications?: any[] }
): Promise<{ success: boolean; imported_count: number; message: string; type: string; node_id: string }> {
  const endpoint = nodeId ? `/kuro/nodes/${encodeURIComponent(nodeId)}/import` : '/kuro/client-data/import'
  const { data } = await client.post(endpoint, payload)
  return data
}

export async function getNodeData(nodeId: string, refresh = false): Promise<import('../types').ClientDataResponse> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/data`, { params: refresh ? { refresh: true } : undefined })
  return data
}

export async function triggerSyncAllNodes(): Promise<{ synced: boolean; message: string }> {
  const { data } = await client.post('/kuro/nodes/sync-all')
  return data
}

export async function getBaikalIntegration(): Promise<import('../types').BaikalIntegrationState> {
  const { data } = await client.get('/kuro/integrations/baikal')
  return data
}

export async function discoverBaikal(payload: Partial<import('../types').BaikalConfig>): Promise<import('../types').DiscoveryResult> {
  const { data } = await client.post('/kuro/integrations/baikal/discover', payload)
  return data
}

export async function saveBaikalIntegration(enabled: boolean, config: import('../types').BaikalConfig): Promise<{ success: boolean }> {
  const { data } = await client.put('/kuro/integrations/baikal', { enabled, config })
  return data
}

export async function getImmichIntegration(): Promise<import('../types').ImmichIntegrationState> {
  const { data } = await client.get('/kuro/integrations/immich')
  return data
}

export async function testImmichIntegration(payload?: Partial<import('../types').ImmichConfig>): Promise<{ success: boolean; version?: string; error?: string }> {
  const { data } = await client.post('/kuro/integrations/immich/test', payload || {})
  return data
}

export async function saveImmichIntegration(enabled: boolean, config: import('../types').ImmichConfig): Promise<{ success: boolean }> {
  const { data } = await client.put('/kuro/integrations/immich', { enabled, config })
  return data
}

export async function getEvolutionStatus(): Promise<import('../types').EvolutionStatus> {
  const { data } = await client.get('/kuro/evolution/status')
  return data
}

export async function triggerEvolutionCycle(): Promise<{ status: string; message: string }> {
  const { data } = await client.post('/kuro/evolution/trigger')
  return data
}

export async function getPapraIntegration(): Promise<import('../types').PapraIntegrationState> {
  const { data } = await client.get('/kuro/integrations/papra')
  return data
}

export async function testPapraIntegration(payload?: Partial<import('../types').PapraConfig>): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data } = await client.post('/kuro/integrations/papra/test', payload || {})
  return data
}

export async function savePapraIntegration(enabled: boolean, config: import('../types').PapraConfig): Promise<{ success: boolean }> {
  const { data } = await client.put('/kuro/integrations/papra', { enabled, config })
  return data
}

export async function toggleLiveLocationTracking(
  nodeId: string,
  enabled: boolean,
  intervalMs = 2000
): Promise<{ ok: boolean; node_id: string; enabled: boolean; interval_ms: number; message: string }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/live-track`, {
    enabled,
    interval_ms: intervalMs,
  })
  return data
}

export async function getClientFiles(
  nodeId: string,
  path = ''
): Promise<import('../types').ClientFilesResponse> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/files`, {
    params: { path: path || undefined },
  })
  return data
}

export async function getClientFileRoots(
  nodeId: string
): Promise<{ roots: import('../types').ClientFileRoot[] }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/files/roots`)
  return data
}

export async function uploadClientFile(
  nodeId: string,
  dirPath: string,
  file: File
): Promise<{ ok: boolean; path: string; name: string; size: number }> {
  const formData = new FormData()
  formData.append('dir_path', dirPath)
  formData.append('file', file)
  const { data } = await client.post(`/kuro/nodes/${nodeId}/files/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteClientFile(
  nodeId: string,
  path: string
): Promise<{ ok: boolean; deleted_path: string }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/files/delete`, { path })
  return data
}

export async function mkdirClientFile(
  nodeId: string,
  parentPath: string,
  name: string
): Promise<{ ok: boolean; path: string }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/files/mkdir`, {
    parent_path: parentPath,
    name,
  })
  return data
}

export async function renameClientFile(
  nodeId: string,
  oldPath: string,
  newName: string
): Promise<{ ok: boolean; old_path: string; new_path: string }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/files/rename`, {
    old_path: oldPath,
    new_name: newName,
  })
  return data
}

export function getClientFileContentUrl(nodeId: string, path: string, download = false): string {
  const token = localStorage.getItem('poco_token') || ''
  const baseUrl = (client.defaults.baseURL || '/api/v1').replace(/\/$/, '')
  return `${baseUrl}/kuro/nodes/${encodeURIComponent(nodeId)}/file-content?path=${encodeURIComponent(path)}${download ? '&download=true' : ''}${token ? `&token=${encodeURIComponent(token)}` : ''}`
}

// ── Hardware Control APIs (Camera & Microphone Direct-to-Device) ──

export interface CameraDevice {
  id: string
  facing: 'front' | 'back' | 'external'
  name: string
  has_flash: boolean
  supported_resolutions: string[]
}

export interface PhotoCaptureResult {
  success: boolean
  error?: string
  file_path?: string
  file_name?: string
  size_bytes?: number
  facing?: string
  timestamp?: number
  preview_b64?: string
}

export interface VideoRecordResult {
  success: boolean
  error?: string
  file_path?: string
  file_name?: string
  size_bytes?: number
  duration_seconds?: number
  facing?: string
  timestamp?: number
}

export interface AudioRecordResult {
  success: boolean
  error?: string
  file_path?: string
  file_name?: string
  size_bytes?: number
  duration_seconds?: number
  timestamp?: number
  preview_b64?: string
}

export async function getNodeCameras(nodeId: string): Promise<{ cameras: CameraDevice[] }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/hardware/cameras`)
  return data
}

export async function getNodeMicrophones(nodeId: string): Promise<{ microphones: { id: string; name: string }[] }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/hardware/microphones`)
  return data
}

export async function captureNodePhoto(nodeId: string, facing: 'front' | 'back' = 'back'): Promise<PhotoCaptureResult> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/hardware/camera/capture`, { facing })
  return data
}

export async function recordNodeVideo(
  nodeId: string,
  facing: 'front' | 'back' = 'back',
  durationSeconds = 10
): Promise<VideoRecordResult> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/hardware/camera/record`, {
    facing,
    duration_seconds: durationSeconds,
  })
  return data
}

export async function recordNodeAudio(nodeId: string, durationSeconds = 10): Promise<AudioRecordResult> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/hardware/mic/record`, {
    duration_seconds: durationSeconds,
  })
  return data
}

export async function controlNodeMicStream(nodeId: string, action: 'start' | 'stop'): Promise<{ success: boolean; error?: string }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/hardware/mic/stream`, { action })
  return data
}

export async function controlNodeCameraStream(
  nodeId: string,
  action: 'start' | 'stop' | 'switch',
  facing: 'front' | 'back' = 'back',
  resolution = '360p'
): Promise<{ success: boolean; error?: string; facing?: string; resolution?: string }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/hardware/camera/stream`, {
    action,
    facing,
    resolution,
  })
  return data
}

export async function getNodeCameraStreamFrame(
  nodeId: string
): Promise<{ node_id: string; frame_b64: string; has_frame: boolean }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/hardware/camera/stream/frame`)
  return data
}

export interface NodeSystemStatusResponse {
  timestamp: number
  permissions: {
    write_settings: boolean
    write_secure_settings: boolean
    device_admin: boolean
    notification_policy: boolean
    camera: boolean
    location: boolean
  }
  toggles: {
    torch: boolean
    location: boolean
    wifi: boolean
    mobile_data: boolean
    bluetooth: boolean
    airplane_mode: boolean
    dnd: boolean
    ringer_mode: string
    brightness: number
    screen_timeout_seconds: number
    is_screen_on: boolean
    is_ringing: boolean
  }
  volumes: {
    media?: { current: number; max: number; percent: number }
    ring?: { current: number; max: number; percent: number }
    alarm?: { current: number; max: number; percent: number }
    notification?: { current: number; max: number; percent: number }
    call?: { current: number; max: number; percent: number }
  }
}

export async function getNodeSystemStatus(nodeId: string): Promise<NodeSystemStatusResponse> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/system/status`)
  return data
}

export async function setNodeSystemSetting(
  nodeId: string,
  setting: string,
  value: any,
  extraParams: Record<string, any> = {}
): Promise<{ success: boolean; setting: string; status?: NodeSystemStatusResponse }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/system/setting`, {
    setting,
    value,
    ...extraParams,
  })
  return data
}

export async function sendNodeSystemAction(
  nodeId: string,
  action: string,
  params: Record<string, any> = {}
): Promise<any> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/system/action`, {
    action,
    params,
  })
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// Windows Workstation Specific RPC API Client
// ─────────────────────────────────────────────────────────────────────────────

export interface WindowsProcessItem {
  pid: number
  name: string
  title: string
  ram_mb: number
  threads: number
  is_responding: boolean
  start_time: string
}

export async function getWindowsProcesses(nodeId: string): Promise<{ processes: WindowsProcessItem[]; total_count: number }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/processes`)
  return data || { processes: [], total_count: 0 }
}

export async function killWindowsProcess(nodeId: string, pid: number): Promise<{ ok: boolean; pid: number }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/processes/kill`, { pid })
  return data
}

export interface WindowsServiceItem {
  name: string
  display_name: string
  status: string
  can_stop: boolean
  service_type: string
}

export async function getWindowsServices(nodeId: string): Promise<{ services: WindowsServiceItem[]; total_count: number }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/services`)
  return data || { services: [], total_count: 0 }
}

export async function controlWindowsService(
  nodeId: string,
  name: string,
  action: 'start' | 'stop' | 'restart'
): Promise<{ ok: boolean; name: string; status: string }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/services/control`, { name, action })
  return data
}

export interface WindowsAppItem {
  name: string
  version: string
  publisher: string
  install_date: string
  install_location: string
  has_uninstaller: boolean
}

export async function getWindowsInstalledApps(nodeId: string): Promise<{ apps: WindowsAppItem[]; total_count: number }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/apps`)
  return data || { apps: [], total_count: 0 }
}

export interface WindowsNetworkAdapter {
  name: string
  description: string
  type: string
  speed_mbps: number
  ipv4: string
  mac: string
}

export interface WindowsTcpListener {
  protocol: string
  port: number
  address: string
  state: string
}

export async function getWindowsNetworkAndPorts(
  nodeId: string
): Promise<{ adapters: WindowsNetworkAdapter[]; listeners: WindowsTcpListener[] }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/ports`)
  return data || { adapters: [], listeners: [] }
}

export interface WindowsPowerInfo {
  battery_percent: number
  battery_charge_status: string
  ac_line_status: string
  battery_full_lifetime: number
  battery_lifetime_sec: number
}

export async function getWindowsPowerInfo(nodeId: string): Promise<WindowsPowerInfo> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/power`)
  return data
}

export async function setWindowsPowerScheme(nodeId: string, guid: string): Promise<{ ok: boolean; guid: string }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/power/scheme`, { guid })
  return data
}

export interface WindowsSystemEvent {
  id: number
  provider: string
  level: string
  time: string
  description: string
}

export async function getWindowsSystemEvents(nodeId: string): Promise<{ events: WindowsSystemEvent[] }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/events`)
  return data || { events: [] }
}

export async function getWindowsScreenshot(nodeId: string): Promise<{ width: number; height: number; image_b64: string; timestamp: string }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/screenshot`)
  return data
}

export async function getWindowsClipboard(nodeId: string): Promise<{ text: string }> {
  const { data } = await client.get(`/kuro/nodes/${nodeId}/clipboard`)
  return data
}

export async function setWindowsClipboard(nodeId: string, text: string): Promise<{ ok: boolean }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/clipboard`, { text })
  return data
}

export async function sendWindowsToast(nodeId: string, title: string, message: string): Promise<{ ok: boolean }> {
  const { data } = await client.post(`/kuro/nodes/${nodeId}/toast`, { title, message })
  return data
}







