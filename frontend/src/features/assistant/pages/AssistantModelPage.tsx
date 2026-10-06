import AssistantLayout from './AssistantLayout'
import ModelSettingsTab from '../components/ModelSettingsTab'

export default function AssistantModelPage() {
  return (
    <AssistantLayout title="Model & Inference">
      {({
        settings,
        modelsData,
        engineStatus,
        pullingModel,
        pullProgress,
        startingEngine,
        savingSettings,
        testingLLM,
        testResult,
        handlePullModel,
        handleDeleteModel,
        handleSetActiveModel,
        handleStartEngine,
        updateSettings,
        testLLM,
      }) => (
        <ModelSettingsTab
          settings={settings}
          modelsData={modelsData}
          engineStatus={engineStatus}
          pullingModel={pullingModel}
          pullProgress={pullProgress}
          startingEngine={startingEngine}
          saving={savingSettings}
          testing={testingLLM}
          testResult={testResult}
          onPullModel={handlePullModel}
          onDeleteModel={handleDeleteModel}
          onSetActiveModel={handleSetActiveModel}
          onStartEngine={handleStartEngine}
          onSave={updateSettings}
          onTestLLM={testLLM}
        />
      )}
    </AssistantLayout>
  )
}

