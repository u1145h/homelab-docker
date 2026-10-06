import { forwardRef } from 'react'
import { Text } from './Text'
import type { TextProps } from './Text'
import { fontSize, fontWeight } from '@/design/typography'

export interface ValueProps extends Omit<TextProps, 'size' | 'weight'> {}

export const Value = forwardRef<HTMLElement, ValueProps>((props, ref) => (
  <Text ref={ref} size={fontSize.metric} weight={fontWeight.semibold} as="div" {...props} />
))

Value.displayName = 'Value'
