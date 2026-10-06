export const radius = {
  card: '8px',
  button: '8px',
  input: '8px',
  badge: '8px',
  modal: '8px',
  table: '8px',
  panel: '8px',
  skeleton: '8px',
} as const

export type RadiusKey = keyof typeof radius
