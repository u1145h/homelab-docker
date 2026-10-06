import Grid from "@mui/material/Grid"
import type { ReactNode } from "react"

interface MetricGridProps {
  children: ReactNode
  columns?: { xs?: number; sm?: number; md?: number; lg?: number }
  spacing?: number
}

export default function MetricGrid({
  children,
  columns = { xs: 12, sm: 6, md: 4, lg: 3 },
  spacing = 3,
}: MetricGridProps) {
  return (
    <Grid container spacing={spacing}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <Grid key={index} size={columns}>
              {child}
            </Grid>
          ))
        : <Grid size={columns}>{children}</Grid>}
    </Grid>
  )
}
