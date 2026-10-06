export interface ActivityEvent {
  id: number
  type: string
  text: string
  timestamp: string
  icon: string
  color: string
}

export interface ActivitiesResponse {
  events: ActivityEvent[]
  total: number
}
