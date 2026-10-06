import type { Components, Theme } from '@mui/material'
import { radius } from '@/design/radius'
import { motion } from '@/design/motion'
import { fontSize, fontWeight } from '@/design/typography'
import { darkColors, amoledColors, lightColors } from '@/design/colors'

const transition = `background-color ${motion.duration.normal}ms ${motion.easing.default}, border-color ${motion.duration.normal}ms ${motion.easing.default}, opacity ${motion.duration.normal}ms ${motion.easing.default}, color ${motion.duration.normal}ms ${motion.easing.default}`

export function getComponentOverrides(mode: 'dark' | 'light', amoled = false): Components<Theme> {
  const isDark = mode === 'dark'
  const colors = isDark ? (amoled ? amoledColors : darkColors) : lightColors
  const dividerColor = colors.border
  const hoverBg = colors.hover
  const surfaceBg = colors.surface
  const backgroundBg = colors.background
  const textMuted = colors.textMuted
  const accentColor = colors.accent
  const inputBg = isDark ? (amoled ? '#000000' : '#111314') : '#F6F4EF'
  const skeletonBg = isDark ? (amoled ? '#121212' : '#1F2121') : '#E8E4DA'
  const tooltipBg = isDark ? (amoled ? '#111213' : '#1B1D1E') : '#FFFFFF'

  return {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: surfaceBg,
          border: `1px solid ${dividerColor}`,
          borderRadius: radius.card,
          boxShadow: 'none',
          transition,
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: radius.card,
          border: `1px solid ${dividerColor}`,
          boxShadow: 'none',
          transition,
          '&:hover': {
            backgroundColor: hoverBg,
            borderColor: isDark ? '#3D3D3D' : '#C8C0B0',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: true },
      styleOverrides: {
        root: {
          borderRadius: radius.button,
          textTransform: 'none',
          fontWeight: fontWeight.medium,
          fontSize: fontSize.body,
          lineHeight: 1.2,
          padding: '8px 20px',
          minHeight: 40,
          transition,
          '&:hover': { opacity: 0.85 },
          '&:active': { opacity: 0.75 },
        },
        contained: {
          color: '#000000',
          backgroundColor: accentColor,
          '&:hover': { backgroundColor: accentColor, opacity: 0.85 },
        },
        outlined: {
          borderColor: dividerColor,
          color: isDark ? '#F7F3EA' : '#262626',
          '&:hover': {
            backgroundColor: hoverBg,
            borderColor: accentColor,
          },
        },
        text: {
          color: isDark ? '#F7F3EA' : '#262626',
          '&:hover': { backgroundColor: hoverBg },
        },
      },
    },
    MuiIconButton: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          borderRadius: radius.button,
          transition,
          '&:hover': { backgroundColor: hoverBg },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: radius.badge,
          fontSize: fontSize.caption,
          fontWeight: fontWeight.medium,
          height: 24,
        },
        filled: { backgroundColor: hoverBg },
        outlined: { borderColor: dividerColor },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: backgroundBg,
          borderRight: 'none',
          boxShadow: 'none',
          borderRadius: 0,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: {
          backgroundColor: surfaceBg,
          borderBottom: `1px solid ${dividerColor}`,
          boxShadow: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radius.modal,
          boxShadow: 'none',
          border: `1px solid ${dividerColor}`,
          backgroundImage: 'none',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: fontSize.heading,
          fontWeight: fontWeight.semibold,
          padding: '24px 24px 8px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '8px 24px 16px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 24px 24px',
          gap: 8,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          boxShadow: 'none',
          border: `1px solid ${dividerColor}`,
          backgroundImage: 'none',
        },
        list: { padding: 4 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: fontSize.body,
          transition,
          '&:hover': { backgroundColor: hoverBg },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tooltipBg,
          border: `1px solid ${dividerColor}`,
          borderRadius: 8,
          color: isDark ? '#F7F3EA' : '#262626',
          fontSize: fontSize.caption,
          padding: '6px 12px',
          boxShadow: 'none',
        },
        arrow: { color: tooltipBg },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: radius.input,
            backgroundColor: inputBg,
            transition,
            '& fieldset': {
              borderColor: dividerColor,
              borderWidth: 1,
            },
            '&:hover fieldset': {
              borderColor: isDark ? '#3D3D3D' : '#C8C0B0',
            },
            '&.Mui-focused fieldset': {
              borderColor: accentColor,
              borderWidth: 1,
            },
            '&.Mui-error fieldset': {
              borderColor: isDark ? '#EA6962' : '#D32F2F',
            },
            '&.Mui-disabled': {
              opacity: 0.5,
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: fontSize.body,
            color: isDark ? 'rgba(247,243,234,0.36)' : '#888888',
            '&.Mui-focused': {
              color: accentColor,
            },
          },
          '& .MuiInputBase-input': {
            fontSize: fontSize.body,
            padding: '12px 14px',
          },
          '& .MuiFormHelperText-root': {
            fontSize: fontSize.caption,
            marginTop: 4,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.input,
          backgroundColor: inputBg,
          transition,
          '& fieldset': { borderColor: dividerColor, borderWidth: 1 },
          '&:hover fieldset': { borderColor: isDark ? '#3D3D3D' : '#C8C0B0' },
          '&.Mui-focused fieldset': { borderColor: accentColor, borderWidth: 1 },
        },
        input: {
          fontSize: fontSize.body,
          padding: '12px 14px',
          '&::placeholder': { color: textMuted, opacity: 1 },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: fontSize.body,
          '&.Mui-disabled': { opacity: 0.5 },
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          '& .MuiFormLabel-root': {
            fontSize: fontSize.body,
            color: textMuted,
            '&.Mui-focused': { color: accentColor },
          },
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontSize: fontSize.body,
          color: textMuted,
          '&.Mui-focused': { color: accentColor },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          padding: '12px 14px',
          fontSize: fontSize.body,
        },
        icon: {
          color: textMuted,
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          borderCollapse: 'separate',
          borderSpacing: 0,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.caption,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: textMuted,
            borderBottom: `1px solid ${dividerColor}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${dividerColor}`,
          fontSize: fontSize.body,
          padding: '12px 16px',
          color: isDark ? '#F7F3EA' : '#262626',
        },
        head: {
          fontWeight: fontWeight.semibold,
          fontSize: fontSize.caption,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: textMuted,
          borderBottom: `1px solid ${dividerColor}`,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition,
          '&:hover': { backgroundColor: hoverBg },
          '&:last-child .MuiTableCell-body': { borderBottom: 'none' },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: dividerColor,
          borderWidth: '0 0 1px',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 4,
          borderRadius: 2,
          backgroundColor: isDark ? '#2B2D2D' : '#DDD7CC',
        },
        bar: {
          borderRadius: 2,
          backgroundColor: accentColor,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          color: accentColor,
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: skeletonBg,
          borderRadius: radius.skeleton,
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          padding: 0,
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          padding: '8px 16px',
          borderRadius: 6,
          transition,
          '&:hover': { backgroundColor: hoverBg },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '8px 16px',
          transition,
          '&:hover': { backgroundColor: hoverBg },
          '&.Mui-selected': {
            backgroundColor: isDark ? 'rgba(169,182,101,0.1)' : 'rgba(169,182,101,0.1)',
            '&:hover': { backgroundColor: isDark ? 'rgba(169,182,101,0.15)' : 'rgba(169,182,101,0.15)' },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 36,
          color: 'inherit',
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: fontSize.body,
          fontWeight: fontWeight.medium,
        },
        secondary: {
          fontSize: fontSize.caption,
          color: textMuted,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: radius.card,
          border: `1px solid ${dividerColor}`,
          boxShadow: 'none',
          backgroundImage: 'none',
          backgroundColor: 'transparent',
          '&:before': { display: 'none' },
          '&.Mui-expanded': { margin: 0 },
          '&:first-of-type': { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
          '&:last-of-type': { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          borderRadius: radius.card,
          padding: '0 16px',
          minHeight: 48,
          '&.Mui-expanded': { minHeight: 48 },
          '&:hover': { backgroundColor: hoverBg },
        },
        content: {
          margin: '12px 0',
          '&.Mui-expanded': { margin: '12px 0' },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: '8px 16px 16px',
          borderTop: `1px solid ${dividerColor}`,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 40,
          borderBottom: `1px solid ${dividerColor}`,
        },
        indicator: {
          backgroundColor: accentColor,
          height: 2,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: fontWeight.medium,
          fontSize: fontSize.body,
          minHeight: 40,
          padding: '8px 16px',
          color: textMuted,
          transition,
          '&:hover': { color: isDark ? '#F7F3EA' : '#262626' },
          '&.Mui-selected': { color: accentColor },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: radius.card,
          border: `1px solid ${dividerColor}`,
          padding: '12px 16px',
          fontSize: fontSize.body,
          backgroundImage: 'none',
          color: isDark ? '#F7F3EA' : '#262626',
          '&.MuiAlert-standardSuccess': {
            backgroundColor: 'rgba(137,180,130,0.1)',
            borderColor: 'rgba(137,180,130,0.3)',
          },
          '&.MuiAlert-standardInfo': {
            backgroundColor: 'rgba(125,174,163,0.1)',
            borderColor: 'rgba(125,174,163,0.3)',
          },
          '&.MuiAlert-standardWarning': {
            backgroundColor: 'rgba(231,138,78,0.1)',
            borderColor: 'rgba(231,138,78,0.3)',
          },
          '&.MuiAlert-standardError': {
            backgroundColor: 'rgba(234,105,98,0.1)',
            borderColor: 'rgba(234,105,98,0.3)',
          },
        },
        icon: { marginRight: 12 },
        message: { padding: 0 },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': {
            border: `1px solid ${dividerColor}`,
            boxShadow: 'none',
            backgroundImage: 'none',
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 44,
          height: 24,
          padding: 0,
          '& .MuiSwitch-switchBase': {
            padding: 2,
            '&.Mui-checked': {
              transform: 'translateX(20px)',
              color: '#FFFFFF',
              '& + .MuiSwitch-track': { backgroundColor: accentColor, opacity: 1 },
            },
          },
          '& .MuiSwitch-thumb': {
            width: 20,
            height: 20,
            boxShadow: 'none',
          },
          '& .MuiSwitch-track': {
            borderRadius: 12,
            backgroundColor: isDark ? '#2B2D2D' : '#DDD7CC',
            opacity: 1,
          },
        },
      },
    },
    MuiCheckbox: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          color: dividerColor,
          borderRadius: 4,
          transition,
          '&.Mui-checked': { color: accentColor },
          '&:hover': { backgroundColor: hoverBg },
        },
      },
    },
    MuiRadio: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          color: dividerColor,
          transition,
          '&.Mui-checked': { color: accentColor },
          '&:hover': { backgroundColor: hoverBg },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          boxShadow: 'none',
          border: `1px solid ${dividerColor}`,
          backgroundImage: 'none',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
        },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: {
        separator: { color: textMuted },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: accentColor,
          color: '#000000',
          fontWeight: fontWeight.semibold,
          fontSize: fontSize.body,
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontSize: 10,
          height: 18,
          minWidth: 18,
        },
      },
    },
  }
}
