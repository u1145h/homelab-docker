import client from "@/api/client"
import type { Settings, SettingsUpdate } from "../types"

export async function getSettings(): Promise<Settings | null> {
  try {
    const { data } = await client.get<Settings>("/settings")
    return data
  } catch {
    return null
  }
}

export async function updateSettings(update: SettingsUpdate): Promise<boolean> {
  try {
    await client.put("/settings", update)
    return true
  } catch {
    return false
  }
}

export async function resetSettings(): Promise<boolean> {
  try {
    await client.post("/settings/reset")
    return true
  } catch {
    return false
  }
}
