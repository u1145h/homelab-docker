import { useEffect, useCallback, useRef } from "react"
import { Box, Typography, Alert } from "@mui/material"
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Button } from "@/components/ui/actions"
import { AppIcon } from "@/components/ui/icons"
import TerminalView from "../components/Terminal"
import TerminalTabs from "../components/TerminalTabs"
import MobileTerminalAccessoryBar from "../components/MobileTerminalAccessoryBar"
import { useTerminalContext } from "../contexts/TerminalContext"

import { radius } from "@/design/radius"

export default function TerminalPage() {
  useDocumentTitle('Terminal - HomeLab')
  const {
    tabs,
    activeTabId,
    createTab,
    reconnectTab,
    closeTab,
    switchTab,
    sendInput,
    sendResize,
    setWrite,
    setFocus,
    focusTab,
  } = useTerminalContext()

  const autoConnected = useRef(false)

  // Autoconnect first terminal session only when there are no existing sessions.
  // Using a module-level ref prevents double-fire in React StrictMode while also
  // working correctly under the keep-alive pattern (page stays mounted).
  useEffect(() => {
    if (!autoConnected.current && tabs.length === 0) {
      autoConnected.current = true
      createTab()
    }
  }, [createTab, tabs.length])


  const handleNewTab = useCallback(() => {
    createTab()
  }, [createTab])

  const handleReconnectActive = useCallback(() => {
    if (activeTabId) {
      reconnectTab(activeTabId)
    }
  }, [activeTabId, reconnectTab])

  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Keyboard shortcut listener (Ctrl+Shift+T / Ctrl+Shift+W)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault()
        handleNewTab()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault()
        if (activeTabId) {
          closeTab(activeTabId)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleNewTab, activeTabId, closeTab])

  return (
    <Box
      className="terminal-page-root"
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        height: "100%",
        maxHeight: "100%",
        minHeight: 0,
        p: { xs: 0, sm: "20px", lg: "25px" },
        m: 0,
        gap: 0,
        borderRadius: 0,
        overflow: "hidden",
      }}
    >
      {/* Main Terminal Panel Card */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          bgcolor: "var(--kuro-color-surface)",
          border: { xs: "none", sm: "1px solid var(--kuro-color-border)" },
          borderRadius: { xs: 0, sm: radius.card },
          overflow: "hidden",
          boxShadow: { xs: "none", sm: "0 4px 20px rgba(0,0,0,0.15)" },
        }}
      >
        {/* Tab Bar Header */}
        <TerminalTabs
          tabs={tabs}
          activeTabId={activeTabId}
          status={activeTab?.status}
          onSelectTab={switchTab}
          onCloseTab={closeTab}
          onNewTab={handleNewTab}
          onReconnect={handleReconnectActive}
          reconnectDisabled={!activeTab}
        />

        {/* Terminal Content Area */}
        <Box
          sx={{
            position: "relative",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
            bgcolor: "var(--kuro-color-surface)",
          }}
        >

          {/* Persistent Render of each tab's xterm view */}
          {tabs.length > 0 ? (
            tabs.map((tab) => {
              const isActive = tab.id === activeTabId

              if (tab.status === "error" && !tab.session) {
                return (
                  <Box
                    key={tab.id}
                    sx={{
                      display: isActive ? "flex" : "none",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: 1,
                      gap: 2,
                      p: 4,
                    }}
                  >
                    <AppIcon name="alert-triangle" size={48} style={{ color: "var(--kuro-color-danger)" }} />
                    <Alert severity="error" sx={{ maxWidth: 500 }}>
                      {tab.error || "Failed to establish terminal connection."}
                    </Alert>
                    <Button variant="secondary" onClick={() => reconnectTab(tab.id)}>
                      Retry Connection
                    </Button>
                  </Box>
                )
              }

              if (tab.status === "closed") {
                return (
                  <Box
                    key={tab.id}
                    sx={{
                      display: isActive ? "flex" : "none",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: 1,
                      gap: 2,
                      p: 4,
                    }}
                  >
                    <AppIcon name="terminal" size={48} style={{ color: "var(--kuro-color-text-muted)" }} />
                    <Typography variant="body1" sx={{ color: "var(--kuro-color-text-secondary)" }}>
                      Terminal session closed.
                    </Typography>
                    <Button variant="secondary" onClick={() => reconnectTab(tab.id)}>
                      Reconnect Session
                    </Button>
                  </Box>
                )
              }

              return (
                <Box
                  key={tab.id}
                    sx={{
                      display: isActive ? "flex" : "none",
                      flexDirection: "column",
                      flex: 1,
                      minHeight: 0,
                      minWidth: 0,
                      overflow: "hidden",
                      width: "100%",
                      height: "100%",
                    }}
                >
                  <TerminalView
                    isActive={isActive}
                    onData={(data) => sendInput(tab.id, data)}
                    onResize={(rows, cols) => sendResize(tab.id, rows, cols)}
                    setWrite={(fn) => setWrite(tab.id, fn)}
                    setFocus={(fn) => setFocus(tab.id, fn)}
                  />
                </Box>
              )
            })
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                gap: 2,
                p: 4,
              }}
            >
              <AppIcon name="terminal" size={48} style={{ color: "var(--kuro-color-text-muted)" }} />
              <Typography variant="body1" sx={{ color: "var(--kuro-color-text-secondary)" }}>
                No active terminal sessions.
              </Typography>
              <Button variant="primary" onClick={handleNewTab}>
                Open New Terminal
              </Button>
            </Box>
          )}
        </Box>

        {/* Mobile Terminal Keyboard Accessory Bar (ESC, TAB, CTRL, ALT, Arrows, etc.) */}
        <MobileTerminalAccessoryBar
          onSendInput={(data) => {
            if (activeTabId) {
              sendInput(activeTabId, data)
            }
          }}
          onFocusTerminal={() => {
            if (activeTabId) {
              focusTab(activeTabId)
            }
          }}
        />
      </Box>
    </Box>
  )
}

