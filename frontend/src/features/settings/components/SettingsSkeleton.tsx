import { Box, Skeleton, Card, CardContent } from "@mui/material"

export default function SettingsSkeleton() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {[1, 2, 3].map((section) => (
        <Card key={section} variant="outlined">
          <CardContent>
            <Skeleton width={140} height={28} sx={{ mb: 2 }} />
            {[1, 2, 3].map((row) => (
              <Box key={row} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Skeleton width={120} height={20} />
                <Skeleton width={200} height={36} />
              </Box>
            ))}
          </CardContent>
        </Card>
      ))}
    </Box>
  )
}
