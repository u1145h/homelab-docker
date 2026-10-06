import { Box, Card, CardContent, Grid, Skeleton, Stack } from "@mui/material"

function MetricCardSkeleton() {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Skeleton variant="text" width={60} height={16} />
        <Skeleton variant="text" width={40} height={32} sx={{ mt: 0.5 }} />
      </CardContent>
    </Card>
  )
}

function ContainerCardSkeleton() {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={160} height={22} />
            <Skeleton variant="text" width={120} height={16} sx={{ mt: 0.5 }} />
            <Skeleton variant="text" width={200} height={14} sx={{ mt: 0.25 }} />
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Skeleton variant="rounded" width={64} height={30} />
            <Skeleton variant="rounded" width={64} height={30} />
            <Skeleton variant="rounded" width={74} height={30} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function DockerSkeleton() {
  return (
    <Box>
      <Skeleton variant="text" width={120} height={36} sx={{ mb: 3 }} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} size={{ xs: 6, md: 3 }}>
            <MetricCardSkeleton />
          </Grid>
        ))}
      </Grid>

      <Skeleton variant="rounded" width="100%" height={40} sx={{ mb: 2 }} />

      <Stack spacing={1.5}>
        {Array.from({ length: 5 }).map((_, i) => (
          <ContainerCardSkeleton key={i} />
        ))}
      </Stack>
    </Box>
  )
}

