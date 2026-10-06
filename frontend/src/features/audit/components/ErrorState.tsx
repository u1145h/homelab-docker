import { Box, Button, Alert } from "@mui/material"
import RefreshIcon from "@mui/icons-material/Refresh"

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Box>
      <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>
      <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry}>Retry</Button>
    </Box>
  )
}
