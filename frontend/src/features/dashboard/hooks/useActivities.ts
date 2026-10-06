import { useQuery } from '@tanstack/react-query'

import { getActivities } from '@/api/activities'

export function useActivities(limit = 15) {
  return useQuery({
    queryKey: ['activities', limit],
    queryFn: () => getActivities(0, limit),
    refetchInterval: 5000,
    staleTime: 4000,
  })
}
