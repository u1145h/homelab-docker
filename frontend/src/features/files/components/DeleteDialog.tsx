import { useState } from "react"
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, FormControlLabel, Checkbox } from "@mui/material"
import { radius } from "@/design/radius"

interface DeleteDialogProps {
  open: boolean
  itemName: string
  isTrash?: boolean
  onClose: () => void
  onConfirm: (permanent: boolean) => void
  busy?: boolean
}

export default function DeleteDialog({ open, itemName, isTrash, onClose, onConfirm, busy }: DeleteDialogProps) {
  const [permanent, setPermanent] = useState(false)

  const handleConfirm = () => {
    onConfirm(isTrash ? true : permanent)
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
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
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700, color: "var(--kuro-color-text-primary)" }}>
        {isTrash ? "Permanently Delete" : "Delete Item"}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 11, color: "var(--kuro-color-text-secondary)", mb: 1 }}>
          {isTrash
            ? `Are you sure you want to permanently delete "${itemName}"? This item cannot be recovered.`
            : `Are you sure you want to delete "${itemName}"?`}
        </DialogContentText>

        {!isTrash && (
          <FormControlLabel
            control={
              <Checkbox
                checked={permanent}
                onChange={(e) => setPermanent(e.target.checked)}
                size="small"
                sx={{ color: "var(--kuro-color-text-muted)" }}
              />
            }
            label="Delete permanently (skip Recycle Bin)"
            slotProps={{
              typography: {
                sx: { fontSize: 11, color: permanent ? "#ef4444" : "var(--kuro-color-text-muted)" },
              },
            }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ borderRadius: radius.button, fontSize: 11 }}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={busy}
          sx={{ borderRadius: radius.button, fontSize: 11 }}
        >
          {busy ? "Deleting..." : isTrash || permanent ? "Delete Permanently" : "Move to Recycle Bin"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
