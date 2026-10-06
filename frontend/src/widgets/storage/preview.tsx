import { StorageWidget } from './Component'
import type { StorageWidgetProps } from './types'

const mockData: StorageWidgetProps = {
  data: {
    mounts: [
      { device: '/dev/loop0p2', mount: '/', filesystem: 'ext4', total: 119185342464, used: 100502998220, available: 18790481920, usage_percent: 84, read_only: false, type: 'root' },
      { device: '/dev/loop0p1', mount: '/boot', filesystem: 'ext2', total: 230686720, used: 76231475, available: 154455245, usage_percent: 33, read_only: false, type: 'boot' },
    ],
    summary: { total_capacity: 119400090828, used: 100610365849, free: 18790481920, physical_volumes: 2 },
    capacity_mix: [
      { name: '/ - ext4', total: 119185342464, used: 100502998220, color: 'var(--kuro-color-accent)' },
      { name: '/boot - ext2', total: 230686720, used: 76231475, color: 'var(--kuro-color-warning)' },
      { name: 'Free', total: 18790481920, used: 0, color: 'var(--kuro-color-text-muted)' },
    ],
    io_throughput: { read_mbps: 128.0, write_mbps: 64.0, iops: 1284, queue_depth: 2.4, await: 0.8 },
    block_devices: [
      { device: '/dev/nvme0n1', model: 'Samsung 980 Pro 1TB', size: 1000204886016, temp: '42°C', read: 197568495616, write: 77309411328, health: 'healthy' }
    ],
    filesystem_cache: {
      cached: 4509715660, buffers: 327155712, dirty: 18874368, hit_ratio: '98.4%', swap_used: 0, swap_total: 2147483648, inodes: '284k / 6.0M', scheduler: 'mq-deadline'
    }
  },
}

export function StoragePreview() {
  return <StorageWidget {...mockData} />
}
