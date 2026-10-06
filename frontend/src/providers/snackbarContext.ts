import { createContext } from "react"
import type { AlertColor } from "@mui/material"

export interface SnackbarOptions {
  title?: string
  actionUrl?: string
  actionLabel?: string
  duration?: number
}

export interface SnackbarMessage {
  id: string
  message: string
  severity: AlertColor
  title?: string
  actionUrl?: string
  actionLabel?: string
  duration?: number
  timestamp?: string
}

export interface SnackbarContextType {
  showSnackbar: (message: string, severity?: AlertColor, options?: SnackbarOptions) => void
  closeSnackbar: (id?: string) => void
}

export const SnackbarContext = createContext<SnackbarContextType | null>(null)

