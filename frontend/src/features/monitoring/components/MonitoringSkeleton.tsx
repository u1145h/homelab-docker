import { Box, Card, CardContent, Grid, Skeleton, Tab, Tabs } from "@mui/material"

function MetricCardSkeleton() {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Skeleton variant="text" width={80} height={16} />
        <Skeleton variant="text" width={100} height={32} sx={{ mt: 0.5 }} />
        <Skeleton variant="text" width={140} height={16} sx={{ mt: 0.5 }} />
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Skeleton variant="text" width={60} height={14} />
            <Skeleton variant="text" width={40} height={14} />
          </Box>
          <Skeleton variant="rounded" width="100%" height={10} sx={{ borderRadius: 1 }} />
        </Box>
      </CardContent>
    </Card>
  )
}

function UsageBarSkeleton() {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Skeleton variant="text" width={120} height={20} />
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Skeleton variant="text" width={60} height={14} />
            <Skeleton variant="text" width={60} height={14} />
          </Box>
          <Skeleton variant="rounded" width="100%" height={16} sx={{ borderRadius: 1 }} />
          <Skeleton variant="text" width={100} height={12} sx={{ mt: 0.25 }} />
        </Box>
      </CardContent>
    </Card>
  )
}

export default function MonitoringSkeleton() {
  return (
    <Box>
      <Skeleton variant="text" width={160} height={36} sx={{ mb: 2 }} />

      <Tabs value={0} sx={{ mb: 3 }}>
        <Tab label={<Skeleton variant="text" width={60} height={20} />} />
        <Tab label={<Skeleton variant="text" width={30} height={20} />} />
        <Tab label={<Skeleton variant="text" width={50} height={20} />} />
        <Tab label={<Skeleton variant="text" width={50} height={20} />} />
        <Tab label={<Skeleton variant="text" width={50} height={20} />} />
      </Tabs>

      <Grid container spacing={3}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCardSkeleton />
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Grid container spacing={3}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, md: 6 }}>
              <UsageBarSkeleton />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  )
}
