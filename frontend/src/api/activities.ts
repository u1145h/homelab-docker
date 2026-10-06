import api from './client'

import type { ActivitiesResponse } from '../types/activity'

export async function getActivities(offset = 0, limit = 15): Promise<ActivitiesResponse> {
  const { data } = await api.get<ActivitiesResponse>('/activities', {
    params: { offset, limit },
  })
  return data
}
