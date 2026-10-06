import AssistantLayout from './AssistantLayout'
import ServerIntegrationsTab from '../components/ServerIntegrationsTab'

export default function AssistantServerConfigPage() {
  return (
    <AssistantLayout title="Integration">
      {() => (
        <ServerIntegrationsTab />
      )}
    </AssistantLayout>
  )
}
