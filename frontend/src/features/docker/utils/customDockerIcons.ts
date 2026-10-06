import { useState, useEffect } from 'react'

const STORAGE_KEY = 'kuro_docker_custom_icons'
export const CUSTOM_ICON_EVENT = 'kuro-docker-icon-change'

export type ContainerInput = string | { name?: string; id?: string; [key: string]: any }

/**
 * Normalizes container identifier key (strips leading slashes and lowercases)
 */
export function normalizeContainerKey(nameOrId: string): string {
  if (!nameOrId) return ''
  return nameOrId.replace(/^\//, '').trim().toLowerCase()
}

/**
 * Retrieves all saved custom icon overrides from localStorage
 */
export function getAllCustomDockerIcons(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Retrieves a custom icon override for a specific container by name or ID
 */
export function getCustomDockerIcon(containerInput: ContainerInput): string | null {
  if (!containerInput) return null
  const all = getAllCustomDockerIcons()

  if (typeof containerInput === 'string') {
    const key = normalizeContainerKey(containerInput)
    if (!key) return null
    const val = all[key]
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null
  }

  if (containerInput.name) {
    const nameKey = normalizeContainerKey(containerInput.name)
    if (nameKey && all[nameKey]) {
      const val = all[nameKey]
      if (typeof val === 'string' && val.trim().length > 0) return val.trim()
    }
  }

  if (containerInput.id) {
    const idKey = normalizeContainerKey(containerInput.id)
    if (idKey && all[idKey]) {
      const val = all[idKey]
      if (typeof val === 'string' && val.trim().length > 0) return val.trim()
    }
  }

  return null
}

/**
 * Saves a custom icon override for a container (by name and optional ID)
 */
export function setCustomDockerIcon(containerInput: ContainerInput, iconValue: string): void {
  if (!containerInput) return
  const all = getAllCustomDockerIcons()
  const trimmed = iconValue.trim()

  const keys: string[] = []
  if (typeof containerInput === 'string') {
    const k = normalizeContainerKey(containerInput)
    if (k) keys.push(k)
  } else if (containerInput) {
    if (containerInput.name) {
      const nk = normalizeContainerKey(containerInput.name)
      if (nk && !keys.includes(nk)) keys.push(nk)
    }
    if (containerInput.id) {
      const ik = normalizeContainerKey(containerInput.id)
      if (ik && !keys.includes(ik)) keys.push(ik)
    }
  }

  if (keys.length === 0) return

  for (const k of keys) {
    if (trimmed) {
      all[k] = trimmed
    } else {
      delete all[k]
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    for (const k of keys) {
      window.dispatchEvent(new CustomEvent(CUSTOM_ICON_EVENT, { detail: { key: k, icon: trimmed } }))
    }
  } catch (e) {
    console.error('Failed to save custom docker icon:', e)
  }
}

/**
 * Removes a custom icon override for a container
 */
export function removeCustomDockerIcon(containerInput: ContainerInput): void {
  setCustomDockerIcon(containerInput, '')
}

/**
 * React hook to observe custom icon changes reactively across all components
 */
export function useCustomDockerIcon(containerInput: ContainerInput): string | null {
  const nameKey = typeof containerInput === 'string' ? normalizeContainerKey(containerInput) : normalizeContainerKey(containerInput?.name || '')
  const idKey = typeof containerInput === 'object' && containerInput ? normalizeContainerKey(containerInput?.id || '') : ''

  const [customIcon, setCustomIcon] = useState<string | null>(() => getCustomDockerIcon(containerInput))

  useEffect(() => {
    setCustomIcon(getCustomDockerIcon(containerInput))

    const handleIconChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail || !detail.key || detail.key === nameKey || detail.key === idKey) {
        setCustomIcon(getCustomDockerIcon(containerInput))
      }
    }

    window.addEventListener(CUSTOM_ICON_EVENT, handleIconChange)
    return () => {
      window.removeEventListener(CUSTOM_ICON_EVENT, handleIconChange)
    }
  }, [nameKey, idKey])

  return customIcon
}
