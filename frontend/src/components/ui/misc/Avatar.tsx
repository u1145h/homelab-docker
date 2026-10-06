import { forwardRef } from 'react'
import MuiAvatar, { type AvatarProps } from '@mui/material/Avatar'

export interface KuroAvatarProps extends AvatarProps {}

export const Avatar = forwardRef<HTMLDivElement, KuroAvatarProps>((props, ref) => (
  <MuiAvatar ref={ref} {...props} />
))

Avatar.displayName = 'Avatar'

export interface AvatarGroupProps {
  avatars: { alt?: string; src?: string; children?: string }[]
  max?: number
  className?: string
}

export function AvatarGroup({ avatars, max = 4, className }: AvatarGroupProps) {
  const visible = avatars.slice(0, max)
  const remaining = avatars.length - max

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((av, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar alt={av.alt} src={av.src}>
            {av.children}
          </Avatar>
        </div>
      ))}
      {remaining > 0 && (
        <div style={{ marginLeft: -8 }}>
          <Avatar>+{remaining}</Avatar>
        </div>
      )}
    </div>
  )
}
