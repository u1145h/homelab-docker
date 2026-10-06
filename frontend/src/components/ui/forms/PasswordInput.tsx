import { useState, forwardRef } from 'react'
import MuiTextField, { type TextFieldProps } from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'

export interface PasswordInputProps extends Omit<TextFieldProps, 'type' | 'variant'> {
  variant?: 'outlined' | 'filled'
}

export const PasswordInput = forwardRef<HTMLDivElement, PasswordInputProps>(
  ({ variant = 'outlined', sx, ...props }, ref) => {
    const [visible, setVisible] = useState(false)

    return (
      <MuiTextField
        ref={ref}
        variant={variant}
        type={visible ? 'text' : 'password'}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  onClick={() => setVisible((v) => !v)}
                  edge="end"
                  size="small"
                >
                  <AppIcon name={visible ? 'eye-off' : 'eye'} size={16} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: radius.input,
          },
          ...sx,
        }}
        {...props}
      />
    )
  },
)

PasswordInput.displayName = 'PasswordInput'
