/**
 * Persistent (localStorage) defaults for the Files page.
 * These are user preferences that survive browser restarts, distinct from
 * the sessionStorage "last visited state" managed in useFiles.ts.
 */

export interface FilesDefaults {
  /** Directory to open when the Files page is visited for the first time in a session */
  defaultPath: string
  /** Default view mode: list (table) or grid */
  defaultViewMode: 'table' | 'grid'
  /**
   * Extra glob/prefix patterns to hide even when "show hidden" is OFF.
   * Each entry is a string; an item is hidden if its name matches any entry:
   *   - Exact name match:   "Desktop.ini"
   *   - Extension match:    "*.sh", "*.log"
   *   - Prefix match:       "~*"
   * Standard dot-files are always hidden when showHidden=false regardless of this list.
   */
  extraHiddenPatterns: string[]
}

const STORAGE_KEY = 'kuro_files_defaults'

const DEFAULTS: FilesDefaults = {
  defaultPath: '/',
  defaultViewMode: 'table',
  extraHiddenPatterns: [],
}

export function loadFilesDefaults(): FilesDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FilesDefaults>
      return { ...DEFAULTS, ...parsed }
    }
  } catch {}
  return { ...DEFAULTS }
}

export function saveFilesDefaults(prefs: FilesDefaults): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {}
}

/**
 * Returns true if a filename should be hidden given the extra patterns list.
 * Patterns support:
 *   - Wildcard prefix:  "*.sh"  → matches anything ending in ".sh"
 *   - Wildcard suffix:  "~*"    → matches anything starting with "~"
 *   - Exact name:       "Desktop.ini"
 */
export function matchesExtraHidden(name: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  const lower = name.toLowerCase()
  return patterns.some((pattern) => {
    const p = pattern.trim().toLowerCase()
    if (!p) return false
    if (p.startsWith('*') && p.length > 1) {
      // *.sh  → ends with .sh
      return lower.endsWith(p.slice(1))
    }
    if (p.endsWith('*') && p.length > 1) {
      // ~*  → starts with ~
      return lower.startsWith(p.slice(0, -1))
    }
    return lower === p
  })
}
