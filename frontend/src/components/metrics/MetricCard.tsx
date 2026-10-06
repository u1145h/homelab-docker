import { Box, Card, CardContent, Typography } from "@mui/material"
import type { ReactNode } from "react"

export interface MetricCardProps {
  label: string
  value: string
  secondary?: string
  icon?: ReactNode
  color?: "success" | "warning" | "error" | "info" | "default"
  children?: ReactNode
}

const colorMap: Record<string, string> = {
  success: "success.main",
  warning: "warning.main",
  error: "error.main",
  info: "info.main",
  default: "grey.500",
}

export default function MetricCard({
  label,
  value,
  secondary,
  icon,
  color = "default",
  children,
}: MetricCardProps) {
  return (
    <Card
      sx={{
        height: "100%",
        borderTop: icon ? 3 : 0,
        borderColor: icon ? colorMap[color] : undefined,
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {label}
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {value}
            </Typography>

            {secondary && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {secondary}
              </Typography>
            )}

            {children}
          </Box>

          {icon && (
            <Box
              sx={{
                fontSize: 36,
                color: colorMap[color],
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
