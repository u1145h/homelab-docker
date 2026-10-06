import { defineWidget } from '@/widgets/registry'
import { DockerWidget } from './Component'
import { DockerSkeleton } from './skeleton'
import { DockerEmpty } from './empty'
import { DockerError } from './error'
import { DockerPreview } from './preview'
import { dockerMetadata } from './metadata'
import { selectDockerWidgetData } from './formatter'
import type { DockerWidgetProps } from './types'

export const dockerWidget = defineWidget<DockerWidgetProps>({
  metadata: dockerMetadata,
  component: DockerWidget,
  skeleton: DockerSkeleton,
  empty: DockerEmpty,
  error: DockerError,
  preview: DockerPreview,
  selectData: selectDockerWidgetData,
})

export { DockerWidget } from './Component'
export { DockerSkeleton } from './skeleton'
export { DockerEmpty } from './empty'
export { DockerError } from './error'
export { DockerPreview } from './preview'
export { dockerMetadata } from './metadata'
export { selectDockerWidgetData } from './formatter'
export type { DockerWidgetProps } from './types'
