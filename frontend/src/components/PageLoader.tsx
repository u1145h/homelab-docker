import { Box, CircularProgress } from "@mui/material"

export default function PageLoader() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 300,
      }}
    >
      <CircularProgress />
    </Box>
  )
}
