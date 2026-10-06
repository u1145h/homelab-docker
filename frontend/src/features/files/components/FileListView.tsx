import Box from "@mui/material/Box"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Typography from "@mui/material/Typography"
import { AppIcon, type IconName } from "@/components/ui/icons"
import type { FileItem, SortField, SortDirection } from "../types"
import { radius } from "@/design/radius"

interface FileListViewProps {
  items: FileItem[]
  selected: FileItem | null
  sortField: SortField
  sortDirection: SortDirection
  onSelect: (item: FileItem) => void
  onOpen: (item: FileItem) => void
  onSort: (field: SortField) => void
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

function formatLinuxDate(isoStr: string): string {
  if (!isoStr) return "Jul 26 04:00"
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr
  const month = d.toLocaleString("en-US", { month: "short" })
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, "0")
  const mins = String(d.getMinutes()).padStart(2, "0")
  return `${month} ${day} ${hours}:${mins}`
}

export default function FileListView({
  items,
  selected,
  sortField,
  sortDirection,
  onSelect,
  onOpen,
  onSort,
}: FileListViewProps) {
  return (
    <TableContainer
      sx={{
        flex: 1,
        height: "100%",
        maxHeight: "100%",
        overflowY: "auto",
        overflowX: "auto",
        minHeight: 0,
        "&::-webkit-scrollbar": {
          width: "6px",
          height: "6px",
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "var(--kuro-color-border)",
          borderRadius: "3px",
        },
      }}
    >
      <Table stickyHeader size="small" sx={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
        <TableHead>
          <TableRow
            sx={{
              "& th": {
                borderBottom: "1px solid var(--kuro-color-border)",
                bgcolor: "var(--kuro-color-surface)",
                py: 1,
                position: "sticky",
                top: 0,
                zIndex: 2,
              },
            }}
          >
            <TableCell
              onClick={() => onSort("name")}
              sx={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--kuro-color-text-muted)",
                letterSpacing: 0.5,
                cursor: "pointer",
                pl: 1.5,
              }}
            >
              NAME {sortField === "name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </TableCell>
            <TableCell
              onClick={() => onSort("size")}
              align="right"
              sx={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--kuro-color-text-muted)",
                letterSpacing: 0.5,
                cursor: "pointer",
                width: 80,
              }}
            >
              SIZE {sortField === "size" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </TableCell>

            <TableCell
              onClick={() => onSort("modified")}
              align="right"
              sx={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--kuro-color-text-muted)",
                letterSpacing: 0.5,
                cursor: "pointer",
                pr: 1.5,
                width: 130,
              }}
            >
              MODIFIED {sortField === "modified" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {items.map((item) => {
            const isSelected = selected?.path === item.path
            return (
              <TableRow
                key={item.path}
                onClick={() => onSelect(item)}
                onDoubleClick={() => onOpen(item)}
                data-item-path={item.path}
                sx={{
                  cursor: "pointer",
                  bgcolor: isSelected ? "var(--kuro-color-hover)" : "transparent",
                  outline: isSelected ? "var(--kuro-color-hover)" : "transparent",
                  borderRadius: isSelected ? "0px" : radius.button,
                  transition: "var(--kuro-transition-fast)",
                  "&:hover": {
                    bgcolor: "var(--kuro-color-hover)",
                  },
                  "& td": {
                    borderBottom: "none",
                    py: 0.75,
                    fontFamily: "var(--kuro-font-family-mono, monospace)",
                    fontSize: 11,
                  },
                }}
              >
                {/* Name & Icon */}
                <TableCell sx={{ pl: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <AppIcon
                      name={getLucideIconName(item)}
                      size={16}
                      style={{
                        color: isSelected
                          ? "var(--kuro-color-accent)"
                          : item.type === "directory"
                          ? "var(--kuro-color-accent)"
                          : "var(--kuro-color-text-secondary)",
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "var(--kuro-font-family-mono, monospace)",
                        fontSize: 11,
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected
                          ? "var(--kuro-color-text-primary)"
                          : "var(--kuro-color-text-primary)",
                      }}
                    >
                      {item.name}
                    </Typography>
                  </Box>
                </TableCell>

                {/* Size */}
                <TableCell align="right" sx={{ color: "var(--kuro-color-text-secondary)" }}>
                  {formatLinuxSize(item)}
                </TableCell>



                {/* Modified */}
                <TableCell align="right" sx={{ pr: 1.5, color: "var(--kuro-color-text-secondary)" }}>
                  {formatLinuxDate(item.modified)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
