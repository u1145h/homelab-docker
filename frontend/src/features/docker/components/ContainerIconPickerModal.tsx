import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Typography,
  IconButton,
  InputAdornment,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import LanguageIcon from '@mui/icons-material/Language'
import CategoryIcon from '@mui/icons-material/Category'
import ImageVectorIcon from '@mui/icons-material/Image'
import { TextInput } from '@/components/ui/forms'
import ContainerIcon from './ContainerIcon'
import {
  getCachedIconCatalog,
  fetchFullIconCatalog,
  searchIconCatalog,
  WALKXCODE_CDN_PNG,
  type DashboardIconItem,
} from '../utils/dashboardIconCatalog'
import { radius } from '@/design/radius'

interface ContainerIconPickerModalProps {
  open: boolean
  onClose: () => void
  containerName: string
  containerImage?: string
  currentCustomIcon?: string | null
  onSave: (iconValue: string | null) => void
}

export default function ContainerIconPickerModal({
  open,
  onClose,
  containerName,
  containerImage,
  currentCustomIcon,
  onSave,
}: ContainerIconPickerModalProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [catalog, setCatalog] = useState<DashboardIconItem[]>(() => getCachedIconCatalog())
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [selectedIcon, setSelectedIcon] = useState<string | null>(currentCustomIcon || null)

  // Custom tab state
  const [customUrl, setCustomUrl] = useState('')
  const [visibleCount, setVisibleCount] = useState(80)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load full catalog asynchronously when modal opens
  useEffect(() => {
    if (open) {
      setSelectedIcon(currentCustomIcon || null)
      setSearchQuery('')
      setVisibleCount(80)

      if (currentCustomIcon?.startsWith('data:')) {
        setActiveTab(1)
      } else if (currentCustomIcon?.startsWith('http://') || currentCustomIcon?.startsWith('https://')) {
        setCustomUrl(currentCustomIcon)
        setActiveTab(1)
      } else {
        setActiveTab(0)
      }

      setLoadingCatalog(true)
      fetchFullIconCatalog()
        .then((items) => {
          setCatalog(items)
        })
        .finally(() => {
          setLoadingCatalog(false)
        })
    }
  }, [open, currentCustomIcon])

  // Filter icons based on query
  const filteredIcons = useMemo(() => {
    return searchIconCatalog(catalog, searchQuery)
  }, [catalog, searchQuery])

  // Reset pagination on search change
  useEffect(() => {
    setVisibleCount(80)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [searchQuery])

  // Scroll listener for lazy loading more items
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 250) {
      setVisibleCount((prev) => Math.min(prev + 60, filteredIcons.length))
    }
  }

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (.png, .jpg, .svg, .webp).')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit. Please choose a smaller image.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const b64 = event.target?.result as string
      if (b64) {
        setSelectedIcon(b64)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleApply = () => {
    onSave(selectedIcon)
    onClose()
  }

  const handleResetDefault = () => {
    onSave(null)
    onClose()
  }

  const cleanName = containerName.replace(/^\//, '')

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        paper: {
          style: {
            backgroundColor: 'var(--kuro-color-surface)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.card,
            backgroundImage: 'none',
            color: 'var(--kuro-color-text-primary)',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--kuro-color-border)',
        }}
      >
        <Box style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <ContainerIcon
              container={{ name: cleanName, image: containerImage }}
              customIcon={selectedIcon}
              size={36}
            />
          </div>
          <Box>
            <Typography variant="h6" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: 'var(--kuro-color-text-primary)' }}>
              Edit Container Logo
            </Typography>
            <Typography variant="caption" style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
              Customizing logo for <strong style={{ color: 'var(--kuro-color-accent)' }}>{cleanName}</strong>
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} style={{ color: 'var(--kuro-color-text-muted)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Tabs */}
      <Box style={{ borderBottom: '1px solid var(--kuro-color-border)', backgroundColor: 'rgba(0,0,0,0.15)', paddingLeft: 16, paddingRight: 16 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            minHeight: 42,
            '& .MuiTab-root': {
              minHeight: 42,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'none',
              color: 'var(--kuro-color-text-muted)',
              '&.Mui-selected': {
                color: 'var(--kuro-color-accent)',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'var(--kuro-color-accent)',
            },
          }}
        >
          <Tab
            icon={<CategoryIcon style={{ fontSize: 16, marginBottom: 0, marginRight: 6 }} />}
            iconPosition="start"
            label={`Dashboard Icons CDN (${catalog.length.toLocaleString()})`}
          />
          <Tab
            icon={<ImageVectorIcon style={{ fontSize: 16, marginBottom: 0, marginRight: 6 }} />}
            iconPosition="start"
            label="Custom Upload / URL"
          />
        </Tabs>
      </Box>

      {/* Content Body */}
      <DialogContent style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === 0 ? (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
            {/* Search Input */}
            <TextInput
              placeholder="Search icons (e.g. immich, plex, postgres, adguard)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon style={{ fontSize: 18, color: 'var(--kuro-color-text-muted)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')} style={{ color: 'var(--kuro-color-text-muted)', padding: 2 }}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
              }}
            />

            {/* Icon Grid */}
            <Box
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                gap: 10,
                paddingRight: 6,
                minHeight: 280,
                alignContent: 'start',
              }}
            >
              {filteredIcons.slice(0, visibleCount).map((item) => {
                const isSelected = selectedIcon === item.slug
                const iconUrl = `${WALKXCODE_CDN_PNG}/${item.slug}.png`

                return (
                  <Box
                    key={item.slug}
                    onClick={() => setSelectedIcon(item.slug)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: 10,
                      borderRadius: radius.card,
                      border: isSelected ? '2px solid var(--kuro-color-accent)' : '1px solid var(--kuro-color-border)',
                      backgroundColor: isSelected ? 'rgba(169, 182, 101, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'
                        e.currentTarget.style.borderColor = 'var(--kuro-color-text-muted)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
                        e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
                      }
                    }}
                  >
                    {isSelected && (
                      <CheckCircleIcon
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          fontSize: 16,
                          color: 'var(--kuro-color-accent)',
                        }}
                      />
                    )}

                    <img
                      src={iconUrl}
                      alt={item.name}
                      loading="lazy"
                      style={{
                        width: 38,
                        height: 38,
                        objectFit: 'contain',
                        borderRadius: 6,
                      }}
                      onError={(e) => {
                        // Fallback if PNG fails
                        ;(e.currentTarget as HTMLElement).style.display = 'none'
                      }}
                    />

                    <Typography
                      variant="caption"
                      style={{
                        fontSize: 10,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        lineHeight: 1.2,
                        maxLines: 2,
                      }}
                    >
                      {item.name}
                    </Typography>
                  </Box>
                )
              })}

              {filteredIcons.length === 0 && (
                <Box
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 40,
                    color: 'var(--kuro-color-text-muted)',
                    gap: 8,
                  }}
                >
                  <SearchIcon style={{ fontSize: 32 }} />
                  <Typography variant="body2" style={{ fontSize: 13 }}>
                    No icons found matching &quot;{searchQuery}&quot;
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Counter bar */}
            <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--kuro-color-text-muted)', paddingTop: 4 }}>
              <span>
                Showing {Math.min(visibleCount, filteredIcons.length)} of {filteredIcons.length} icons
              </span>
              {loadingCatalog && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CircularProgress size={12} style={{ color: 'var(--kuro-color-accent)' }} /> Updating icon index...
                </span>
              )}
            </Box>
          </Box>
        ) : (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 8, paddingBottom: 8 }}>
            {/* Upload File Section */}
            <Box
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--kuro-color-border)',
                borderRadius: radius.card,
                padding: '24px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--kuro-color-accent)'
                e.currentTarget.style.backgroundColor = 'rgba(169, 182, 101, 0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <CloudUploadIcon style={{ fontSize: 36, color: 'var(--kuro-color-accent)' }} />
              <Typography variant="body2" style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                Click to upload custom logo artwork
              </Typography>
              <Typography variant="caption" style={{ color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>
                Supports PNG, JPG, SVG, WebP (Max size: 2MB)
              </Typography>
            </Box>

            {/* Direct Image URL Section */}
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Typography variant="subtitle2" style={{ fontSize: 12, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                Or enter direct image URL:
              </Typography>
              <TextInput
                placeholder="https://example.com/logo.png"
                value={customUrl}
                onChange={(e) => {
                  const val = e.target.value
                  setCustomUrl(val)
                  if (val.trim()) {
                    setSelectedIcon(val.trim())
                  }
                }}
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LanguageIcon style={{ fontSize: 18, color: 'var(--kuro-color-text-muted)' }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            {/* Live Preview Box */}
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 16,
                borderRadius: radius.card,
                border: '1px solid var(--kuro-color-border)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <ContainerIcon
                container={{ name: cleanName, image: containerImage }}
                customIcon={selectedIcon}
                size={52}
              />
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Typography variant="subtitle2" style={{ fontWeight: 700, color: 'var(--kuro-color-accent)', fontSize: 13 }}>
                  Live Preview
                </Typography>
                <Typography variant="caption" style={{ color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>
                  {selectedIcon
                    ? selectedIcon.startsWith('data:')
                      ? 'Custom uploaded image active'
                      : `Selected URL: ${selectedIcon}`
                    : 'Currently using auto-detected icon'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      {/* Actions Footer */}
      <DialogActions
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--kuro-color-border)',
          justifyContent: 'space-between',
        }}
      >
        <Tooltip title="Restore auto-detected icon based on container name/image">
          <Button
            size="small"
            onClick={handleResetDefault}
            startIcon={<RestartAltIcon fontSize="small" />}
            style={{
              color: 'var(--kuro-color-danger)',
              fontSize: 12,
              textTransform: 'none',
            }}
          >
            Reset to Default
          </Button>
        </Tooltip>

        <Box style={{ display: 'flex', gap: 10 }}>
          <Button
            size="small"
            onClick={onClose}
            style={{
              color: 'var(--kuro-color-text-secondary)',
              fontSize: 12,
              textTransform: 'none',
            }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleApply}
            style={{
              backgroundColor: 'var(--kuro-color-accent)',
              color: '#111314',
              fontWeight: 700,
              fontSize: 12,
              textTransform: 'none',
              borderRadius: radius.button,
            }}
          >
            Save Icon
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}
