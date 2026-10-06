import { useState, useEffect, useCallback, useRef } from "react"
import { TerminalWebSocket } from "../api/websocket"
import { createSession, closeSession, resizeSession } from "../api/terminal"
import type { SessionResponse, ConnectionStatus } from "../types"

export interface UseTerminalReturn {
  session: SessionResponse | null
  status: ConnectionStatus
  error: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendInput: (data: string) => void
  sendResize: (rows: number, cols: number) => void
  onOutput: (data: string) => void
  setOnOutput: (cb: ((data: string) => void) | null) => void
}

export function useTerminal(autoConnect = true): UseTerminalReturn {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<TerminalWebSocket | null>(null)
  const sessionRef = useRef<SessionResponse | null>(null)
  const pingRef = useRef<number | null>(null)
  const onOutputRef = useRef<((data: string) => void) | null>(null)

  const cleanup = useCallback(() => {
    if (pingRef.current !== null) {
      clearInterval(pingRef.current)
      pingRef.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  const disconnect = useCallback(async () => {
    cleanup()
    const sid = sessionRef.current?.id
    if (sid) {
      try { await closeSession(sid) } catch { /* ignore close errors */ }
    }
    sessionRef.current = null
    setSession(null)
    setStatus("closed")
    setError(null)
  }, [cleanup])

  const connect = useCallback(async () => {
    cleanup()
    setStatus("connecting")
    setError(null)

    try {
      const sess = await createSession()
      sessionRef.current = sess
      setSession(sess)

      const ws = new TerminalWebSocket(sess.id, {
        onOpen: () => {
          setStatus("connected")
        },
        onMessage: (msg) => {
          if (msg.type === "output" && msg.data) {
            onOutputRef.current?.(msg.data)
          }
        },
        onClose: () => {
          cleanup()
          setStatus("closed")
        },
        onError: () => {
          setStatus("error")
          setError("WebSocket connection failed. Check that the backend is running.")
        },
      })

      ws.connect()
      wsRef.current = ws
      pingRef.current = window.setInterval(() => ws.sendPing(), 30000)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create terminal session"
      setStatus("error")
      setError(message)
    }
  }, [cleanup])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (autoConnect) {
      timer = setTimeout(() => connect(), 0)
    }
    return () => {
      if (timer) clearTimeout(timer)
      cleanup()
      const sid = sessionRef.current?.id
      if (sid) { closeSession(sid).catch(() => {}) }
    }
  }, [autoConnect, connect, cleanup])

  const sendInput = useCallback((data: string) => {
    wsRef.current?.sendInput(data)
  }, [])

  const sendResize = useCallback((rows: number, cols: number) => {
    wsRef.current?.sendResize(rows, cols)
    const sid = sessionRef.current?.id
    if (sid) {
      resizeSession(sid, rows, cols).catch(() => {})
    }
  }, [])

  const setOnOutput = useCallback((cb: ((data: string) => void) | null) => {
    onOutputRef.current = cb
  }, [])

  return {
    session,
    status,
    error,
    connect,
    disconnect,
    sendInput,
    sendResize,
    onOutput: (data: string) => onOutputRef.current?.(data),
    setOnOutput,
  }
}
