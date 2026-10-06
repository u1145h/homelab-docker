import { Box, Typography } from "@mui/material"
import GroupOffIcon from "@mui/icons-material/GroupOff"
import SearchOffIcon from "@mui/icons-material/SearchOff"

interface EmptyStateProps {
  isSearch: boolean
}

export default function EmptyState({ isSearch }: EmptyStateProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 8, color: "text.secondary" }}>
      {isSearch ? <SearchOffIcon sx={{ fontSize: 64, mb: 2 }} /> : <GroupOffIcon sx={{ fontSize: 64, mb: 2 }} />}
      <Typography variant="h6">
        {isSearch ? "No matching users" : "No users found"}
      </Typography>
      <Typography variant="body2">
        {isSearch ? "Try a different search term." : "Create a user to get started."}
      </Typography>
    </Box>
  )
}
