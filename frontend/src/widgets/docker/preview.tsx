import { DockerWidget } from './Component'
import type { DockerWidgetProps } from './types'

const mockData: DockerWidgetProps = {
  data: {
    containers: [
      { id: 'abc123def456', name: 'nginx', image: 'nginx:latest', state: 'running', status: 'Up 2 days' },
      { id: 'ghi789jkl012', name: 'redis', image: 'redis:7', state: 'running', status: 'Up 5 days' },
      { id: 'mno345pqr678', name: 'postgres', image: 'postgres:16', state: 'exited', status: 'Exited 3 hours ago' },
    ],
  },
}

export function DockerPreview() {
  return <DockerWidget {...mockData} />
}
