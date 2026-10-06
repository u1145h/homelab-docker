import client from "@/api/client"
import type { UserResponse, CreateUserRequest, UpdateUserRequest, Setup2FAResponse, UserSessionsResponse } from "../types"

export async function listUsers(): Promise<UserResponse[]> {
  const { data } = await client.get<UserResponse[]>("/users")
  return data
}

export async function getUser(id: string): Promise<UserResponse> {
  const { data } = await client.get<UserResponse>(`/users/${id}`)
  return data
}

export async function createUser(req: CreateUserRequest): Promise<UserResponse> {
  const { data } = await client.post<UserResponse>("/users", req)
  return data
}

export async function updateUser(id: string, req: UpdateUserRequest): Promise<UserResponse> {
  const { data } = await client.put<UserResponse>(`/users/${id}`, req)
  return data
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete(`/users/${id}`)
}

export async function changePassword(id: string, password: string): Promise<void> {
  await client.post(`/users/${id}/password`, { password })
}

export async function revokeUserSessions(id: string): Promise<void> {
  await client.post(`/users/${id}/revoke-sessions`)
}

export async function getUserSessions(id: string): Promise<UserSessionsResponse> {
  const { data } = await client.get<UserSessionsResponse>(`/users/${id}/sessions`)
  return data
}

export async function revokeSingleSession(id: string, sessionId: string): Promise<void> {
  await client.delete(`/users/${id}/sessions/${sessionId}`)
}

export async function revokeAllUserSessions(id: string): Promise<void> {
  await client.delete(`/users/${id}/sessions`)
}

export async function setupUser2FA(id: string): Promise<Setup2FAResponse> {
  const { data } = await client.post<Setup2FAResponse>(`/users/${id}/2fa/setup`)
  return data
}

export async function verifyUser2FA(id: string, code: string): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post<{ success: boolean; message: string }>(`/users/${id}/2fa/verify`, { code })
  return data
}

export async function disableUser2FA(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post<{ success: boolean; message: string }>(`/users/${id}/2fa/disable`)
  return data
}
