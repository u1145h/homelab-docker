import { Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material"

export default function FileListSkeleton() {
  const rows = Array.from({ length: 8 })

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox"><Skeleton variant="rectangular" width={20} height={20} /></TableCell>
            <TableCell><Skeleton width={80} /></TableCell>
            <TableCell><Skeleton width={60} /></TableCell>
            <TableCell><Skeleton width={60} /></TableCell>
            <TableCell><Skeleton width={120} /></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((_, i) => (
            <TableRow key={i}>
              <TableCell padding="checkbox"><Skeleton variant="rectangular" width={20} height={20} /></TableCell>
              <TableCell><Skeleton width={`${[60, 45, 70, 55, 65, 50, 75, 60][i]}%`} /></TableCell>
              <TableCell><Skeleton width={50} /></TableCell>
              <TableCell><Skeleton width={50} /></TableCell>
              <TableCell><Skeleton width={100} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
