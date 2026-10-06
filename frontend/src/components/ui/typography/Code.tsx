import { forwardRef } from 'react'
import { Text } from './Text'
import type { TextProps } from './Text'
import { fontSize } from '@/design/typography'

export interface CodeProps extends Omit<TextProps, 'mono' | 'as'> {}

export const Code = forwardRef<HTMLElement, CodeProps>((props, ref) => (
  <Text ref={ref} mono size={fontSize.body} as="code" {...props} />
))

Code.displayName = 'Code'
