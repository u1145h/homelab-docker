import AssistantLayout from './AssistantLayout'
import ConnectedNodesTab from '../components/ConnectedNodesTab'

export default function AssistantClientsPage() {
  return (
    <AssistantLayout title="Connected Clients">
      {({ nodes, refresh }) => (
        <ConnectedNodesTab
          nodes={nodes}
          onRefresh={refresh}
        />
      )}
    </AssistantLayout>
  )
}
