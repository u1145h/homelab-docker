import { Box, Typography, Button, Stack } from "@mui/material"
import FolderOffIcon from "@mui/icons-material/FolderOff"
import SearchOffIcon from "@mui/icons-material/SearchOff"
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep"
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder"
import NoteAddIcon from "@mui/icons-material/NoteAdd"
import { radius } from "@/design/radius"

interface EmptyStateProps {
  isSearch: boolean
  isTrash?: boolean
  onNewFolder?: () => void
  onNewFile?: () => void
}

export default function EmptyState({ isSearch, isTrash, onNewFolder, onNewFile }: EmptyStateProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 8, color: "text.secondary" }}>
      {isSearch ? (
        <SearchOffIcon sx={{ fontSize: 64, mb: 2 }} />
      ) : isTrash ? (
        <DeleteSweepIcon sx={{ fontSize: 64, mb: 2, color: "var(--kuro-color-text-muted)" }} />
      ) : (
        <FolderOffIcon sx={{ fontSize: 64, mb: 2 }} />
      )}
      <Typography variant="h6" sx={{ color: "var(--kuro-color-text-primary)", fontWeight: 600 }}>
        {isSearch ? "No matching files" : isTrash ? "Recycle Bin is empty" : "This folder is empty"}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "var(--kuro-color-text-muted)" }}>
        {isSearch
          ? "Try a different search term."
          : isTrash
          ? "Items moved to Recycle Bin will appear here."
          : "Create a new folder or file to get started."}
      </Typography>
      {!isSearch && !isTrash && (onNewFolder || onNewFile) && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
          {onNewFolder && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<CreateNewFolderIcon />}
              onClick={onNewFolder}
              sx={{ borderRadius: radius.button, fontSize: 11 }}
            >
              Create Folder
            </Button>
          )}
          {onNewFile && (
            <Button
              variant="contained"
              size="small"
              startIcon={<NoteAddIcon />}
              onClick={onNewFile}
              sx={{ borderRadius: radius.button, fontSize: 11 }}
            >
              Create File
            </Button>
          )}
        </Stack>
      )}
    </Box>
  )
}
