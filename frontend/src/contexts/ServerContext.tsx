import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  type ServerProfile,
  getStoredProfiles,
  saveStoredProfiles,
  setActiveServerId,
  getActiveServerProfile,
  hasConfiguredServer,
  sanitizeUrl,
  testServerConnection,
  isNativeMobileApp,
  type PingResult,
} from '../utils/serverStorage'
import { updateClientBaseURL } from '../api/client'
import { syncNativeCredentials } from '../services/notificationBridge'
import { authStorage } from '../utils/authStorage'

interface ServerContextValue {
  profiles: ServerProfile[]
  activeProfile: ServerProfile | null
  isServerConfigured: boolean
  isAndroidNative: boolean
  setActiveServer: (id: string) => void
  saveServerUrl: (url: string, name?: string) => ServerProfile
  addProfile: (name: string, url: string) => ServerProfile
  updateProfile: (id: string, name: string, url: string) => void
  deleteProfile: (id: string) => void
  resetServerConfig: () => void
  testServer: (url: string) => Promise<PingResult>
}

const ServerContext = createContext<ServerContextValue | null>(null)

export function ServerProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<ServerProfile[]>(() => getStoredProfiles())
  const [activeProfile, setActiveProfileState] = useState<ServerProfile | null>(() => getActiveServerProfile())

  const isAndroidNative = isNativeMobileApp()
  const isServerConfigured = !isAndroidNative || hasConfiguredServer()

  const syncActiveServer = useCallback((profile: ServerProfile | null) => {
    if (profile && profile.url) {
      updateClientBaseURL(profile.url)
      const token = authStorage.getToken() || undefined
      syncNativeCredentials(profile.url, token)
    }
  }, [])

  useEffect(() => {
    if (activeProfile) {
      syncActiveServer(activeProfile)
    }
  }, [activeProfile, syncActiveServer])

  const setActiveServer = useCallback(
    (id: string) => {
      const found = profiles.find((p) => p.id === id)
      if (!found) return
      setActiveServerId(id)
      setActiveProfileState(found)
      syncActiveServer(found)
    },
    [profiles, syncActiveServer]
  )

  const saveServerUrl = useCallback(
    (rawUrl: string, name?: string): ServerProfile => {
      const cleanUrl = sanitizeUrl(rawUrl)
      const existing = profiles.find((p) => p.url.toLowerCase() === cleanUrl.toLowerCase())

      let targetProfile: ServerProfile
      let updatedProfiles = [...profiles]

      if (existing) {
        targetProfile = existing
        if (name && name.trim() && existing.name !== name.trim()) {
          targetProfile = { ...existing, name: name.trim() }
          updatedProfiles = profiles.map((p) => (p.id === existing.id ? targetProfile : p))
        }
      } else {
        targetProfile = {
          id: `custom-${Date.now()}`,
          name: name && name.trim() ? name.trim() : cleanUrl,
          url: cleanUrl,
          isDefault: false,
        }
        updatedProfiles = [...profiles, targetProfile]
      }

      setProfiles(updatedProfiles)
      saveStoredProfiles(updatedProfiles)
      setActiveServerId(targetProfile.id)
      setActiveProfileState(targetProfile)
      syncActiveServer(targetProfile)

      return targetProfile
    },
    [profiles, syncActiveServer]
  )

  const updateProfile = useCallback(
    (id: string, name: string, rawUrl: string) => {
      const cleanUrl = sanitizeUrl(rawUrl)
      const updated = profiles.map((p) => {
        if (p.id === id) {
          return { ...p, name: name.trim() || cleanUrl, url: cleanUrl }
        }
        return p
      })
      setProfiles(updated)
      saveStoredProfiles(updated)

      if (activeProfile && activeProfile.id === id) {
        const updatedActive = updated.find((p) => p.id === id)
        if (updatedActive) {
          setActiveProfileState(updatedActive)
          syncActiveServer(updatedActive)
        }
      }
    },
    [profiles, activeProfile, syncActiveServer]
  )

  const deleteProfile = useCallback(
    (id: string) => {
      const target = profiles.find((p) => p.id === id)
      if (!target || target.isDefault) return

      const updated = profiles.filter((p) => p.id !== id)
      setProfiles(updated)
      saveStoredProfiles(updated)

      if (activeProfile && activeProfile.id === id) {
        if (updated.length > 0) {
          const fallback = updated[0]
          setActiveServerId(fallback.id)
          setActiveProfileState(fallback)
          syncActiveServer(fallback)
        } else {
          setActiveServerId(null)
          setActiveProfileState(null)
        }
      }
    },
    [profiles, activeProfile, syncActiveServer]
  )

  const resetServerConfig = useCallback(() => {
    setActiveServerId(null)
    setActiveProfileState(null)
  }, [])

  const testServer = useCallback(async (url: string) => {
    return testServerConnection(url)
  }, [])

  return (
    <ServerContext.Provider
      value={{
        profiles,
        activeProfile,
        isServerConfigured,
        isAndroidNative,
        setActiveServer,
        saveServerUrl,
        addProfile: (name: string, url: string) => saveServerUrl(url, name),
        updateProfile,
        deleteProfile,
        resetServerConfig,
        testServer,
      }}
    >
      {children}
    </ServerContext.Provider>
  )
}

export function useServer(): ServerContextValue {
  const ctx = useContext(ServerContext)
  if (!ctx) {
    throw new Error('useServer must be used within a ServerProvider')
  }
  return ctx
}
