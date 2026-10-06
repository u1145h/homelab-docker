import { useState, useCallback } from "react"
import { useSnackbar } from "@/hooks/useSnackbar"
import * as filesApi from "../api/files"

export interface UseFileOperationsReturn {
  createFolder: (path: string, name: string) => Promise<boolean>
  createFile: (folderPath: string, name: string, content?: string) => Promise<boolean>
  renameItem: (source: string, newName: string) => Promise<boolean>
  deleteItem: (path: string, permanent?: boolean) => Promise<boolean>
  restoreTrash: (id: string) => Promise<boolean>
  deleteTrashItem: (id: string) => Promise<boolean>
  emptyTrash: () => Promise<boolean>
  copyItem: (source: string, target: string) => Promise<boolean>
  moveItem: (source: string, target: string) => Promise<boolean>
  downloadItem: (path: string) => Promise<boolean>
  busy: boolean
}

export function useFileOperations(onSuccess: () => void): UseFileOperationsReturn {
  const [busy, setBusy] = useState(false)
  const { showSnackbar } = useSnackbar()

  const createFolder = useCallback(async (folderPath: string, name: string): Promise<boolean> => {
    setBusy(true)
    try {
      await filesApi.createDirectory(`${folderPath}/${name}`)
      showSnackbar(`Folder "${name}" created.`, "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create folder."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const createFile = useCallback(async (folderPath: string, name: string, content = ""): Promise<boolean> => {
    setBusy(true)
    const fullPath = folderPath.endsWith("/") ? `${folderPath}${name}` : `${folderPath}/${name}`
    try {
      await filesApi.createFile(fullPath, content)
      showSnackbar(`File "${name}" created.`, "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create file."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const renameItem = useCallback(async (source: string, newName: string): Promise<boolean> => {
    setBusy(true)
    const parent = source.substring(0, source.lastIndexOf("/"))
    const target = `${parent}/${newName}`
    try {
      await filesApi.renameFile(source, target)
      showSnackbar(`Renamed to "${newName}".`, "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to rename."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const deleteItem = useCallback(async (path: string, permanent = false): Promise<boolean> => {
    setBusy(true)
    const name = path.split("/").pop() || path
    try {
      await filesApi.deleteFile(path, permanent)
      showSnackbar(permanent ? `"${name}" permanently deleted.` : `"${name}" moved to Recycle Bin.`, "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const restoreTrash = useCallback(async (id: string): Promise<boolean> => {
    setBusy(true)
    try {
      await filesApi.restoreTrashItem(id)
      showSnackbar("Item restored from Recycle Bin.", "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to restore item."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const deleteTrashItem = useCallback(async (id: string): Promise<boolean> => {
    setBusy(true)
    try {
      await filesApi.deleteTrashItem(id)
      showSnackbar("Item permanently deleted.", "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete item."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const emptyTrash = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    try {
      await filesApi.emptyTrash()
      showSnackbar("Recycle Bin emptied.", "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to empty Recycle Bin."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const copyItem = useCallback(async (source: string, target: string): Promise<boolean> => {
    setBusy(true)
    try {
      await filesApi.copyFile(source, target)
      showSnackbar("Copied successfully.", "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to copy."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const moveItem = useCallback(async (source: string, target: string): Promise<boolean> => {
    setBusy(true)
    try {
      await filesApi.moveFile(source, target)
      showSnackbar("Moved successfully.", "success")
      onSuccess()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to move."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [onSuccess, showSnackbar])

  const downloadItem = useCallback(async (path: string): Promise<boolean> => {
    setBusy(true)
    try {
      await filesApi.downloadFile(path)
      showSnackbar("Download started.", "success")
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to download."
      showSnackbar(msg, "error")
      return false
    } finally {
      setBusy(false)
    }
  }, [showSnackbar])

  return {
    createFolder,
    createFile,
    renameItem,
    deleteItem,
    restoreTrash,
    deleteTrashItem,
    emptyTrash,
    copyItem,
    moveItem,
    downloadItem,
    busy,
  }
}
