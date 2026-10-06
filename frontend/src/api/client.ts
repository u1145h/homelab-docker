import axios from "axios"
import { authStorage } from "../utils/authStorage"
import { getActiveServerProfile, isNativeMobileApp } from "../utils/serverStorage"

function resolveInitialBaseURL(): string {
  if (typeof window === "undefined") return "/api/v1"
  try {
    if (isNativeMobileApp()) {
      const activeProfile = getActiveServerProfile()
      if (activeProfile && activeProfile.url) {
        const clean = activeProfile.url.replace(/\/+$/, "")
        return `${clean}/api/v1`
      }
    }
  } catch {
    // fallback
  }
  return "/api/v1"
}

const client = axios.create({
  baseURL: resolveInitialBaseURL(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

export function updateClientBaseURL(serverUrl: string): void {
  if (!serverUrl) return
  const clean = serverUrl.replace(/\/+$/, "")
  client.defaults.baseURL = `${clean}/api/v1`
}

client.interceptors.request.use((config) => {
  const token = authStorage.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let onUnauthorized: (() => void) | null = null

export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorized = cb
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ""
    const isAuthOrStatusOrLogin = url.includes("/login") || url.includes("/status") || url.includes("/auth")
    if (error.response?.status === 401 && onUnauthorized && !isAuthOrStatusOrLogin) {
      onUnauthorized()
    }
    return Promise.reject(error)
  },
)

export default client
