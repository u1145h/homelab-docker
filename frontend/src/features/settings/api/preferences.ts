import client from '@/api/client'
import type { UserPreferences } from '../types'

export async function getPreferences(): Promise<UserPreferences> {
  const { data } = await client.get<UserPreferences>('/preferences')
  return data
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  await client.put('/preferences', prefs)
}
