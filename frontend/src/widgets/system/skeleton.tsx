import { Skeleton } from '@/components/ui/feedback'

export function SystemSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton width={140} height={20} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="60%" height={14} />
      <Skeleton width="50%" height={14} />
    </div>
  )
}
