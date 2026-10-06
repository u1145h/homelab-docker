import { defineWidget } from '@/widgets/registry'
import { StorageWidget } from './Component'
import { StorageSkeleton } from './skeleton'
import { StorageEmpty } from './empty'
import { StorageError } from './error'
import { StoragePreview } from './preview'
import { storageMetadata } from './metadata'
import { selectStorageWidgetData } from './formatter'
import type { StorageWidgetProps } from './types'

export const storageWidget = defineWidget<StorageWidgetProps>({
  metadata: storageMetadata,
  component: StorageWidget,
  skeleton: StorageSkeleton,
  empty: StorageEmpty,
  error: StorageError,
  preview: StoragePreview,
  selectData: selectStorageWidgetData,
})

export { StorageWidget } from './Component'
export { StorageSkeleton } from './skeleton'
export { StorageEmpty } from './empty'
export { StorageError } from './error'
export { StoragePreview } from './preview'
export { storageMetadata } from './metadata'
export { selectStorageWidgetData } from './formatter'
export type { StorageWidgetProps } from './types'
