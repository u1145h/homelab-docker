import { useState, useCallback } from "react"
import { useSnackbar } from "@/hooks/useSnackbar"
import * as usersApi from "../api/users"
import type { CreateUserRequest, UpdateUserRequest } from "../types"

export interface UseUserMutationsReturn {
  createUser: (req: CreateUserRequest) => Promise<boolean>
  updateUser: (id: string, req: UpdateUserRequest) => Promise<boolean>
  deleteUser: (id: string) => Promise<boolean>
  resetPassword: (id: string, password: string) => Promise<boolean>
  busy: boolean
}

export function useUserMutations(onSuccess: () => void): UseUserMutationsReturn {
  const [busy, setBusy] = useState(false)
  const { showSnackbar } = useSnackbar()

  const createUser = useCallback(async (req: CreateUserRequest): Promise<boolean> => {
    setBusy(true)
    try {
      await usersApi.createUser(req)
      showSnackbar(`User "${req.username}" created.`, "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create user."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const updateUser = useCallback(async (id: string, req: UpdateUserRequest): Promise<boolean> => {
    setBusy(true)
    try {
      await usersApi.updateUser(id, req)
      showSnackbar("User updated.", "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update user."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const deleteUser = useCallback(async (id: string): Promise<boolean> => {
    setBusy(true)
    try {
      await usersApi.deleteUser(id)
      showSnackbar("User deleted.", "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete user."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const resetPassword = useCallback(async (id: string, password: string): Promise<boolean> => {
    setBusy(true)
    try {
      await usersApi.changePassword(id, password)
      showSnackbar("Password updated.", "success")
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reset password."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [showSnackbar])

  return { createUser, updateUser, deleteUser, resetPassword, busy }
}
