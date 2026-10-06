import { Box, Typography, Paper } from "@mui/material"
import SettingsIcon from "@mui/icons-material/Settings"
import { CATEGORIES } from "../utils/settings"

export default function EmptyState() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 3 }}>
      <SettingsIcon sx={{ fontSize: 64, color: "text.secondary" }} />
      <Typography variant="h5" gutterBottom>
        Settings API Not Available
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, textAlign: "center" }}>
        The server does not expose a settings API. All configuration is loaded
        from environment variables at startup. The following configuration
        categories are defined in the backend:
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 2, justifyContent: "center" }}>
        {CATEGORIES.map((cat) => (
          <Paper key={cat.id} variant="outlined" sx={{ p: 2, minWidth: 200 }}>
            <Typography variant="subtitle2" gutterBottom>
              {cat.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {cat.description}
            </Typography>
          </Paper>
        ))}
      </Box>
      <Typography variant="body2" color="text.disabled" sx={{ mt: 2, maxWidth: 500, textAlign: "center" }}>
        To make settings configurable at runtime, the backend would need a
        Settings API (GET/PUT /api/v1/settings) with a persistence layer.
      </Typography>
    </Box>
  )
}
