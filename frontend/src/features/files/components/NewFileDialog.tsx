import { useState } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Chip,
  Stack,
} from "@mui/material"
import { radius } from "@/design/radius"

interface NewFileDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (filename: string, content?: string) => void
  currentPath: string
}

const COMMON_EXTENSIONS = [
  "txt",
  "json",
  "js",
  "ts",
  "html",
  "css",
  "py",
  "sh",
  "yml",
  "md",
]

export default function NewFileDialog({
  open,
  onClose,
  onCreate,
  currentPath,
}: NewFileDialogProps) {
  const [filename, setFilename] = useState("")
  const [extension, setExtension] = useState("txt")
  const [content, setContent] = useState("")

  const getFullFilename = () => {
    const trimmedName = filename.trim()
    if (!trimmedName) return ""
    // If the user entered a dot in the filename (e.g. app.js or docker-compose.yml), use it directly
    if (trimmedName.includes(".")) {
      return trimmedName
    }
    const trimmedExt = extension.trim().replace(/^\./, "")
    return trimmedExt ? `${trimmedName}.${trimmedExt}` : trimmedName
  }

  const fullFilename = getFullFilename()
  const fullPathPreview = currentPath.endsWith("/")
    ? `${currentPath}${fullFilename}`
    : `${currentPath}/${fullFilename}`

  const handleCreate = () => {
    if (!fullFilename) return
    onCreate(fullFilename, content)
    setFilename("")
    setContent("")
    onClose()
  }

  const handleClose = () => {
    setFilename("")
    setContent("")
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: radius.modal,
            bgcolor: "var(--kuro-color-surface)",
            border: "1px solid var(--kuro-color-border)",
          },
        },
      }}
    >
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700, pb: 1 }}>
        Create New File
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField
              autoFocus
              fullWidth
              label="File Name"
              placeholder="e.g. index, config, script"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
              slotProps={{
                input: { sx: { borderRadius: radius.input, fontSize: 11 } },
                inputLabel: { sx: { fontSize: 11 } },
              }}
            />
            <TextField
              sx={{ width: 130 }}
              label="Extension"
              placeholder="e.g. js, txt"
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
              slotProps={{
                input: { sx: { borderRadius: radius.input, fontSize: 11 } },
                inputLabel: { sx: { fontSize: 11 } },
              }}
            />
          </Box>

          {/* Preset Extension Chips */}
          <Box>
            <Typography variant="caption" sx={{ fontSize: 10, color: "var(--kuro-color-text-muted)", mb: 0.5, display: "block" }}>
              Extension Presets:
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {COMMON_EXTENSIONS.map((ext) => (
                <Chip
                  key={ext}
                  label={`.${ext}`}
                  size="small"
                  onClick={() => setExtension(ext)}
                  color={extension.replace(/^\./, "") === ext ? "primary" : "default"}
                  variant={extension.replace(/^\./, "") === ext ? "filled" : "outlined"}
                  sx={{ fontSize: 10, height: 22, cursor: "pointer" }}
                />
              ))}
            </Box>
          </Box>

          {/* Target File Path Preview */}
          {fullFilename && (
            <Box
              sx={{
                p: 1.25,
                borderRadius: radius.card,
                bgcolor: "rgba(0,0,0,0.2)",
                border: "1px solid var(--kuro-color-border)",
              }}
            >
              <Typography variant="caption" sx={{ fontSize: 10, color: "var(--kuro-color-text-muted)", display: "block" }}>
                Target File Path:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: 11,
                  fontFamily: "var(--kuro-font-family-mono, monospace)",
                  color: "var(--kuro-color-success)",
                  wordBreak: "break-all",
                }}
              >
                {fullPathPreview}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={handleClose} sx={{ borderRadius: radius.button, fontSize: 11 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!fullFilename}
          sx={{ borderRadius: radius.button, fontSize: 11 }}
        >
          Create File
        </Button>
      </DialogActions>
    </Dialog>
  )
}
