import { createContext } from 'react'
import type { AppearanceContextValue } from './appearanceTypes'
import { DEFAULT_APPEARANCE } from './appearanceDefaults'

export const AppearanceContext = createContext<AppearanceContextValue>({
  ...DEFAULT_APPEARANCE,
  toggleTheme: () => {},
  setTheme: () => {},
  toggleAmoled: () => {},
  setAmoled: () => {},
  setDensity: () => {},
  setRadius: () => {},
  setMotion: () => {},
})
