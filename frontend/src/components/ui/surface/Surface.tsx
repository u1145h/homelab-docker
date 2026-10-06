import type { ReactNode } from 'react'
import { styled } from '@mui/material'

const SurfaceRoot = styled('div')({
  backgroundColor: 'var(--kuro-color-surface)',
  borderRadius: 8,
})

export interface SurfaceProps {
  border?: boolean
  children?: ReactNode
  className?: string
}

export function Surface({ border = false, children, className }: SurfaceProps) {
  return (
    <SurfaceRoot
      className={className}
      style={{
        border: border ? '1px solid var(--kuro-color-border)' : undefined,
      }}
    >
      {children}
    </SurfaceRoot>
  )
}
