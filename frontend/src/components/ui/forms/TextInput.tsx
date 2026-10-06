import { forwardRef } from 'react'
import MuiTextField, { type TextFieldProps } from '@mui/material/TextField'
import { radius } from '@/design/radius'

export interface TextInputProps extends Omit<TextFieldProps, 'variant'> {
  variant?: 'outlined' | 'filled'
}

export const TextInput = forwardRef<HTMLDivElement, TextInputProps>(
  ({ variant = 'outlined', sx, ...props }, ref) => (
    <MuiTextField
      ref={ref}
      variant={variant}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: radius.input,
        },
        ...sx,
      }}
      {...props}
    />
  ),
)

TextInput.displayName = 'TextInput'
