import { useState } from 'react'
import { useServer } from '../../contexts/ServerContext'
import { sanitizeUrl, type PingResult } from '../../utils/serverStorage'

export function InitialServerSetupPage() {
  const { saveServerUrl, testServer } = useServer()

  const [inputUrl, setInputUrl] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [pingResult, setPingResult] = useState<PingResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleTestConnection = async (urlToTest?: string) => {
    const targetUrl = (urlToTest || inputUrl).trim()
    if (!targetUrl) return

    setIsTesting(true)
    setPingResult(null)

    try {
      const clean = sanitizeUrl(targetUrl)
      const res = await testServer(clean)
      setPingResult(res)
    } catch {
      setPingResult({ ok: false, error: 'Failed to test server connection' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetUrl = inputUrl.trim()
    if (!targetUrl) return

    setIsSubmitting(true)
    setPingResult(null)

    const clean = sanitizeUrl(targetUrl)

    // Check if the server is reachable before proceeding
    let currentPing: PingResult
    try {
      currentPing = await testServer(clean)
    } catch {
      currentPing = { ok: false, error: 'Connection attempt failed' }
    }

    setPingResult(currentPing)

    // DO NOT proceed if the server is not reachable
    if (!currentPing.ok) {
      setIsSubmitting(false)
      return
    }

    // Only save and load login page if reachable!
    saveServerUrl(clean, clean)
    setIsSubmitting(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: '#0c0d0e',
        color: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          backgroundColor: 'rgba(20, 22, 24, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: '36px 28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* Header Branding - Clean Logo with NO Background Container */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img
            src="/sidebar-logo.svg"
            alt="HomeLab Logo"
            style={{
              width: 60,
              height: 60,
              objectFit: 'contain',
              filter: 'drop-shadow(0 6px 18px rgba(169, 182, 101, 0.25))',
            }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
              Connect to HomeLab
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
              Set up your server address to connect your native app.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Server URL Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af' }}>
              Server Address
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value)
                  setPingResult(null)
                }}
                placeholder="https://homelab.example.com or http://192.168.1.100:9876"
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                  transition: 'all 150ms ease',
                }}
              />
            </div>
          </div>

          {/* Connection Feedback / Error State */}
          {pingResult && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: pingResult.ok ? 'rgba(169, 182, 101, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${pingResult.ok ? 'rgba(169, 182, 101, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                color: pingResult.ok ? '#a9b665' : '#f87171',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: pingResult.ok ? '#a9b665' : '#ef4444',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
                {pingResult.ok
                  ? `Server Reachable (${pingResult.latencyMs} ms)`
                  : `Connection Failed: ${pingResult.error || 'Server Unreachable'}. Please check your server URL.`}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => handleTestConnection()}
              disabled={isTesting || isSubmitting || !inputUrl.trim()}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 10,
                border: '1px solid rgba(169, 182, 101, 0.25)',
                backgroundColor: 'rgba(169, 182, 101, 0.08)',
                color: '#a9b665',
                fontSize: 13,
                fontWeight: 600,
                cursor: isTesting || isSubmitting || !inputUrl.trim() ? 'not-allowed' : 'pointer',
                opacity: isTesting || isSubmitting || !inputUrl.trim() ? 0.5 : 1,
                transition: 'all 150ms ease',
              }}
            >
              {isTesting ? 'Testing...' : 'Test Ping'}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isTesting || !inputUrl.trim()}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #a9b665 0%, #8f9a52 100%)',
                color: '#111314',
                fontSize: 13,
                fontWeight: 700,
                cursor: isSubmitting || isTesting || !inputUrl.trim() ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || isTesting || !inputUrl.trim() ? 0.5 : 1,
                boxShadow: '0 4px 16px rgba(169, 182, 101, 0.35)',
                transition: 'all 150ms ease',
              }}
            >
              {isSubmitting ? 'Verifying...' : 'Connect to Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
