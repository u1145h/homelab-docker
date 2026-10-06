export type StatusType = 'healthy' | 'info' | 'warning' | 'danger' | 'offline' | 'unknown'

export interface StatusConfig {
  color: string
  background: string
  border: string
  icon: string
  label: string
}

export const statusConfig: Record<StatusType, StatusConfig> = {
  healthy: {
    color: '#89B482',
    background: 'rgba(137,180,130,0.1)',
    border: 'rgba(137,180,130,0.3)',
    icon: 'check-circle',
    label: 'Healthy',
  },
  info: {
    color: '#7DAEA3',
    background: 'rgba(125,174,163,0.1)',
    border: 'rgba(125,174,163,0.3)',
    icon: 'info',
    label: 'Info',
  },
  warning: {
    color: '#E78A4E',
    background: 'rgba(231,138,78,0.1)',
    border: 'rgba(231,138,78,0.3)',
    icon: 'alert-triangle',
    label: 'Warning',
  },
  danger: {
    color: '#EA6962',
    background: 'rgba(234,105,98,0.1)',
    border: 'rgba(234,105,98,0.3)',
    icon: 'x-circle',
    label: 'Danger',
  },
  offline: {
    color: '#888888',
    background: 'rgba(136,136,136,0.1)',
    border: 'rgba(136,136,136,0.3)',
    icon: 'circle-off',
    label: 'Offline',
  },
  unknown: {
    color: '#888888',
    background: 'rgba(136,136,136,0.1)',
    border: 'rgba(136,136,136,0.3)',
    icon: 'help-circle',
    label: 'Unknown',
  },
}
