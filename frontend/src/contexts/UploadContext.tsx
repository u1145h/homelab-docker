import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import * as filesApi from "@/features/files/api/files"
import { useSnackbar } from "@/hooks/useSnackbar"

export interface UploadTask {
  id: string
  filename: string
  targetPath: string
  size: number
  loadedBytes: number
  totalBytes: number
  progress: number // 0 to 100
  status: "uploading" | "completed" | "error"
  errorMessage?: string
}

interface UploadContextValue {
  tasks: UploadTask[]
  isUploading: boolean
  overallProgress: number
  startUpload: (destinationPath: string, fileList: FileList | File[], onSuccess?: () => void) => Promise<void>
  clearCompleted: () => void
  cancelAll: () => void
}

const UploadContext = createContext<UploadContextValue | null>(null)

export function UploadProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const { showSnackbar } = useSnackbar()

  const startUpload = useCallback(
    async (destinationPath: string, fileList: FileList | File[], onSuccess?: () => void) => {
      const filesArr = Array.from(fileList)
      if (filesArr.length === 0) return

      const newTasks: UploadTask[] = filesArr.map((f, idx) => {
        const relPath = (f as any).webkitRelativePath || f.name
        const fullPath = destinationPath.endsWith("/")
          ? `${destinationPath}${relPath}`
          : `${destinationPath}/${relPath}`

        return {
          id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          filename: f.name,
          targetPath: fullPath,
          size: f.size,
          loadedBytes: 0,
          totalBytes: f.size,
          progress: 0,
          status: "uploading",
        }
      })

      setTasks((prev) => [...prev, ...newTasks])
      showSnackbar(`Started uploading ${filesArr.length} file(s)...`, "info")

      let completedCount = 0
      let errorCount = 0

      for (let i = 0; i < filesArr.length; i++) {
        const file = filesArr[i]
        const task = newTasks[i]

        try {
          await filesApi.uploadSingleFile(task.targetPath, file, (pct) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, progress: pct } : t))
            )
          })

          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, progress: 100, status: "completed" } : t
            )
          )
          completedCount++
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed"
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, status: "error", errorMessage: msg } : t
            )
          )
          errorCount++
        }
      }

      if (completedCount > 0) {
        showSnackbar(`Uploaded ${completedCount} file(s) successfully.`, "success")
        if (onSuccess) onSuccess()
      }
      if (errorCount > 0) {
        showSnackbar(`Failed to upload ${errorCount} file(s).`, "error")
      }
    },
    [showSnackbar]
  )

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === "uploading"))
  }, [])

  const cancelAll = useCallback(() => {
    setTasks([])
  }, [])

  const isUploading = tasks.some((t) => t.status === "uploading")
  const totalItems = tasks.length
  const overallProgress =
    totalItems > 0
      ? Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / totalItems)
      : 0

  return (
    <UploadContext.Provider
      value={{
        tasks,
        isUploading,
        overallProgress,
        startUpload,
        clearCompleted,
        cancelAll,
      }}
    >
      {children}
    </UploadContext.Provider>
  )
}

export function useUploads() {
  const ctx = useContext(UploadContext)
  if (!ctx) {
    throw new Error("useUploads must be used within an UploadProvider")
  }
  return ctx
}
