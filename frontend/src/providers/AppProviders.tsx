import { useEffect, type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'
import { NavigationBar, Style as NavigationBarStyle } from '@capawesome/capacitor-navigation-bar'
import { AuthProvider } from '../contexts/AuthContext'
import { StatusProvider } from '../contexts/StatusContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { ServerProvider, useServer } from '../contexts/ServerContext'
import { InitialServerSetupPage } from '../components/server/InitialServerSetupPage'
import { lightTheme, darkTheme, amoledTheme, injectCSSVariables, clearCSSVariables } from '../theme'
import QueryProvider from './QueryProvider'
import { AppearanceProvider } from './AppearanceProvider'
import { useThemeMode } from '../hooks/useThemeMode'

interface AppProvidersProps {
  children: ReactNode
}

function ServerConfigGuard({ children }: { children: ReactNode }) {
  const { isServerConfigured } = useServer()

  if (!isServerConfigured) {
    return <InitialServerSetupPage />
  }

  return <>{children}</>
}

function ThemedApp({ children }: { children: ReactNode }) {
  const { mode, isAmoled } = useThemeMode()
  const theme = mode === 'light' ? lightTheme : isAmoled ? amoledTheme : darkTheme

  useEffect(() => {
    injectCSSVariables(theme, isAmoled)

    const isDark = mode !== 'light'
    const bgColor = isDark ? (isAmoled ? '#000000' : '#111314') : '#F6F4EF'

    let metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta')
      metaThemeColor.setAttribute('name', 'theme-color')
      document.head.appendChild(metaThemeColor)
    }
    metaThemeColor.setAttribute('content', bgColor)

    if (typeof (window as any).AndroidThemeBridge?.setSystemTheme === 'function') {
      (window as any).AndroidThemeBridge.setSystemTheme(bgColor, isDark)
    }

    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
      StatusBar.setBackgroundColor({ color: bgColor }).catch(() => {})
      StatusBar.setStyle({ style: isDark ? StatusBarStyle.Dark : StatusBarStyle.Light }).catch(() => {})
      NavigationBar.setColor({ color: 'transparent' }).catch(() => {})
      NavigationBar.setStyle({ style: isDark ? NavigationBarStyle.Dark : NavigationBarStyle.Light }).catch(() => {})
    }

    return () => clearCSSVariables()
  }, [theme, isAmoled, mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <ServerConfigGuard>{children}</ServerConfigGuard>
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <ServerProvider>
      <QueryProvider>
        <AuthProvider>
          <StatusProvider>
            <AppearanceProvider>
              <ThemedApp>{children}</ThemedApp>
            </AppearanceProvider>
          </StatusProvider>
        </AuthProvider>
      </QueryProvider>
    </ServerProvider>
  )
}
