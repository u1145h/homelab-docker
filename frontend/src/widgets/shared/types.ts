import type { ReactNode, ReactElement } from 'react'
import type { IconName } from '@/components/ui/icons'

export const WidgetState = {
  Loading: 'loading',
  Empty: 'empty',
  Offline: 'offline',
  Error: 'error',
  Ready: 'ready',
} as const

export type WidgetState = (typeof WidgetState)[keyof typeof WidgetState]

export interface WidgetSize {
  width: number
  height: number
}

export interface WidgetMetadata {
  id: string
  title: string
  description: string
  icon: IconName
  category: string
  priority: number
  defaultSize: WidgetSize
  supportedSizes: WidgetSize[]
  permissions?: string[]
  experimental?: boolean
  refreshable?: boolean
  searchable?: boolean
  version: string
}

export interface WidgetDefinition<TProps = Record<string, unknown>> {
  metadata: WidgetMetadata
  component: React.ComponentType<TProps>
  render?: (props: TProps) => ReactElement
  skeleton: React.ComponentType
  empty: React.ComponentType
  error: React.ComponentType<{ error?: string; onRetry?: () => void }>
  preview: React.ComponentType
  selectData: (status: any) => TProps | null
}

export interface WidgetStateResult {
  state: WidgetState
  props: any
  error?: string
}

export interface WidgetCardSlotProps {
  widget: WidgetDefinition
  state: WidgetState
  size?: WidgetSize
  error?: string
  onRetry?: () => void
  children?: ReactNode
  className?: string
}
