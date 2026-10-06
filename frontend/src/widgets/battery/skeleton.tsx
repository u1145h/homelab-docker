import { Skeleton } from '@/components/ui/feedback'

export function BatterySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        <Skeleton width={80} height={42} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Skeleton width={8} height={8} borderRadius={8} />
          <Skeleton width={70} height={13} />
        </div>
      </div>
      <Skeleton width="100%" height={4} borderRadius={4} />
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Skeleton width={40} height={11} />
          <Skeleton width={50} height={13} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Skeleton width={30} height={11} />
          <Skeleton width={50} height={13} />
        </div>
      </div>
      <Skeleton width="50%" height={11} />
    </div>
  )
}
