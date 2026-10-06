import { useState, useCallback, useRef } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import InputAdornment from "@mui/material/InputAdornment"
import OutlinedInput from "@mui/material/OutlinedInput"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogContentText from "@mui/material/DialogContentText"
import DialogActions from "@mui/material/DialogActions"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { IconButton, Button } from "@/components/ui/actions"
import { AppIcon } from "@/components/ui/icons"
import { useFiles } from "../hooks/useFiles"
import { useFileOperations } from "../hooks/useFileOperations"
import { useUploads } from "@/contexts/UploadContext"
import PlacesSidebar from "../components/PlacesSidebar"
import FileListView from "../components/FileListView"
import FileGridView from "../components/FileGridView"
import FileListSkeleton from "../components/FileListSkeleton"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"
import DetailsPanel from "../components/DetailsPanel"
import ContextMenu from "../components/ContextMenu"
import type { ViewMode } from "../types"
import NewFolderDialog from "../components/NewFolderDialog"
import NewFileDialog from "../components/NewFileDialog"
import FileEditorModal from "../components/FileEditorModal"
import MediaViewerModal, { getMediaKind } from "../components/MediaViewerModal"
import RenameDialog from "../components/RenameDialog"
import DeleteDialog from "../components/DeleteDialog"
import type { FileItem, SortField } from "../types"
import { radius } from "@/design/radius"

export default function FilesPage() {
  useDocumentTitle("Files - HomeLab")

  const {
    items,
    currentPath,
    loading,
    error,
    search,
    setSearch,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    showHidden,
    setShowHidden,
    navigate,
    navigateUp,
    refresh,
    canGoUp,
    defaultViewMode,
  } = useFiles()

  const ops = useFileOperations(refresh)
  const { startUpload } = useUploads()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  const isTrash = currentPath === "/trash"

  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode)
  const [selected, setSelected] = useState<FileItem | null>(null)
  const [editorFile, setEditorFile] = useState<FileItem | null>(null)
  const [mediaFile, setMediaFile] = useState<FileItem | null>(null)
  const [createMenuAnchor, setCreateMenuAnchor] = useState<HTMLElement | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false)
  const [contextItem, setContextItem] = useState<FileItem | null>(null)
  const [contextPosition, setContextPosition] = useState<{ mouseX: number; mouseY: number } | null>(null)
  const [copyFrom, setCopyFrom] = useState<string | null>(null)
  const [moveFrom, setMoveFrom] = useState<string | null>(null)

  // Mobile drawer state
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false)
  const [mobileRightOpen, setMobileRightOpen] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      startUpload(currentPath, e.target.files, refresh)
      e.target.value = ""
    }
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      startUpload(currentPath, e.target.files, refresh)
      e.target.value = ""
    }
  }

  const handleViewFile = useCallback((item: FileItem) => {
    if (isTrash) return
    const kind = getMediaKind(item)
    if (kind === "image" || kind === "video" || kind === "audio") {
      setMediaFile(item)
    } else {
      setEditorFile(item)
    }
  }, [isTrash])

  const handleOpen = useCallback(
    (item: FileItem) => {
      if (isTrash) return
      if (item.type === "directory") {
        navigate(item.path)
        setSelected(null)
      } else {
        handleViewFile(item)
      }
    },
    [navigate, handleViewFile]
  )

  const handleSelect = useCallback((item: FileItem) => {
    setSelected((prev) => (prev?.path === item.path ? null : item))
  }, [])

  const handleDeselect = useCallback(() => {
    setSelected(null)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, item: FileItem) => {
    e.preventDefault()
    setSelected(item)
    setContextItem(item)
    setContextPosition({ mouseX: e.clientX, mouseY: e.clientY })
  }, [])

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
      } else {
        setSortField(field)
        setSortDirection("asc")
      }
    },
    [sortField, sortDirection, setSortField, setSortDirection]
  )

  const handleCreateFolder = useCallback(
    async (name: string) => {
      setNewFolderOpen(false)
      await ops.createFolder(currentPath, name)
    },
    [currentPath, ops]
  )

  const handleCreateFile = useCallback(
    async (name: string, content = "") => {
      setNewFileOpen(false)
      await ops.createFile(currentPath, name, content)
    },
    [currentPath, ops]
  )

  const handleRename = useCallback(
    async (name: string) => {
      setRenameOpen(false)
      const target = selected || contextItem
      if (target) await ops.renameItem(target.path, name)
      setSelected(null)
      setContextItem(null)
    },
    [selected, contextItem, ops]
  )

  const handleDelete = useCallback(async (permanent = false) => {
    setDeleteOpen(false)
    const target = selected || contextItem
    if (!target) return
    if (isTrash) {
      await ops.deleteTrashItem(target.path)
    } else {
      await ops.deleteItem(target.path, permanent)
    }
    setSelected(null)
  }, [selected, contextItem, isTrash, ops])

  const handleRestoreItem = useCallback(async (item?: FileItem | null) => {
    const target = item || selected || contextItem
    if (!target) return
    await ops.restoreTrash(target.path)
    setSelected(null)
  }, [selected, contextItem, ops])

  const handleEmptyTrashConfirm = useCallback(async () => {
    setEmptyTrashOpen(false)
    await ops.emptyTrash()
    setSelected(null)
  }, [ops])

  const handleCopy = useCallback(() => {
    if (selected) setCopyFrom(selected.path)
  }, [selected])

  const handleMove = useCallback(() => {
    if (selected) setMoveFrom(selected.path)
  }, [selected])

  const handleDownload = useCallback(async () => {
    if (selected) await ops.downloadItem(selected.path)
  }, [selected, ops])

  return (
    <Box
      className="files-page-root"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        position: "relative",  // anchor for absolute-positioned mobile panels
        overflow: "hidden",    // clip panels to this container
        p: { xs: 0, lg: "25px" },
        borderRadius: 0,
      }}
    >

      {/* ── MOBILE BACKDROP (only on xs) ─────────────────────────────── */}
      {(mobileLeftOpen || mobileRightOpen) && (
        <Box
          onClick={() => { setMobileLeftOpen(false); setMobileRightOpen(false) }}
          sx={{
            display: { xs: "block", lg: "none" },
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.45)",
            zIndex: 200,
          }}
        />
      )}

      {/* ── MOBILE LEFT PANEL: Places + Filesystem (slides in from left) ── */}
      <Box
        sx={{
          display: { xs: "flex", lg: "none" },
          flexDirection: "column",
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          bgcolor: "var(--kuro-color-background)",
          borderRight: "1px solid var(--kuro-color-border)",
          zIndex: 201,
          overflowY: "auto",
          p: 2,
          transform: mobileLeftOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}
      >
        <PlacesSidebar
          currentPath={currentPath}
          onNavigate={(path) => { navigate(path); setMobileLeftOpen(false) }}
        />
      </Box>

      {/* ── MOBILE RIGHT PANEL: Details + Disk Usage (slides in from right) ── */}
      <Box
        sx={{
          display: { xs: "flex", lg: "none" },
          flexDirection: "column",
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 300,
          bgcolor: "var(--kuro-color-background)",
          borderLeft: "1px solid var(--kuro-color-border)",
          zIndex: 201,
          overflowY: "auto",
          p: 2,
          transform: mobileRightOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
        }}
      >
        <DetailsPanel
          selected={selected}
          isTrash={isTrash}
          onRestore={() => handleRestoreItem(selected)}
          onDownload={handleDownload}
          onRename={() => { setRenameOpen(true); setMobileRightOpen(false) }}
          onDelete={() => { setDeleteOpen(true); setMobileRightOpen(false) }}
          onCopy={handleCopy}
          onMove={handleMove}
          onOpenEditor={() => selected && handleViewFile(selected)}
        />
      </Box>

      {/* ── MAIN LAYOUT ──────────────────────────────────────────────────── */}
      <Box
        className="files-main-layout"
        sx={{
          display: { xs: "flex", lg: "flex" },
          flexDirection: { xs: "column", lg: "row" },
          flex: 1,
          height: "100%",
          minHeight: 0,
          alignItems: { xs: "stretch", lg: "stretch" },
          gap: { xs: 0, lg: "15px" },
        }}
      >
        {/* LEFT: Places + Filesystem sidebar — hidden on mobile (in left drawer) */}
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <PlacesSidebar currentPath={currentPath} onNavigate={navigate} />
        </Box>

        {/* CENTER: File browser panel */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            bgcolor: "var(--kuro-color-surface)",
            border: { xs: "none", lg: "1px solid var(--kuro-color-border)" },
            borderRadius: { xs: 0, lg: radius.card },
            overflow: "hidden",
            gridColumn: { lg: "2" },
            gridRow: { lg: "1 / span 2" },
          }}
        >
          {/* ── DESKTOP toolbar (single row) — hidden on mobile ── */}
          <Box
            sx={{
              display: { xs: "none", lg: "flex" },
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 1.25,
              borderBottom: "1px solid var(--kuro-color-border)",
            }}
          >
            {/* Filter input */}
            <OutlinedInput
              size="small"
              placeholder="Filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startAdornment={
                <InputAdornment position="start">
                  <AppIcon name="search" size={13} style={{ color: "var(--kuro-color-text-muted)" }} />
                </InputAdornment>
              }
              endAdornment={
                search ? (
                  <InputAdornment position="end">
                    <AppIcon
                      name="x"
                      size={13}
                      style={{ cursor: "pointer", color: "var(--kuro-color-text-muted)" }}
                      onClick={() => setSearch("")}
                    />
                  </InputAdornment>
                ) : null
              }
              sx={{
                width: { sm: 120, md: 160 },
                fontSize: 11,
                borderRadius: radius.input,
                "& .MuiOutlinedInput-input": { py: 0.5, px: 1, fontSize: 11 },
                "& fieldset": { borderColor: "var(--kuro-color-border)" },
              }}
            />
            <Box sx={{ flex: 1 }} />
            {/* Desktop action buttons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton icon="arrow-up" iconSize={14} label="Up" onClick={navigateUp} disabled={!canGoUp || loading} />
              {isTrash ? (
                <Button variant="danger" size="small" onClick={() => setEmptyTrashOpen(true)} disabled={items.length === 0 || loading} sx={{ fontSize: 11, py: 0.5, px: 1.5, gap: 1, borderRadius: radius.button }}>
                  <AppIcon name="trash-2" size={14} />
                  Empty Trash
                </Button>
              ) : (
                <IconButton icon="plus" iconSize={14} label="New..." onClick={(e) => setCreateMenuAnchor(e.currentTarget as HTMLElement)} />
              )}
              <Menu anchorEl={createMenuAnchor} open={Boolean(createMenuAnchor)} onClose={() => setCreateMenuAnchor(null)} slotProps={{ paper: { sx: { borderRadius: radius.card, bgcolor: "var(--kuro-color-surface)", border: "1px solid var(--kuro-color-border)", mt: 0.5 } } }}>
                <MenuItem onClick={() => { setCreateMenuAnchor(null); setNewFolderOpen(true) }} sx={{ fontSize: 11, gap: 1.5, minWidth: 150 }}>
                  <AppIcon name="folder" size={14} style={{ color: "var(--kuro-color-accent)" }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 500 }}>Create Folder</Typography>
                </MenuItem>
                <MenuItem onClick={() => { setCreateMenuAnchor(null); setNewFileOpen(true) }} sx={{ fontSize: 11, gap: 1.5, minWidth: 150 }}>
                  <AppIcon name="file" size={14} style={{ color: "var(--kuro-color-success)" }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 500 }}>Create File</Typography>
                </MenuItem>
                <MenuItem onClick={() => { setCreateMenuAnchor(null); fileInputRef.current?.click() }} sx={{ fontSize: 11, gap: 1.5, minWidth: 150, borderTop: "1px solid var(--kuro-color-border)", mt: 0.5, pt: 1 }}>
                  <AppIcon name="upload" size={14} style={{ color: "#3b82f6" }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 500 }}>Upload File(s)</Typography>
                </MenuItem>
                <MenuItem onClick={() => { setCreateMenuAnchor(null); folderInputRef.current?.click() }} sx={{ fontSize: 11, gap: 1.5, minWidth: 150 }}>
                  <AppIcon name="arrow-up" size={14} style={{ color: "#a855f7" }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 500 }}>Upload Folder</Typography>
                </MenuItem>
              </Menu>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple style={{ display: "none" }} />
              <input type="file" ref={folderInputRef} onChange={handleFolderSelect} multiple {...({ webkitdirectory: "", directory: "" } as any)} style={{ display: "none" }} />
              <IconButton icon="refresh-cw" iconSize={14} label="Refresh" onClick={refresh} disabled={loading} />
              <IconButton icon={showHidden ? "eye" : "eye-off"} iconSize={14} label={showHidden ? "Hide hidden items" : "Show hidden items"} onClick={() => setShowHidden((prev) => !prev)} style={{ color: showHidden ? "var(--kuro-color-accent)" : undefined }} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, bgcolor: "var(--kuro-color-background)", p: 0.5, borderRadius: radius.button, border: "1px solid var(--kuro-color-border)" }}>
                <Box onClick={() => setViewMode("table")} title="List View" sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "4px", cursor: "pointer", bgcolor: viewMode === "table" ? "var(--kuro-color-hover)" : "transparent", color: viewMode === "table" ? "var(--kuro-color-accent)" : "var(--kuro-color-text-muted)", transition: "all 0.15s ease", "&:hover": { color: "var(--kuro-color-text-primary)" } }}>
                  <AppIcon name="list" size={13} />
                </Box>
                <Box onClick={() => setViewMode("grid")} title="Grid View" sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "4px", cursor: "pointer", bgcolor: viewMode === "grid" ? "var(--kuro-color-hover)" : "transparent", color: viewMode === "grid" ? "var(--kuro-color-accent)" : "var(--kuro-color-text-muted)", transition: "all 0.15s ease", "&:hover": { color: "var(--kuro-color-text-primary)" } }}>
                  <AppIcon name="grid" size={13} />
                </Box>
              </Box>
            </Box>
          </Box>

          {/* ── MOBILE toolbar (2 rows) — hidden on desktop ── */}
          <Box
            sx={{
              display: { xs: "flex", lg: "none" },
              flexDirection: "column",
              borderBottom: "1px solid var(--kuro-color-border)",
            }}
          >
            {/* Row 1: Left hamburger | Search | Right hamburger */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1 }}>
              {/* Left hamburger — opens Places + Filesystem drawer */}
              <Box
                onClick={() => setMobileLeftOpen(true)}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: radius.button, cursor: "pointer",
                  bgcolor: mobileLeftOpen ? "rgba(169,182,101,0.12)" : "var(--kuro-color-hover)",
                  color: mobileLeftOpen ? "var(--kuro-color-accent)" : "var(--kuro-color-text-secondary)",
                  border: "1px solid var(--kuro-color-border)",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
                title="Places & Filesystem"
              >
                <AppIcon name="panel-left" size={15} />
              </Box>

              {/* Search bar — fills remaining space */}
              <OutlinedInput
                size="small"
                placeholder="Filter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <AppIcon name="search" size={13} style={{ color: "var(--kuro-color-text-muted)" }} />
                  </InputAdornment>
                }
                endAdornment={
                  search ? (
                    <InputAdornment position="end">
                      <AppIcon name="x" size={13} style={{ cursor: "pointer", color: "var(--kuro-color-text-muted)" }} onClick={() => setSearch("")} />
                    </InputAdornment>
                  ) : null
                }
                sx={{
                  flex: 1,
                  fontSize: 11,
                  borderRadius: radius.input,
                  "& .MuiOutlinedInput-input": { py: 0.5, px: 1, fontSize: 11 },
                  "& fieldset": { borderColor: "var(--kuro-color-border)" },
                }}
              />

              {/* Right hamburger — opens Details + Disk Usage drawer */}
              <Box
                onClick={() => setMobileRightOpen(true)}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: radius.button, cursor: "pointer",
                  bgcolor: mobileRightOpen ? "rgba(169,182,101,0.12)" : "var(--kuro-color-hover)",
                  color: mobileRightOpen ? "var(--kuro-color-accent)" : "var(--kuro-color-text-secondary)",
                  border: "1px solid var(--kuro-color-border)",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
                title="Details & Disk Usage"
              >
                <AppIcon name="panel-right" size={15} />
              </Box>
            </Box>

            {/* Row 2: Action icons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.75, borderTop: "1px solid var(--kuro-color-border)" }}>
              <IconButton icon="arrow-up" iconSize={14} label="Up" onClick={navigateUp} disabled={!canGoUp || loading} />
              {isTrash ? (
                <Button variant="danger" size="small" onClick={() => setEmptyTrashOpen(true)} disabled={items.length === 0 || loading} sx={{ fontSize: 11, py: 0.5, px: 1.5, gap: 1, borderRadius: radius.button }}>
                  <AppIcon name="trash-2" size={14} />
                  Empty
                </Button>
              ) : (
                <IconButton icon="plus" iconSize={14} label="New..." onClick={(e) => setCreateMenuAnchor(e.currentTarget as HTMLElement)} />
              )}
              {/* Reuse the same create menu — it's portal-based so works globally */}
              <IconButton icon="refresh-cw" iconSize={14} label="Refresh" onClick={refresh} disabled={loading} />
              <IconButton icon={showHidden ? "eye" : "eye-off"} iconSize={14} label={showHidden ? "Hide hidden items" : "Show hidden items"} onClick={() => setShowHidden((prev) => !prev)} style={{ color: showHidden ? "var(--kuro-color-accent)" : undefined }} />
              <Box sx={{ flex: 1 }} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, bgcolor: "var(--kuro-color-background)", p: 0.5, borderRadius: radius.button, border: "1px solid var(--kuro-color-border)" }}>
                <Box onClick={() => setViewMode("table")} title="List View" sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "4px", cursor: "pointer", bgcolor: viewMode === "table" ? "var(--kuro-color-hover)" : "transparent", color: viewMode === "table" ? "var(--kuro-color-accent)" : "var(--kuro-color-text-muted)", transition: "all 0.15s ease", "&:hover": { color: "var(--kuro-color-text-primary)" } }}>
                  <AppIcon name="list" size={13} />
                </Box>
                <Box onClick={() => setViewMode("grid")} title="Grid View" sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "4px", cursor: "pointer", bgcolor: viewMode === "grid" ? "var(--kuro-color-hover)" : "transparent", color: viewMode === "grid" ? "var(--kuro-color-accent)" : "var(--kuro-color-text-muted)", transition: "all 0.15s ease", "&:hover": { color: "var(--kuro-color-text-primary)" } }}>
                  <AppIcon name="grid" size={13} />
                </Box>
              </Box>
            </Box>
          </Box>

          {/* File content area */}
          <Box
            sx={{ flex: 1, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}
            onClick={handleDeselect}
            onContextMenu={(e) => {
              const target = (e.target as HTMLElement).closest("[data-item-path]")
              if (target) {
                e.preventDefault()
                const path = target.getAttribute("data-item-path")
                const item = items.find((i) => i.path === path)
                if (item) {
                  handleContextMenu(e, item)
                }
              }
            }}
          >
            {loading && items.length === 0 && <FileListSkeleton />}
            {!loading && !!error && <ErrorState message={error} onRetry={refresh} />}
            {!loading && !error && items.length === 0 && (
              <EmptyState
                isSearch={search !== ""}
                isTrash={isTrash}
                onNewFolder={isTrash ? undefined : () => setNewFolderOpen(true)}
                onNewFile={isTrash ? undefined : () => setNewFileOpen(true)}
              />
            )}
            {!loading && !error && items.length > 0 && (
              <Box onClick={(e) => e.stopPropagation()} sx={{ flex: 1, height: "100%", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {viewMode === "table" ? (
                  <FileListView
                    items={items}
                    selected={selected}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSelect={handleSelect}
                    onOpen={handleOpen}
                    onSort={handleSort}
                  />
                ) : (
                  <Box sx={{ flex: 1, height: "100%", overflowY: "auto", minHeight: 0 }}>
                    <FileGridView
                      items={items}
                      selected={selected}
                      onSelect={handleSelect}
                      onOpen={handleOpen}
                    />
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* Footer status bar */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 0.75,
              borderTop: "1px solid var(--kuro-color-border)",
              fontSize: 11,
              fontFamily: "var(--kuro-font-family-mono, monospace)",
              color: "var(--kuro-color-text-muted)",
            }}
          >
            <Typography variant="caption" sx={{ fontFamily: "inherit", fontSize: 11, color: "inherit" }}>
              {items.length} item{items.length !== 1 ? "s" : ""}
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: "inherit", fontSize: 11, color: "inherit" }}>
              {selected ? `${selected.name} · ${selected.mode}` : ""}&nbsp;
              {selected ? `root@localhost` : ""}
            </Typography>
          </Box>
        </Box>

        {/* RIGHT: Details + Disk usage panel — hidden on mobile & tablet (in right drawer) */}
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <DetailsPanel
            selected={selected}
            isTrash={isTrash}
            onRestore={() => handleRestoreItem(selected)}
            onDownload={handleDownload}
            onRename={() => setRenameOpen(true)}
            onDelete={() => setDeleteOpen(true)}
            onCopy={handleCopy}
            onMove={handleMove}
            onOpenEditor={() => selected && handleViewFile(selected)}
          />
        </Box>
      </Box>


      {/* Dialogs */}
      <ContextMenu
        contextPosition={contextPosition}
        item={contextItem}
        isTrash={isTrash}
        onRestore={() => handleRestoreItem(contextItem)}
        onClose={() => { setContextPosition(null); setContextItem(null) }}
        onEdit={() => contextItem && handleViewFile(contextItem)}
        onRename={() => setRenameOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onCopy={handleCopy}
        onMove={handleMove}
        onDownload={handleDownload}
      />

      <FileEditorModal
        item={editorFile}
        onClose={() => setEditorFile(null)}
      />

      <MediaViewerModal
        item={mediaFile}
        onClose={() => setMediaFile(null)}
      />

      <NewFolderDialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onCreate={handleCreateFolder}
      />

      <NewFileDialog
        open={newFileOpen}
        onClose={() => setNewFileOpen(false)}
        onCreate={handleCreateFile}
        currentPath={currentPath}
      />

      <RenameDialog
        open={renameOpen}
        currentName={selected?.name ?? contextItem?.name ?? ""}
        onClose={() => setRenameOpen(false)}
        onRename={handleRename}
      />

      <DeleteDialog
        open={deleteOpen}
        itemName={selected?.name ?? ""}
        isTrash={isTrash}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        busy={ops.busy}
      />

      {/* Empty Trash Confirmation Dialog */}
      <Dialog
        open={emptyTrashOpen}
        onClose={() => setEmptyTrashOpen(false)}
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              borderRadius: radius.modal,
              bgcolor: "var(--kuro-color-surface)",
              border: "1px solid var(--kuro-color-border)",
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: 18, fontWeight: 700, color: "var(--kuro-color-text-primary)" }}>
          Empty Recycle Bin?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 11, color: "var(--kuro-color-text-secondary)" }}>
            Are you sure you want to permanently delete all items in the Recycle Bin? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="secondary" onClick={() => setEmptyTrashOpen(false)} sx={{ borderRadius: radius.button, fontSize: 11 }}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleEmptyTrashConfirm}
            disabled={ops.busy}
            sx={{ borderRadius: radius.button, fontSize: 11 }}
          >
            {ops.busy ? "Emptying..." : "Empty Recycle Bin"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Copy/Move destination dialog */}
      {(copyFrom || moveFrom) && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.6)",
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => { setCopyFrom(null); setMoveFrom(null) }}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              bgcolor: "var(--kuro-color-surface)",
              border: "1px solid var(--kuro-color-border)",
              borderRadius: radius.modal,
              p: 3,
              width: 360,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: 18 }}>
              {moveFrom ? "Move to..." : "Copy to..."}
            </Typography>
            <Typography variant="caption" sx={{ color: "var(--kuro-color-text-muted)", fontFamily: "monospace", fontSize: 11 }}>
              Source: {copyFrom || moveFrom}
            </Typography>
            <OutlinedInput
              autoFocus
              fullWidth
              size="small"
              placeholder="Destination path, e.g. /home/arka/other"
              defaultValue={currentPath}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  const input = (e.target as HTMLInputElement).value
                  const name = (copyFrom || moveFrom)!.split("/").pop() || ""
                  const target = `${input.replace(/\/$/, "")}/${name}`
                  if (moveFrom) await ops.moveItem(moveFrom, target)
                  else if (copyFrom) await ops.copyItem(copyFrom, target)
                  setCopyFrom(null)
                  setMoveFrom(null)
                  setSelected(null)
                }
              }}
              sx={{ fontSize: 11, fontFamily: "var(--kuro-font-family-mono, monospace)", borderRadius: radius.input }}
            />
            <Typography variant="caption" sx={{ color: "var(--kuro-color-text-muted)", fontSize: 11 }}>
              Press Enter to confirm or click outside to cancel.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}
