import { useState, useCallback, useEffect } from "react"
import Box from "@mui/material/Box"
import Collapse from "@mui/material/Collapse"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import { AppIcon, type IconName } from "@/components/ui/icons"
import * as filesApi from "../api/files"
import type { FileItem } from "../types"
import { radius } from "@/design/radius"

interface PlaceItem {
  label: string
  path: string
  icon: IconName
}

const places: PlaceItem[] = [
  { label: "Root", path: "/", icon: "hard-drive" },
  { label: "Home", path: "/home", icon: "home" },
  { label: "Logs", path: "/var/log", icon: "file-text" },
  { label: "Recycle Bin", path: "/trash", icon: "trash-2" },
]

interface PlacesSidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
}

export default function PlacesSidebar({ currentPath, onNavigate }: PlacesSidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "/": true })
  const [treeData, setTreeData] = useState<Record<string, FileItem[]>>({})
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({})

  // Fetch directory children dynamically from the backend API
  const fetchChildren = useCallback(async (path: string) => {
    if (treeData[path] || loadingNodes[path]) return
    setLoadingNodes((prev) => ({ ...prev, [path]: true }))
    try {
      const res = await filesApi.listDirectory(path)
      const dirs = res.items.filter((item) => item.type === "directory")
      setTreeData((prev) => ({ ...prev, [path]: dirs }))
    } catch {
      setTreeData((prev) => ({ ...prev, [path]: [] }))
    } finally {
      setLoadingNodes((prev) => ({ ...prev, [path]: false }))
    }
  }, [treeData, loadingNodes])

  // Load root directory items on mount
  useEffect(() => {
    fetchChildren("/")
  }, [fetchChildren])

  const handleToggle = (path: string) => {
    const nextState = !expanded[path]
    setExpanded((prev) => ({ ...prev, [path]: nextState }))
    if (nextState && !treeData[path]) {
      fetchChildren(path)
    }
  }

  const renderNode = (name: string, path: string, depth = 0) => {
    const isExpanded = !!expanded[path]
    const isActive = currentPath === path
    const children = treeData[path]
    const isLoading = !!loadingNodes[path]

    return (
      <Box key={path}>
        <Box
          onClick={() => onNavigate(path)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.4,
            pl: 0.5 + depth * 1.5,
            borderRadius: radius.button,
            cursor: "pointer",
            bgcolor: isActive ? "rgba(169,182,101,0.12)" : "transparent",
            color: isActive
              ? "var(--kuro-color-text-primary)"
              : "var(--kuro-color-text-secondary)",
            border: isActive
              ? "1px solid rgba(169,182,101,0.25)"
              : "1px solid transparent",
            transition: "var(--kuro-transition-fast)",
            userSelect: "none",
            "&:hover": {
              bgcolor: "var(--kuro-color-hover)",
              color: "var(--kuro-color-text-primary)",
            },
          }}
        >
          {/* Expand Toggle */}
          <Box
            component="span"
            onClick={(e) => {
              e.stopPropagation()
              handleToggle(path)
            }}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              width: 14,
              flexShrink: 0,
              color: "var(--kuro-color-text-muted)",
              "&:hover": { color: "var(--kuro-color-text-primary)" },
              cursor: "pointer",
            }}
          >
            {isLoading ? (
              <CircularProgress size={10} color="inherit" />
            ) : (
              <AppIcon name={isExpanded ? "chevron-down" : "chevron-right"} size={12} />
            )}
          </Box>

          <AppIcon
            name={path === "/" ? "hard-drive" : "folder"}
            size={13}
            style={{
              color: isActive
                ? "var(--kuro-color-accent)"
                : "var(--kuro-color-text-muted)",
              flexShrink: 0,
            }}
          />

          <Typography
            variant="body2"
            sx={{
              fontSize: 11,
              fontFamily: "var(--kuro-font-family-mono, monospace)",
              fontWeight: isActive ? 600 : 400,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </Typography>
        </Box>

        {children && children.length > 0 && (
          <Collapse in={isExpanded} timeout="auto">
            {children.map((child) => renderNode(child.name, child.path, depth + 1))}
          </Collapse>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "10px", width: { md: 240 }, flexShrink: 0 }}>
      {/* Places Card */}
      <Box
        sx={{
          bgcolor: "var(--kuro-color-surface)",
          border: "1px solid var(--kuro-color-border)",
          borderRadius: radius.card,
          p: 1.5,
        }}
      >
        <Typography
          variant="overline"
          sx={{
            display: "block",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: 0.8,
            color: "var(--kuro-color-text-muted)",
            px: 1,
            mb: 1,
          }}
        >
          Places
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          {places.map((item) => {
            const isActive =
              currentPath === item.path ||
              (item.path !== "/" && currentPath.startsWith(item.path + "/"))

            return (
              <Box
                key={item.path}
                onClick={() => onNavigate(item.path)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1,
                  py: 0.75,
                  borderRadius: radius.button,
                  cursor: "pointer",
                  bgcolor: isActive ? "rgba(169,182,101,0.12)" : "transparent",
                  border: isActive
                    ? "1px solid rgba(169,182,101,0.25)"
                    : "1px solid transparent",
                  transition: "var(--kuro-transition-fast)",
                  userSelect: "none",
                  "&:hover": { bgcolor: "var(--kuro-color-hover)" },
                }}
              >
                <AppIcon
                  name={item.icon}
                  size={15}
                  style={{
                    color: isActive
                      ? "var(--kuro-color-accent)"
                      : "var(--kuro-color-text-secondary)",
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive
                      ? "var(--kuro-color-text-primary)"
                      : "var(--kuro-color-text-secondary)",
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Filesystem Dynamic Tree Card */}
      <Box
        sx={{
          bgcolor: "var(--kuro-color-surface)",
          border: "1px solid var(--kuro-color-border)",
          borderRadius: radius.card,
          p: 1.5,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 1,
            mb: 1,
          }}
        >
          <Typography
            variant="overline"
            sx={{
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 0.8,
              color: "var(--kuro-color-text-muted)",
            }}
          >
            Filesystem
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: 11,
              fontFamily: "var(--kuro-font-family-mono, monospace)",
              color: "var(--kuro-color-text-muted)",
            }}
          >
            Linux Root
          </Typography>
        </Box>

        <Box>
          {renderNode("/", "/", 0)}
        </Box>
      </Box>
    </Box>
  )
}
