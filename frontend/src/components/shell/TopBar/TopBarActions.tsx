import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material'
import { AppIcon } from '@/components/ui/icons'
import { useAuth } from '@/contexts/AuthContext'
import { radius } from '@/design/radius'
import { TopBarNotifications } from './TopBarNotifications'
import { PowerConfirmationModal } from '@/components/power/PowerConfirmationModal'
import { PowerStateOverlay } from '@/components/power/PowerStateOverlay'

export interface TopBarActionsProps {
  className?: string
}

export function TopBarActions({ className }: TopBarActionsProps) {
  const navigate = useNavigate()
  const { user, role, logout } = useAuth()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [openRebootModal, setOpenRebootModal] = useState(false)
  const [isRebooting, setIsRebooting] = useState(false)

  const open = Boolean(anchorEl)

  const handleMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)

  const handleLogout = async () => {
    handleClose()
    await logout()
    navigate('/login', { replace: true })
  }

  const handleOpenReboot = () => {
    handleClose()
    setOpenRebootModal(true)
  }

  const handleRebootSuccess = () => {
    setIsRebooting(true)
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {/* Notification Icon on left side of user menu */}
      <TopBarNotifications />

      {/* User menu */}
      <button
        type="button"
        onClick={handleMenu}
        aria-label="User menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderRadius: radius.button,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <Avatar
          sx={{
            width: 28,
            height: 28,
            backgroundColor: 'var(--kuro-color-hover)',
            color: 'var(--kuro-color-text-secondary)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {user?.username?.charAt(0).toUpperCase() ?? 'U'}
        </Avatar>
      </button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {user && (
          <MenuItem disabled sx={{ opacity: 1 }}>
            <ListItemIcon>
              <AppIcon name="user" size={16} />
            </ListItemIcon>
            <ListItemText primary={user.username} />
          </MenuItem>
        )}

        {role === 'admin' && (
          [
            <Divider key="div-power" sx={{ my: 0.5 }} />,
            <MenuItem key="item-reboot" onClick={handleOpenReboot}>
              <ListItemIcon>
                <AppIcon name="rotate-cw" size={16} style={{ color: 'var(--kuro-color-warning, #e6c384)' }} />
              </ListItemIcon>
              <ListItemText primary="Reboot Server" />
            </MenuItem>,
            <Divider key="div-logout" sx={{ my: 0.5 }} />,
          ]
        )}

        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <AppIcon name="log-out" size={16} />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </MenuItem>
      </Menu>

      {/* Confirmation Modal */}
      <PowerConfirmationModal
        open={openRebootModal}
        onClose={() => setOpenRebootModal(false)}
        onSuccess={handleRebootSuccess}
      />

      {/* Reboot Overlay */}
      <PowerStateOverlay active={isRebooting} />
    </div>
  )
}
