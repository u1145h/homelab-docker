import { useState, useEffect, useCallback } from "react"
import Box from "@mui/material/Box"
import { useNativeKeyboard } from "@/hooks/useNativeKeyboard"

interface MobileTerminalAccessoryBarProps {
  onSendInput: (data: string) => void
  onFocusTerminal?: () => void
}

export default function MobileTerminalAccessoryBar({
  onSendInput,
  onFocusTerminal,
}: MobileTerminalAccessoryBarProps) {
  const { isKeyboardOpen, isAndroidApp } = useNativeKeyboard(true)
  const [ctrlActive, setCtrlActive] = useState(false)
  const [altActive, setAltActive] = useState(false)

  // Reset modifier keys when keyboard closes
  useEffect(() => {
    if (!isKeyboardOpen) {
      setCtrlActive(false)
      setAltActive(false)
    }
  }, [isKeyboardOpen])

  // Listen for keydown when CTRL or ALT modifiers are latched
  useEffect(() => {
    if (!ctrlActive && !altActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      let char = e.key
      let consumed = false

      if (ctrlActive && char.length === 1) {
        const code = char.toUpperCase().charCodeAt(0)
        // Convert A-Z or special chars to ASCII control code (1-26)
        if (code >= 65 && code <= 90) {
          const ctrlChar = String.fromCharCode(code - 64)
          onSendInput(ctrlChar)
          consumed = true
        } else if (char === "[" || char === "3") {
          onSendInput("\x1b") // ESC
          consumed = true
        } else if (char === "\\" || char === "4") {
          onSendInput("\x1c")
          consumed = true
        } else if (char === "]" || char === "5") {
          onSendInput("\x1d")
          consumed = true
        }
      } else if (altActive && char.length === 1) {
        onSendInput(`\x1b${char}`)
        consumed = true
      }

      if (consumed) {
        e.preventDefault()
        e.stopPropagation()
        setCtrlActive(false)
        setAltActive(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [ctrlActive, altActive, onSendInput])

  const handleKeyClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent, action: string) => {
      // Prevent button click from unfocusing xterm textarea
      e.preventDefault()
      e.stopPropagation()

      switch (action) {
        case "ESC":
          onSendInput("\x1b")
          break
        case "/":
          onSendInput("/")
          break
        case "-":
          onSendInput("-")
          break
        case "HOME":
          onSendInput("\x1b[H")
          break
        case "UP":
          onSendInput("\x1b[A")
          break
        case "END":
          onSendInput("\x1b[F")
          break
        case "PGUP":
          onSendInput("\x1b[5~")
          break
        case "TAB":
          onSendInput("\t")
          break
        case "CTRL":
          setCtrlActive((prev) => !prev)
          break
        case "ALT":
          setAltActive((prev) => !prev)
          break
        case "LEFT":
          onSendInput("\x1b[D")
          break
        case "DOWN":
          onSendInput("\x1b[B")
          break
        case "RIGHT":
          onSendInput("\x1b[C")
          break
        case "PGDN":
          onSendInput("\x1b[6~")
          break
        default:
          break
      }

      onFocusTerminal?.()
    },
    [onSendInput, onFocusTerminal]
  )

  // Only render on the Android Native App and only when the keyboard is open
  if (!isAndroidApp || !isKeyboardOpen) {
    return null
  }

  const row1 = [
    { label: "ESC", action: "ESC" },
    { label: "/", action: "/" },
    { label: "—", action: "-" },
    { label: "HOME", action: "HOME" },
    { label: "↑", action: "UP" },
    { label: "END", action: "END" },
    { label: "PGUP", action: "PGUP" },
  ]

  const row2 = [
    { label: "⇥", action: "TAB" },
    { label: "CTRL", action: "CTRL", isModifier: true, active: ctrlActive },
    { label: "ALT", action: "ALT", isModifier: true, active: altActive },
    { label: "←", action: "LEFT" },
    { label: "↓", action: "DOWN" },
    { label: "→", action: "RIGHT" },
    { label: "PGDN", action: "PGDN" },
  ]

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: "#000000",
        borderTop: "1px solid rgba(255, 255, 255, 0.15)",
        pt: 0.5,
        pb: 0.5,
        px: 0.5,
        m: 0,
        gap: 0.5,
        userSelect: "none",
        touchAction: "manipulation",
        zIndex: 100,
        flexShrink: 0,
        boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.5)",
      }}
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
    >
      {/* Row 1 */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.5,
          alignItems: "center",
        }}
      >
        {row1.map((k) => (
          <Box
            key={k.label}
            onMouseDown={(e) => handleKeyClick(e, k.action)}
            onTouchStart={(e) => handleKeyClick(e, k.action)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 32,
              bgcolor: "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "var(--kuro-font-family-mono, monospace)",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              transition: "background-color 0.1s, transform 0.05s",
              "&:active": {
                bgcolor: "rgba(255, 255, 255, 0.25)",
                transform: "scale(0.95)",
              },
            }}
          >
            {k.label}
          </Box>
        ))}
      </Box>

      {/* Row 2 */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.5,
          alignItems: "center",
        }}
      >
        {row2.map((k) => {
          const isActive = k.active
          return (
            <Box
              key={k.label}
              onMouseDown={(e) => handleKeyClick(e, k.action)}
              onTouchStart={(e) => handleKeyClick(e, k.action)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 32,
                bgcolor: isActive ? "var(--kuro-color-primary, #a9b665)" : "rgba(255, 255, 255, 0.08)",
                color: isActive ? "#000000" : "#ffffff",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--kuro-font-family-mono, monospace)",
                cursor: "pointer",
                borderRadius: "4px",
                border: isActive ? "1px solid var(--kuro-color-primary, #a9b665)" : "1px solid rgba(255, 255, 255, 0.05)",
                transition: "background-color 0.1s, transform 0.05s",
                "&:active": {
                  bgcolor: isActive ? "var(--kuro-color-primary, #a9b665)" : "rgba(255, 255, 255, 0.25)",
                  transform: "scale(0.95)",
                },
              }}
            >
              {k.label}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
