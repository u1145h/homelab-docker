import client from "@/api/client"
import type { CreateSessionRequest, SessionResponse, ListSessionsResponse } from "../types"

export async function createSession(req: CreateSessionRequest = {}): Promise<SessionResponse> {
  const { data } = await client.post<SessionResponse>("/terminal/session", req)
  return data
}

export async function listSessions(): Promise<ListSessionsResponse> {
  const { data } = await client.get<ListSessionsResponse>("/terminal/session")
  return data
}

export async function getSession(id: string): Promise<SessionResponse> {
  const { data } = await client.get<SessionResponse>(`/terminal/session/${id}`)
  return data
}

export async function closeSession(id: string): Promise<void> {
  await client.delete(`/terminal/session/${id}`)
}

export async function resizeSession(id: string, rows: number, cols: number): Promise<void> {
  await client.post(`/terminal/session/${id}/resize`, { rows, cols })
}
