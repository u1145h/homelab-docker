import { Box, Typography } from "@mui/material"
import HistoryOffIcon from "@mui/icons-material/HistoryToggleOff"
import SearchOffIcon from "@mui/icons-material/SearchOff"

interface EmptyStateProps {
  isSearch: boolean
}

export default function EmptyState({ isSearch }: EmptyStateProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 8, color: "text.secondary" }}>
      {isSearch ? <SearchOffIcon sx={{ fontSize: 64, mb: 2 }} /> : <HistoryOffIcon sx={{ fontSize: 64, mb: 2 }} />}
      <Typography variant="h6">
        {isSearch ? "No matching events" : "No audit events"}
      </Typography>
      <Typography variant="body2">
        {isSearch ? "Try a different search term." : "Audit events will appear here as actions are performed."}
      </Typography>
    </Box>
  )
}
