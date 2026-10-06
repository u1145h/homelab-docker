import { forwardRef } from 'react'
import MuiButton, { type ButtonProps as MuiButtonProps } from '@mui/material/Button'
import { radius } from '@/design/radius'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends Omit<MuiButtonProps, 'variant' | 'color'> {
  variant?: ButtonVariant
}

const variantMap: Record<ButtonVariant, MuiButtonProps['variant']> = {
  primary: 'contained',
  secondary: 'outlined',
  ghost: 'text',
  danger: 'contained',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', sx, ...props }, ref) => {
    const muiVariant = variantMap[variant]
    return (
      <MuiButton
        ref={ref}
        variant={muiVariant}
        color={variant === 'danger' ? 'error' : 'primary'}
        sx={{
          borderRadius: radius.button,
          textTransform: 'none',
          fontWeight: 500,
          ...sx,
        }}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'
