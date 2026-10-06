import { forwardRef } from 'react'
import MuiSwitch, { type SwitchProps } from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'

export interface KuroSwitchProps extends Omit<SwitchProps, 'onChange'> {
  label?: string
  onChange?: (checked: boolean) => void
}

export const Switch = forwardRef<HTMLButtonElement, KuroSwitchProps>(
  ({ label, onChange, checked, ...props }, ref) => {
    const handleChange = (_: unknown, ch: boolean) => onChange?.(ch)
    const switchEl = <MuiSwitch ref={ref} checked={checked} onChange={handleChange} {...props} />
    if (!label) return switchEl
    return <FormControlLabel control={switchEl} label={label} />
  },
)

Switch.displayName = 'Switch'
