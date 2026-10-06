import type { FileItem, SortField, SortDirection } from "../types"
import { matchesExtraHidden } from "./filesDefaults"
import { formatDateTime } from "@/utils/format"

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDate(iso: string): string {
  return formatDateTime(iso)
}

export function getFileIcon(item: FileItem): string {
  switch (item.type) {
    case "directory":
      return "folder"
    case "symlink":
      return "link"
    default: {
      const ext = item.name.split(".").pop()?.toLowerCase() ?? ""
      const iconMap: Record<string, string> = {
        txt: "description",
        md: "description",
        json: "code",
        yml: "code",
        yaml: "code",
        xml: "code",
        js: "javascript",
        ts: "javascript",
        jsx: "javascript",
        tsx: "javascript",
        py: "code",
        go: "code",
        rs: "code",
        sh: "terminal",
        bat: "terminal",
        ps1: "terminal",
        html: "html",
        css: "css",
        scss: "css",
        png: "image",
        jpg: "image",
        jpeg: "image",
        gif: "image",
        svg: "image",
        webp: "image",
        ico: "image",
        pdf: "picture_as_pdf",
        zip: "folder_zip",
        gz: "folder_zip",
        tar: "folder_zip",
        rar: "folder_zip",
        "7z": "folder_zip",
        exe: "build",
        dll: "build",
        so: "build",
        dmg: "build",
        deb: "build",
        rpm: "build",
        log: "article",
        csv: "table_chart",
        xlsx: "table_chart",
        doc: "description",
        docx: "description",
        mp3: "music_note",
        wav: "music_note",
        mp4: "movie",
        mov: "movie",
        avi: "movie",
        mkv: "movie",
      }
      return iconMap[ext] ?? "insert_drive_file"
    }
  }
}

export function getFileTypeLabel(item: FileItem): string {
  if (item.type === "directory") return "Directory"
  if (item.type === "symlink") return "Symlink"
  const ext = item.name.split(".").pop()?.toLowerCase() ?? ""
  const typeMap: Record<string, string> = {
    txt: "Text File",
    md: "Markdown",
    json: "JSON",
    yml: "YAML",
    yaml: "YAML",
    xml: "XML",
    js: "JavaScript",
    ts: "TypeScript",
    jsx: "JSX",
    tsx: "TSX",
    py: "Python",
    go: "Go",
    rs: "Rust",
    sh: "Shell Script",
    bat: "Batch File",
    ps1: "PowerShell",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    png: "PNG Image",
    jpg: "JPEG Image",
    jpeg: "JPEG Image",
    gif: "GIF Image",
    svg: "SVG Image",
    webp: "WebP Image",
    ico: "Icon",
    pdf: "PDF",
    zip: "ZIP Archive",
    gz: "GZip Archive",
    tar: "TAR Archive",
    rar: "RAR Archive",
    "7z": "7-Zip Archive",
    exe: "Executable",
    dll: "DLL",
    so: "Shared Object",
    log: "Log File",
    csv: "CSV",
    xlsx: "Excel",
    doc: "Word Document",
    docx: "Word Document",
    mp3: "Audio",
    wav: "Audio",
    mp4: "Video",
    mov: "Video",
    avi: "Video",
    mkv: "Video",
  }
  return typeMap[ext] ?? "File"
}

const typeOrder: Record<string, number> = {
  directory: 0,
  symlink: 1,
  file: 2,
}

export function sortItems(
  items: FileItem[],
  field: SortField,
  direction: SortDirection,
  showHidden = false,
  extraHiddenPatterns: string[] = []
): FileItem[] {
  let filtered = items
  if (!showHidden) {
    filtered = items.filter(
      (item) =>
        !item.name.startsWith(".") &&
        !matchesExtraHidden(item.name, extraHiddenPatterns)
    )
  }

  return [...filtered].sort((a, b) => {
    // Folders always on top before files
    const aIsDir = a.type === "directory" ? 0 : 1
    const bIsDir = b.type === "directory" ? 0 : 1
    if (aIsDir !== bIsDir) {
      return aIsDir - bIsDir
    }

    let cmp = 0
    switch (field) {
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        break
      case "size":
        cmp = a.size - b.size
        break
      case "type": {
        const ta = typeOrder[a.type] ?? 2
        const tb = typeOrder[b.type] ?? 2
        cmp = ta - tb
        break
      }
      case "modified":
        cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime()
        break
    }
    return direction === "asc" ? cmp : -cmp
  })
}

export function filterItems(items: FileItem[], query: string): FileItem[] {
  if (!query.trim()) return items
  const lower = query.toLowerCase()
  return items.filter((item) => item.name.toLowerCase().includes(lower))
}

export function pathParts(path: string): string[] {
  if (path === "/") return ["/"]
  const parts = path.split("/").filter(Boolean)
  parts.unshift("/")
  return parts
}

export function parentPath(path: string): string {
  if (path === "/") return "/"
  const parts = path.replace(/\/$/, "").split("/")
  parts.pop()
  return parts.join("/") || "/"
}
