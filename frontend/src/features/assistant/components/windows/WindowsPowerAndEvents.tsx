import React, { useState, useEffect, useCallback } from 'react'
import { Zap, ShieldAlert, RefreshCw, CheckCircle2 } from 'lucide-react'
import { radius } from '@/design/radius'
import { useSnackbar } from '@/hooks/useSnackbar'
import {
  getWindowsPowerInfo,
  setWindowsPowerScheme,
  getWindowsSystemEvents,
  type WindowsPowerInfo,
  type WindowsSystemEvent,
} from '../../api/assistant'
import type { KuroNode } from '../../types'

interface WindowsPowerAndEventsProps {
  node?: KuroNode
  nodeId: string
}

export const WindowsPowerAndEvents: React.FC<WindowsPowerAndEventsProps> = ({ nodeId }) => {
  const { showSnackbar } = useSnackbar()
  const [power, setPower] = useState<WindowsPowerInfo | null>(null)
  const [events, setEvents] = useState<WindowsSystemEvent[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [switchingScheme, setSwitchingScheme] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!nodeId) return
    setLoading(true)
    try {
      const [pRes, eRes] = await Promise.all([getWindowsPowerInfo(nodeId), getWindowsSystemEvents(nodeId)])
      setPower(pRes)
      setEvents(eRes?.events || [])
    } catch (err: any) {
      showSnackbar(`Failed to load system diagnostics: ${err?.message || 'Offline'}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [nodeId, showSnackbar])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSetScheme = async (guid: string, name: string) => {
    setSwitchingScheme(guid)
    try {
      await setWindowsPowerScheme(nodeId, guid)
      showSnackbar(`Switched active power scheme to ${name}`, 'success')
    } catch (err: any) {
      showSnackbar(`Failed to switch power scheme: ${err?.message}`, 'error')
    } finally {
      setSwitchingScheme(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Power Schemes & Battery Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: 14,
        }}
      >
        {/* Power Status Card */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} color="var(--kuro-color-accent, #a9b665)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)' }}>
                Power & Battery Telemetry
              </span>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
                borderRadius: radius.button,
                color: 'var(--kuro-color-text-primary, #fff)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={11} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--kuro-color-accent, #a9b665)' }}>
              {power?.battery_percent ?? 100}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--kuro-color-text-secondary, #aaa)' }}>
              <div>AC Line: <strong style={{ color: '#fff' }}>{power?.ac_line_status || 'Online (Plugged In)'}</strong></div>
              <div>State: <strong style={{ color: '#fff' }}>{power?.battery_charge_status || 'AC Power'}</strong></div>
            </div>
          </div>

          {/* Quick Power Plan Buttons */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--kuro-color-text-muted, #888)', marginBottom: 8 }}>
              ACTIVATE POWER SCHEME
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { name: 'High Performance', guid: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c' },
                { name: 'Balanced', guid: '381b4222-f694-41f0-9685-ff5bb260df2e' },
                { name: 'Power Saver', guid: 'a1841308-3541-4fab-bc81-f71556f20b4a' },
              ].map((scheme) => (
                <button
                  key={scheme.guid}
                  onClick={() => handleSetScheme(scheme.guid, scheme.name)}
                  disabled={switchingScheme === scheme.guid}
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: radius.button,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
                    color: 'var(--kuro-color-text-primary, #fff)',
                    cursor: 'pointer',
                  }}
                >
                  {scheme.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Windows Event Viewer (Errors & Crashes) */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--kuro-color-surface, #18191a)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            borderRadius: radius.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={18} color="#f87171" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)' }}>
                Crash & System Error Sentinel ({events.length})
              </span>
            </div>
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#10b981', fontSize: 12 }}>
                <CheckCircle2 size={20} style={{ display: 'inline', marginBottom: 4 }} />
                <div>Zero critical errors in the last 24 hours. Workstation healthy!</div>
              </div>
            ) : (
              events.map((ev, idx) => (
                <div
                  key={`${ev.id}-${idx}`}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: radius.card,
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171', fontWeight: 700, marginBottom: 2 }}>
                    <span>{ev.provider} (Event #{ev.id})</span>
                    <span style={{ color: 'var(--kuro-color-text-muted, #777)' }}>{ev.time ? new Date(ev.time).toLocaleTimeString() : ''}</span>
                  </div>
                  <div style={{ color: 'var(--kuro-color-text-secondary, #ccc)', fontSize: 11 }}>
                    {ev.description || 'System Error Logged'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
