import { forwardRef, type HTMLAttributes } from 'react'
import { getIcon, type IconName } from './registry'

const semanticSizes = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 22,
  xl: 28,
} as const

type SemanticSize = keyof typeof semanticSizes

export interface AppIconProps extends HTMLAttributes<SVGSVGElement> {
  name: IconName
  size?: number | SemanticSize
}

export const AppIcon = forwardRef<SVGSVGElement, AppIconProps>(
  ({ name, size = 'md', ...props }, ref) => {
    const pixelSize = typeof size === 'number' ? size : semanticSizes[size]
    const Icon = getIcon(name)

    return <Icon ref={ref} size={pixelSize} {...props} />
  },
)

AppIcon.displayName = 'AppIcon'
