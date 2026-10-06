import { forwardRef } from 'react'
import MuiSelect, { type SelectProps } from '@mui/material/Select'
import MuiMenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import { radius } from '@/design/radius'

export interface SelectOption {
  value: string | number
  label: string
}

export interface KuroSelectProps extends Omit<SelectProps, 'children'> {
  options: SelectOption[]
  label?: string
}

export const Select = forwardRef<HTMLDivElement, KuroSelectProps>(
  ({ options, label, sx, ...props }, ref) => {
    const select = (
      <MuiSelect
        ref={ref}
        sx={{
          borderRadius: radius.input,
          ...sx,
        }}
        {...props}
      >
        {options.map((opt) => (
          <MuiMenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MuiMenuItem>
        ))}
      </MuiSelect>
    )

    if (!label) return select

    return (
      <FormControl fullWidth={props.fullWidth}>
        <InputLabel>{label}</InputLabel>
        {select}
      </FormControl>
    )
  },
)

Select.displayName = 'Select'
