import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  KuroHealth,
  KuroSettings,
  KuroNode,
  KuroMemory,
  Conversation,
  ModelsData,
  EngineStatus,
  PullProgress,
} from '../types'
import * as api from '../api/assistant'
import { useSnackbar } from '@/hooks/useSnackbar'

export function useAssistant() {
  const [health, setHealth] = useState<KuroHealth | null>(null)
  const [settings, setSettings] = useState<KuroSettings | null>(null)
  const [nodes, setNodes] = useState<KuroNode[]>([])
  const [memories, setMemories] = useState<KuroMemory[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [modelsData, setModelsData] = useState<ModelsData | null>(null)
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null)
  const [pullingModel, setPullingModel] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null)
  const [startingEngine, setStartingEngine] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [testingLLM, setTestingLLM] = useState(false)
  const [testResult, setTestResult] = useState<api.TestLLMResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { showSnackbar } = useSnackbar()
  const pollTimerRef = useRef<any>(null)

  const refreshModels = useCallback(async () => {
    try {
      const [m, e] = await Promise.allSettled([api.getModelsData(), api.getEngineStatus()])
      if (m.status === 'fulfilled') setModelsData(m.value)
      if (e.status === 'fulfilled') setEngineStatus(e.value)
    } catch (err) {
      console.error('Failed to load models data:', err)
    }
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    // Priority: immediate fast load for nodes & settings so Clients page never blocks
    api.getConnectedNodes().then((nodeList) => {
      setNodes(nodeList || [])
      setLoading(false)
    }).catch(() => {})

    api.getAssistantSettings().then((s) => {
      if (s) setSettings(s)
    }).catch(() => {})

    try {
      const [h, s, n, m, c, md, es] = await Promise.allSettled([
        api.getAssistantHealth(),
        api.getAssistantSettings(),
        api.getConnectedNodes(),
        api.getMemories(),
        api.getConversations(),
        api.getModelsData(),
        api.getEngineStatus(),
      ])

      if (h.status === 'fulfilled') setHealth(h.value)
      if (s.status === 'fulfilled') setSettings(s.value)
      if (n.status === 'fulfilled') setNodes(n.value)
      if (m.status === 'fulfilled') setMemories(m.value)
      if (c.status === 'fulfilled') setConversations(c.value)
      if (md.status === 'fulfilled') setModelsData(md.value)
      if (es.status === 'fulfilled') setEngineStatus(es.value)
    } catch (err: any) {
      setError(err.message || 'Failed to load Kuro assistant data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // Safety timer: ensure loading never hangs beyond 1.5s
    const safetyTimer = setTimeout(() => {
      setLoading(false)
    }, 1500)

    const interval = setInterval(() => {
      Promise.allSettled([api.getAssistantHealth(), api.getConnectedNodes(), api.getEngineStatus()]).then(([h, n, es]) => {
        if (h.status === 'fulfilled') setHealth(h.value)
        if (n.status === 'fulfilled') setNodes(n.value)
        if (es.status === 'fulfilled') setEngineStatus(es.value)
      })
    }, 6000)
    return () => {
      clearTimeout(safetyTimer)
      clearInterval(interval)
    }
  }, [refresh])

  // Poll pull progress when pulling
  useEffect(() => {
    if (!pullingModel) return

    const poll = async () => {
      try {
        const progress = await api.getPullProgress(pullingModel)
        setPullProgress(progress)
        if (progress.done) {
          if (progress.error) {
            showSnackbar(`Failed to download ${pullingModel}: ${progress.error}`, 'error')
          } else {
            showSnackbar(`Model ${pullingModel} installed successfully!`, 'success')
            await refreshModels()
          }
          setPullingModel(null)
        }
      } catch (err) {
        console.error('Error polling pull progress:', err)
      }
    }

    pollTimerRef.current = setInterval(poll, 1500)
    poll()

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [pullingModel, refreshModels, showSnackbar])

  const handlePullModel = useCallback(
    async (modelName: string) => {
      try {
        setPullingModel(modelName)
        setPullProgress({
          model: modelName,
          status: 'Initializing download...',
          total: 0,
          completed: 0,
          percent: 0,
          done: false,
        })
        await api.pullModel(modelName)
        showSnackbar(`Started downloading ${modelName}`, 'info')
      } catch (err: any) {
        setPullingModel(null)
        showSnackbar(err.message || `Failed to start downloading ${modelName}`, 'error')
      }
    },
    [showSnackbar]
  )

  const handleDeleteModel = useCallback(
    async (modelName: string) => {
      try {
        await api.deleteModel(modelName)
        showSnackbar(`Model ${modelName} deleted`, 'info')
        await refreshModels()
      } catch (err: any) {
        showSnackbar(err.message || 'Failed to delete model', 'error')
      }
    },
    [refreshModels, showSnackbar]
  )

  const handleSetActiveModel = useCallback(
    async (modelName: string) => {
      try {
        await api.setActiveModel(modelName)
        showSnackbar(`Active model switched to ${modelName}`, 'success')
        await refresh()
      } catch (err: any) {
        showSnackbar(err.message || 'Failed to switch model', 'error')
      }
    },
    [refresh, showSnackbar]
  )

  const handleStartEngine = useCallback(async () => {
    setStartingEngine(true)
    try {
      await api.startLocalEngine()
      showSnackbar('Starting local inference engine...', 'info')
      let attempts = 0
      const checkInterval = setInterval(async () => {
        attempts++
        try {
          const status = await api.getEngineStatus()
          if (status.running || attempts >= 8) {
            clearInterval(checkInterval)
            await refreshModels()
            setStartingEngine(false)
            if (status.running) {
              showSnackbar('Local inference engine is now online', 'success')
            }
          }
        } catch {
          if (attempts >= 8) {
            clearInterval(checkInterval)
            setStartingEngine(false)
          }
        }
      }, 1500)
    } catch (err: any) {
      setStartingEngine(false)
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' ? err.response?.data : err.message) ||
        'Failed to start engine'
      showSnackbar(errorMsg, 'error')
    }
  }, [refreshModels, showSnackbar])

  const updateSettings = useCallback(
    async (updated: Partial<KuroSettings>) => {
      setSavingSettings(true)
      try {
        await api.updateAssistantSettings(updated)
        showSnackbar('Kuro settings updated successfully', 'success')
        await refresh()
      } catch (err: any) {
        showSnackbar(err.message || 'Failed to update settings', 'error')
        throw err
      } finally {
        setSavingSettings(false)
      }
    },
    [refresh, showSnackbar]
  )

  const testLLM = useCallback(
    async (payload: { base_url?: string; model?: string; provider?: string; api_key?: string }) => {
      setTestingLLM(true)
      setTestResult(null)
      try {
        const res = await api.testLLMConnection(payload)
        setTestResult(res)
        if (res.ok) {
          showSnackbar(`LLM Connection successful (${res.latency_ms}ms)`, 'success')
        } else {
          showSnackbar(`LLM Connection failed: ${res.error}`, 'error')
        }
        return res
      } catch (err: any) {
        const failure: api.TestLLMResult = {
          ok: false,
          latency_ms: 0,
          base_url: payload.base_url || '',
          model: payload.model || '',
          error: err.response?.data?.error || err.message || 'Connection failed',
        }
        setTestResult(failure)
        showSnackbar(failure.error || 'Connection test failed', 'error')
        return failure
      } finally {
        setTestingLLM(false)
      }
    },
    [showSnackbar]
  )

  const addMemory = useCallback(
    async (payload: { category: string; content: string; importance: number }) => {
      try {
        await api.createMemory(payload)
        showSnackbar('Knowledge item saved', 'success')
        const updated = await api.getMemories()
        setMemories(updated)
      } catch (err: any) {
        showSnackbar(err.message || 'Failed to save knowledge', 'error')
        throw err
      }
    },
    [showSnackbar]
  )

  const editMemory = useCallback(
    async (id: string, payload: { category: string; content: string; importance: number }) => {
      try {
        await api.updateMemory(id, payload)
        showSnackbar('Knowledge item updated', 'success')
        const updated = await api.getMemories()
        setMemories(updated)
      } catch (err: any) {
        showSnackbar(err.message || 'Failed to update knowledge', 'error')
        throw err
      }
    },
    [showSnackbar]
  )

  const removeMemory = useCallback(
    async (id: string) => {
      try {
        await api.deleteMemory(id)
        showSnackbar('Knowledge item deleted', 'info')
        setMemories((prev) => prev.filter((m) => m.id !== id))
      } catch (err: any) {
        showSnackbar(err.message || 'Failed to delete knowledge', 'error')
        throw err
      }
    },
    [showSnackbar]
  )

  const removeConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id)
        showSnackbar('Conversation deleted', 'info')
        setConversations((prev) => prev.filter((c) => c.id !== id))
      } catch (err: any) {
        showSnackbar(err.message || 'Failed to delete conversation', 'error')
        throw err
      }
    },
    [showSnackbar]
  )

  return {
    health,
    settings,
    nodes,
    memories,
    conversations,
    modelsData,
    engineStatus,
    pullingModel,
    pullProgress,
    startingEngine,
    loading,
    savingSettings,
    testingLLM,
    testResult,
    error,
    refresh,
    refreshModels,
    handlePullModel,
    handleDeleteModel,
    handleSetActiveModel,
    handleStartEngine,
    updateSettings,
    testLLM,
    addMemory,
    editMemory,
    removeMemory,
    removeConversation,
  }
}


