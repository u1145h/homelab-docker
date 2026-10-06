import { forwardRef } from 'react'
import MuiIconButton, { type IconButtonProps as MuiIconButtonProps } from '@mui/material/IconButton'
import { AppIcon, type IconName } from '@/components/ui/icons'

export interface ToolbarButtonProps extends Omit<MuiIconButtonProps, 'children'> {
  icon: IconName
  iconSize?: number
  label: string
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ icon, iconSize = 18, label, ...props }, ref) => (
    <MuiIconButton
      ref={ref}
      aria-label={label}
      size="small"
      sx={{
        borderRadius: 1,
        color: 'var(--kuro-color-text-secondary)',
        '&:hover': { backgroundColor: 'var(--kuro-color-hover)' },
      }}
      {...props}
    >
      <AppIcon name={icon} size={iconSize} />
    </MuiIconButton>
  ),
)

ToolbarButton.displayName = 'ToolbarButton'
