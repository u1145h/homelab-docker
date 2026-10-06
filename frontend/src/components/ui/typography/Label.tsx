import { forwardRef } from 'react'
import { Text } from './Text'
import type { TextProps } from './Text'
import { fontSize, fontWeight } from '@/design/typography'

export interface LabelProps extends Omit<TextProps, 'size' | 'weight'> {}

export const Label = forwardRef<HTMLElement, LabelProps>((props, ref) => (
  <Text ref={ref} size={fontSize.label} weight={fontWeight.medium} color="secondary" {...props} />
))

Label.displayName = 'Label'
