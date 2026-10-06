import { forwardRef } from 'react'
import MuiTextField, { type TextFieldProps } from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'

export interface SearchInputProps extends Omit<TextFieldProps, 'variant'> {
  variant?: 'outlined' | 'filled'
}

export const SearchInput = forwardRef<HTMLDivElement, SearchInputProps>(
  ({ variant = 'outlined', sx, ...props }, ref) => (
    <MuiTextField
      ref={ref}
      variant={variant}
      placeholder="Search\u2026"
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <AppIcon name="search" size={16} style={{ color: 'var(--kuro-color-text-muted)' }} />
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
  ),
)

SearchInput.displayName = 'SearchInput'
