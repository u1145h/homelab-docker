import type { AppearanceState } from './appearanceTypes'
import { CURRENT_STORAGE_VERSION, DEFAULT_APPEARANCE } from './appearanceDefaults'

const STORAGE_KEY = 'kuro.appearance'

interface StoredAppearance {
  version: number
  theme?: string
  amoled?: boolean
  density?: string
  radius?: string
  motion?: string
}

function isValidTheme(value: string): value is AppearanceState['theme'] {
  return value === 'dark' || value === 'light' || value === 'system'
}

function isValidDensity(value: string): value is AppearanceState['density'] {
  return value === 'compact' || value === 'comfortable' || value === 'spacious'
}

function isValidRadius(value: string): value is AppearanceState['radius'] {
  return value === 'default' || value === 'rounded' || value === 'square'
}

function isValidMotion(value: string): value is AppearanceState['motion'] {
  return value === 'enabled' || value === 'reduced' || value === 'disabled'
}

function migrateStored(data: StoredAppearance): AppearanceState {
  return {
    theme: data.theme && isValidTheme(data.theme) ? data.theme : DEFAULT_APPEARANCE.theme,
    amoled: typeof data.amoled === 'boolean' ? data.amoled : DEFAULT_APPEARANCE.amoled,
    density: data.density && isValidDensity(data.density) ? data.density : DEFAULT_APPEARANCE.density,
    radius: data.radius && isValidRadius(data.radius) ? data.radius : DEFAULT_APPEARANCE.radius,
    motion: data.motion && isValidMotion(data.motion) ? data.motion : DEFAULT_APPEARANCE.motion,
  }
}

export function loadAppearance(): AppearanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_APPEARANCE }
    const parsed = JSON.parse(raw) as StoredAppearance
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_APPEARANCE }
    return migrateStored(parsed)
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

export function saveAppearance(state: AppearanceState): void {
  try {
    const data: StoredAppearance = {
      version: CURRENT_STORAGE_VERSION,
      theme: state.theme,
      amoled: state.amoled,
      density: state.density,
      radius: state.radius,
      motion: state.motion,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Silently fail if localStorage is unavailable
  }
}
