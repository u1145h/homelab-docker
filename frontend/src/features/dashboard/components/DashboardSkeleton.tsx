import { Box, Card, CardContent, Grid, Skeleton } from "@mui/material"

function StatCardSkeleton() {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={80} height={20} />
            <Skeleton variant="text" width={60} height={36} sx={{ mt: 0.5 }} />
            <Skeleton variant="text" width={120} height={16} sx={{ mt: 0.5 }} />
            <Skeleton variant="rounded" width="100%" height={6} sx={{ mt: 1.5, borderRadius: 3 }} />
          </Box>
          <Skeleton variant="circular" width={36} height={36} />
        </Box>
      </CardContent>
    </Card>
  )
}

function QuickActionSkeleton() {
  return (
    <Card>
      <CardContent sx={{ textAlign: "center", py: 3 }}>
        <Skeleton variant="circular" width={36} height={36} sx={{ mx: "auto", mb: 1 }} />
        <Skeleton variant="text" width={60} height={20} sx={{ mx: "auto" }} />
        <Skeleton variant="text" width={80} height={16} sx={{ mx: "auto" }} />
      </CardContent>
    </Card>
  )
}

function SummaryRowSkeleton() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Skeleton variant="circular" width={24} height={24} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width={60} height={14} />
        <Skeleton variant="text" width={100} height={18} />
      </Box>
    </Box>
  )
}

export default function DashboardSkeleton() {
  return (
    <Box>
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Skeleton variant="text" width={160} height={36} />
          <Skeleton variant="text" width={120} height={16} sx={{ mt: 0.5 }} />
        </Box>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Skeleton variant="rounded" width={100} height={32} />
          <Skeleton variant="rounded" width={110} height={32} />
        </Box>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, md: 6, lg: 3 }}>
            <StatCardSkeleton />
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={140} height={28} sx={{ mb: 2 }} />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
            gap: 2,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <QuickActionSkeleton key={i} />
          ))}
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={140} height={28} sx={{ mb: 2 }} />
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                  <SummaryRowSkeleton />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
