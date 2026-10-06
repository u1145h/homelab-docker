import { createTheme, type Theme } from '@mui/material'
import { darkPalette, amoledPalette } from './palette'
import { typography } from './typography'
import { getComponentOverrides } from './overrides'

export function getDarkTheme(amoled = false): Theme {
  return createTheme({
    palette: amoled ? amoledPalette : darkPalette,
    typography,
    shape: { borderRadius: 8 },
    components: getComponentOverrides('dark', amoled),
  })
}

export const darkTheme = getDarkTheme(false)
export const amoledTheme = getDarkTheme(true)
