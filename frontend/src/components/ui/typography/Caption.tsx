import { forwardRef } from 'react'
import { Text } from './Text'
import type { TextProps } from './Text'
import { fontSize } from '@/design/typography'

export interface CaptionProps extends Omit<TextProps, 'size'> {}

export const Caption = forwardRef<HTMLElement, CaptionProps>((props, ref) => (
  <Text ref={ref} size={fontSize.caption} color="secondary" {...props} />
))

Caption.displayName = 'Caption'
