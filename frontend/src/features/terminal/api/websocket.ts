import type { WSMessage } from "../types"
import { getWebSocketUrl } from "../utils/terminal"

export interface WSOptions {
  onOpen?: () => void
  onMessage?: (msg: WSMessage) => void
  onClose?: (code: number, reason: string) => void
  onError?: (error: Event) => void
}

export class TerminalWebSocket {
  private ws: WebSocket | null = null
  private sessionId: string
  private options: WSOptions

  constructor(sessionId: string, options: WSOptions = {}) {
    this.sessionId = sessionId
    this.options = options
  }

  connect(): void {
    if (this.ws) return
    const url = getWebSocketUrl(`/ws/terminal/${this.sessionId}`)
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.options.onOpen?.()
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        this.options.onMessage?.(msg)
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = (event: CloseEvent) => {
      this.options.onClose?.(event.code, event.reason)
      this.ws = null
    }

    this.ws.onerror = (event: Event) => {
      this.options.onError?.(event)
    }
  }

  send(msg: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  sendInput(data: string): void {
    this.send({ type: "input", data })
  }

  sendResize(rows: number, cols: number): void {
    this.send({ type: "resize", rows, cols })
  }

  sendPing(): void {
    this.send({ type: "ping" })
  }

  sendExit(): void {
    this.send({ type: "exit" })
  }

  close(): void {
    try {
      this.sendExit()
    } catch {
      // ignore send errors during close
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
