const STORAGE_KEY = 'kuro.shell'
const STORAGE_VERSION = 1

export interface ShellStorageData {
  version: number
  sidebar: {
    collapsed: boolean
  }
}

const defaults: ShellStorageData = {
  version: STORAGE_VERSION,
  sidebar: { collapsed: false },
}

export function loadShellState(): ShellStorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw)
    if (parsed?.version === STORAGE_VERSION) {
      return {
        version: STORAGE_VERSION,
        sidebar: { collapsed: !!parsed?.sidebar?.collapsed },
      }
    }
    return { ...defaults }
  } catch {
    return { ...defaults }
  }
}

export function saveShellState(data: ShellStorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* storage unavailable */
  }
}
