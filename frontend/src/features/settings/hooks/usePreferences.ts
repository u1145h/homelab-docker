import { useState, useCallback, useEffect, useRef } from 'react'
import * as prefsApi from '../api/preferences'
import { useSnackbar } from '@/hooks/useSnackbar'
import type { UserPreferences } from '../types'
import { DEFAULT_PREFERENCES } from '../types'
import { loadAppearance, saveAppearance } from '@/providers/appearanceStorage'
import { saveFilesDefaults } from '@/features/files/utils/filesDefaults'
import { saveDockerDefaults } from '@/features/docker/utils/dockerDefaults'

// How often to re-fetch server prefs so changes made on another device/session
// are reflected on all open sessions of the same user.
const SYNC_INTERVAL_MS = 30_000

export interface UsePreferencesReturn {
  prefs: UserPreferences
  savedPrefs: UserPreferences
  dirty: boolean
  loading: boolean
  saving: boolean
  update: (patch: Partial<UserPreferences>) => void
  save: () => Promise<void>
  discard: () => void
}

/**
 * Merge server prefs with device-local theme/amoled from localStorage.
 * Theme is intentionally NOT stored on the server so it stays per-device.
 */
function mergeWithLocalTheme(serverData: UserPreferences): UserPreferences {
  const localAppearance = loadAppearance()
  return {
    ...serverData,
    // Overlay device-local theme values on top of server data.
    theme: (localAppearance.theme as UserPreferences['theme']) ?? serverData.theme,
    amoled: localAppearance.amoled ?? serverData.amoled,
  }
}

function syncCaches(data: UserPreferences) {
  // Persist theme locally (device-local — never pushed to server)
  if (data.theme || data.amoled !== undefined) {
    const current = loadAppearance()
    saveAppearance({
      ...current,
      ...(data.theme ? { theme: data.theme as any } : {}),
      ...(data.amoled !== undefined ? { amoled: data.amoled } : {}),
    })
  }
  saveFilesDefaults({
    defaultPath: data.files_default_path || '/',
    defaultViewMode: data.files_default_view_mode || 'table',
    extraHiddenPatterns: data.files_extra_hidden_patterns || [],
  })
  saveDockerDefaults({
    selectedContainers: data.docker_selected_containers || [],
  })
}

export function usePreferences(): UsePreferencesReturn {
  const [savedPrefs, setSavedPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { showSnackbar } = useSnackbar()

  // Track whether the user has unsaved local edits so that background polling
  // does not overwrite them while they are mid-edit.
  const dirtyRef = useRef(false)

  const applyServerData = useCallback((data: UserPreferences, isInitial: boolean) => {
    const safeData: UserPreferences = {
      ...DEFAULT_PREFERENCES,
      ...data,
      visible_widgets: Array.isArray(data?.visible_widgets) ? data.visible_widgets : DEFAULT_PREFERENCES.visible_widgets,
      files_extra_hidden_patterns: Array.isArray(data?.files_extra_hidden_patterns) ? data.files_extra_hidden_patterns : [],
      docker_selected_containers: Array.isArray(data?.docker_selected_containers) ? data.docker_selected_containers : [],
    }
    const merged = mergeWithLocalTheme(safeData)
    setSavedPrefs(merged)
    // Only update the live prefs if the user has no unsaved changes, to avoid
    // clobbering in-progress edits during a background poll.
    if (isInitial || !dirtyRef.current) {
      setPrefs(merged)
    }
    syncCaches(merged)
  }, [])

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    prefsApi.getPreferences()
      .then((data) => {
        if (!cancelled) applyServerData(data, true)
      })
      .catch(() => {
        if (!cancelled) {
          // Backend not available — use defaults with local theme overlay
          applyServerData(DEFAULT_PREFERENCES, true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [applyServerData])

  // ── Cross-device polling ──────────────────────────────────────────────────
  // Poll every 30 s so changes saved on another device/session of the same
  // user are reflected here without needing a page reload.
  useEffect(() => {
    const id = setInterval(async () => {
      // Skip while the user is actively editing or saving to avoid UX confusion.
      if (dirtyRef.current || saving) return
      try {
        const data = await prefsApi.getPreferences()
        applyServerData(data, false)
      } catch {
        // Silent — don't distract the user with poll failures
      }
    }, SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [applyServerData, saving])

  const dirty = JSON.stringify(prefs) !== JSON.stringify(savedPrefs)

  // Keep dirtyRef in sync so the polling interval can read it without stale
  // closure issues.
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const update = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }))
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await prefsApi.savePreferences(prefs)
      // Re-fetch from server immediately after save so savedPrefs reflects
      // what the server actually stored (the server restores theme/amoled from
      // the existing stored value — those stay in localStorage only).
      const confirmed = await prefsApi.getPreferences()
      const merged = mergeWithLocalTheme({ ...DEFAULT_PREFERENCES, ...confirmed })
      setSavedPrefs(merged)
      setPrefs(merged)
      syncCaches(merged)
      showSnackbar('Settings saved successfully', 'success')
    } catch {
      showSnackbar('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }, [prefs, showSnackbar])

  const discard = useCallback(() => {
    setPrefs(savedPrefs)
  }, [savedPrefs])

  return { prefs, savedPrefs, dirty, loading, saving, update, save, discard }
}
