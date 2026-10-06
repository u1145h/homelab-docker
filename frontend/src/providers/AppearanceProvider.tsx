import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react'
import { AppearanceContext } from './appearanceContext'
import type { AppearanceState, ThemeMode, Density, RadiusMode, MotionMode } from './appearanceTypes'
import { DEFAULT_APPEARANCE } from './appearanceDefaults'
import { loadAppearance, saveAppearance } from './appearanceStorage'

interface AppearanceProviderProps {
  children: ReactNode
}

export function AppearanceProvider({ children }: AppearanceProviderProps) {
  const [state, setState] = useState<AppearanceState>(() => {
    try {
      return loadAppearance()
    } catch {
      return { ...DEFAULT_APPEARANCE }
    }
  })

  useEffect(() => {
    saveAppearance(state)
  }, [state])

  const toggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : prev.theme === 'light' ? 'system' : 'dark',
    }))
  }, [])

  const setTheme = useCallback((theme: ThemeMode) => {
    setState((prev) => ({ ...prev, theme }))
  }, [])

  const toggleAmoled = useCallback(() => {
    setState((prev) => ({ ...prev, amoled: !prev.amoled }))
  }, [])

  const setAmoled = useCallback((amoled: boolean) => {
    setState((prev) => ({ ...prev, amoled }))
  }, [])

  const setDensity = useCallback((density: Density) => {
    setState((prev) => ({ ...prev, density }))
  }, [])

  const setRadius = useCallback((radius: RadiusMode) => {
    setState((prev) => ({ ...prev, radius }))
  }, [])

  const setMotion = useCallback((motion: MotionMode) => {
    setState((prev) => ({ ...prev, motion }))
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      toggleTheme,
      setTheme,
      toggleAmoled,
      setAmoled,
      setDensity,
      setRadius,
      setMotion,
    }),
    [state, toggleTheme, setTheme, toggleAmoled, setAmoled, setDensity, setRadius, setMotion],
  )

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  )
}
