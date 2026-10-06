export interface ColorTokens {
  background: string
  surface: string
  surfaceElevated: string
  hover: string
  border: string
  accent: string
  success: string
  info: string
  warning: string
  danger: string
  purple: string
  textPrimary: string
  textSecondary: string
  textMuted: string
}

export const darkColors: ColorTokens = {
  background: '#111314',
  surface: '#161819',
  surfaceElevated: '#161819',
  hover: '#1F2121',
  border: '#26292a',
  accent: '#A9B665',
  success: '#89B482',
  info: '#7DAEA3',
  warning: '#E78A4E',
  danger: '#EA6962',
  purple: '#D3869B',
  textPrimary: '#CECBC4',
  textSecondary: '#928f87',
  textMuted: 'rgba(247,243,234,0.36)',
}

export const amoledColors: ColorTokens = {
  background: '#000000',
  surface: '#000000',
  surfaceElevated: '#0c0c0c',
  hover: '#141414',
  border: '#0F0F0F',
  accent: '#A9B665',
  success: '#89B482',
  info: '#7DAEA3',
  warning: '#E78A4E',
  danger: '#EA6962',
  purple: '#D3869B',
  textPrimary: '#CECBC4',
  textSecondary: '#928f87',
  textMuted: 'rgba(247,243,234,0.36)',
}

export const lightColors: ColorTokens = {
  background: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFAF8',
  hover: '#F0EDE6',
  border: '#DDD7CC',
  accent: '#A9B665',
  success: '#89B482',
  info: '#7DAEA3',
  warning: '#E78A4E',
  danger: '#EA6962',
  purple: '#D3869B',
  textPrimary: '#262626',
  textSecondary: '#555555',
  textMuted: '#888888',
}

export const statusColors = {
  healthy: { fg: '#89B482', bg: 'rgba(137,180,130,0.1)', border: 'rgba(137,180,130,0.3)' },
  info: { fg: '#7DAEA3', bg: 'rgba(125,174,163,0.1)', border: 'rgba(125,174,163,0.3)' },
  warning: { fg: '#E78A4E', bg: 'rgba(231,138,78,0.1)', border: 'rgba(231,138,78,0.3)' },
  danger: { fg: '#EA6962', bg: 'rgba(234,105,98,0.1)', border: 'rgba(234,105,98,0.3)' },
  offline: { fg: '#888888', bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.3)' },
  unknown: { fg: '#888888', bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.3)' },
} as const
