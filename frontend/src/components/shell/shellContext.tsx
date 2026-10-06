import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react'
import { useMediaQuery, useTheme } from '@mui/material'
import { loadShellState, saveShellState } from './shellStorage'

export type SidebarMode = 'expanded' | 'collapsed'

export interface ShellContextValue {
  sidebarMode: SidebarMode
  sidebarOpen: boolean
  setSidebarMode: (mode: SidebarMode) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  isMobile: boolean
  isTablet: boolean
}

const defaultValue: ShellContextValue = {
  sidebarMode: 'expanded',
  sidebarOpen: false,
  setSidebarMode: () => {},
  toggleSidebar: () => {},
  setSidebarOpen: () => {},
  isMobile: false,
  isTablet: false,
}

const ShellContext = createContext<ShellContextValue>(defaultValue)

export function ShellProvider({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'))

  const [sidebarMode, setSidebarModeState] = useState<SidebarMode>(() => {
    const saved = loadShellState()
    return saved.sidebar.collapsed ? 'collapsed' : 'expanded'
  })

  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    saveShellState({ version: 1, sidebar: { collapsed: sidebarMode === 'collapsed' } })
  }, [sidebarMode])

  const setSidebarMode = useCallback((mode: SidebarMode) => {
    setSidebarModeState(mode)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarModeState((prev) => (prev === 'expanded' ? 'collapsed' : 'expanded'))
  }, [])

  const value = useMemo(
    () => ({
      sidebarMode,
      sidebarOpen,
      setSidebarMode,
      toggleSidebar,
      setSidebarOpen,
      isMobile,
      isTablet,
    }),
    [sidebarMode, sidebarOpen, setSidebarMode, toggleSidebar, isMobile, isTablet],
  )

  return (
    <ShellContext.Provider value={value}>
      {children}
    </ShellContext.Provider>
  )
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext)
  if (!ctx) {
    throw new Error('useShell must be used within ShellProvider')
  }
  return ctx
}
