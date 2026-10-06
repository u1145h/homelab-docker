import { useState, useEffect } from "react"
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  CircularProgress,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import * as filesApi from "../api/files"
import { formatFileSize, formatDate, getFileIcon, getFileTypeLabel } from "../utils/files"
import type { FileItem, StatInfo } from "../types"

interface DetailsDrawerProps {
  item: FileItem | null
  onClose: () => void
}

export default function DetailsDrawer({ item, onClose }: DetailsDrawerProps) {
  const [stat, setStat] = useState<StatInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!item) {
        setStat(null)
        return
      }
      setLoading(true)
      filesApi.getStat(item.path).then(setStat).catch(() => setStat(null)).finally(() => setLoading(false))
    }, 0)
    return () => clearTimeout(timer)
  }, [item])

  return (
    <Drawer anchor="right" open={!!item} onClose={onClose}>
      <Box sx={{ width: 320, p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6">Details</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
        {item && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Typography variant="h5">{getFileIcon(item)}</Typography>
              <Box>
                <Typography variant="subtitle1">{item.name}</Typography>
                <Typography variant="body2" color="text.secondary">{getFileTypeLabel(item)}</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary", pr: 2 }}>Type</TableCell>
                    <TableCell>{item.type}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary", pr: 2 }}>Size</TableCell>
                    <TableCell>{item.type === "directory" ? "—" : formatFileSize(item.size)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary", pr: 2 }}>Path</TableCell>
                    <TableCell sx={{ wordBreak: "break-all" }}>{item.path}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary", pr: 2 }}>Modified</TableCell>
                    <TableCell>{formatDate(item.modified)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary", pr: 2 }}>Permissions</TableCell>
                    <TableCell>{item.mode}</TableCell>
                  </TableRow>
                  {stat && (
                    <>
                      {stat.mime && (
                        <TableRow>
                          <TableCell sx={{ color: "text.secondary", pr: 2 }}>MIME</TableCell>
                          <TableCell sx={{ wordBreak: "break-all" }}>{stat.mime}</TableCell>
                        </TableRow>
                      )}
                      {stat.permissions && (
                        <TableRow>
                          <TableCell sx={{ color: "text.secondary", pr: 2 }}>Permission Bits</TableCell>
                          <TableCell>{stat.permissions}</TableCell>
                        </TableRow>
                      )}
                      {stat.isSymlink && stat.symlinkTarget && (
                        <TableRow>
                          <TableCell sx={{ color: "text.secondary", pr: 2 }}>Symlink Target</TableCell>
                          <TableCell sx={{ wordBreak: "break-all" }}>{stat.symlinkTarget}</TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </Box>
    </Drawer>
  )
}
