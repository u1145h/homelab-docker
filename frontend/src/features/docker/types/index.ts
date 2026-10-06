export interface ContainerSummary {
  id: string
  name: string
  image: string
  state: string
  status: string
  labels: Record<string, string>
  project: string
  service: string
  workingDir: string
}

export interface ContainerGroup {
  isGroup: true
  name: string
  containers: ContainerSummary[]
  state: 'running' | 'stopped' | 'mixed'
}

export type ContainerOrGroup = ContainerSummary | ContainerGroup

export interface ProjectSummary {
  name: string
  workingDir: string
  containerCount: number
  containers: ContainerSummary[]
  running: boolean
  healthy: boolean
}

export interface ContainerStateDetail {
  status: string
  running: boolean
  paused: boolean
  restarting: boolean
  dead: boolean
  pid: number
  exitCode: number
  startedAt: string
  finishedAt: string
  health?: { status: string }
}

export interface ContainerDetail {
  id: string
  name: string
  image: string
  command: string
  created: string
  state: ContainerStateDetail
  mounts?: Array<{ type: string; source: string; destination: string; mode: string; rw: boolean }>
  network?: Array<{ name: string; ip: string; gateway: string }>
  ports?: Array<{ privatePort: number; publicPort: number; type: string; ip: string }>
  labels: Record<string, string>
  env?: string[]
  // Live stats (optional — populated if backend supports it)
  cpu_percent?: number
  mem_used?: number
  mem_limit?: number
  net_rx?: number
  net_tx?: number
  block_read?: number
  block_write?: number
  restart_count?: number
  pids?: number
}

export interface ContainerLog {
  timestamp: string
  level: string
  message: string
}

export type ContainerFilter = "all" | "running" | "stopped" | "paused" | "restarting"

export interface DockerActionResponse {
  success: boolean
  message: string
}
