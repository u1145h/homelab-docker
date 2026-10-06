export interface SSHConfig {
  host: string
  port: number
  username: string
  password?: string
  key?: string
}

export interface CreateSessionRequest {
  shell?: string
  rows?: number
  cols?: number
  ssh?: SSHConfig
}

export interface SessionResponse {
  id: string
  user: string
  pid: number
  shell: string
  rows: number
  cols: number
  createdAt: string
  closedAt: string | null
  exitCode: number | null
}

export interface ListSessionsResponse {
  sessions: SessionResponse[]
}

export interface ResizeRequest {
  rows: number
  cols: number
}

export type WSMessageType = "input" | "output" | "resize" | "ping" | "pong" | "exit"

export interface WSMessage {
  type: WSMessageType
  data?: string
  rows?: number
  cols?: number
  code?: number
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "closing" | "closed" | "error"

export interface TerminalState {
  session: SessionResponse | null
  status: ConnectionStatus
  error: string | null
}
