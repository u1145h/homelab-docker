export type StatusLevel = 'success' | 'warning' | 'danger'

export interface MetricStatus {
  label: string
  level: StatusLevel
  colorVar: string
}

export interface StatusThresholds {
  warning: number
  critical: number
}

const defaultThresholds: StatusThresholds = { warning: 70, critical: 90 }

export function getMetricStatus(
  percent: number,
  thresholds?: Partial<StatusThresholds>,
): MetricStatus {
  const { warning, critical } = { ...defaultThresholds, ...thresholds }
  if (percent > critical) {
    return { label: 'Critical', level: 'danger', colorVar: 'var(--kuro-color-danger)' }
  }
  if (percent > warning) {
    return { label: 'Warning', level: 'warning', colorVar: 'var(--kuro-color-warning)' }
  }
  return { label: 'Healthy', level: 'success', colorVar: 'var(--kuro-color-success)' }
}
