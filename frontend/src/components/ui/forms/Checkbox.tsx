import { forwardRef } from 'react'
import MuiCheckbox, { type CheckboxProps } from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'

export interface KuroCheckboxProps extends Omit<CheckboxProps, 'onChange'> {
  label?: string
  onChange?: (checked: boolean) => void
}

export const Checkbox = forwardRef<HTMLButtonElement, KuroCheckboxProps>(
  ({ label, onChange, checked, sx, ...props }, ref) => {
    const handleChange = (_: unknown, ch: boolean) => onChange?.(ch)
    const checkboxEl = <MuiCheckbox ref={ref} checked={checked} onChange={handleChange} sx={!label ? sx : undefined} {...props} />
    if (!label) return checkboxEl
    return <FormControlLabel control={checkboxEl} label={label} sx={sx} />
  },
)

Checkbox.displayName = 'Checkbox'
