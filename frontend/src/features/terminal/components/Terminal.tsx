import { useEffect, useRef, useCallback } from "react"
import { Terminal as XTerm } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import "xterm/css/xterm.css"
import Box from "@mui/material/Box"
import { useThemeMode } from "@/hooks/useThemeMode"
import { getTerminalTheme } from "../utils/terminal"

interface TerminalProps {
  onData: (data: string) => void
  onResize: (rows: number, cols: number) => void
  setWrite: (write: (data: string) => void) => void
  setClear?: (clear: () => void) => void
  setFocus?: (focus: () => void) => void
  isActive?: boolean
}

export default function TerminalView({ onData, onResize, setWrite, setClear, setFocus, isActive = true }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const resizeTimerRef = useRef<number | null>(null)
  const { mode, isAmoled } = useThemeMode()

  const isMobile = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window))

  // ── Stable callback refs ─────────────────────────────────────────────────
  const onDataRef    = useRef(onData)
  const onResizeRef  = useRef(onResize)
  const setWriteRef  = useRef(setWrite)
  const setClearRef  = useRef(setClear)
  const setFocusRef  = useRef(setFocus)

  // Keep refs in sync with the latest prop values
  useEffect(() => { onDataRef.current = onData },    [onData])
  useEffect(() => { onResizeRef.current = onResize }, [onResize])
  useEffect(() => { setWriteRef.current = setWrite }, [setWrite])
  useEffect(() => { setClearRef.current = setClear }, [setClear])
  useEffect(() => { setFocusRef.current = setFocus }, [setFocus])
  // ─────────────────────────────────────────────────────────────────────────

  // fitTerminal is stable (empty dep array) — it reads onResize via ref,
  // so it doesn't need to be recreated when onResize changes reference.
  const fitTerminal = useCallback(() => {
    if (fitAddonRef.current && containerRef.current && containerRef.current.clientWidth > 0) {
      try {
        fitAddonRef.current.fit()
        const term = xtermRef.current
        if (term && term.rows > 0 && term.cols > 0) {
          onResizeRef.current(term.rows, term.cols)
        }
      } catch {
        // ignore transient fit errors
      }
    }
  }, []) // stable — reads onResize via ref

  // Re-fit when this tab becomes the active one
  useEffect(() => {
    if (isActive) {
      const timer = requestAnimationFrame(() => {
        fitTerminal()
        xtermRef.current?.focus()
        xtermRef.current?.textarea?.focus()
      })
      return () => cancelAnimationFrame(timer)
    }
  }, [isActive, fitTerminal])

  // ── XTerm instance lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    const term = new XTerm({
      fontFamily: "var(--kuro-font-family-mono, 'MesloLGS NF', 'Symbols Nerd Font Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'DejaVu Sans Mono for Powerline', 'Consolas', monospace)",
      fontSize: isMobile ? 12 : 11,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "block",
      allowTransparency: true,
      theme: getTerminalTheme(mode, isAmoled),
      allowProposedApi: true,
      screenReaderMode: isMobile,
      rows: 24,
      cols: 80,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    if (containerRef.current) {
      term.open(containerRef.current)
    }

    // Configure xterm's hidden helper textarea for Android Soft Keyboards
    // inputmode="url" + autocorrect/autocapitalize off stops Gboard from doing
    // multi-word predictive composition that causes duplicated text or broken backspaces
    if (term.textarea) {
      term.textarea.setAttribute('autocapitalize', 'none')
      term.textarea.setAttribute('autocorrect', 'off')
      term.textarea.setAttribute('autocomplete', 'off')
      term.textarea.setAttribute('spellcheck', 'false')
      term.textarea.setAttribute('data-gramm', 'false')
      if (isMobile) {
        term.textarea.setAttribute('inputmode', 'url')
      }
    }

    // Use ref so this listener always calls the latest onData without the
    // effect needing to re-run and dispose/recreate the terminal
    term.onData((data) => {
      onDataRef.current(data)
    })

    // Register the write function — uses ref so we get the current setWrite
    // (which is bound to the correct tab.id in TerminalPage)
    setWriteRef.current((data: string) => {
      term.write(data)
    })

    if (setClearRef.current) {
      setClearRef.current(() => {
        term.clear()
      })
    }

    if (setFocusRef.current) {
      setFocusRef.current(() => {
        term.focus()
        term.textarea?.focus()
      })
    }

    xtermRef.current = term

    requestAnimationFrame(() => {
      fitTerminal()
    })

    const ro = new ResizeObserver(() => {
      if (resizeTimerRef.current !== null) {
        clearTimeout(resizeTimerRef.current)
      }
      resizeTimerRef.current = window.setTimeout(fitTerminal, 150)
    })
    resizeObserverRef.current = ro

    if (containerRef.current) {
      ro.observe(containerRef.current)
    }

    return () => {
      if (resizeTimerRef.current !== null) {
        clearTimeout(resizeTimerRef.current)
      }
      resizeObserverRef.current?.disconnect()
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [mode, isAmoled, fitTerminal, isMobile])

  const handleContainerFocus = () => {
    if (xtermRef.current) {
      xtermRef.current.focus()
      xtermRef.current.textarea?.focus()
    }
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box
        ref={containerRef}
        onClick={handleContainerFocus}
        onTouchEnd={handleContainerFocus}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: "var(--kuro-color-surface)",
          padding: "8px 12px",
          overflow: "hidden",
          "& .xterm": {
            height: "100%",
            padding: 0,
          },
          "& .xterm-viewport": {
            scrollbarWidth: "thin",
            scrollbarColor: mode === "dark" ? "var(--kuro-color-border) transparent" : "#d0d0d0 transparent",
            backgroundColor: "transparent !important",
          },
          "& .xterm-screen": {
            padding: 0,
          },
        }}
      />
    </Box>
  )
}



