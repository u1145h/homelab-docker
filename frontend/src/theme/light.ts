import { createTheme } from '@mui/material'
import { lightPalette } from './palette'
import { typography } from './typography'
import { getComponentOverrides } from './overrides'

export const lightTheme = createTheme({
  palette: lightPalette,
  typography,
  shape: { borderRadius: 8 },
  components: getComponentOverrides('light'),
})
