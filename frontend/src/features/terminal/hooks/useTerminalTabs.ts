import { useState, useCallback, useRef, useEffect } from "react"
import { TerminalWebSocket } from "../api/websocket"
import { createSession, closeSession, resizeSession } from "../api/terminal"
import type { SessionResponse, ConnectionStatus, SSHConfig } from "../types"

const CONNECTION_TIMEOUT = 8000

let tabCounter = 0

export interface TabData {
  id: string
  label: string
  session: SessionResponse | null
  status: ConnectionStatus
  error: string | null
  sshConfig?: SSHConfig
}

export function useTerminalTabs() {
  const [tabs, setTabs] = useState<TabData[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const writeMapRef = useRef<Map<string, ((data: string) => void) | null>>(new Map())
  const clearMapRef = useRef<Map<string, (() => void) | null>>(new Map())
  const wsMapRef = useRef<Map<string, TerminalWebSocket | null>>(new Map())
  const pingMapRef = useRef<Map<string, number>>(new Map())
  const sessionMapRef = useRef<Map<string, string>>(new Map())
  const connectTimeoutRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (activeTabId === null && tabs.length > 0) {
      setActiveTabId(tabs[tabs.length - 1].id)
    }
  }, [activeTabId, tabs])

  const cleanupTab = useCallback((tempId: string) => {
    const timeout = connectTimeoutRef.current.get(tempId)
    if (timeout !== undefined) {
      clearTimeout(timeout)
      connectTimeoutRef.current.delete(tempId)
    }
    const ping = pingMapRef.current.get(tempId)
    if (ping !== undefined) {
      clearInterval(ping)
      pingMapRef.current.delete(tempId)
    }
    const ws = wsMapRef.current.get(tempId)
    if (ws) {
      ws.close()
      wsMapRef.current.delete(tempId)
    }
    writeMapRef.current.delete(tempId)
    clearMapRef.current.delete(tempId)
  }, [])

  const initSessionForTab = useCallback(async (tempId: string, sshConfig?: SSHConfig) => {
    cleanupTab(tempId)

    setTabs(prev => prev.map(t => t.id === tempId ? { ...t, status: "connecting", error: null } : t))

    try {
      const session = await createSession(sshConfig ? { ssh: sshConfig } : {})
      sessionMapRef.current.set(tempId, session.id)

      setTabs(prev => prev.map(t => {
        if (t.id !== tempId) return t
        const formattedLabel = sshConfig
          ? `${sshConfig.username}@${sshConfig.host}`
          : (t.label || `terminal #${tabCounter}`)
        return { ...t, label: formattedLabel, session, sshConfig }
      }))

      const ws = new TerminalWebSocket(session.id, {
        onOpen: () => {
          const timeout = connectTimeoutRef.current.get(tempId)
          if (timeout !== undefined) {
            clearTimeout(timeout)
            connectTimeoutRef.current.delete(tempId)
          }
          setTabs(prev => prev.map(t => t.id === tempId ? { ...t, status: "connected", session } : t))
        },
        onMessage: (msg) => {
          if (msg.type === "output" && msg.data) {
            writeMapRef.current.get(tempId)?.(msg.data)
          }
        },
        onClose: () => {
          cleanupTab(tempId)
          setTabs(prev => prev.map(t => t.id === tempId ? { ...t, status: "closed" } : t))
        },
        onError: () => {
          cleanupTab(tempId)
          setTabs(prev => prev.map(t => t.id === tempId ? {
            ...t,
            status: "error",
            error: "WebSocket connection failed. Check that the backend is running.",
          } : t))
        },
      })

      ws.connect()
      wsMapRef.current.set(tempId, ws)
      pingMapRef.current.set(tempId, window.setInterval(() => ws.sendPing(), 30000))

      connectTimeoutRef.current.set(tempId, window.setTimeout(() => {
        cleanupTab(tempId)
        setTabs(prev => prev.map(t => t.id === tempId ? {
          ...t,
          status: "error",
          error: "Connection timed out. The backend might be unreachable or a firewall is blocking WebSocket connections.",
        } : t))
      }, CONNECTION_TIMEOUT))
    } catch (err: any) {
      cleanupTab(tempId)
      setTabs(prev => prev.map(t => t.id === tempId ? {
        ...t,
        status: "error",
        error: err.message || "Failed to create terminal session",
      } : t))
    }
  }, [cleanupTab])

  const createTab = useCallback(async (sshConfig?: SSHConfig) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    tabCounter++
    const label = sshConfig
      ? `${sshConfig.username}@${sshConfig.host}`
      : `terminal #${tabCounter}`

    const newTab: TabData = {
      id: tempId,
      label,
      session: null,
      status: "connecting",
      error: null,
      sshConfig,
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(tempId)

    await initSessionForTab(tempId, sshConfig)
  }, [initSessionForTab])

  const reconnectTab = useCallback(async (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (!tab) return

    const oldSid = sessionMapRef.current.get(id)
    if (oldSid) {
      sessionMapRef.current.delete(id)
      closeSession(oldSid).catch(() => {})
    }

    await initSessionForTab(id, tab.sshConfig)
  }, [tabs, initSessionForTab])

  const closeTab = useCallback((id: string) => {
    cleanupTab(id)

    const sid = sessionMapRef.current.get(id)
    if (sid) {
      sessionMapRef.current.delete(id)
      closeSession(sid).catch(() => {})
    }

    setTabs(prev => prev.filter(t => t.id !== id))
    setActiveTabId(prev => prev === id ? null : prev)
  }, [cleanupTab])

  const switchTab = useCallback((id: string) => {
    setActiveTabId(id)
  }, [])

  const sendInput = useCallback((id: string, data: string) => {
    wsMapRef.current.get(id)?.sendInput(data)
  }, [])

  const sendResize = useCallback((id: string, rows: number, cols: number) => {
    wsMapRef.current.get(id)?.sendResize(rows, cols)
    const sid = sessionMapRef.current.get(id)
    if (sid) {
      resizeSession(sid, rows, cols).catch(() => {})
    }
  }, [])

  const setWrite = useCallback((id: string, fn: ((data: string) => void) | null) => {
    writeMapRef.current.set(id, fn)
  }, [])

  const setClear = useCallback((id: string, fn: (() => void) | null) => {
    clearMapRef.current.set(id, fn)
  }, [])

  const focusMapRef = useRef<Map<string, (() => void) | null>>(new Map())

  const setFocus = useCallback((id: string, fn: (() => void) | null) => {
    focusMapRef.current.set(id, fn)
  }, [])

  const focusTab = useCallback((id: string) => {
    const focusFn = focusMapRef.current.get(id)
    if (focusFn) {
      focusFn()
    }
  }, [])

  const clearTab = useCallback((id: string) => {
    const clearFn = clearMapRef.current.get(id)
    if (clearFn) {
      clearFn()
    }
  }, [])

  useEffect(() => {
    return () => {
      connectTimeoutRef.current.forEach((timeout) => clearTimeout(timeout))
      connectTimeoutRef.current.clear()
      pingMapRef.current.forEach((ping) => clearInterval(ping))
      pingMapRef.current.clear()
      wsMapRef.current.forEach((ws) => ws?.close())
      wsMapRef.current.clear()
      sessionMapRef.current.forEach((sid) => closeSession(sid).catch(() => {}))
      sessionMapRef.current.clear()
      writeMapRef.current.clear()
      clearMapRef.current.clear()
      focusMapRef.current.clear()
    }
  }, [])

  return {
    tabs,
    activeTabId,
    createTab,
    reconnectTab,
    closeTab,
    switchTab,
    sendInput,
    sendResize,
    setWrite,
    setClear,
    setFocus,
    focusTab,
    clearTab,
  } as const
}

