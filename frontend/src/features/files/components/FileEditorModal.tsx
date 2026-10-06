import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog,
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Chip,
  Tooltip,
  Alert,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import SaveIcon from "@mui/icons-material/Save"
import WrapTextIcon from "@mui/icons-material/WrapText"
import RefreshIcon from "@mui/icons-material/Refresh"
import DownloadIcon from "@mui/icons-material/Download"
import DescriptionIcon from "@mui/icons-material/Description"
import { radius } from "@/design/radius"
import * as filesApi from "../api/files"
import type { FileItem } from "../types"
import { formatFileSize } from "../utils/files"
import { useSnackbar } from "@/hooks/useSnackbar"

interface FileEditorModalProps {
  item: FileItem | null
  onClose: () => void
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  switch (ext) {
    case "json":
      return "JSON"
    case "yml":
    case "yaml":
      return "YAML"
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "JavaScript"
    case "ts":
    case "tsx":
      return "TypeScript"
    case "py":
      return "Python"
    case "sh":
    case "bash":
    case "zsh":
      return "Shell Script"
    case "go":
      return "Go"
    case "html":
    case "htm":
      return "HTML"
    case "css":
    case "scss":
    case "less":
      return "CSS"
    case "md":
    case "markdown":
      return "Markdown"
    case "xml":
    case "svg":
      return "XML"
    case "sql":
      return "SQL"
    case "env":
    case "ini":
    case "conf":
    case "config":
      return "Config"
    case "log":
      return "Log File"
    case "dockerfile":
      return "Dockerfile"
    default:
      if (filename.toLowerCase() === "dockerfile") return "Dockerfile"
      if (filename.toLowerCase() === "makefile") return "Makefile"
      return ext ? ext.toUpperCase() : "Text"
  }
}

function isBinaryString(str: string): boolean {
  // Check for null characters or high concentration of non-printable bytes
  let nonPrintable = 0
  const maxCheck = Math.min(str.length, 1000)
  for (let i = 0; i < maxCheck; i++) {
    const code = str.charCodeAt(i)
    if (code === 0) return true
    if (code < 9 || (code > 13 && code < 32)) nonPrintable++
  }
  return nonPrintable / Math.max(1, maxCheck) > 0.3
}

export default function FileEditorModal({ item, onClose }: FileEditorModalProps) {
  const [content, setContent] = useState<string>("")
  const [originalContent, setOriginalContent] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isBinary, setIsBinary] = useState<boolean>(false)
  const [wordWrap, setWordWrap] = useState<boolean>(true)
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 })

  const { showSnackbar } = useSnackbar()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const lineNumbersRef = useRef<HTMLDivElement | null>(null)

  const filename = item?.name || ""
  const path = item?.path || ""
  const isDirty = content !== originalContent
  const language = detectLanguage(filename)

  const loadFileContent = useCallback(async () => {
    if (!path) return
    setLoading(true)
    setError(null)
    setIsBinary(false)
    try {
      const data = await filesApi.readFileText(path)
      if (typeof data === "string" && isBinaryString(data)) {
        setIsBinary(true)
        setContent("")
        setOriginalContent("")
      } else {
        const textStr = typeof data === "string" ? data : String(data ?? "")
        setContent(textStr)
        setOriginalContent(textStr)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load file content"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    if (item) {
      loadFileContent()
    } else {
      setContent("")
      setOriginalContent("")
      setError(null)
    }
  }, [item, loadFileContent])

  const handleSave = useCallback(async () => {
    if (!path || !isDirty || saving) return
    setSaving(true)
    try {
      await filesApi.saveFileText(path, content)
      setOriginalContent(content)
      showSnackbar(`Saved "${filename}" successfully.`, "success")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save file"
      showSnackbar(msg, "error")
    } finally {
      setSaving(false)
    }
  }, [path, isDirty, saving, content, filename, showSnackbar])

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        handleSave()
      } else if (e.key === "Escape" && !isDirty) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave, isDirty, onClose])

  // Synchronize scroll between textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Calculate cursor line and column position
  const handleCursorMove = () => {
    if (!textareaRef.current) return
    const text = textareaRef.current.value
    const selStart = textareaRef.current.selectionStart
    const lines = text.substring(0, selStart).split("\n")
    const currentLine = lines.length
    const currentCol = lines[lines.length - 1].length + 1
    setCursorPos({ line: currentLine, col: currentCol })
  }

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  const handleDownload = async () => {
    if (path) {
      try {
        await filesApi.downloadFile(path)
      } catch {
        showSnackbar("Failed to download file", "error")
      }
    }
  }

  const linesCount = content ? content.split("\n").length : 1
  const lineNumbersArray = Array.from({ length: linesCount }, (_, i) => i + 1)

  return (
    <Dialog
      open={Boolean(item)}
      onClose={handleClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            bgcolor: "var(--kuro-color-bg)",
            color: "var(--kuro-color-text-primary)",
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {/* Editor Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 1.25,
          bgcolor: "var(--kuro-color-surface)",
          borderBottom: "1px solid var(--kuro-color-border)",
          gap: 2,
        }}
      >
        {/* Left: Title & File Info */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: 1 }}>
          <DescriptionIcon sx={{ color: "var(--kuro-color-accent)", fontSize: 20 }} />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: "var(--kuro-font-family-mono, monospace)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {filename}
              </Typography>
              {isDirty && (
                <Chip
                  label="Unsaved"
                  size="small"
                  color="warning"
                  sx={{ height: 18, fontSize: 10, fontWeight: 600 }}
                />
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontSize: 10,
                color: "var(--kuro-color-text-muted)",
                fontFamily: "var(--kuro-font-family-mono, monospace)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block",
              }}
            >
              {path}
            </Typography>
          </Box>
        </Box>

        {/* Center: Language & File Metadata */}
        <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1 }}>
          <Chip
            label={language}
            size="small"
            variant="outlined"
            sx={{
              fontSize: 10,
              height: 22,
              borderColor: "var(--kuro-color-border)",
              color: "var(--kuro-color-text-secondary)",
            }}
          />
          {item?.size !== undefined && (
            <Chip
              label={formatFileSize(item.size)}
              size="small"
              variant="outlined"
              sx={{
                fontSize: 10,
                height: 22,
                borderColor: "var(--kuro-color-border)",
                color: "var(--kuro-color-text-secondary)",
              }}
            />
          )}
        </Box>

        {/* Right: Actions */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title={wordWrap ? "Disable Word Wrap" : "Enable Word Wrap"}>
            <IconButton
              size="small"
              onClick={() => setWordWrap(!wordWrap)}
              sx={{
                bgcolor: wordWrap ? "var(--kuro-color-hover)" : "transparent",
                color: "var(--kuro-color-text-primary)",
              }}
            >
              <WrapTextIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Reload file">
            <IconButton size="small" onClick={loadFileContent} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Download file">
            <IconButton size="small" onClick={handleDownload}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            size="small"
            color="success"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!isDirty || saving || loading || isBinary}
            sx={{
              fontSize: 11,
              borderRadius: radius.button,
              px: 2,
              py: 0.5,
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {saving ? "Saving..." : "Save (Ctrl+S)"}
          </Button>

          <IconButton size="small" onClick={handleClose} sx={{ color: "var(--kuro-color-text-muted)" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Editor Main Content Area */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 2 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" sx={{ fontSize: 11, color: "var(--kuro-color-text-muted)" }}>
              Loading file content...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
            <Alert severity="error" sx={{ maxWidth: 500 }}>
              {error}
            </Alert>
          </Box>
        ) : isBinary ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, p: 4, gap: 2 }}>
            <DescriptionIcon sx={{ fontSize: 64, color: "var(--kuro-color-text-muted)" }} />
            <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
              Binary File Detected
            </Typography>
            <Typography variant="body2" sx={{ fontSize: 11, color: "var(--kuro-color-text-muted)", textAlign: "center", maxWidth: 400 }}>
              This file contains binary data and cannot be displayed in the text editor. You can download the file to inspect it on your computer.
            </Typography>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ borderRadius: radius.button, fontSize: 11, mt: 1 }}
            >
              Download File
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              overflow: "hidden",
              bgcolor: "#0d1117",
              color: "#c9d1d9",
              fontFamily: "var(--kuro-font-family-mono, monospace)",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {/* Line Numbers Column */}
            <Box
              ref={lineNumbersRef}
              sx={{
                width: 48,
                bgcolor: "#161b22",
                borderRight: "1px solid #30363d",
                color: "#484f58",
                textAlign: "right",
                pr: 1.5,
                pt: 1.5,
                pb: 1.5,
                userSelect: "none",
                overflowY: "hidden",
                fontFamily: "var(--kuro-font-family-mono, monospace)",
                fontSize: 11,
                lineHeight: 1.6,
                flexShrink: 0,
              }}
            >
              {lineNumbersArray.map((num) => (
                <div key={num}>{num}</div>
              ))}
            </Box>

            {/* Textarea Editor Area */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onScroll={handleScroll}
              onKeyUp={handleCursorMove}
              onClick={handleCursorMove}
              onSelect={handleCursorMove}
              spellCheck={false}
              wrap={wordWrap ? "soft" : "off"}
              style={{
                flex: 1,
                width: "100%",
                height: "100%",
                backgroundColor: "transparent",
                color: "#e6edf3",
                border: "none",
                outline: "none",
                padding: "12px 16px",
                fontFamily: "var(--kuro-font-family-mono, monospace)",
                fontSize: "12px",
                lineHeight: 1.6,
                resize: "none",
                tabSize: 2,
                whiteSpace: wordWrap ? "pre-wrap" : "pre",
                overflowX: wordWrap ? "hidden" : "auto",
                overflowY: "auto",
              }}
            />
          </Box>
        )}
      </Box>

      {/* Editor Footer Status Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 0.5,
          bgcolor: "var(--kuro-color-surface)",
          borderTop: "1px solid var(--kuro-color-border)",
          fontSize: 10,
          color: "var(--kuro-color-text-muted)",
          fontFamily: "var(--kuro-font-family-mono, monospace)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span>{linesCount} lines</span>
          <span>{content.length} characters</span>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span>UTF-8</span>
          <span style={{ color: isDirty ? "#e3b341" : "var(--kuro-color-success)", fontWeight: 600 }}>
            {isDirty ? "Modified" : "Saved"}
          </span>
        </Box>
      </Box>
    </Dialog>
  )
}
