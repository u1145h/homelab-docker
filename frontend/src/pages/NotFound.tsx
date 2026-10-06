import { useNavigate } from "react-router-dom"
import { Box, Button, Typography } from "@mui/material"
import ErrorIcon from "@mui/icons-material/Error"
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Page Not Found - HomeLab')
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 2,
        textAlign: "center",
      }}
    >
      <ErrorIcon sx={{ fontSize: 80, color: "text.secondary" }} />
      <Typography variant="h3" sx={{ fontWeight: 700 }}>
        404
      </Typography>
      <Typography variant="body1" color="text.secondary">
        The page you are looking for does not exist.
      </Typography>
      <Button variant="contained" onClick={() => navigate("/")}>
        Return to Dashboard
      </Button>
    </Box>
  )
}
