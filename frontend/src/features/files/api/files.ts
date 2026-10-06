import client from "@/api/client"
import type { DirectoryListing, StatInfo, TrashItem } from "../types"

export async function listDirectory(path = "/"): Promise<DirectoryListing> {
  const { data } = await client.get<DirectoryListing>("/files", { params: { path } })
  return data
}

export async function createDirectory(path: string): Promise<void> {
  await client.post("/mkdir", { path })
}

export async function createFile(path: string, content = ""): Promise<void> {
  await client.put("/file", { path, content })
}

export async function deleteFile(path: string, permanent = false): Promise<void> {
  await client.delete("/file", { data: { path }, params: { permanent: permanent ? "true" : "false" } })
}

export async function listTrash(): Promise<TrashItem[]> {
  const { data } = await client.get<{ items: TrashItem[] }>("/trash")
  return data.items || []
}

export async function restoreTrashItem(id: string): Promise<void> {
  await client.post("/trash/restore", { id })
}

export async function deleteTrashItem(id: string): Promise<void> {
  await client.delete("/trash/item", { data: { id } })
}

export async function emptyTrash(): Promise<void> {
  await client.delete("/trash/empty")
}

export async function renameFile(source: string, target: string): Promise<void> {
  await client.post("/rename", { source, target })
}

export async function moveFile(source: string, target: string): Promise<void> {
  await client.post("/move", { source, target })
}

export async function copyFile(source: string, target: string): Promise<void> {
  await client.post("/copy", { source, target })
}

export async function downloadFile(path: string): Promise<void> {
  const response = await client.get<Blob>("/download", {
    params: { path },
    responseType: "blob",
  })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement("a")
  a.href = url
  a.download = path.split("/").pop() || "download"
  a.click()
  URL.revokeObjectURL(url)
}

export async function getStat(path: string): Promise<StatInfo> {
  const { data } = await client.get<StatInfo>("/stat", { params: { path } })
  return data
}

export async function readFileText(path: string): Promise<string> {
  const response = await client.get<string>("/file", {
    params: { path },
    responseType: "text",
    transformResponse: [(d) => d], // Return raw string without auto JSON decoding
  })
  return response.data
}

export async function saveFileText(path: string, content: string): Promise<void> {
  await client.put("/file", { path, content })
}

export async function getFileBlobUrl(path: string): Promise<string> {
  const response = await client.get<Blob>("/file", {
    params: { path },
    responseType: "blob",
  })
  return URL.createObjectURL(response.data)
}

export async function uploadSingleFile(
  targetFilePath: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  const formData = new FormData()
  formData.append("path", targetFilePath)
  formData.append("file", file)

  await client.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (evt) => {
      if (evt.total && evt.total > 0 && onProgress) {
        const pct = Math.round((evt.loaded / evt.total) * 100)
        onProgress(pct)
      }
    },
  })
}
