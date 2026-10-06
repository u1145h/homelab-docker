import { Box, Card, CardContent, Typography } from "@mui/material"
import type { ReactNode } from "react"
import type { StatusColor } from "../types"

interface StatusCardProps {
  icon: ReactNode
  label: string
  value: string
  secondary?: string
  color: StatusColor
  progress?: number
  onClick?: () => void
}

const colorMap: Record<StatusColor, string> = {
  success: "success.main",
  warning: "warning.main",
  error: "error.main",
  default: "grey.500",
}

export default function StatusCard({
  icon,
  label,
  value,
  secondary,
  color,
  progress,
  onClick,
}: StatusCardProps) {
  return (
    <Card
      onClick={onClick}
      sx={{
        height: "100%",
        cursor: onClick ? "pointer" : undefined,
        borderTop: 3,
        borderColor: colorMap[color],
        "&:hover": onClick
          ? { boxShadow: (theme) => theme.shadows[4] }
          : undefined,
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
              <Box sx={{ color: colorMap[color], display: "flex", fontSize: 20 }}>{icon}</Box>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {value}
            </Typography>

            {secondary && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {secondary}
              </Typography>
            )}

            {progress !== undefined && (
              <Box
                sx={{
                  mt: 1.5,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "grey.200",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    width: `${Math.min(Math.max(progress, 0), 100)}%`,
                    height: "100%",
                    bgcolor: colorMap[color],
                    borderRadius: 3,
                    transition: "width 0.5s ease",
                  }}
                />
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
