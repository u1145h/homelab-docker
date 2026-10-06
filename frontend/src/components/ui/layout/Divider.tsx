import MuiDivider from '@mui/material/Divider'
import type { DividerProps as MuiDividerProps } from '@mui/material/Divider'

export type DividerVariant = 'fullWidth' | 'inset' | 'middle'

export interface DividerProps extends Omit<MuiDividerProps, 'variant'> {
  variant?: DividerVariant
  label?: string
}

export function Divider({ variant = 'fullWidth', label, ...props }: DividerProps) {
  return <MuiDivider variant={variant} {...(label ? { textAlign: 'center', children: label } : {})} {...props} />
}
