import { forwardRef } from 'react'
import MuiIconButton, { type IconButtonProps as MuiIconButtonProps } from '@mui/material/IconButton'
import { AppIcon, type IconName } from '@/components/ui/icons'

export interface IconButtonProps extends Omit<MuiIconButtonProps, 'children'> {
  icon: IconName
  iconSize?: number
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, iconSize = 18, label, ...props }, ref) => (
    <MuiIconButton ref={ref} aria-label={label} {...props}>
      <AppIcon name={icon} size={iconSize} />
    </MuiIconButton>
  ),
)

IconButton.displayName = 'IconButton'
