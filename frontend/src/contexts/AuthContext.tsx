import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { ReactNode } from "react"
import { login as apiLogin, logout as apiLogout, checkSession } from "../api/auth"
import type { LoginResponse } from "../api/auth"
import { setOnUnauthorized } from "../api/client"
import { authStorage } from "../utils/authStorage"
import { useSnackbar } from "../hooks/useSnackbar"
import { SnackbarProvider } from "../providers/SnackbarProvider"

export interface AuthUser {
  username: string
  first_name?: string
  last_name?: string
  role?: string
  two_factor_enabled?: boolean
}

export interface LoginParams {
  username: string
  password: string
  rememberMe: boolean
  totp_code?: string
}

export interface AuthContextType {
  authenticated: boolean
  loading: boolean
  user: AuthUser | null
  role: string | null
  login: (params: LoginParams) => Promise<LoginResponse>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const role = user?.role ?? null
  const { showSnackbar } = useSnackbar()

  const handleUnauthorized = useCallback(() => {
    setAuthenticated((wasAuth) => {
      if (wasAuth) {
        showSnackbar("Session expired. Please log in again.", "warning")
      }
      return false
    })
    setUser(null)
    authStorage.clear()
  }, [showSnackbar])

  useEffect(() => {
    setOnUnauthorized(handleUnauthorized)
    return () => setOnUnauthorized(null)
  }, [handleUnauthorized])

  useEffect(() => {
    async function initialize() {
      const { user: stored, storage } = authStorage.getUser()
      if (!stored || !storage) {
        setLoading(false)
        return
      }

      const rememberMe = storage === 'local'

      // Pre-authenticate locally if stored token exists
      if (stored.username) {
        setAuthenticated(true)
        setUser({ username: stored.username, role: stored.role })
      }

      try {
        const session = await checkSession()
        if (session.authenticated && session.username) {
          const currentUser: AuthUser = {
            username: session.username,
            role: session.role,
            first_name: session.first_name,
            last_name: session.last_name,
            two_factor_enabled: session.two_factor_enabled,
          }
          setAuthenticated(true)
          setUser(currentUser)
          // Retain stored token when updating stored user!
          authStorage.setUser({ ...currentUser, token: stored.token }, rememberMe)
        } else if (session.authenticated === false) {
          // Explicitly unauthenticated / token expired on server
          setAuthenticated(false)
          setUser(null)
          authStorage.clear()
        }
      } catch (err) {
        // Network error or server temporarily unreachable - keep local authentication state
        console.warn("Session verification check warning:", err)
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [])

  const login = useCallback(async ({ username, password, rememberMe, totp_code }: LoginParams): Promise<LoginResponse> => {
    const res = await apiLogin({ username, password, rememberMe, totp_code })
    if (res.require_2fa) {
      return res
    }
    if (res.role === 'client') {
      throw new Error("Client accounts are restricted to background synchronization and cannot access the web dashboard.")
    }
    if (res.role === 'user') {
      throw new Error("User accounts are dedicated to the Kuro Assistant app. Please sign in using the Kuro Assistant mobile or desktop application.")
    }
    const currentUser: AuthUser = {
      username,
      role: res.role,
      first_name: res.first_name,
      last_name: res.last_name,
    }
    setAuthenticated(true)
    setUser(currentUser)
    authStorage.setUser({ ...currentUser, token: res.token }, rememberMe)
    return res
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiLogout()
    } finally {
      setAuthenticated(false)
      setUser(null)
      authStorage.clear()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ authenticated, loading, user, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SnackbarProvider>
      <AuthProviderInner>
        {children}
      </AuthProviderInner>
    </SnackbarProvider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
