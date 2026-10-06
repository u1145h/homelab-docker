import { Skeleton } from '@/components/ui/feedback'

export function DockerSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Skeleton width={8} height={8} borderRadius={8} />
        <Skeleton width={80} height={13} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="100%" height={28} />
        <Skeleton width="100%" height={28} />
        <Skeleton width="100%" height={28} />
      </div>
      <Skeleton width="50%" height={11} />
      <Skeleton width="100%" height={1} />
      <Skeleton width={110} height={12} />
    </div>
  )
}
