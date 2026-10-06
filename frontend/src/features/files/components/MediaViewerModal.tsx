import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Chip,
  Tooltip,
  Alert,
  Select,
  MenuItem,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import DownloadIcon from "@mui/icons-material/Download"
import ZoomInIcon from "@mui/icons-material/ZoomIn"
import ZoomOutIcon from "@mui/icons-material/ZoomOut"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import RotateRightIcon from "@mui/icons-material/RotateRight"
import ImageIcon from "@mui/icons-material/Image"
import MovieIcon from "@mui/icons-material/Movie"
import AudiotrackIcon from "@mui/icons-material/Audiotrack"
import { radius } from "@/design/radius"
import * as filesApi from "../api/files"
import type { FileItem } from "../types"
import { formatFileSize } from "../utils/files"
import { useSnackbar } from "@/hooks/useSnackbar"

interface MediaViewerModalProps {
  item: FileItem | null
  onClose: () => void
}

export type MediaKind = "image" | "video" | "audio" | "other"

export function getMediaKind(item: FileItem | null): MediaKind {
  if (!item || item.type === "directory") return "other"
  const ext = item.name.split(".").pop()?.toLowerCase() || ""
  const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tiff", "avif"]
  const videoExts = ["mp4", "webm", "ogg", "mov", "m4v", "mkv", "avi"]
  const audioExts = ["mp3", "wav", "flac", "aac", "m4a", "opus"]

  if (imageExts.includes(ext)) return "image"
  if (videoExts.includes(ext)) return "video"
  if (audioExts.includes(ext)) return "audio"
  return "other"
}

export default function MediaViewerModal({ item, onClose }: MediaViewerModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { showSnackbar } = useSnackbar()

  // Image viewer state
  const [zoom, setZoom] = useState<number>(1)
  const [rotation, setRotation] = useState<number>(0)
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null)
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Video state
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const mediaKind = getMediaKind(item)
  const filename = item?.name || ""
  const path = item?.path || ""
  const ext = filename.split(".").pop()?.toUpperCase() || ""

  useEffect(() => {
    if (!item || mediaKind === "other") {
      setBlobUrl(null)
      setError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)
    setZoom(1)
    setRotation(0)
    setPanPos({ x: 0, y: 0 })
    setImgDimensions(null)

    let createdUrl: string | null = null

    filesApi
      .getFileBlobUrl(path)
      .then((url) => {
        if (isMounted) {
          createdUrl = url
          setBlobUrl(url)
        } else {
          URL.revokeObjectURL(url)
        }
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load media file"
          setError(msg)
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [item, path, mediaKind])

  const handleDownload = async () => {
    if (path) {
      try {
        await filesApi.downloadFile(path)
      } catch {
        showSnackbar("Failed to download file", "error")
      }
    }
  }

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 4))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.25))
  const handleResetZoom = () => {
    setZoom(1)
    setRotation(0)
    setPanPos({ x: 0, y: 0 })
  }
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360)

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (mediaKind !== "image") return
    e.preventDefault()
    if (e.deltaY < 0) {
      setZoom((prev) => Math.min(prev + 0.15, 4))
    } else {
      setZoom((prev) => Math.max(prev - 0.15, 0.25))
    }
  }

  // Drag pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mediaKind !== "image" || zoom <= 1) return
    setIsPanning(true)
    startPanRef.current = { x: e.clientX - panPos.x, y: e.clientY - panPos.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    setPanPos({
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y,
    })
  }

  const handleMouseUp = () => setIsPanning(false)

  // Video playback speed change
  const handleSpeedChange = (newRate: number) => {
    setPlaybackRate(newRate)
    if (videoRef.current) {
      videoRef.current.playbackRate = newRate
    }
  }

  if (!item || mediaKind === "other") return null

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#090d16",
            color: "var(--kuro-color-text-primary)",
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {/* Media Header */}
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
          zIndex: 10,
        }}
      >
        {/* Left: Icon & File Name */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: 1 }}>
          {mediaKind === "image" && <ImageIcon sx={{ color: "var(--kuro-color-accent)", fontSize: 22 }} />}
          {mediaKind === "video" && <MovieIcon sx={{ color: "#a855f7", fontSize: 22 }} />}
          {mediaKind === "audio" && <AudiotrackIcon sx={{ color: "var(--kuro-color-success)", fontSize: 22 }} />}
          <Box sx={{ minWidth: 0 }}>
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

        {/* Center: Format & Dimensions / Size */}
        <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1 }}>
          <Chip
            label={ext}
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
          {imgDimensions && (
            <Chip
              label={`${imgDimensions.w} × ${imgDimensions.h} px`}
              size="small"
              variant="outlined"
              sx={{
                fontSize: 10,
                height: 22,
                borderColor: "var(--kuro-color-border)",
                color: "var(--kuro-color-accent)",
              }}
            />
          )}
        </Box>

        {/* Right: Media Controls */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {mediaKind === "image" && (
            <>
              <Tooltip title="Zoom In (+)">
                <IconButton size="small" onClick={handleZoomIn}>
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out (-)">
                <IconButton size="small" onClick={handleZoomOut}>
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset Zoom & Rotation">
                <IconButton size="small" onClick={handleResetZoom}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Rotate Clockwise">
                <IconButton size="small" onClick={handleRotate}>
                  <RotateRightIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {mediaKind === "video" && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" sx={{ fontSize: 10, color: "var(--kuro-color-text-muted)" }}>
                Speed:
              </Typography>
              <Select
                value={playbackRate}
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
                size="small"
                sx={{
                  height: 26,
                  fontSize: 10,
                  bgcolor: "var(--kuro-color-surface)",
                  borderRadius: radius.button,
                  "& .MuiSelect-select": { py: 0.25, px: 1 },
                }}
              >
                <MenuItem value={0.5} sx={{ fontSize: 11 }}>0.5x</MenuItem>
                <MenuItem value={1.0} sx={{ fontSize: 11 }}>1.0x (Normal)</MenuItem>
                <MenuItem value={1.25} sx={{ fontSize: 11 }}>1.25x</MenuItem>
                <MenuItem value={1.5} sx={{ fontSize: 11 }}>1.5x</MenuItem>
                <MenuItem value={2.0} sx={{ fontSize: 11 }}>2.0x</MenuItem>
              </Select>
            </Box>
          )}

          <Tooltip title="Download File">
            <IconButton size="small" onClick={handleDownload}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <IconButton size="small" onClick={onClose} sx={{ color: "var(--kuro-color-text-muted)" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Main Viewport Content */}
      <Box
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          cursor: mediaKind === "image" && zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default",
          userSelect: "none",
        }}
      >
        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <CircularProgress size={36} />
            <Typography variant="body2" sx={{ fontSize: 11, color: "var(--kuro-color-text-muted)" }}>
              Loading media file...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ maxWidth: 450 }}>
            {error}
          </Alert>
        ) : blobUrl ? (
          <>
            {/* Image Mode */}
            {mediaKind === "image" && (
              <Box
                component="img"
                src={blobUrl}
                alt={filename}
                onLoad={(e) => {
                  const target = e.currentTarget
                  setImgDimensions({ w: target.naturalWidth, h: target.naturalHeight })
                }}
                sx={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                  transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isPanning ? "none" : "transform 0.2s ease-out",
                  borderRadius: radius.card,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                }}
              />
            )}

            {/* Video Mode */}
            {mediaKind === "video" && (
              <Box
                component="video"
                ref={videoRef}
                src={blobUrl}
                controls
                autoPlay
                sx={{
                  maxWidth: "95%",
                  maxHeight: "90%",
                  borderRadius: radius.card,
                  bgcolor: "#000",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
                  outline: "none",
                }}
              />
            )}

            {/* Audio Mode */}
            {mediaKind === "audio" && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  p: 4,
                  bgcolor: "var(--kuro-color-surface)",
                  border: "1px solid var(--kuro-color-border)",
                  borderRadius: radius.modal,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                  width: { xs: "90%", sm: 420 },
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    bgcolor: "rgba(16, 185, 129, 0.15)",
                    color: "var(--kuro-color-success)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AudiotrackIcon sx={{ fontSize: 40 }} />
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: 16 }}>
                    {filename}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--kuro-color-text-muted)", fontSize: 11 }}>
                    {formatFileSize(item.size)}
                  </Typography>
                </Box>
                <Box component="audio" src={blobUrl} controls autoPlay sx={{ width: "100%", outline: "none" }} />
              </Box>
            )}
          </>
        ) : null}
      </Box>

      {/* Image Zoom Status Badge overlay */}
      {mediaKind === "image" && zoom !== 1 && (
        <Box
          sx={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            bgcolor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            px: 2,
            py: 0.5,
            borderRadius: radius.button,
            border: "1px solid var(--kuro-color-border)",
            zIndex: 10,
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: "var(--kuro-color-accent)" }}>
            Zoom: {Math.round(zoom * 100)}%
          </Typography>
        </Box>
      )}
    </Dialog>
  )
}
