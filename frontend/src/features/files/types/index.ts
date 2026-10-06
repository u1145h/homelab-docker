export interface FileItem {
  name: string
  path: string
  type: "file" | "directory" | "symlink"
  size: number
  modified: string
  mode: string
}

export interface DirectoryListing {
  path: string
  parent: string
  items: FileItem[]
}

export interface TrashItem {
  id: string
  name: string
  originalPath: string
  trashedAt: string
  size: number
  type: "file" | "directory"
}

export interface StatInfo {
  name: string
  size: number
  mime: string
  mode: string
  permissions: string
  modified: string
  isDir: boolean
  isSymlink: boolean
  symlinkTarget: string
}

export type SortField = "name" | "size" | "type" | "modified"
export type SortDirection = "asc" | "desc"
export type ViewMode = "table" | "grid"
export type ConnectionStatus = "idle" | "connecting" | "connected" | "error"
