import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Typography from "@mui/material/Typography"
import TerminalIcon from "@mui/icons-material/Terminal"
import AddIcon from "@mui/icons-material/Add"
import type { TabData } from "../hooks/useTerminalTabs"

interface TerminalToolbarProps {
  tabs: TabData[]
  onNewTab: () => void
}

export default function TerminalToolbar({ tabs, onNewTab }: TerminalToolbarProps) {
  const connected = tabs.filter(t => t.status === "connected").length

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2,
        py: 0.75,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        minHeight: 40,
      }}
    >
      <TerminalIcon color="primary" sx={{ fontSize: 20 }} />
      <Typography variant="subtitle2" sx={{ flex: 1 }}>
        Terminal
      </Typography>

      <Typography variant="caption" color="text.secondary">
        {tabs.length} session{tabs.length !== 1 ? "s" : ""}
        {tabs.length > 0 && `, ${connected} connected`}
      </Typography>

      <Button
        size="small"
        variant="contained"
        startIcon={<AddIcon />}
        onClick={onNewTab}
      >
        New Tab
      </Button>
    </Box>
  )
}
