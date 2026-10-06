import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import type { KuroSettings, ModelsData, EngineStatus, PullProgress } from '../types'
import type { TestLLMResult } from '../api/assistant'

export interface ProviderReference {
  name: string
  baseUrl: string
  defaultModel: string
  authScheme: string
  endpoint: string
  popularModels: string
  notes?: string
}

export const PROVIDER_REFERENCE_MATRIX: ProviderReference[] = [
  {
    name: 'Cactus Compute Engine',
    baseUrl: 'http://localhost:8088/v1',
    defaultModel: 'cactus-needle-2',
    authScheme: 'Bearer none (Local Sidecar)',
    endpoint: '/v1/chat/completions',
    popularModels: 'cactus-needle-2, cactus-needle-1',
    notes: 'High-speed edge inference runtime for tiny agentic SLMs.',
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    authScheme: 'Bearer sk-...',
    endpoint: '/v1/chat/completions',
    popularModels: 'gpt-4o-mini, gpt-4o, o3-mini',
  },
  {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
    authScheme: 'x-api-key: sk-ant-...',
    endpoint: '/v1/messages',
    popularModels: 'claude-3-5-haiku-20241022, claude-3-7-sonnet',
  },
  {
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    authScheme: 'Bearer gsk_...',
    endpoint: '/openai/v1/chat/completions',
    popularModels: 'llama-3.3-70b-versatile, llama-3.1-8b-instant',
  },
  {
    name: 'Nvidia NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    authScheme: 'Bearer nvapi-...',
    endpoint: '/v1/chat/completions',
    popularModels: 'meta/llama-3.3-70b-instruct, deepseek-ai/deepseek-r1',
  },
  {
    name: 'Google Gemini (OpenAI Mode)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    authScheme: 'Bearer AIzaSy...',
    endpoint: '/openai/chat/completions',
    popularModels: 'gemini-2.0-flash, gemini-1.5-flash',
  },
  {
    name: 'DeepSeek Official',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    authScheme: 'Bearer sk-...',
    endpoint: '/v1/chat/completions',
    popularModels: 'deepseek-chat (V3), deepseek-reasoner (R1)',
  },
  {
    name: 'OpenRouter Gateway',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-haiku',
    authScheme: 'Bearer sk-or-...',
    endpoint: '/v1/chat/completions',
    popularModels: 'anthropic/claude-3.5-haiku, meta-llama/llama-3.3-70b-instruct',
  },
  {
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    authScheme: 'Bearer ...',
    endpoint: '/v1/chat/completions',
    popularModels: 'mistral-small-latest, codestral-latest',
  },
  {
    name: 'Ollama (Local / LAN Server)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:3b',
    authScheme: 'Bearer ollama (optional)',
    endpoint: '/v1/chat/completions',
    popularModels: 'qwen2.5:3b, llama3.2:3b, mistral:7b',
  },
]

export interface ModelSettingsTabProps {
  settings: KuroSettings | null
  modelsData?: ModelsData | null
  engineStatus?: EngineStatus | null
  pullingModel?: string | null
  pullProgress?: PullProgress | null
  startingEngine?: boolean
  saving: boolean
  testing?: boolean
  testResult?: TestLLMResult | null
  onSave: (updated: Partial<KuroSettings>) => Promise<void>
  onTestLLM?: (payload: { base_url?: string; model?: string; provider?: string; api_key?: string }) => Promise<TestLLMResult>
  onPullModel?: (name: string) => Promise<void>
  onDeleteModel?: (name: string) => Promise<void>
  onSetActiveModel?: (name: string) => Promise<void>
  onStartEngine?: () => Promise<void>
}

export default function ModelSettingsTab({
  settings,
  saving,
  onSave,
  onTestLLM,
}: ModelSettingsTabProps) {
  const [baseUrl, setBaseUrl] = useState(settings?.base_url || 'http://127.0.0.1:8088')
  const [temperature, setTemperature] = useState(settings?.temperature ?? 0.7)
  const [maxTokens, setMaxTokens] = useState(settings?.max_tokens ?? 2048)
  const [contextMsgs, setContextMsgs] = useState(settings?.context_msgs ?? 30)
  const [memoryRetrieve, setMemoryRetrieve] = useState(settings?.memory_retrieve ?? 10)

  // Cloud state
  const [cloudEnabled, setCloudEnabled] = useState(settings?.cloud_enabled ?? false)
  const [cloudModel, setCloudModel] = useState(settings?.cloud_model ?? 'gpt-4o-mini')
  const [cloudBaseUrl, setCloudBaseUrl] = useState(settings?.cloud_base_url ?? '')
  const [cloudApiKey, setCloudApiKey] = useState('')
  const [savingCloud, setSavingCloud] = useState(false)
  const [testingCloud, setTestingCloud] = useState(false)
  const [cloudTestResult, setCloudTestResult] = useState<TestLLMResult | null>(null)

  useEffect(() => {
    if (settings) {
      setBaseUrl(settings.base_url || 'http://127.0.0.1:8088')
      setTemperature(settings.temperature ?? 0.7)
      setMaxTokens(settings.max_tokens ?? 2048)
      setContextMsgs(settings.context_msgs ?? 30)
      setMemoryRetrieve(settings.memory_retrieve ?? 10)

      setCloudEnabled(settings.cloud_enabled ?? false)
      if (settings.cloud_model) setCloudModel(settings.cloud_model)
      if (settings.cloud_base_url) setCloudBaseUrl(settings.cloud_base_url)
    }
  }, [settings])

  const handleCloudToggle = async (enabled: boolean) => {
    setCloudEnabled(enabled)
    await onSave({ cloud_enabled: enabled })
  }

  const [showReferenceModal, setShowReferenceModal] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  const handleApplyReference = (ref: ProviderReference) => {
    setCloudBaseUrl(ref.baseUrl)
    setCloudModel(ref.defaultModel)
    setShowReferenceModal(false)
  }

  const handleSaveCloudConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCloud(true)
    setCloudTestResult(null)
    try {
      const payload: Partial<KuroSettings> = {
        cloud_provider: 'custom',
        cloud_model: cloudModel.trim(),
        cloud_base_url: cloudBaseUrl.trim(),
      }
      if (cloudApiKey.trim()) {
        payload.cloud_api_key = cloudApiKey.trim()
      }
      await onSave(payload)
      setCloudApiKey('') // clear write-only field after successful save
    } finally {
      setSavingCloud(false)
    }
  }

  const handleTestCloudConnection = async () => {
    if (!onTestLLM) return
    setTestingCloud(true)
    setCloudTestResult(null)
    try {
      const res = await onTestLLM({
        provider: 'custom',
        model: cloudModel.trim(),
        api_key: cloudApiKey.trim() || undefined,
        base_url: cloudBaseUrl.trim() || undefined,
      })
      setCloudTestResult(res)
    } finally {
      setTestingCloud(false)
    }
  }

  const handleSaveHyperparams = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      base_url: baseUrl.trim(),
      temperature,
      max_tokens: maxTokens,
      context_msgs: contextMsgs,
      memory_retrieve: memoryRetrieve,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 0A. Assistant Operation Mode Selector */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AppIcon name="zap" size={18} style={{ color: '#10B981' }} />
              <span>Cactus Needle Intelligence Engine</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                ACTIVE & DEFAULT
              </span>
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--kuro-color-text-muted)' }}>
              Unified on-device and server agent engine powered by Cactus Needle 2 (45M SLM).
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              ⚡ &lt;15ms Latency
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              💾 ~14 MB RAM
            </span>
          </div>
        </div>

        {/* Engine Information Card */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: radius.input,
            fontSize: 12,
            lineHeight: '1.5',
            backgroundColor: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: 'var(--kuro-color-text-primary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ marginTop: 2 }}>
            <AppIcon
              name="zap"
              size={18}
              style={{ color: '#10B981' }}
            />
          </div>
          <div>
            <strong>🌵 Cactus Needle Engine (Primary Universal Agent):</strong> High-speed 45M parameter agentic micro-model engineered specifically for instant tool execution, device hardware automation, personal data querying (calendar, contacts, calls, notes, telemetry), and background autonomous self-learning memory extraction with zero cloud data exposure.
          </div>
        </div>
      </div>

      {/* 0B. Third-Party Provider Integration & Privacy Firewall */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AppIcon name="globe" size={18} style={{ color: cloudEnabled ? '#10B981' : 'var(--kuro-color-text-muted)' }} />
              <span>Third-Party Provider Integration</span>
              {cloudEnabled && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--kuro-color-success)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  ACTIVE
                </span>
              )}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--kuro-color-text-muted)' }}>
              Optionally route assistant queries to external cloud models (OpenAI, Claude, Groq, Nvidia, Gemini).
            </p>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            id="cloud-provider-toggle"
            role="switch"
            aria-checked={cloudEnabled}
            onClick={() => handleCloudToggle(!cloudEnabled)}
            style={{
              position: 'relative',
              width: 50,
              height: 28,
              borderRadius: 14,
              backgroundColor: cloudEnabled ? 'var(--kuro-color-success)' : 'var(--kuro-color-surface-hover)',
              border: `1px solid ${cloudEnabled ? 'var(--kuro-color-success)' : 'var(--kuro-color-border)'}`,
              cursor: 'pointer',
              outline: 'none',
              padding: 0,
              transition: 'all 0.2s ease',
              boxShadow: cloudEnabled ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: cloudEnabled ? 24 : 2,
                width: 22,
                height: 22,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
              }}
            />
          </button>
        </div>

        {/* 🔒 Strict Privacy Sandbox Firewall Guarantee Banner */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: radius.input,
            fontSize: 12,
            lineHeight: '1.5',
            backgroundColor: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: 'var(--kuro-color-text-primary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <div style={{ marginTop: 2 }}>
            <AppIcon name="shield-alert" size={16} style={{ color: 'var(--kuro-color-success)' }} />
          </div>
          <div>
            <strong style={{ color: 'var(--kuro-color-success)' }}>Strict Privacy Firewall Sandbox:</strong>{' '}
            Third-party cloud models are <strong>hard-blocked</strong> from accessing any of your personal data (contacts, phone calls, SMS messages, calendar events, photos, notes, camera, files, and server infrastructure).
            They are strictly restricted to <strong>web searches, public Wikipedia lookups, and internet knowledge retrieval</strong>. Your private data never leaves your homelab.
          </div>
        </div>

        {/* Cloud Configuration Form (Expanded when cloudEnabled is ON) */}
        {cloudEnabled && (
          <form
            onSubmit={handleSaveCloudConfig}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              paddingTop: 8,
              borderTop: '1px solid var(--kuro-color-border-subtle)',
            }}
          >
            {/* Header with Help/Reference trigger */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                  Custom OpenAI-Compatible Endpoint
                </label>
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                  Route assistant inference through any self-hosted gateway or 3rd-party provider endpoint.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowReferenceModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid var(--kuro-color-primary)',
                  borderRadius: radius.button,
                  padding: '6px 12px',
                  color: 'var(--kuro-color-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <AppIcon name="help-circle" size={14} />
                <span>Provider Reference & Help</span>
              </button>
            </div>

            {/* Custom Base URL & Model Name Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>
                    Custom Base URL
                  </label>
                  <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)' }}>OpenAI-compatible URL</span>
                </div>
                <input
                  type="text"
                  value={cloudBaseUrl}
                  onChange={(e) => setCloudBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1 or http://192.168.1.X:11434/v1"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--kuro-color-surface-input)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.input,
                    padding: '8px 12px',
                    color: 'var(--kuro-color-text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: cloudBaseUrl ? 'monospace' : 'inherit',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>
                    Model Identifier
                  </label>
                  <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)' }}>Target Model ID</span>
                </div>
                <input
                  type="text"
                  value={cloudModel}
                  onChange={(e) => setCloudModel(e.target.value)}
                  placeholder="e.g. gpt-4o-mini, llama-3.3-70b-versatile, deepseek-chat"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--kuro-color-surface-input)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.input,
                    padding: '8px 12px',
                    color: 'var(--kuro-color-text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* API Key Input with Write-Only Security & Masked Status */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>
                  API Key (Stored Encrypted AES-256-GCM)
                </label>
                {settings?.has_cloud_api_key && (
                  <span style={{ fontSize: 11, color: 'var(--kuro-color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AppIcon name="check-circle" size={12} />
                    <span>Key saved on server ({settings.cloud_api_key_preview})</span>
                  </span>
                )}
              </div>
              <input
                type="password"
                autoComplete="new-password"
                value={cloudApiKey}
                onChange={(e) => setCloudApiKey(e.target.value)}
                placeholder={
                  settings?.has_cloud_api_key
                    ? `•••••••••••••••• (Leave blank to keep existing key, or paste new key to update)`
                    : `Paste API / Bearer Token... (Optional for local Ollama)`
                }
                style={{
                  width: '100%',
                  backgroundColor: 'var(--kuro-color-surface-input)',
                  border: '1px solid var(--kuro-color-border)',
                  borderRadius: radius.input,
                  padding: '8px 12px',
                  color: 'var(--kuro-color-text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: cloudApiKey ? 'monospace' : 'inherit',
                }}
              />
            </div>

            {/* Test Cloud Provider Result Banner */}
            {cloudTestResult && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: radius.input,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: cloudTestResult.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${cloudTestResult.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: cloudTestResult.ok ? 'var(--kuro-color-success)' : 'var(--kuro-color-danger)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AppIcon name={cloudTestResult.ok ? 'check-circle' : 'alert-triangle'} size={15} />
                  <span>
                    {cloudTestResult.ok
                      ? `Connected to custom endpoint successfully (${cloudTestResult.latency_ms}ms latency)`
                      : `Connection failed: ${cloudTestResult.error || 'Endpoint unreachable. Check your Base URL or API key.'}`}
                  </span>
                </div>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{cloudTestResult.model}</span>
              </div>
            )}

            {/* Cloud Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4 }}>
              {onTestLLM && (
                <button
                  type="button"
                  onClick={handleTestCloudConnection}
                  disabled={testingCloud}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: 'var(--kuro-color-surface-hover)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '8px 14px',
                    color: 'var(--kuro-color-text-primary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: testingCloud ? 'not-allowed' : 'pointer',
                  }}
                >
                  <AppIcon name={testingCloud ? 'rotate-cw' : 'zap'} size={14} className={testingCloud ? 'animate-spin' : ''} />
                  <span>{testingCloud ? 'Testing Endpoint...' : 'Test Connection'}</span>
                </button>
              )}

              <button
                type="submit"
                disabled={savingCloud}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'var(--kuro-color-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: radius.button,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: savingCloud ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                }}
              >
                <AppIcon name={savingCloud ? 'rotate-cw' : 'check-circle'} size={14} className={savingCloud ? 'animate-spin' : ''} />
                <span>{savingCloud ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Quick Reference Matrix Help Dialog */}
      <Dialog
        open={showReferenceModal}
        onClose={() => setShowReferenceModal(false)}
        fullWidth
        maxWidth="md"
        slotProps={{
          paper: {
            sx: {
              borderRadius: radius.modal,
              bgcolor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              backgroundImage: 'none',
              color: 'var(--kuro-color-text-primary)',
            },
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--kuro-color-border-subtle)', pb: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AppIcon name="help-circle" size={18} style={{ color: 'var(--kuro-color-primary)' }} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>LLM Provider Quick Reference Matrix</span>
          </div>
          <IconButton onClick={() => setShowReferenceModal(false)} size="small" sx={{ color: 'var(--kuro-color-text-muted)' }}>
            <AppIcon name="x" size={16} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--kuro-color-text-secondary)', lineHeight: 1.5 }}>
            Use the reference table below to look up exact <strong>Custom Base URLs</strong>, authentication schemes, and popular models for third-party or local OpenAI-compatible engines. Click <strong>"Use in Form"</strong> to instantly populate the URL and default model.
          </p>

          <div style={{ overflowX: 'auto', borderRadius: radius.card, border: '1px solid var(--kuro-color-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--kuro-color-surface-hover)', borderBottom: '1px solid var(--kuro-color-border)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>Provider</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>Custom Base URL</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>Auth Header / Key</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>Popular Models</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--kuro-color-text-primary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDER_REFERENCE_MATRIX.map((ref, idx) => (
                  <tr
                    key={ref.name}
                    style={{
                      borderBottom: idx < PROVIDER_REFERENCE_MATRIX.length - 1 ? '1px solid var(--kuro-color-border-subtle)' : 'none',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--kuro-color-text-primary)', whiteSpace: 'nowrap' }}>
                      {ref.name}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 6px', backgroundColor: 'var(--kuro-color-surface-input)', borderRadius: 4, color: 'var(--kuro-color-primary)', wordBreak: 'break-all' }}>
                          {ref.baseUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(ref.baseUrl)}
                          title="Copy Base URL"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedUrl === ref.baseUrl ? 'var(--kuro-color-success)' : 'var(--kuro-color-text-muted)',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <AppIcon name={copiedUrl === ref.baseUrl ? 'check' : 'copy'} size={13} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--kuro-color-text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                      {ref.authScheme}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--kuro-color-text-muted)', fontSize: 11 }}>
                      {ref.popularModels}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => handleApplyReference(ref)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: radius.badge,
                          border: '1px solid var(--kuro-color-primary)',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          color: 'var(--kuro-color-primary)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Use in Form
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid var(--kuro-color-border-subtle)' }}>
          <button
            type="button"
            onClick={() => setShowReferenceModal(false)}
            style={{
              padding: '6px 14px',
              borderRadius: radius.button,
              border: '1px solid var(--kuro-color-border)',
              backgroundColor: 'transparent',
              color: 'var(--kuro-color-text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </DialogActions>
      </Dialog>

      {/* 2. Generation & Memory Hyperparameters */}
      <form
        onSubmit={handleSaveHyperparams}
        style={{
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ borderBottom: '1px solid var(--kuro-color-border-subtle)', paddingBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
            Generation & Memory Hyperparameters
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--kuro-color-text-muted)' }}>
            Fine-tune assistant creativity, response length limits, context history window, and long-term memory retrieval.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          {/* Temperature */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>Temperature</label>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--kuro-color-primary)' }}>{temperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--kuro-color-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--kuro-color-text-muted)', marginTop: 2 }}>
              <span>Precise (0.0)</span>
              <span>Creative (1.0)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>Max Response Tokens</label>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--kuro-color-primary)' }}>{maxTokens}</span>
            </div>
            <input
              type="number"
              min="256"
              max="8192"
              step="256"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
              style={{
                width: '100%',
                backgroundColor: 'var(--kuro-color-surface-input)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.input,
                padding: '8px 10px',
                color: 'var(--kuro-color-text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Context Messages */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>Context History Messages</label>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--kuro-color-primary)' }}>{contextMsgs}</span>
            </div>
            <input
              type="number"
              min="5"
              max="100"
              value={contextMsgs}
              onChange={(e) => setContextMsgs(parseInt(e.target.value) || 30)}
              style={{
                width: '100%',
                backgroundColor: 'var(--kuro-color-surface-input)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.input,
                padding: '8px 10px',
                color: 'var(--kuro-color-text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Memory Retrieval Top-K */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-secondary)' }}>Memory Retrieval (Top-K)</label>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--kuro-color-primary)' }}>{memoryRetrieve}</span>
            </div>
            <input
              type="number"
              min="1"
              max="20"
              value={memoryRetrieve}
              onChange={(e) => setMemoryRetrieve(parseInt(e.target.value) || 10)}
              style={{
                width: '100%',
                backgroundColor: 'var(--kuro-color-surface-input)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.input,
                padding: '8px 10px',
                color: 'var(--kuro-color-text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'var(--kuro-color-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: radius.button,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
            }}
          >
            <AppIcon name={saving ? 'rotate-cw' : 'check-circle'} size={15} className={saving ? 'animate-spin' : ''} />
            {saving ? 'Saving...' : 'Apply & Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
