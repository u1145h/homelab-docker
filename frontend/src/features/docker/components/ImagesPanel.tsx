import type { ContainerSummary } from '../types'
import { radius } from '@/design/radius'

function getStateColor(state: string): string {
  switch (state) {
    case 'running': return 'var(--kuro-color-success)'
    case 'paused': return 'var(--kuro-color-warning)'
    case 'restarting': return 'var(--kuro-color-info)'
    case 'exited':
    case 'dead':
      return 'var(--kuro-color-danger)'
    default:
      return 'var(--kuro-color-text-muted)'
  }
}

/**
 * Extract a short human-readable image name.
 * e.g. "ghcr.io/immich-app/immich-server:release" → "immich_server"
 *      "vaultwarden/server:latest"                 → "vaultwarden"
 */
function shortImageName(image: string): string {
  const parts = image.split('/')
  let name: string
  if (parts.length > 2) {
    // registry prefix present — take the last two segments (org/repo)
    name = parts.slice(-2).join('/')
  } else if (parts.length === 2) {
    name = parts[1]
  } else {
    name = parts[0]
  }
  // strip tag and digest
  return name.split(':')[0].split('@')[0]
}

/**
 * Parse a relative time from the Docker status field.
 * "Up 4 hours (healthy)" → "4 hours"
 * "Up 3 days"            → "3 days"
 * "Exited (0) 2 hours ago" → "2 hours ago"
 */
function parseRelativeTime(status: string): string {
  if (!status) return ''
  // "Up X unit" format
  const upMatch = status.match(/Up\s+(\d+\s+\w+)/i)
  if (upMatch) return upMatch[1]
  // "Exited (N) X unit ago" format
  const exitMatch = status.match(/(\d+\s+\w+)\s+ago/i)
  if (exitMatch) return exitMatch[1] + ' ago'
  return status
}

interface ImageRow {
  shortName: string
  fullImage: string
  state: string
  relativeTime: string
}

interface ImagesPanelProps {
  containers: ContainerSummary[]
}

export default function ImagesPanel({ containers }: ImagesPanelProps) {
  // Deduplicate by full image name, keeping the most relevant container per image
  const imageMap = new Map<string, ImageRow>()
  for (const c of containers) {
    if (!imageMap.has(c.image)) {
      imageMap.set(c.image, {
        shortName: shortImageName(c.image),
        fullImage: c.image,
        state: c.state,
        relativeTime: parseRelativeTime(c.status),
      })
    }
  }
  const images = Array.from(imageMap.values())

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--kuro-color-text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          Images
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--kuro-color-text-secondary)',
            fontWeight: 500,
          }}
        >
          {images.length} in use
        </span>
      </div>

      {/* Image list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {images.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
            No images
          </span>
        ) : (
          images.map((img) => (
            <div
              key={img.fullImage}
              title={img.fullImage}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {/* colored dash indicator */}
                <div
                  style={{
                    width: 14,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: getStateColor(img.state),
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--kuro-color-text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {img.shortName}
                </span>
              </div>
              {img.relativeTime && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--kuro-color-warning)',
                    flexShrink: 0,
                    fontWeight: 500,
                  }}
                >
                  {img.relativeTime}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
