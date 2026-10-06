import { Box, Typography } from "@mui/material"

interface UsageBarProps {
  used: string
  free: string
  total: string
  percent: number
  color?: "success" | "warning" | "error"
  showLabels?: boolean
}

const colorMap: Record<string, string> = {
  success: "success.main",
  warning: "warning.main",
  error: "error.main",
}

export default function UsageBar({
  used,
  free,
  total,
  percent,
  color = "success",
  showLabels = true,
}: UsageBarProps) {
  const clamped = Math.min(Math.max(percent, 0), 100)

  return (
    <Box>
      {showLabels && (
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">{used} used</Typography>
          <Typography variant="body2" color="text.secondary">{free} free</Typography>
        </Box>
      )}

      <Box
        sx={{
          height: 16,
          borderRadius: 1,
          bgcolor: "grey.200",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Box
          sx={{
            width: `${clamped}%`,
            height: "100%",
            bgcolor: colorMap[color],
            borderRadius: 1,
            transition: "width 0.5s ease",
          }}
        />
      </Box>

      {showLabels && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: "block" }}>
          {total} total &middot; {percent.toFixed(0)}% used
        </Typography>
      )}
    </Box>
  )
}
