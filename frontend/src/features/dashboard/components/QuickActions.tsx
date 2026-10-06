import { useNavigate } from "react-router-dom"
import { Box, Card, CardContent, Typography } from "@mui/material"
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart"
import AdbIcon from "@mui/icons-material/Adb"
import FolderIcon from "@mui/icons-material/Folder"
import TerminalIcon from "@mui/icons-material/Terminal"
import type { QuickAction } from "../types"

const actions: QuickAction[] = [
  { label: "Monitoring", path: "/cpu", icon: <MonitorHeartIcon />, description: "View system metrics" },
  { label: "Docker", path: "/docker", icon: <AdbIcon />, description: "Manage containers" },
  { label: "Files", path: "/files", icon: <FolderIcon />, description: "Browse files" },
  { label: "Terminal", path: "/terminal", icon: <TerminalIcon />, description: "Shell access" },
]

export default function QuickActions() {
  const navigate = useNavigate()

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Quick Actions
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(4, 1fr)",
          },
          gap: 2,
        }}
      >
        {actions.map((action) => (
          <Card
            key={action.path}
            onClick={() => navigate(action.path)}
            sx={{
              cursor: "pointer",
              transition: "box-shadow 0.2s, transform 0.2s",
              "&:hover": {
                boxShadow: (theme) => theme.shadows[4],
                transform: "translateY(-2px)",
              },
            }}
          >
            <CardContent sx={{ textAlign: "center", py: 3 }}>
              <Box
                sx={{
                  fontSize: 36,
                  color: "primary.main",
                  mb: 1,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {action.icon}
              </Box>
              <Typography variant="subtitle2">{action.label}</Typography>
              <Typography variant="caption" color="text.secondary">
                {action.description}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
