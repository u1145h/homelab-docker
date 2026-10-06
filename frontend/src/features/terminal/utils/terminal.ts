import type { CSSProperties } from "react"
import type { ITheme } from "xterm"
import { darkColors, amoledColors, lightColors } from "@/design/colors"
import { getActiveServerProfile } from "@/utils/serverStorage"
import { authStorage } from "@/utils/authStorage"
import client from "@/api/client"

export function getWebSocketUrl(path: string): string {
  const token = authStorage.getToken()
  const appendToken = (url: string) => {
    if (!token) return url
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}token=${encodeURIComponent(token)}`
  }

  if (typeof window !== "undefined") {
    let baseUrl = ""

    // 1. Check if active server profile is configured (e.g. mobile app or multi-server)
    try {
      const active = getActiveServerProfile()
      if (active && active.url) {
        baseUrl = active.url
      }
    } catch {}

    // 2. Check client.defaults.baseURL if absolute
    if (!baseUrl && client.defaults.baseURL && client.defaults.baseURL.startsWith("http")) {
      baseUrl = client.defaults.baseURL.replace(/\/api\/v1\/?$/, "")
    }

    if (baseUrl) {
      try {
        const urlObj = new URL(baseUrl)
        const wsProtocol = urlObj.protocol === "https:" ? "wss:" : "ws:"
        return appendToken(`${wsProtocol}//${urlObj.host}${path}`)
      } catch {}
    }

    // 3. Fallback to window.location (web browser)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return appendToken(`${protocol}//${window.location.host}${path}`)
  }

  return appendToken(`ws://localhost:9876${path}`)
}

export function getTerminalTheme(mode: "light" | "dark", isAmoled = false): ITheme {
  if (mode === "light") {
    return {
      background: lightColors.surface,
      foreground: lightColors.textPrimary,
      cursor: lightColors.accent,
      cursorAccent: lightColors.surface,
      selectionBackground: "rgba(169, 182, 101, 0.25)",
      black: "#1A1A1A",
      red: lightColors.danger,
      green: lightColors.success,
      yellow: lightColors.warning,
      blue: lightColors.info,
      magenta: lightColors.purple,
      cyan: lightColors.info,
      white: "#E0E0E0",
      brightBlack: "#666666",
      brightRed: "#EF5350",
      brightGreen: lightColors.accent,
      brightYellow: "#FF9800",
      brightBlue: "#42A5F5",
      brightMagenta: "#BA68C8",
      brightCyan: "#03A9F4",
      brightWhite: "#FFFFFF",
    }
  }

  const colors = isAmoled ? amoledColors : darkColors

  return {
    background: colors.surface,
    foreground: colors.textPrimary,
    cursor: colors.accent,
    cursorAccent: colors.surface,
    selectionBackground: "rgba(169, 182, 101, 0.25)",
    black: isAmoled ? "#000000" : "#1A1C1E",
    red: colors.danger,
    green: colors.success,
    yellow: colors.warning,
    blue: colors.info,
    magenta: colors.purple,
    cyan: colors.info,
    white: colors.textPrimary,
    brightBlack: "#55585A",
    brightRed: "#F18882",
    brightGreen: colors.accent,
    brightYellow: "#F0A775",
    brightBlue: "#9CBDC7",
    brightMagenta: "#E1A7B7",
    brightCyan: "#9CBDC7",
    brightWhite: "#F7F3EA",
  }
}

export function getTerminalFont(): CSSProperties {
  return {
    fontFamily:
      "var(--kuro-font-family-mono, 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace)",
    fontSize: 14,
    lineHeight: 1.2,
  }
}

