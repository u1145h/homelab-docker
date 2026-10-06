import { useState, useEffect, useCallback } from "react"
import * as settingsApi from "../api/settings"
import type { Settings, SettingsUpdate, SettingsCategory } from "../types"

export interface UseSettingsReturn {
  settings: Settings | null
  loading: boolean
  error: string | null
  available: boolean
  availableCategories: SettingsCategory[]
  saving: boolean
  saveError: string | null
  updateSettings: (update: SettingsUpdate) => Promise<boolean>
  resetSettings: () => Promise<boolean>
  refresh: () => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await settingsApi.getSettings()
      if (data) {
        setSettings(data)
        setAvailable(true)
      } else {
        setSettings(null)
        setAvailable(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load settings."
      setError(message)
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  const updateSettings = useCallback(async (update: SettingsUpdate): Promise<boolean> => {
    setSaveError(null)
    setSaving(true)
    try {
      const ok = await settingsApi.updateSettings(update)
      if (ok) {
        await load()
      }
      return ok
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings."
      setSaveError(message)
      return false
    } finally {
      setSaving(false)
    }
  }, [load])

  const resetSettings = useCallback(async (): Promise<boolean> => {
    setSaveError(null)
    setSaving(true)
    try {
      const ok = await settingsApi.resetSettings()
      if (ok) {
        await load()
      }
      return ok
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset settings."
      setSaveError(message)
      return false
    } finally {
      setSaving(false)
    }
  }, [load])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  return {
    settings,
    loading,
    error,
    available,
    availableCategories: ["general", "docker", "terminal", "history"],
    saving,
    saveError,
    updateSettings,
    resetSettings,
    refresh,
  }
}
