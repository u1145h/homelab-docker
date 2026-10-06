import { Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material"

export default function UserSkeleton() {
  const rows = Array.from({ length: 5 })
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><Skeleton width={100} /></TableCell>
            <TableCell><Skeleton width={60} /></TableCell>
            <TableCell><Skeleton width={120} /></TableCell>
            <TableCell><Skeleton width={120} /></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton width={`${[80, 60, 100, 70, 90][i]}%`} /></TableCell>
              <TableCell><Skeleton width={60} /></TableCell>
              <TableCell><Skeleton width={120} /></TableCell>
              <TableCell><Skeleton width={120} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
