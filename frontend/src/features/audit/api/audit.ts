import client from "@/api/client"
import type { AuditEntry, AuditFilter, AuditConfig } from "../types"

export async function listAudit(filter: AuditFilter): Promise<AuditEntry[]> {
  const params: Record<string, string | number> = {
    offset: filter.offset,
    limit: filter.limit,
  }
  if (filter.action) {
    params.action = filter.action
  }
  const { data } = await client.get<AuditEntry[]>("/audit", { params })
  return data
}

export async function getAudit(id: string): Promise<AuditEntry> {
  const { data } = await client.get<AuditEntry>(`/audit/${id}`)
  return data
}

export async function getAuditConfig(): Promise<AuditConfig> {
  const { data } = await client.get<AuditConfig>("/audit/config")
  return data
}
