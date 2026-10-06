import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { AppIcon } from "@/components/ui/icons"
import { IconButton } from "@/components/ui/actions"
import { radius } from "@/design/radius"
import type { TabData } from "../hooks/useTerminalTabs"

import type { ConnectionStatus } from "../types"

interface TerminalTabsProps {
  tabs: TabData[]
  activeTabId: string | null
  status?: ConnectionStatus
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onNewTab: () => void
  onReconnect: () => void
  reconnectDisabled?: boolean
}

export default function TerminalTabs({
  tabs,
  activeTabId,
  status,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onReconnect,
  reconnectDisabled,
}: TerminalTabsProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        bgcolor: "var(--kuro-color-background)",
        borderBottom: "1px solid var(--kuro-color-border)",
        px: 1.5,
        pt: 1,
        pb: 0,
        gap: 1,
        minHeight: 44,
        overflow: "hidden",
      }}
    >
      {/* Tabs List */}
      <Box
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          flex: 1,
          minWidth: 0,
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <Box
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.25,
                py: 0.75,
                cursor: "pointer",
                borderRadius: `${radius.card} ${radius.card} 0 0`,
                bgcolor: isActive ? "var(--kuro-color-surface)" : "transparent",
                border: "1px solid",
                borderColor: isActive ? "var(--kuro-color-border)" : "transparent",
                borderBottom: isActive ? "1px solid var(--kuro-color-surface)" : "1px solid transparent",
                marginBottom: "-1px",
                transition: "var(--kuro-transition-normal)",
                userSelect: "none",
                width: 150,
                minWidth: 150,
                maxWidth: 150,
                flexShrink: 0,
                boxSizing: "border-box",
                overflow: "hidden",
                "&:hover": {
                  bgcolor: isActive ? "var(--kuro-color-surface)" : "var(--kuro-color-hover)",
                },
              }}
            >
              <AppIcon
                name="terminal"
                size={14}
                style={{
                  color: isActive
                    ? "var(--kuro-color-accent)"
                    : "var(--kuro-color-text-secondary)",
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  fontFamily: "var(--kuro-font-family-mono, monospace)",
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? "var(--kuro-color-text-primary)"
                    : "var(--kuro-color-text-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {tab.label}
              </Typography>
              <Box
                component="span"
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(tab.id)
                }}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.button,
                  p: "2px",
                  ml: "auto",
                  flexShrink: 0,
                  color: "var(--kuro-color-text-muted)",
                  transition: "var(--kuro-transition-fast)",
                  "&:hover": {
                    color: "var(--kuro-color-text-primary)",
                    bgcolor: "var(--kuro-color-hover)",
                  },
                }}
              >
                <AppIcon name="x" size={12} />
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* New Tab Button */}
      <IconButton
        icon="plus"
        iconSize={14}
        label="New tab"
        onClick={onNewTab}
        sx={{ flexShrink: 0, mb: 0.5 }}
      />
      {/* Reconnect Button */}
      <IconButton
        icon="refresh-cw"
        iconSize={14}
        label="Reconnect"
        onClick={onReconnect}
        disabled={reconnectDisabled}
        sx={{ flexShrink: 0, mb: 0.5 }}
      />
      {/* Connection Status Dot */}
      {status && (
        <Box
          title={status === "connected" ? "Connected" : status === "connecting" ? "Connecting..." : "Disconnected"}
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor:
              status === "connected"
                ? "var(--kuro-color-success, #10b981)"
                : status === "connecting"
                ? "var(--kuro-color-warning, #f59e0b)"
                : "var(--kuro-color-danger, #ef4444)",
            boxShadow:
              status === "connected"
                ? "0 0 6px var(--kuro-color-success, #10b981)"
                : status === "connecting"
                ? "0 0 6px var(--kuro-color-warning, #f59e0b)"
                : "none",
            flexShrink: 0,
            mb: 0.5,
            mr: 0.5,
            transition: "all 0.2s ease",
          }}
        />
      )}
    </Box>
  )
}

