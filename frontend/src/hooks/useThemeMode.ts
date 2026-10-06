import { useAppearance } from './useAppearance'
import { useState, useEffect } from 'react'

export function useThemeMode() {
  const { theme, toggleTheme, amoled, toggleAmoled, setAmoled } = useAppearance()
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(mq.matches)
    
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedMode = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  const isAmoled = Boolean(amoled && resolvedMode === 'dark')

  return {
    mode: resolvedMode,
    isAmoled,
    amoled,
    toggle: toggleTheme,
    toggleAmoled,
    setAmoled,
  }
}
