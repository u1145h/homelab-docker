import { forwardRef } from 'react'
import { Text } from './Text'
import type { TextProps } from './Text'
import { fontSize, fontWeight } from '@/design/typography'

export interface HeadingProps extends Omit<TextProps, 'size' | 'weight' | 'as'> {
  level?: 1 | 2 | 3 | 4
}

const headingConfig = {
  1: { size: fontSize.pageTitle, weight: fontWeight.semibold, as: 'h1' as const },
  2: { size: fontSize.heading, weight: fontWeight.semibold, as: 'h2' as const },
  3: { size: fontSize.bodyLarge, weight: fontWeight.semibold, as: 'h3' as const },
  4: { size: fontSize.bodyLarge, weight: fontWeight.medium, as: 'h4' as const },
}

export const Heading = forwardRef<HTMLElement, HeadingProps>(
  ({ level = 1, children, ...props }, ref) => {
    const config = headingConfig[level]
    return (
      <Text ref={ref} as={config.as} size={config.size} weight={config.weight} {...props}>
        {children}
      </Text>
    )
  },
)

Heading.displayName = 'Heading'
