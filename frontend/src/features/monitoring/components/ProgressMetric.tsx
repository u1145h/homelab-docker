import { Box, Typography } from "@mui/material"

interface ProgressMetricProps {
  label: string
  value: string
  usage: number
  color?: "success" | "warning" | "error" | "primary"
}

const colorMap: Record<string, string> = {
  success: "success.main",
  warning: "warning.main",
  error: "error.main",
  primary: "primary.main",
}

export default function ProgressMetric({
  label,
  value,
  usage,
  color = "primary",
}: ProgressMetricProps) {
  const clamped = Math.min(Math.max(usage, 0), 100)

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
      </Box>

      <Box
        sx={{
          height: 10,
          borderRadius: 1,
          bgcolor: "grey.200",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${clamped}%`,
            height: "100%",
            bgcolor: colorMap[color],
            borderRadius: 1,
            transition: "width 0.5s ease, background-color 0.3s ease",
          }}
        />
      </Box>
    </Box>
  )
}
