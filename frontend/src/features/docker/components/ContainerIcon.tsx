import { useState, useEffect, useMemo } from 'react'
import { getDockerIconUrls } from '../utils/dockerIconResolver'
import { useCustomDockerIcon } from '../utils/customDockerIcons'
import { radius } from '@/design/radius'

interface ContainerIconProps {
  container: string | { name: string; image?: string; labels?: Record<string, string> }
  customIcon?: string | null
  size?: number
  style?: React.CSSProperties
  className?: string
  alt?: string
}

/**
 * Modern SVG Docker Whale / Generic Container Fallback
 */
export function DefaultDockerWhale({ size, style, className }: { size: number; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius.button,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid var(--kuro-color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--kuro-color-accent)',
        flexShrink: 0,
        ...style,
      }}
      className={className}
    >
      <svg
        width={Math.round(size * 0.65)}
        height={Math.round(size * 0.65)}
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ opacity: 0.9 }}
      >
        <path d="M22 13.5c0-.4-.1-.7-.3-1-.3-.4-.7-.7-1.2-.8-.2-.7-.7-1.3-1.4-1.6-.7-.3-1.5-.3-2.1 0-.6-.9-1.6-1.5-2.8-1.5H13V7h2V5h-2V3h-2v2H9v2h2v1.6H9V7H7v1.6H5V7H3v1.6H2c-.6 0-1 .4-1 1v4.8c0 1.9.9 3.7 2.4 4.8 1.5 1.1 3.4 1.7 5.3 1.7 5.5 0 10.3-3.7 11.8-8.9.9-.1 1.5-.8 1.5-1.6zM4 10.2h1.6V12H4v-1.8zm3.6 0h1.6V12H7.6v-1.8zm3.6 0h1.6V12h-1.6v-1.8zm3.6 0h1.6V12h-1.6v-1.8z" />
      </svg>
    </div>
  )
}

export default function ContainerIcon({
  container,
  customIcon: explicitCustomIcon,
  size = 28,
  style,
  className,
  alt = '',
}: ContainerIconProps) {
  const containerName = typeof container === 'string' ? container : container?.name || ''
  const containerImage = typeof container === 'object' && container ? container.image || '' : ''
  const storeCustomIcon = useCustomDockerIcon(container)
  const activeCustomIcon = explicitCustomIcon !== undefined ? explicitCustomIcon : storeCustomIcon

  const candidateUrls = useMemo(() => {
    return getDockerIconUrls(container, activeCustomIcon)
  }, [containerName, containerImage, activeCustomIcon])

  const [currentIdx, setCurrentIdx] = useState(0)

  // Reset index when the candidate URL list changes
  useEffect(() => {
    setCurrentIdx(0)
  }, [candidateUrls.join(',')])

  const currentUrl = candidateUrls[currentIdx]

  // All URLs failed or none available -> render whale fallback
  if (!currentUrl || currentIdx >= candidateUrls.length) {
    return <DefaultDockerWhale size={size} style={style} className={className} />
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius.button,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
      className={className}
    >
      <img
        key={currentUrl}
        src={currentUrl}
        alt={alt || containerName}
        width={size}
        height={size}
        onError={() => {
          // Immediately try next candidate URL
          setCurrentIdx((prev) => prev + 1)
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: radius.button,
        }}
      />
    </div>
  )
}
