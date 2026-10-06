import { Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material"

export default function AuditSkeleton() {
  const rows = Array.from({ length: 8 })
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><Skeleton width={140} /></TableCell>
            <TableCell><Skeleton width={80} /></TableCell>
            <TableCell><Skeleton width={100} /></TableCell>
            <TableCell><Skeleton width={100} /></TableCell>
            <TableCell><Skeleton width={60} /></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton width={140} /></TableCell>
              <TableCell><Skeleton width={80} /></TableCell>
              <TableCell><Skeleton width={100} /></TableCell>
              <TableCell><Skeleton width={[120, 80, 100, 60, 140, 90, 70, 110][i]} /></TableCell>
              <TableCell><Skeleton width={60} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
