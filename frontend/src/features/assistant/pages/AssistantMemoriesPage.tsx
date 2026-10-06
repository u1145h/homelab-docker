import AssistantLayout from './AssistantLayout'
import MemoryManagerTab from '../components/MemoryManagerTab'

export default function AssistantMemoriesPage() {
  return (
    <AssistantLayout title="Memories">
      {({ memories, addMemory, editMemory, removeMemory }) => (
        <MemoryManagerTab
          memories={memories}
          onAddMemory={addMemory}
          onEditMemory={editMemory}
          onDeleteMemory={removeMemory}
        />
      )}
    </AssistantLayout>
  )
}

