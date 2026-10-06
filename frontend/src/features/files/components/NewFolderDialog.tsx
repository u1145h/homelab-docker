import { useState } from "react"
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from "@mui/material"
import { radius } from "@/design/radius"

interface NewFolderDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => void
}

export default function NewFolderDialog({ open, onClose, onCreate }: NewFolderDialogProps) {
  const [name, setName] = useState("")

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
    setName("")
  }

  const handleClose = () => {
    setName("")
    onClose()
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      fullWidth 
      maxWidth="xs"
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
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700 }}>New Folder</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Folder Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
          slotProps={{
            input: { sx: { borderRadius: radius.input, fontSize: 11 } },
            inputLabel: { sx: { fontSize: 11 } },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} sx={{ borderRadius: radius.button, fontSize: 11 }}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!name.trim()} sx={{ borderRadius: radius.button, fontSize: 11 }}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  )
}
