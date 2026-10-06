import { useState, useEffect, useCallback, useMemo } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import { useSnackbar } from '@/hooks/useSnackbar'
import type {
  BaikalConfig,
  DiscoveredResource,
  BaikalIntegrationState,
  ImmichConfig,
  ImmichIntegrationState,
  PapraConfig,
  PapraIntegrationState,
} from '../types'
import * as api from '../api/assistant'

const monoFont = 'var(--kuro-font-mono, "SF Mono", monospace)'

export default function ServerIntegrationsTab() {
  const { showSnackbar } = useSnackbar()

  // Baïkal State
  const [baikalState, setBaikalState] = useState<BaikalIntegrationState>({
    enabled: false,
    config: {
      url: '',
      username: '',
      password: '',
      default_calendar: 'default',
      reminder_calendar: 'reminders',
      addressbook: 'default',
    },
    has_password: false,
  })
  const [loading, setLoading] = useState<boolean>(true)
  const [modalOpen, setModalOpen] = useState<boolean>(false)

  // Baïkal Modal Form State
  const [formConfig, setFormConfig] = useState<BaikalConfig>({
    url: '',
    username: '',
    password: '',
    default_calendar: 'default',
    reminder_calendar: 'reminders',
    addressbook: 'default',
  })
  const [formEnabled, setFormEnabled] = useState<boolean>(true)
  const [showPassword, setShowPassword] = useState<boolean>(false)

  // Baïkal Discovery State
  const [discovering, setDiscovering] = useState<boolean>(false)
  const [discoveredCalendars, setDiscoveredCalendars] = useState<DiscoveredResource[]>([])
  const [discoveredAddressbooks, setDiscoveredAddressbooks] = useState<DiscoveredResource[]>([])
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [discoverySuccess, setDiscoverySuccess] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)

  // Immich State
  const [immichState, setImmichState] = useState<ImmichIntegrationState>({
    enabled: false,
    config: {
      url: 'http://127.0.0.1:2283',
      api_key: '',
    },
  })
  const [immichModalOpen, setImmichModalOpen] = useState<boolean>(false)
  const [immichFormConfig, setImmichFormConfig] = useState<ImmichConfig>({
    url: 'http://127.0.0.1:2283',
    api_key: '',
  })
  const [immichFormEnabled, setImmichFormEnabled] = useState<boolean>(true)
  const [testingImmich, setTestingImmich] = useState<boolean>(false)
  const [immichTestResult, setImmichTestResult] = useState<{ success: boolean; version?: string; error?: string } | null>(null)
  const [savingImmich, setSavingImmich] = useState<boolean>(false)
  const [showImmichApiKey, setShowImmichApiKey] = useState<boolean>(false)

  // Papra Document Management Integration State
  const [papraState, setPapraState] = useState<PapraIntegrationState>({
    enabled: true,
    config: {
      url: 'http://127.0.0.1:3005',
      api_token: '',
    },
  })
  const [papraModalOpen, setPapraModalOpen] = useState<boolean>(false)
  const [papraFormConfig, setPapraFormConfig] = useState<PapraConfig>({
    url: 'http://127.0.0.1:3005',
    api_token: '',
  })
  const [papraFormEnabled, setPapraFormEnabled] = useState<boolean>(true)
  const [testingPapra, setTestingPapra] = useState<boolean>(false)
  const [papraTestResult, setPapraTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)
  const [savingPapra, setSavingPapra] = useState<boolean>(false)
  const [showPapraToken, setShowPapraToken] = useState<boolean>(false)

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      const [baikalRes, immichRes, papraRes] = await Promise.allSettled([
        api.getBaikalIntegration(),
        api.getImmichIntegration(),
        api.getPapraIntegration(),
      ])
      if (baikalRes.status === 'fulfilled') {
        setBaikalState(baikalRes.value)
        setFormConfig(baikalRes.value.config)
        setFormEnabled(baikalRes.value.enabled)
      }
      if (immichRes.status === 'fulfilled') {
        setImmichState(immichRes.value)
        setImmichFormConfig(immichRes.value.config)
        setImmichFormEnabled(immichRes.value.enabled)
      }
      if (papraRes.status === 'fulfilled') {
        setPapraState(papraRes.value)
        setPapraFormConfig(papraRes.value.config)
        setPapraFormEnabled(papraRes.value.enabled)
      }
    } catch (err: any) {
      console.error('Failed to load integration configurations:', err)
      showSnackbar(err.message || 'Failed to load integration settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [showSnackbar])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const openConfigModal = () => {
    const currentCfg = { ...baikalState.config, password: '' }
    setFormConfig(currentCfg)
    setFormEnabled(baikalState.enabled)
    setDiscoveryError(null)
    setDiscoverySuccess(false)
    setModalOpen(true)

    // Auto-discover if credentials exist
    if (currentCfg.url && currentCfg.username && baikalState.has_password) {
      api.discoverBaikal(currentCfg).then((res) => {
        if (res.success) {
          if (res.calendars && res.calendars.length > 0) setDiscoveredCalendars(res.calendars)
          if (res.addressbooks && res.addressbooks.length > 0) setDiscoveredAddressbooks(res.addressbooks)
        }
      }).catch(() => {})
    }
  }

  const openImmichModal = () => {
    setImmichFormConfig({ ...immichState.config, api_key: '' })
    setImmichFormEnabled(immichState.enabled)
    setImmichTestResult(null)
    setImmichModalOpen(true)
  }

  const handleTestImmich = async () => {
    if (!immichFormConfig.url) {
      showSnackbar('Please enter Immich server URL', 'error')
      return
    }
    setTestingImmich(true)
    setImmichTestResult(null)
    try {
      const res = await api.testImmichIntegration(immichFormConfig)
      setImmichTestResult(res)
      if (res.success) {
        showSnackbar(`Connected to Immich successfully${res.version ? ` (v${res.version})` : ''}`, 'success')
      } else {
        showSnackbar(res.error || 'Failed to connect to Immich', 'error')
      }
    } catch (err: any) {
      setImmichTestResult({ success: false, error: err.message || 'Connection failed' })
      showSnackbar(err.message || 'Failed to connect to Immich', 'error')
    } finally {
      setTestingImmich(false)
    }
  }

  const handleSaveImmich = async () => {
    if (!immichFormConfig.url) {
      showSnackbar('Please enter Immich server URL', 'error')
      return
    }
    setSavingImmich(true)
    try {
      await api.saveImmichIntegration(immichFormEnabled, immichFormConfig)
      showSnackbar('Immich integration settings saved successfully', 'success')
      setImmichModalOpen(false)
      loadConfig()
    } catch (err: any) {
      showSnackbar(err.message || 'Failed to save Immich settings', 'error')
    } finally {
      setSavingImmich(false)
    }
  }

  const openPapraModal = () => {
    setPapraFormConfig({ ...papraState.config })
    setPapraFormEnabled(papraState.enabled)
    setPapraTestResult(null)
    setPapraModalOpen(true)
  }

  const handleTestPapra = async () => {
    if (!papraFormConfig.url) {
      showSnackbar('Please enter Papra server URL', 'error')
      return
    }
    setTestingPapra(true)
    setPapraTestResult(null)
    try {
      const res = await api.testPapraIntegration(papraFormConfig)
      setPapraTestResult(res)
      if (res.success) {
        showSnackbar(res.message || 'Connected to Papra successfully', 'success')
      } else {
        showSnackbar(res.error || 'Failed to connect to Papra', 'error')
      }
    } catch (err: any) {
      setPapraTestResult({ success: false, error: err.message || 'Connection failed' })
      showSnackbar(err.message || 'Failed to connect to Papra', 'error')
    } finally {
      setTestingPapra(false)
    }
  }

  const handleSavePapra = async () => {
    if (!papraFormConfig.url) {
      showSnackbar('Please enter Papra Server URL', 'error')
      return
    }
    setSavingPapra(true)
    try {
      await api.savePapraIntegration(papraFormEnabled, papraFormConfig)
      showSnackbar('Papra Document Management configuration saved successfully', 'success')
      setPapraModalOpen(false)
      loadConfig()
    } catch (err: any) {
      showSnackbar(err.message || 'Failed to save Papra settings', 'error')
    } finally {
      setSavingPapra(false)
    }
  }

  const handleTestAndDiscover = async () => {
    if (!formConfig.url || !formConfig.username) {
      showSnackbar('Please enter Baïkal Server URL and Username', 'error')
      return
    }
    try {
      setDiscovering(true)
      setDiscoveryError(null)
      setDiscoverySuccess(false)
      const res = await api.discoverBaikal(formConfig)
      if (!res.success) {
        setDiscoveryError(res.error || 'Connection failed')
        showSnackbar(res.error || 'Connection test failed', 'error')
      } else {
        setDiscoveredCalendars(res.calendars || [])
        setDiscoveredAddressbooks(res.addressbooks || [])
        setDiscoverySuccess(true)
        showSnackbar(
          `Connected! Found ${res.calendars?.length || 0} calendar(s) and ${res.addressbooks?.length || 0} address book(s)`,
          'success'
        )
      }
    } catch (err: any) {
      setDiscoveryError(err.message || 'Discovery error')
      showSnackbar(err.message || 'Discovery error', 'error')
    } finally {
      setDiscovering(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await api.saveBaikalIntegration(formEnabled, formConfig)
      showSnackbar('Baïkal server integration settings saved', 'success')
      setModalOpen(false)
      loadConfig()
    } catch (err: any) {
      showSnackbar(err.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Dynamic calendar options combining current config and discovered calendars
  const availableCalendars = useMemo(() => {
    const map = new Map<string, string>()
    if (formConfig.reminder_calendar) {
      map.set(formConfig.reminder_calendar, formConfig.reminder_calendar)
    }
    if (formConfig.default_calendar) {
      map.set(formConfig.default_calendar, formConfig.default_calendar)
    }
    discoveredCalendars.forEach((c) => {
      map.set(c.name, c.display_name ? `${c.display_name} (${c.name})` : c.name)
    })
    if (!map.has('reminders')) map.set('reminders', 'Reminders & Tasks (reminders)')
    if (!map.has('default')) map.set('default', 'Default Calendar (default)')
    if (!map.has('events')) map.set('events', 'Events (events)')
    if (!map.has('todo')) map.set('todo', 'To-Do (todo)')
    if (!map.has('personal')) map.set('personal', 'Personal (personal)')
    return Array.from(map.entries()).map(([name, label]) => ({ name, label }))
  }, [formConfig.reminder_calendar, formConfig.default_calendar, discoveredCalendars])

  const availableAddressbooks = useMemo(() => {
    const map = new Map<string, string>()
    if (formConfig.addressbook) {
      map.set(formConfig.addressbook, formConfig.addressbook)
    }
    discoveredAddressbooks.forEach((a) => {
      map.set(a.name, a.display_name ? `${a.display_name} (${a.name})` : a.name)
    })
    if (!map.has('default')) map.set('default', 'Default Address Book (default)')
    if (!map.has('contacts')) map.set('contacts', 'Contacts Directory (contacts)')
    return Array.from(map.entries()).map(([name, label]) => ({ name, label }))
  }, [formConfig.addressbook, discoveredAddressbooks])

  const isConfigured = Boolean(baikalState.config?.url && baikalState.config?.username)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
      {/* ── Top Header Banner ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
            Integrations & Services
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--kuro-color-text-muted)' }}>
            Configure on-premise Docker servers to grant Kuro Assistant direct read & write access
          </p>
        </div>

        <button
          onClick={loadConfig}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'var(--kuro-color-bg)',
            border: '1px solid var(--kuro-color-border)',
            color: 'var(--kuro-color-text-primary)',
            borderRadius: radius.button,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          <AppIcon name="rotate-cw" size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Integrations Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {/* ── 1. BAIKAL (ACTIVE) ── */}
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface)',
            border: `1px solid ${isConfigured && baikalState.enabled ? '#8ec07c' : 'var(--kuro-color-border)'}`,
            borderRadius: radius.card,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: radius.button,
                    backgroundColor: 'rgba(215, 153, 33, 0.15)',
                    color: 'var(--kuro-color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="calendar" size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                    Baïkal Server
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                    CalDAV & CardDAV Protocol
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 12,
                  backgroundColor: !isConfigured
                    ? 'rgba(254, 128, 25, 0.15)'
                    : baikalState.enabled
                    ? 'rgba(142, 192, 124, 0.15)'
                    : 'rgba(255, 255, 255, 0.08)',
                  color: !isConfigured ? '#fe8019' : baikalState.enabled ? '#8ec07c' : 'var(--kuro-color-text-muted)',
                }}
              >
                {!isConfigured ? 'Needs Setup' : baikalState.enabled ? 'Active & Linked' : 'Disabled'}
              </span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)', lineHeight: 1.5 }}>
              Syncs full read & write calendar events, contacts address book, and designated reminder tasks with your Baïkal CalDAV/CardDAV server.
            </div>

            {/* Configured Details */}
            {isConfigured && (
              <div
                style={{
                  backgroundColor: 'var(--kuro-color-bg)',
                  borderRadius: radius.button,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--kuro-color-text-muted)' }}>Host URL:</span>
                  <span style={{ fontFamily: monoFont, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                    {baikalState.config.url}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--kuro-color-text-muted)' }}>User:</span>
                  <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                    {baikalState.config.username}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--kuro-color-text-muted)' }}>Reminder Calendar:</span>
                  <span style={{ fontWeight: 700, color: 'var(--kuro-color-primary)' }}>
                    {baikalState.config.reminder_calendar || 'reminders'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--kuro-color-text-muted)' }}>Events Calendar:</span>
                  <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                    {baikalState.config.default_calendar || 'default'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={openConfigModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: isConfigured ? 'rgba(215, 153, 33, 0.15)' : 'var(--kuro-color-primary)',
              border: `1px solid ${isConfigured ? 'var(--kuro-color-primary)' : 'transparent'}`,
              color: isConfigured ? 'var(--kuro-color-primary)' : '#14161B',
              borderRadius: radius.button,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <AppIcon name="sliders" size={15} />
            <span>{isConfigured ? 'Configure Baïkal Settings' : 'Set Up Baïkal Connection'}</span>
          </button>
        </div>

        {/* ── 2. IMMICH PHOTOS INTEGRATION ── */}
        {(() => {
          const isImmichConfigured = !!(immichState.config.url && (immichState.config.has_api_key || immichState.config.api_key))
          return (
            <div
              style={{
                backgroundColor: 'var(--kuro-color-surface)',
                border: `1px solid ${isImmichConfigured && immichState.enabled ? 'rgba(131, 165, 152, 0.4)' : 'var(--kuro-color-border)'}`,
                borderRadius: radius.card,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                boxShadow: isImmichConfigured && immichState.enabled ? '0 4px 20px rgba(131, 165, 152, 0.08)' : 'none',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: radius.button,
                        backgroundColor: 'rgba(131, 165, 152, 0.15)',
                        color: '#83a598',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppIcon name="image" size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                        Immich Photos
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                        Visual Media & AI Photo Search
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 12,
                      backgroundColor:
                        isImmichConfigured && immichState.enabled
                          ? 'rgba(142, 192, 124, 0.15)'
                          : isImmichConfigured
                            ? 'rgba(215, 153, 33, 0.15)'
                            : 'rgba(255, 255, 255, 0.08)',
                      color:
                        isImmichConfigured && immichState.enabled
                          ? '#8ec07c'
                          : isImmichConfigured
                            ? 'var(--kuro-color-primary)'
                            : 'var(--kuro-color-text-muted)',
                    }}
                  >
                    {isImmichConfigured && immichState.enabled ? 'Active' : isImmichConfigured ? 'Configured' : 'Not Configured'}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)', lineHeight: 1.5 }}>
                  Connect your Immich server for AI-powered photo search by date, location, albums, and recognized people (*"Show photos from Tokyo 2024"*, *"Find photos of Ullash"*).
                </div>

                {isImmichConfigured && (
                  <div
                    style={{
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.button,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 11.5,
                      fontFamily: monoFont,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kuro-color-text-muted)' }}>Server:</span>
                      <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                        {immichState.config.url}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kuro-color-text-muted)' }}>API Key:</span>
                      <span style={{ fontWeight: 600, color: '#8ec07c' }}>
                        {immichState.config.has_api_key || immichState.config.api_key ? 'Configured' : 'Missing'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={openImmichModal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: isImmichConfigured ? 'rgba(131, 165, 152, 0.15)' : '#83a598',
                  border: `1px solid ${isImmichConfigured ? '#83a598' : 'transparent'}`,
                  color: isImmichConfigured ? '#83a598' : '#14161B',
                  borderRadius: radius.button,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <AppIcon name="sliders" size={15} />
                <span>{isImmichConfigured ? 'Configure Immich Settings' : 'Set Up Immich Connection'}</span>
              </button>
            </div>
          )
        })()}

        {/* ── 3. PAPRA DOCUMENT MANAGEMENT (ACTIVE) ── */}
        {(() => {
          const isPapraConfigured = !!papraState.config.url
          return (
            <div
              style={{
                backgroundColor: 'var(--kuro-color-surface)',
                border: `1px solid ${isPapraConfigured && papraState.enabled ? 'rgba(211, 134, 155, 0.4)' : 'var(--kuro-color-border)'}`,
                borderRadius: radius.card,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                boxShadow: isPapraConfigured && papraState.enabled ? '0 4px 20px rgba(211, 134, 155, 0.08)' : 'none',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: radius.button,
                        backgroundColor: 'rgba(211, 134, 155, 0.15)',
                        color: '#d3869b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppIcon name="file-text" size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                        Papra Document Management
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                        Invoices, Receipts & OCR Archives
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 12,
                      backgroundColor:
                        isPapraConfigured && papraState.enabled
                          ? 'rgba(142, 192, 124, 0.15)'
                          : isPapraConfigured
                            ? 'rgba(215, 153, 33, 0.15)'
                            : 'rgba(255, 255, 255, 0.08)',
                      color:
                        isPapraConfigured && papraState.enabled
                          ? '#8ec07c'
                          : isPapraConfigured
                            ? 'var(--kuro-color-primary)'
                            : 'var(--kuro-color-text-muted)',
                    }}
                  >
                    {isPapraConfigured && papraState.enabled ? 'Active' : isPapraConfigured ? 'Configured' : 'Not Configured'}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--kuro-color-text-muted)', lineHeight: 1.5 }}>
                  Connect Papra to allow Kuro Assistant to look up receipts, utility bills, warranty cards, tax documents, and contracts via OCR (*"Find electricity bill"*, *"Show last month's grocery receipt"*).
                </div>

                {isPapraConfigured && (
                  <div
                    style={{
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.button,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 11.5,
                      fontFamily: monoFont,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kuro-color-text-muted)' }}>Server:</span>
                      <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                        {papraState.config.url}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kuro-color-text-muted)' }}>API Token:</span>
                      <span style={{ fontWeight: 600, color: papraState.config.api_token ? '#8ec07c' : 'var(--kuro-color-text-muted)' }}>
                        {papraState.config.api_token ? 'Configured' : 'Optional'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={openPapraModal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: isPapraConfigured ? 'rgba(211, 134, 155, 0.15)' : '#d3869b',
                  border: `1px solid ${isPapraConfigured ? '#d3869b' : 'transparent'}`,
                  color: isPapraConfigured ? '#d3869b' : '#14161B',
                  borderRadius: radius.button,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <AppIcon name="sliders" size={15} />
                <span>{isPapraConfigured ? 'Configure Papra Settings' : 'Set Up Papra Connection'}</span>
              </button>
            </div>
          )
        })()}
      </div>


      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ── BAIKAL CONFIGURATION & DISCOVERY MODAL ── */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              width: '100%',
              maxWidth: 580,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AppIcon name="calendar" size={20} style={{ color: 'var(--kuro-color-primary)' }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                  Baïkal CalDAV & CardDAV Configuration
                </span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--kuro-color-text-muted)', cursor: 'pointer' }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            {/* Enable Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--kuro-color-bg)',
                padding: '12px 14px',
                borderRadius: radius.button,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                  Enable Baïkal Integration
                </div>
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', marginTop: 2 }}>
                  Allows Kuro Assistant to manage calendar events, reminders, and contacts
                </div>
              </div>
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--kuro-color-primary)', cursor: 'pointer' }}
              />
            </div>

            {/* Credentials Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-muted)' }}>
                    Baïkal Server URL / Endpoint
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setFormConfig({ ...formConfig, url: 'http://127.0.0.1:3001/dav.php' })}
                      style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: 'rgba(215, 153, 33, 0.12)',
                        border: '1px solid var(--kuro-color-primary)',
                        color: 'var(--kuro-color-primary)',
                        borderRadius: radius.button,
                        cursor: 'pointer',
                      }}
                    >
                      Localhost (127.0.0.1:3001)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormConfig({ ...formConfig, url: 'http://100.122.11.42:3001/dav.php' })}
                      style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        color: 'var(--kuro-color-text-muted)',
                        borderRadius: radius.button,
                        cursor: 'pointer',
                      }}
                    >
                      Tailscale (100.122.11.42:3001)
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="e.g. http://127.0.0.1:3001/dav.php"
                  value={formConfig.url}
                  onChange={(e) => setFormConfig({ ...formConfig, url: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--kuro-color-bg)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '9px 12px',
                    fontSize: 13,
                    color: 'var(--kuro-color-text-primary)',
                    fontFamily: monoFont,
                    outline: 'none',
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', marginTop: 4 }}>
                  Since Baïkal and HomeLab run on the same Poco host, <strong style={{ color: 'var(--kuro-color-primary)' }}>http://127.0.0.1:3001/dav.php</strong> connects directly via in-kernel loopback without reverse proxy or domain overhead.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-muted)', display: 'block', marginBottom: 4 }}>
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. admin or username"
                    value={formConfig.username}
                    onChange={(e) => setFormConfig({ ...formConfig, username: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.button,
                      padding: '9px 12px',
                      fontSize: 13,
                      color: 'var(--kuro-color-text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-muted)', display: 'block', marginBottom: 4 }}>
                    Password {baikalState.has_password && '(Saved)'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={baikalState.has_password ? '•••••••• (leave blank to keep)' : 'Enter password'}
                      value={formConfig.password || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, password: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--kuro-color-bg)',
                        border: '1px solid var(--kuro-color-border)',
                        borderRadius: radius.button,
                        padding: '9px 34px 9px 12px',
                        fontSize: 13,
                        color: 'var(--kuro-color-text-primary)',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--kuro-color-text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      <AppIcon name={showPassword ? 'eye-off' : 'eye'} size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Test & Discover Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={handleTestAndDiscover}
                disabled={discovering}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(215, 153, 33, 0.15)',
                  border: '1px solid var(--kuro-color-primary)',
                  color: 'var(--kuro-color-primary)',
                  borderRadius: radius.button,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: discovering ? 'wait' : 'pointer',
                }}
              >
                <AppIcon name="search" size={14} className={discovering ? 'animate-spin' : ''} />
                <span>{discovering ? 'Connecting & Discovering Uplink...' : 'Test Connection & Discover Calendars'}</span>
              </button>

              {discoveryError && (
                <div style={{ fontSize: 12, color: '#fb4934', padding: '8px 10px', backgroundColor: 'rgba(251, 73, 52, 0.1)', borderRadius: radius.button }}>
                  {discoveryError}
                </div>
              )}
              {discoverySuccess && (
                <div style={{ fontSize: 12, color: '#8ec07c', padding: '8px 10px', backgroundColor: 'rgba(142, 192, 124, 0.1)', borderRadius: radius.button }}>
                  Connection verified successfully! Choose your preferred calendars below.
                </div>
              )}
            </div>

            {/* Calendar & Address Book Mapping Dropdowns */}
            <div style={{ borderTop: '1px solid var(--kuro-color-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                Calendar & Task Mapping
              </div>

              {/* 1. Reminder Calendar Selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-primary)', display: 'block', marginBottom: 4 }}>
                  Designated Reminder Calendar (Tasks & To-Dos)
                </label>
                <select
                  value={formConfig.reminder_calendar || 'reminders'}
                  onChange={(e) => setFormConfig({ ...formConfig, reminder_calendar: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--kuro-color-bg)',
                    border: '1px solid var(--kuro-color-primary)',
                    borderRadius: radius.button,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--kuro-color-text-primary)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {availableCalendars.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', marginTop: 3 }}>
                  When you say *"Remind me to..."*, the Assistant will specifically write tasks (VTODO) to this calendar.
                </div>
              </div>

              {/* 2. Default Events Calendar */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-muted)', display: 'block', marginBottom: 4 }}>
                  Default Events Calendar (Meetings & Schedule)
                </label>
                <select
                  value={formConfig.default_calendar || 'default'}
                  onChange={(e) => setFormConfig({ ...formConfig, default_calendar: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--kuro-color-bg)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--kuro-color-text-primary)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {availableCalendars.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Address Book Selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-muted)', display: 'block', marginBottom: 4 }}>
                  Contacts Address Book (CardDAV)
                </label>
                <select
                  value={formConfig.addressbook || 'default'}
                  onChange={(e) => setFormConfig({ ...formConfig, addressbook: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--kuro-color-bg)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--kuro-color-text-primary)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {availableAddressbooks.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', marginTop: 3 }}>
                  Used to match incoming Call Logs & SMS to identify callers by name.
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--kuro-color-border)', paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--kuro-color-border)',
                  color: 'var(--kuro-color-text-muted)',
                  borderRadius: radius.button,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: 'var(--kuro-color-primary)',
                  border: 'none',
                  color: '#14161B',
                  borderRadius: radius.button,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ── IMMICH CONFIGURATION MODAL ── */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {immichModalOpen && (
        <div
          onClick={() => setImmichModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.button,
                    backgroundColor: 'rgba(131, 165, 152, 0.15)',
                    color: '#83a598',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="image" size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)', margin: 0 }}>
                    Immich Photos Setup
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                    Visual Media, Face Tagging & AI Photo Search
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImmichModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--kuro-color-text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            {/* Enable/Disable Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--kuro-color-bg)',
                border: '1px solid var(--kuro-color-border)',
                borderRadius: radius.button,
                padding: '10px 14px',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                  Enable Immich Integration
                </div>
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                  Allow Kuro Assistant to query and display photo search results
                </div>
              </div>
              <input
                type="checkbox"
                checked={immichFormEnabled}
                onChange={(e) => setImmichFormEnabled(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#83a598' }}
              />
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-muted)', display: 'block', marginBottom: 4 }}>
                  Immich Server URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. http://192.168.1.100:2283"
                  value={immichFormConfig.url}
                  onChange={(e) => setImmichFormConfig({ ...immichFormConfig, url: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--kuro-color-bg)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--kuro-color-text-primary)',
                    outline: 'none',
                    fontFamily: monoFont,
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-muted)' }}>
                    API Key
                  </label>
                  {immichState.config.has_api_key && (
                    <span style={{ fontSize: 11, color: '#8ec07c', fontWeight: 600 }}>
                      API Key Saved (Leave empty to keep)
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showImmichApiKey ? 'text' : 'password'}
                    placeholder={immichState.config.has_api_key ? '••••••••••••••••' : 'Enter Immich API Key'}
                    value={immichFormConfig.api_key}
                    onChange={(e) => setImmichFormConfig({ ...immichFormConfig, api_key: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--kuro-color-bg)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.button,
                      padding: '8px 40px 8px 12px',
                      fontSize: 13,
                      color: 'var(--kuro-color-text-primary)',
                      outline: 'none',
                      fontFamily: monoFont,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowImmichApiKey(!showImmichApiKey)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--kuro-color-text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      padding: 4,
                    }}
                  >
                    <AppIcon name={showImmichApiKey ? 'eye-off' : 'eye'} size={15} />
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', marginTop: 4 }}>
                  Create an API key in Immich Web: <b>Account Settings → API Keys → New API Key</b>.
                </div>
              </div>
            </div>

            {/* Test Connection Button & Result */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={handleTestImmich}
                disabled={testingImmich}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(131, 165, 152, 0.15)',
                  border: '1px solid #83a598',
                  color: '#83a598',
                  borderRadius: radius.button,
                  padding: '9px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: testingImmich ? 'wait' : 'pointer',
                }}
              >
                <AppIcon name={testingImmich ? 'refresh-cw' : 'activity'} size={15} />
                <span>{testingImmich ? 'Testing Connection...' : 'Test Connection'}</span>
              </button>

              {immichTestResult && (
                <div
                  style={{
                    backgroundColor: immichTestResult.success ? 'rgba(142, 192, 124, 0.15)' : 'rgba(251, 73, 52, 0.15)',
                    border: `1px solid ${immichTestResult.success ? '#8ec07c' : '#fb4934'}`,
                    borderRadius: radius.button,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: immichTestResult.success ? '#8ec07c' : '#fb4934',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name={immichTestResult.success ? 'check-circle' : 'alert-triangle'} size={15} />
                  <span>
                    {immichTestResult.success
                      ? `Connection Successful (${immichTestResult.version || 'Immich Server Ready'})`
                      : immichTestResult.error || 'Connection Failed'}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--kuro-color-border)', paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => setImmichModalOpen(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--kuro-color-border)',
                  color: 'var(--kuro-color-text-muted)',
                  borderRadius: radius.button,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveImmich}
                disabled={savingImmich}
                style={{
                  backgroundColor: '#83a598',
                  border: 'none',
                  color: '#14161B',
                  borderRadius: radius.button,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: savingImmich ? 'wait' : 'pointer',
                }}
              >
                {savingImmich ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ── Papra Document Management Configuration Modal ── */}
      {papraModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPapraModalOpen(false)
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              width: '100%',
              maxWidth: 540,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.button,
                    backgroundColor: 'rgba(211, 134, 155, 0.15)',
                    color: '#d3869b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="file-text" size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                    Papra Document Management
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--kuro-color-text-muted)' }}>
                    Configure OCR & Document Search Service
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPapraModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--kuro-color-text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            {/* Modal Form Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Enabled Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--kuro-color-bg)',
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                    Enable Papra Integration
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                    Allow Kuro Assistant to search invoices, receipts, and OCR scanned docs
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={papraFormEnabled}
                  onChange={(e) => setPapraFormEnabled(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#d3869b' }}
                />
              </div>

              {/* Server URL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-muted)' }}>
                  Papra Server URL
                </label>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:3005"
                  value={papraFormConfig.url}
                  onChange={(e) => setPapraFormConfig((c) => ({ ...c, url: e.target.value }))}
                  style={{
                    backgroundColor: 'var(--kuro-color-bg)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '9px 12px',
                    fontSize: 13,
                    color: 'var(--kuro-color-text-primary)',
                    fontFamily: monoFont,
                    outline: 'none',
                    caretColor: '#ffffff',
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                  e.g. <code style={{ color: '#d3869b' }}>http://127.0.0.1:3005</code> (or Docker network address)
                </div>
              </div>

              {/* API Token */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-muted)' }}>
                    API Token (Optional / Bearer Token)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPapraToken(!showPapraToken)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--kuro-color-text-muted)',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <AppIcon name={showPapraToken ? 'eye-off' : 'eye'} size={12} />
                    {showPapraToken ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPapraToken ? 'text' : 'password'}
                  placeholder="Enter API token if Papra requires authentication..."
                  value={papraFormConfig.api_token}
                  onChange={(e) => setPapraFormConfig((c) => ({ ...c, api_token: e.target.value }))}
                  style={{
                    backgroundColor: 'var(--kuro-color-bg)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '9px 12px',
                    fontSize: 13,
                    color: 'var(--kuro-color-text-primary)',
                    fontFamily: monoFont,
                    outline: 'none',
                    caretColor: '#ffffff',
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                  Leave empty if Papra is running in unauthenticated local network mode
                </div>
              </div>

              {/* Test Connection Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleTestPapra}
                  disabled={testingPapra}
                  style={{
                    backgroundColor: 'rgba(211, 134, 155, 0.15)',
                    border: '1px solid rgba(211, 134, 155, 0.3)',
                    color: '#d3869b',
                    borderRadius: radius.button,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: testingPapra ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AppIcon name="zap" size={13} />
                  {testingPapra ? 'Testing Connection...' : 'Test Connection'}
                </button>
              </div>

              {/* Test Result Message */}
              {papraTestResult && (
                <div
                  style={{
                    backgroundColor: papraTestResult.success ? 'rgba(184, 187, 38, 0.12)' : 'rgba(251, 73, 52, 0.12)',
                    border: `1px solid ${papraTestResult.success ? 'rgba(184, 187, 38, 0.3)' : 'rgba(251, 73, 52, 0.3)'}`,
                    borderRadius: radius.button,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: papraTestResult.success ? '#b8bb26' : '#fb4934',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AppIcon name={papraTestResult.success ? 'check-circle' : 'alert-triangle'} size={15} />
                  <span>{papraTestResult.message || papraTestResult.error || 'Connection Failed'}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--kuro-color-border)', paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => setPapraModalOpen(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--kuro-color-border)',
                  color: 'var(--kuro-color-text-muted)',
                  borderRadius: radius.button,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePapra}
                disabled={savingPapra}
                style={{
                  backgroundColor: '#d3869b',
                  border: 'none',
                  color: '#000000',
                  borderRadius: radius.button,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: savingPapra ? 'wait' : 'pointer',
                }}
              >
                {savingPapra ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
