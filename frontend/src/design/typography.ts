export const fontFamily = {
  sans: "'Space Mono', 'Inter', system-ui, -apple-system, sans-serif",
  mono: "'Space Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  spaceMono: "'Space Mono', monospace",
} as const

export const fontSize = {
  tiny: 10,
  caption: 11,
  label: 11,
  body: 11,
  bodyLarge: 12,
  heading: 18,
  pageTitle: 18,
  metric: 22,
} as const

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const

export type FontSizeKey = keyof typeof fontSize
export type FontWeightKey = keyof typeof fontWeight
