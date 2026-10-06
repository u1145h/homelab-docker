import AssistantLayout from './AssistantLayout'
import ClientDataTab from '../components/ClientDataTab'

export default function AssistantDataPage() {
  return (
    <AssistantLayout title="Client Telemetry Data">
      {({ nodes, refresh }) => (
        <ClientDataTab
          nodes={nodes}
          onRefreshNodes={refresh}
        />
      )}
    </AssistantLayout>
  )
}
