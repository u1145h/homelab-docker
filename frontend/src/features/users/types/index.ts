export interface UserResponse {
  id: string
  username: string
  first_name?: string
  last_name?: string
  role: UserRole
  two_factor_enabled?: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export type UserRole = "admin" | "user" | "readonly" | "client"

export interface CreateUserRequest {
  username: string
  first_name?: string
  last_name?: string
  password: string
  role: UserRole
}

export interface UpdateUserRequest {
  username?: string
  first_name?: string
  last_name?: string
  role?: UserRole
  password?: string
}

export interface ChangePasswordRequest {
  password: string
}

export interface Setup2FAResponse {
  secret: string
  uri: string
  recovery_codes: string[]
}

export type UserFilter = "all" | UserRole

export interface UserSession {
  id: string
  user_id: string
  username: string
  token_version: number
  client_type: string
  device_name: string
  os: string
  browser: string
  ip_address: string
  user_agent: string
  is_active: boolean
  is_online?: boolean
  status?: 'online' | 'offline' | 'revoked'
  last_active_at: string
  created_at: string
  expires_at?: string
  revoked_at?: string
  is_current?: boolean
}

export interface UserSessionsResponse {
  total_count: number
  active_count: number
  sessions: UserSession[]
}
