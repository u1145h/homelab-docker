import { Skeleton } from '@/components/ui/feedback'

export function TailscaleSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton width={100} height={42} />
      <Skeleton width="60%" height={14} />
      <Skeleton width="40%" height={14} />
    </div>
  )
}
