import { Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material"
import EditNoteIcon from "@mui/icons-material/EditNote"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove"
import DownloadIcon from "@mui/icons-material/Download"
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash"
import DeleteForeverIcon from "@mui/icons-material/DeleteForever"
import type { FileItem } from "../types"
import { radius } from "@/design/radius"

interface ContextMenuProps {
  contextPosition: { mouseX: number; mouseY: number } | null
  anchorEl?: HTMLElement | null
  item: FileItem | null
  onClose: () => void
  isTrash?: boolean
  onRestore?: () => void
  onEdit?: () => void
  onRename: () => void
  onDelete: () => void
  onCopy: () => void
  onMove: () => void
  onDownload: () => void
}

export default function ContextMenu({
  contextPosition,
  anchorEl,
  item,
  onClose,
  isTrash,
  onRestore,
  onEdit,
  onRename,
  onDelete,
  onCopy,
  onMove,
  onDownload,
}: ContextMenuProps) {
  if (!item) return null

  const isFile = item.type !== "directory"
  const isOpen = contextPosition !== null || Boolean(anchorEl)

  const menuSlotProps = {
    backdrop: {
      invisible: true,
      sx: { backgroundColor: "transparent" },
    },
    paper: {
      sx: {
        borderRadius: radius.card,
        bgcolor: "var(--kuro-color-surface)",
        border: "1px solid var(--kuro-color-border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minWidth: 160,
      },
    },
  }

  if (isTrash) {
    return (
      <Menu
        open={isOpen}
        onClose={onClose}
        anchorReference={contextPosition ? "anchorPosition" : "anchorEl"}
        anchorPosition={contextPosition ? { top: contextPosition.mouseY, left: contextPosition.mouseX } : undefined}
        anchorEl={anchorEl}
        slotProps={menuSlotProps}
      >
        {onRestore && (
          <MenuItem onClick={() => { onRestore(); onClose() }}>
            <ListItemIcon><RestoreFromTrashIcon fontSize="small" color="primary" /></ListItemIcon>
            <ListItemText sx={{ fontWeight: 600, color: "var(--kuro-color-accent)" }}>Restore Item</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { onDelete(); onClose() }}>
          <ListItemIcon><DeleteForeverIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: "error.main", fontWeight: 600 }}>Delete Permanently</ListItemText>
        </MenuItem>
      </Menu>
    )
  }

  return (
    <Menu
      open={isOpen}
      onClose={onClose}
      anchorReference={contextPosition ? "anchorPosition" : "anchorEl"}
      anchorPosition={contextPosition ? { top: contextPosition.mouseY, left: contextPosition.mouseX } : undefined}
      anchorEl={anchorEl}
      slotProps={menuSlotProps}
    >
      {isFile && onEdit && (
        <MenuItem onClick={() => { onEdit(); onClose() }}>
          <ListItemIcon><EditNoteIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText sx={{ fontWeight: 600 }}>View / Edit File</ListItemText>
        </MenuItem>
      )}
      <MenuItem onClick={() => { onRename(); onClose() }}>
        <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Rename</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => { onCopy(); onClose() }}>
        <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Copy</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => { onMove(); onClose() }}>
        <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Move</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => { onDelete(); onClose() }}>
        <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
        <ListItemText sx={{ color: "error.main" }}>Delete</ListItemText>
      </MenuItem>
      {isFile && (
        <MenuItem onClick={() => { onDownload(); onClose() }}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
      )}
    </Menu>
  )
}
