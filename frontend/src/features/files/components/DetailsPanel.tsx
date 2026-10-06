import { useState, useEffect } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import LinearProgress from "@mui/material/LinearProgress"
import CircularProgress from "@mui/material/CircularProgress"
import { AppIcon } from "@/components/ui/icons"
import { Button } from "@/components/ui/actions"
import { useStatus } from "@/hooks/useStatus"
import * as filesApi from "../api/files"
import type { FileItem, StatInfo } from "../types"
import { formatFileSize, formatDate, getFileTypeLabel } from "../utils/files"
import { radius } from "@/design/radius"

interface DetailsPanelProps {
  selected: FileItem | null
  isTrash?: boolean
  onRestore?: () => void
  onDownload: () => void
  onRename: () => void
  onDelete: () => void
  onCopy: () => void
  onMove: () => void
  onOpenEditor?: () => void
}

export default function DetailsPanel({
  selected,
  isTrash,
  onRestore,
  onDownload,
  onRename,
  onDelete,
  onCopy,
  onMove,
  onOpenEditor,
}: DetailsPanelProps) {
  const { data: statusData } = useStatus()
  const storage = statusData?.storage

  const [statInfo, setStatInfo] = useState<StatInfo | null>(null)
  const [statLoading, setStatLoading] = useState(false)

  // Fetch real file/directory stat info from backend when selected item changes
  useEffect(() => {
    if (!selected) {
      setStatInfo(null)
      return
    }

    let isMounted = true
    setStatLoading(true)
    filesApi
      .getStat(selected.path)
      .then((data) => {
        if (isMounted) setStatInfo(data)
      })
      .catch(() => {
        if (isMounted) setStatInfo(null)
      })
      .finally(() => {
        if (isMounted) setStatLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selected])

  const rootMount = storage?.mounts?.find((m) => m.mount === "/") || storage?.mounts?.[0]

  const deviceName = rootMount?.device || "/dev/root"
  const usedBytes = rootMount?.used ?? 0
  const totalBytes = rootMount?.total ?? 0
  const pct = rootMount?.usage_percent ?? 0

  const usedFormatted = formatFileSize(usedBytes)
  const totalFormatted = formatFileSize(totalBytes)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "10px", width: { md: 280 }, flexShrink: 0 }}>
      {/* Details Card */}
      <Box
        sx={{
          bgcolor: "var(--kuro-color-surface)",
          border: "1px solid var(--kuro-color-border)",
          borderRadius: radius.card,
          p: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: 18,
              color: "var(--kuro-color-text-primary)",
            }}
          >
            Details
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: 11,
              fontFamily: "var(--kuro-font-family-mono, monospace)",
              color: "var(--kuro-color-text-muted)",
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selected ? selected.name : "none"}
          </Typography>
        </Box>

        {!selected ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 120,
              color: "var(--kuro-color-text-muted)",
              fontSize: 11,
              fontStyle: "italic",
            }}
          >
            select an item
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Preview icon box */}
            <Box
              sx={{
                width: "100%",
                height: 90,
                borderRadius: radius.card,
                bgcolor: "var(--kuro-color-background)",
                border: "1px solid var(--kuro-color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {statLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <AppIcon
                  name={selected.type === "directory" ? "folder" : "file-text"}
                  size={36}
                  style={{
                    color:
                      selected.type === "directory"
                        ? "var(--kuro-color-accent)"
                        : "var(--kuro-color-text-secondary)",
                  }}
                />
              )}
            </Box>

            {/* Metadata rows */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[
                { label: "Type", value: statInfo?.mime ? statInfo.mime : getFileTypeLabel(selected) },
                {
                  label: "Size",
                  value: selected.type === "directory" ? "—" : formatFileSize(statInfo?.size ?? selected.size),
                  mono: true,
                },
                { label: "Modified", value: formatDate(statInfo?.modified ?? selected.modified) },
                { label: "Mode / Perms", value: statInfo?.mode || selected.mode || "—", mono: true },
                ...(statInfo?.isSymlink ? [{ label: "Symlink Target", value: statInfo.symlinkTarget, mono: true }] : []),
              ].map(({ label, value, mono }) => (
                <Box
                  key={label}
                  sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: "var(--kuro-color-text-muted)", fontSize: 11 }}
                  >
                    {label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "var(--kuro-color-text-primary)",
                      fontWeight: 500,
                      fontSize: 11,
                      fontFamily: mono
                        ? "var(--kuro-font-family-mono, monospace)"
                        : "inherit",
                      maxWidth: 150,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Action buttons */}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                pt: 1,
                borderTop: "1px solid var(--kuro-color-border)",
                justifyContent: "space-between",
              }}
            >
              {isTrash ? (
                <>
                  {onRestore && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={onRestore}
                      sx={{ width: "100%", mb: 0.5, borderRadius: radius.button, fontSize: 11, py: 0.75 }}
                    >
                      <AppIcon name="rotate-ccw" size={14} style={{ marginRight: 6 }} />
                      Restore Item
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={onDelete}
                    sx={{
                      width: "100%",
                      borderRadius: radius.button,
                      fontSize: 11,
                      py: 0.75,
                      color: "var(--kuro-color-danger)",
                      borderColor: "var(--kuro-color-danger)",
                      "&:hover": {
                        bgcolor: "rgba(204, 102, 102, 0.08)",
                        borderColor: "var(--kuro-color-danger)",
                      },
                    }}
                  >
                    <AppIcon name="trash-2" size={14} style={{ marginRight: 6 }} />
                    Delete Permanently
                  </Button>
                </>
              ) : (
                <>
                  {selected.type !== "directory" && onOpenEditor && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={onOpenEditor}
                      sx={{ width: "100%", mb: 0.5, borderRadius: radius.button, fontSize: 11, py: 0.75 }}
                    >
                      <AppIcon name="file-text" size={14} style={{ marginRight: 6 }} />
                      Open in Editor
                    </Button>
                  )}
                  {selected.type !== "directory" && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={onDownload}
                      sx={{ minWidth: 0, px: 1.5, borderRadius: radius.button }}
                    >
                      <AppIcon name="arrow-down" size={15} />
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={onRename}
                    sx={{ minWidth: 0, px: 1.5, borderRadius: radius.button }}
                  >
                    <AppIcon name="text-cursor" size={15} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={onCopy}
                    sx={{ minWidth: 0, px: 1.5, borderRadius: radius.button }}
                  >
                    <AppIcon name="copy" size={15} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={onMove}
                    sx={{ minWidth: 0, px: 1.5, borderRadius: radius.button }}
                  >
                    <AppIcon name="move" size={15} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={onDelete}
                    sx={{
                      minWidth: 0,
                      px: 1.5,
                      borderRadius: radius.button,
                      color: "var(--kuro-color-danger)",
                      borderColor: "var(--kuro-color-danger)",
                      "&:hover": {
                        bgcolor: "rgba(204, 102, 102, 0.08)",
                        borderColor: "var(--kuro-color-danger)",
                      },
                    }}
                  >
                    <AppIcon name="trash-2" size={15} />
                  </Button>
                </>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Real Disk Usage Card from Device Server Status */}
      <Box
        sx={{
          bgcolor: "var(--kuro-color-surface)",
          border: "1px solid var(--kuro-color-border)",
          borderRadius: radius.card,
          p: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: 18,
              color: "var(--kuro-color-text-primary)",
            }}
          >
            Disk usage
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: 11,
              fontFamily: "var(--kuro-font-family-mono, monospace)",
              color: "var(--kuro-color-text-muted)",
            }}
          >
            {deviceName}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: 18,
              color: "var(--kuro-color-text-primary)",
              lineHeight: 1,
            }}
          >
            {pct.toFixed(0)}%
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: 11,
              fontFamily: "var(--kuro-font-family-mono, monospace)",
              color: "var(--kuro-color-text-secondary)",
            }}
          >
            {usedFormatted} / {totalFormatted}
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={Math.min(pct, 100)}
          sx={{
            height: 6,
            borderRadius: radius.card,
            bgcolor: "var(--kuro-color-border)",
            "& .MuiLinearProgress-bar": {
              bgcolor: pct > 85 ? "#E78A4E" : "var(--kuro-color-accent, #A9B665)",
              borderRadius: radius.card,
            },
            mb: 2,
          }}
        />

        <Typography
          variant="caption"
          sx={{
            fontSize: 11,
            color: "var(--kuro-color-text-muted)",
            display: "block",
          }}
        >
          Live filesystem metrics connected to server backend daemon.
        </Typography>
      </Box>
    </Box>
  )
}
