import type { PaletteOptions } from '@mui/material'
import { darkColors, amoledColors, lightColors } from '@/design/colors'

export const lightPalette: PaletteOptions = {
  mode: 'light',
  primary: { main: lightColors.accent, contrastText: '#FFFFFF' },
  secondary: { main: lightColors.purple, contrastText: '#FFFFFF' },
  error: { main: lightColors.danger, contrastText: '#FFFFFF' },
  warning: { main: lightColors.warning, contrastText: '#000000' },
  info: { main: lightColors.info, contrastText: '#000000' },
  success: { main: lightColors.success, contrastText: '#000000' },
  background: { default: lightColors.background, paper: lightColors.surface },
  text: {
    primary: lightColors.textPrimary,
    secondary: lightColors.textSecondary,
    disabled: lightColors.textMuted,
  },
  divider: lightColors.border,
  action: {
    active: lightColors.textSecondary,
    hover: lightColors.hover,
    selected: lightColors.hover,
    disabled: lightColors.textMuted,
    disabledBackground: 'transparent',
  },
}

export function createDarkPalette(amoled = false): PaletteOptions {
  const colors = amoled ? amoledColors : darkColors
  return {
    mode: 'dark',
    primary: { main: colors.accent, contrastText: '#000000' },
    secondary: { main: colors.purple, contrastText: '#000000' },
    error: { main: colors.danger, contrastText: '#FFFFFF' },
    warning: { main: colors.warning, contrastText: '#000000' },
    info: { main: colors.info, contrastText: '#000000' },
    success: { main: colors.success, contrastText: '#000000' },
    background: { default: colors.background, paper: colors.surface },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textMuted,
    },
    divider: colors.border,
    action: {
      active: colors.textSecondary,
      hover: colors.hover,
      selected: colors.hover,
      disabled: colors.textMuted,
      disabledBackground: 'transparent',
    },
  }
}

export const darkPalette = createDarkPalette(false)
export const amoledPalette = createDarkPalette(true)
