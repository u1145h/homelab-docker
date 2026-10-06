import { styled } from '@mui/material'

export interface SpacerProps {
  axis?: 'horizontal' | 'vertical'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | number
  flex?: boolean
}

const sizeMap = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const

const SpacerRoot = styled('div', {
  shouldForwardProp: (prop) => prop !== '$axis' && prop !== '$size' && prop !== '$flex',
})<{ $axis: 'horizontal' | 'vertical'; $size: number; $flex: boolean }>(
  ({ $axis, $size, $flex }) => ({
    flexShrink: 0,
    ...($axis === 'horizontal'
      ? { width: $flex ? '100%' : $size, height: 1, minHeight: 1 }
      : { height: $flex ? '100%' : $size, width: 1, minWidth: 1 }),
  }),
)

export function Spacer({ axis = 'vertical', size = 'md', flex = false }: SpacerProps) {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size]
  return <SpacerRoot $axis={axis} $size={pixelSize} $flex={flex} />
}
