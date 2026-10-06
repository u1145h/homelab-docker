export interface SystemWidgetData {
  hostname: string
  os: string
  kernel: string
  arch: string
  uptime: string
  runningContainers: number
  totalContainers: number
  goVersion: string
}

export interface SystemWidgetProps {
  data: SystemWidgetData
}
