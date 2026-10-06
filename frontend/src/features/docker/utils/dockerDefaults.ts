/**
 * Device-local storage for Docker widget homepage preferences.
 * Stores selected containers (1-6), custom links, and order.
 */

export interface SelectedDockerContainer {
  id: string
  name: string
  customLink?: string
}

export interface DockerDefaults {
  selectedContainers: SelectedDockerContainer[]
}

const STORAGE_KEY = "kuro_docker_defaults"

const DEFAULTS: DockerDefaults = {
  selectedContainers: [],
}

export function loadDockerDefaults(): DockerDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DockerDefaults>
      return { ...DEFAULTS, ...parsed }
    }
  } catch {}
  return { ...DEFAULTS }
}

export function saveDockerDefaults(prefs: DockerDefaults): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {}
}

/**
 * Normalizes a URL string ensuring it has an http:// or https:// protocol prefix.
 */
export function ensureProtocol(url: string): string {
  if (!url) return ""
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}
