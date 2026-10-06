export const elevation = {
  none: 'none',
  subtle: '0 1px 2px rgba(0,0,0,0.04)',
} as const

export type ElevationKey = keyof typeof elevation
