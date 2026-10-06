import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { AppIcon, type IconName } from "@/components/ui/icons"
import type { FileItem } from "../types"
import { radius } from "@/design/radius"

interface FileGridViewProps {
  items: FileItem[]
  selected: FileItem | null
  onSelect: (item: FileItem) => void
  onOpen: (item: FileItem) => void
}

function getLucideIconName(item: FileItem): IconName {
  if (item.type === "directory") return "folder"
  if (item.type === "symlink") return "external-link"
  const ext = item.name.split(".").pop()?.toLowerCase() ?? ""
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "file"
  if (["sh", "bash", "zsh", "bat", "cmd"].includes(ext)) return "terminal"
  if (["log", "txt", "md"].includes(ext)) return "file-text"
  if (["json", "yml", "yaml", "xml", "js", "ts", "jsx", "tsx", "py", "go"].includes(ext)) return "file-text"
  return "file"
}

function formatLinuxSize(item: FileItem): string {
  if (item.type === "directory") return "4.0K"
  if (item.size === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "K", "M", "G", "T"]
  const i = Math.floor(Math.log(item.size) / Math.log(k))
  const val = (item.size / Math.pow(k, i)).toFixed(1)
  return `${val}${sizes[i]}`
}

export default function FileGridView({ items, selected, onSelect, onOpen }: FileGridViewProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        gap: 1.5,
        p: 1.5,
      }}
    >
      {items.map((item) => {
        const isSelected = selected?.path === item.path
        const isDir = item.type === "directory"

        return (
          <Box
            key={item.path}
            data-item-path={item.path}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(item)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onOpen(item)
            }}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              p: 1.5,
              borderRadius: isSelected ? "0px" : radius.card,
              bgcolor: isSelected ? "var(--kuro-color-hover)" : "var(--kuro-color-surface)",
              border: "1px solid var(--kuro-color-border)",
              outline: isSelected ? "var(--kuro-color-hover)" : "none",
              cursor: "pointer",
              userSelect: "none",
              transition: "all 0.15s ease",
              "&:hover": {
                bgcolor: "var(--kuro-color-hover)",
                borderColor: "var(--kuro-color-accent)",
              },
            }}
          >
            <AppIcon
              name={getLucideIconName(item)}
              size={36}
              style={{
                color: isDir
                  ? "var(--kuro-color-accent)"
                  : "var(--kuro-color-text-secondary)",
                marginBottom: 8,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontSize: 11,
                fontFamily: "var(--kuro-font-family-mono, monospace)",
                fontWeight: isSelected ? 600 : 400,
                color: "var(--kuro-color-text-primary)",
                textAlign: "center",
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={item.name}
            >
              {item.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: 10,
                fontFamily: "var(--kuro-font-family-mono, monospace)",
                color: "var(--kuro-color-text-muted)",
                mt: 0.25,
              }}
            >
              {formatLinuxSize(item)}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
