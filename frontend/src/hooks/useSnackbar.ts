import { useContext } from "react"
import { SnackbarContext } from "../providers/snackbarContext"

export function useSnackbar() {
  const ctx = useContext(SnackbarContext)
  if (!ctx) {
    throw new Error("useSnackbar must be used within SnackbarProvider")
  }
  return ctx
}
