import { Box, Typography } from "@mui/material"
import type { ReactNode } from "react"

interface MonitorEmptyStateProps {
  icon: ReactNode
  message: string
  secondary?: string
}

export default function MonitorEmptyState({
  icon,
  message,
  secondary,
}: MonitorEmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 6,
        gap: 1,
      }}
    >
      <Box sx={{ fontSize: 48, color: "text.disabled", lineHeight: 1 }}>{icon}</Box>
      <Typography variant="body1" color="text.secondary">{message}</Typography>
      {secondary && <Typography variant="body2" color="text.disabled">{secondary}</Typography>}
    </Box>
  )
}
