import client from "./client"

export interface LoginResponse {
  success: boolean
  role?: string
  token?: string
  first_name?: string
  last_name?: string
  require_2fa?: boolean
  message?: string
  error?: string
  retry_after?: number
}

export interface SessionResponse {
  authenticated: boolean
  username?: string
  first_name?: string
  last_name?: string
  role?: string
  two_factor_enabled?: boolean
}

export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
  client_type?: string
  totp_code?: string
}

export interface Setup2FAResponse {
  secret: string
  uri: string
  recovery_codes: string[]
}

export async function login({ username, password, rememberMe, client_type, totp_code }: LoginRequest): Promise<LoginResponse> {
  const { data } = await client.post<LoginResponse>("/login", {
    username,
    password,
    rememberMe,
    client_type: client_type || "homelab_dashboard",
    totp_code,
  })
  return data
}

export async function logout(): Promise<void> {
  await client.post("/logout")
}

export async function checkSession(): Promise<SessionResponse> {
  const { data } = await client.get<SessionResponse>("/auth")
  return data
}

export async function setup2FA(): Promise<Setup2FAResponse> {
  const { data } = await client.post<Setup2FAResponse>("/auth/2fa/setup")
  return data
}

export async function verify2FA(code: string): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post<{ success: boolean; message: string }>("/auth/2fa/verify", { code })
  return data
}

export async function disable2FA(): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post<{ success: boolean; message: string }>("/auth/2fa/disable")
  return data
}
