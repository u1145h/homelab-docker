import { Stack, Button } from "@mui/material"
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward"
import RefreshIcon from "@mui/icons-material/Refresh"
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import DownloadIcon from "@mui/icons-material/Download"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove"

interface FileToolbarProps {
  canGoUp: boolean
  hasSelection: boolean
  onUp: () => void
  onRefresh: () => void
  onNewFolder: () => void
  onRename: () => void
  onDelete: () => void
  onDownload: () => void
  onCopy?: () => void
  onMove?: () => void
}

export default function FileToolbar({
  canGoUp,
  hasSelection,
  onUp,
  onRefresh,
  onNewFolder,
  onRename,
  onDelete,
  onDownload,
  onCopy,
  onMove,
}: FileToolbarProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
      <Button variant="outlined" startIcon={<ArrowUpwardIcon />} disabled={!canGoUp} onClick={onUp}>
        Up
      </Button>
      <Button variant="contained" startIcon={<RefreshIcon />} onClick={onRefresh}>
        Refresh
      </Button>
      <Button variant="contained" color="success" startIcon={<CreateNewFolderIcon />} onClick={onNewFolder}>
        New Folder
      </Button>
      <Button variant="outlined" startIcon={<EditIcon />} disabled={!hasSelection} onClick={onRename}>
        Rename
      </Button>
      <Button variant="outlined" color="error" startIcon={<DeleteIcon />} disabled={!hasSelection} onClick={onDelete}>
        Delete
      </Button>
      <Button variant="outlined" startIcon={<ContentCopyIcon />} disabled={!hasSelection} onClick={onCopy}>
        Copy
      </Button>
      <Button variant="outlined" startIcon={<DriveFileMoveIcon />} disabled={!hasSelection} onClick={onMove}>
        Move
      </Button>
      <Button variant="outlined" startIcon={<DownloadIcon />} disabled={!hasSelection} onClick={onDownload}>
        Download
      </Button>
    </Stack>
  )
}
