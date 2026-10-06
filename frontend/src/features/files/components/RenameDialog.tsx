import { useState, useEffect } from "react"
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from "@mui/material"
import { radius } from "@/design/radius"

interface RenameDialogProps {
  open: boolean
  currentName: string
  onClose: () => void
  onRename: (name: string) => void
}

export default function RenameDialog({ open, currentName, onClose, onRename }: RenameDialogProps) {
  const [name, setName] = useState(currentName)

  useEffect(() => {
    if (open) {
      setName(currentName)
    }
  }, [open, currentName])

  const handleRename = () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentName) return
    onRename(trimmed)
  }

  const handleClose = () => {
    setName(currentName)
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
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700 }}>Rename</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="New Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => { if (e.key === "Enter") handleRename() }}
          slotProps={{
            input: { sx: { borderRadius: radius.input, fontSize: 11 } },
            inputLabel: { sx: { fontSize: 11 } },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} sx={{ borderRadius: radius.button, fontSize: 11 }}>Cancel</Button>
        <Button variant="contained" onClick={handleRename} disabled={!name.trim() || name.trim() === currentName} sx={{ borderRadius: radius.button, fontSize: 11 }}>
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  )
}
