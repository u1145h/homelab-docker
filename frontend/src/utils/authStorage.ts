import { isNativeMobileApp } from './serverStorage'

export interface StoredUser {
  username: string
  role?: string
  token?: string
}

const KEY = "kuro_user"

export type StorageType = 'local' | 'session'

interface GetUserResult {
  user: StoredUser | null
  storage: StorageType | null
}

function getStorage(type: StorageType): Storage {
  return type === 'local' ? localStorage : sessionStorage
}

export const authStorage = {
  getUser(): GetUserResult {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return { user: JSON.parse(raw) as StoredUser, storage: 'local' }
    } catch {}

    try {
      const raw = sessionStorage.getItem(KEY)
      if (raw) return { user: JSON.parse(raw) as StoredUser, storage: 'session' }
    } catch {}

    return { user: null, storage: null }
  },

  getToken(): string | null {
    const { user } = this.getUser()
    return user?.token || null
  },

  setUser(user: StoredUser, rememberMe: boolean): void {
    // Clear both storages first to avoid orphaned duplicates
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)

    // On native mobile app, enforce localStorage so sessions survive app closes/restarts
    const shouldPersist = rememberMe || isNativeMobileApp()
    const storage = getStorage(shouldPersist ? 'local' : 'session')
    storage.setItem(KEY, JSON.stringify(user))
  },

  clear(): void {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
  },
}
