import type { TypographyVariantsOptions } from '@mui/material/styles'
import { fontFamily, fontSize, fontWeight, lineHeight } from '@/design/typography'

export const typography: TypographyVariantsOptions = {
  fontFamily: fontFamily.sans,
  fontSize: fontSize.body,

  h1: { fontSize: fontSize.pageTitle, fontWeight: fontWeight.semibold, lineHeight: lineHeight.tight },
  h2: { fontSize: fontSize.heading, fontWeight: fontWeight.semibold, lineHeight: lineHeight.tight },
  h3: { fontSize: 16, fontWeight: fontWeight.semibold, lineHeight: lineHeight.tight },
  h4: { fontSize: 14, fontWeight: fontWeight.medium, lineHeight: lineHeight.normal },
  h5: { fontSize: 12, fontWeight: fontWeight.medium, lineHeight: lineHeight.normal },
  h6: { fontSize: fontSize.label, fontWeight: fontWeight.medium, lineHeight: lineHeight.normal },

  body1: { fontSize: fontSize.body, lineHeight: lineHeight.normal },
  body2: { fontSize: fontSize.body, lineHeight: lineHeight.normal },

  subtitle1: { fontSize: fontSize.body, fontWeight: fontWeight.medium, lineHeight: lineHeight.normal },
  subtitle2: { fontSize: fontSize.label, fontWeight: fontWeight.medium, lineHeight: lineHeight.normal },

  caption: { fontSize: fontSize.caption, lineHeight: lineHeight.relaxed },
  overline: { fontSize: fontSize.tiny, fontWeight: fontWeight.semibold, lineHeight: lineHeight.tight, letterSpacing: 0.5, textTransform: 'uppercase' },

  button: { fontSize: fontSize.body, fontWeight: fontWeight.medium, lineHeight: lineHeight.tight, textTransform: 'none' },
}
