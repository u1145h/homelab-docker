import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { radius } from "@/design/radius"
import type { ConnectionStatus as CS } from "../types"

interface ConnectionStatusProps {
  status: CS
}

const statusMap: Record<CS, { label: string; color: string }> = {
  disconnected: { label: "Disconnected", color: "var(--kuro-color-text-muted)" },
  connecting: { label: "Connecting...", color: "var(--kuro-color-warning)" },
  connected: { label: "Connected", color: "var(--kuro-color-success)" },
  closing: { label: "Closing...", color: "var(--kuro-color-warning)" },
  closed: { label: "Closed", color: "var(--kuro-color-text-muted)" },
  error: { label: "Error", color: "var(--kuro-color-danger)" },
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = statusMap[status] ?? statusMap.disconnected

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        px: 1.25,
        py: 0.5,
        borderRadius: radius.badge,
        bgcolor: "rgba(0, 0, 0, 0.4)",
        border: "1px solid var(--kuro-color-border)",
        backdropFilter: "blur(4px)",
        userSelect: "none",
      }}
    >
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          bgcolor: config.color,
          boxShadow: status === "connected" ? `0 0 6px ${config.color}` : "none",
          flexShrink: 0,
        }}
      />
      <Typography
        variant="caption"
        sx={{
          fontSize: 11,
          fontWeight: 500,
          color: config.color,
          lineHeight: 1,
        }}
      >
        {config.label}
      </Typography>
    </Box>
  )
}

