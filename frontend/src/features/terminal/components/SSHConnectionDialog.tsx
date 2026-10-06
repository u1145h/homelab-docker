import { useState } from "react"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import TextField from "@mui/material/TextField"
import Radio from "@mui/material/Radio"
import RadioGroup from "@mui/material/RadioGroup"
import FormControlLabel from "@mui/material/FormControlLabel"
import FormControl from "@mui/material/FormControl"
import FormLabel from "@mui/material/FormLabel"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { Button } from "@/components/ui/actions"
import { AppIcon } from "@/components/ui/icons"
import { radius } from "@/design/radius"
import type { SSHConfig } from "../types"

interface SSHConnectionDialogProps {
  open: boolean
  onClose: () => void
  onConnect: (config: SSHConfig | null) => void
}

type ConnectionMode = "local" | "ssh"

export default function SSHConnectionDialog({ open, onClose, onConnect }: SSHConnectionDialogProps) {
  const [mode, setMode] = useState<ConnectionMode>("ssh")
  const [host, setHost] = useState("")
  const [port, setPort] = useState("22")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [key, setKey] = useState("")

  const handleConnect = () => {
    if (mode === "local") {
      onConnect(null)
    } else {
      onConnect({
        host: host.trim(),
        port: parseInt(port, 10) || 22,
        username: username.trim(),
        password: password || undefined,
        key: key || undefined,
      })
    }
    reset()
  }

  const handleCancel = () => {
    reset()
    onClose()
  }

  const reset = () => {
    setMode("ssh")
    setHost("")
    setPort("22")
    setUsername("")
    setPassword("")
    setKey("")
  }

  const sshValid = host.trim() !== "" && username.trim() !== ""

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "var(--kuro-color-surface)",
            border: "1px solid var(--kuro-color-border)",
            borderRadius: radius.modal,
            backgroundImage: "none",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          color: "var(--kuro-color-text-primary)",
          fontSize: 18,
          fontWeight: 700,
          pb: 1,
        }}
      >
        <AppIcon name="terminal" size={20} style={{ color: "var(--kuro-color-accent)" }} />
        New Terminal Connection
      </DialogTitle>
      <DialogContent sx={{ pt: 1, fontSize: 11 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
          <FormControl>
            <FormLabel sx={{ color: "var(--kuro-color-text-secondary)", fontSize: 11, mb: 0.5 }}>
              Connection Type
            </FormLabel>
            <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as ConnectionMode)}>
              <FormControlLabel
                value="local"
                control={<Radio size="small" sx={{ color: "var(--kuro-color-border)", "&.Mui-checked": { color: "var(--kuro-color-accent)" } }} />}
                label={<Typography sx={{ color: "var(--kuro-color-text-primary)", fontSize: 11 }}>Local shell</Typography>}
              />
              <FormControlLabel
                value="ssh"
                control={<Radio size="small" sx={{ color: "var(--kuro-color-border)", "&.Mui-checked": { color: "var(--kuro-color-accent)" } }} />}
                label={<Typography sx={{ color: "var(--kuro-color-text-primary)", fontSize: 11 }}>SSH connection</Typography>}
              />
            </RadioGroup>
          </FormControl>

          {mode === "local" ? (
            <Box sx={{ color: "var(--kuro-color-text-secondary)", fontSize: 11, p: 2, borderRadius: radius.card, bgcolor: "var(--kuro-color-background)", border: "1px solid var(--kuro-color-border)" }}>
              Opens a local shell session on the dashboard server.
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Host"
                placeholder="192.168.1.100 or 100.x.y.z"
                size="small"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                fullWidth
                required
                slotProps={{
                  input: { sx: { borderRadius: radius.input, fontSize: 11 } },
                  inputLabel: { sx: { fontSize: 11 } },
                }}
              />
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  label="Port"
                  placeholder="22"
                  size="small"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  sx={{ width: 120 }}
                  slotProps={{
                    input: { sx: { borderRadius: radius.input, fontSize: 11 } },
                    inputLabel: { sx: { fontSize: 11 } },
                  }}
                />
                <TextField
                  label="Username"
                  placeholder="ullash"
                  size="small"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  fullWidth
                  required
                  slotProps={{
                    input: { sx: { borderRadius: radius.input, fontSize: 11 } },
                    inputLabel: { sx: { fontSize: 11 } },
                  }}
                />
              </Box>
              <TextField
                label="Password"
                type="password"
                size="small"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                slotProps={{
                  input: { sx: { borderRadius: radius.input, fontSize: 11 } },
                  inputLabel: { sx: { fontSize: 11 } },
                }}
              />
              <TextField
                label="Private Key (PEM)"
                multiline
                rows={3}
                size="small"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                fullWidth
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                slotProps={{
                  input: { sx: { borderRadius: radius.input, fontSize: 11 } },
                  inputLabel: { sx: { fontSize: 11 } },
                }}
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleConnect}
          disabled={mode === "ssh" && !sshValid}
        >
          {mode === "local" ? "Open Terminal" : "Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

