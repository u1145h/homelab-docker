import React, { useState, useEffect, useCallback } from 'react'
import { Network, RefreshCw, Server } from 'lucide-react'
import { radius } from '@/design/radius'
import { useSnackbar } from '@/hooks/useSnackbar'
import {
  getWindowsNetworkAndPorts,
  type WindowsNetworkAdapter,
  type WindowsTcpListener,
} from '../../api/assistant'
import type { KuroNode } from '../../types'

interface WindowsNetworkAndPortsProps {
  node?: KuroNode
  nodeId: string
}

export const WindowsNetworkAndPorts: React.FC<WindowsNetworkAndPortsProps> = ({ nodeId }) => {
  const { showSnackbar } = useSnackbar()
  const [adapters, setAdapters] = useState<WindowsNetworkAdapter[]>([])
  const [listeners, setListeners] = useState<WindowsTcpListener[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const fetchData = useCallback(async () => {
    if (!nodeId) return
    setLoading(true)
    try {
      const res = await getWindowsNetworkAndPorts(nodeId)
      setAdapters(res?.adapters || [])
      setListeners(res?.listeners || [])
    } catch (err: any) {
      showSnackbar(`Failed to load network ports: ${err?.message || 'Offline'}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [nodeId, showSnackbar])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Network Adapters Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          backgroundColor: 'var(--kuro-color-surface, #18191a)',
          border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
          borderRadius: radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Network size={18} color="var(--kuro-color-accent, #a9b665)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)' }}>
            Network Interfaces & Open Listening Ports
          </span>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.1))',
            borderRadius: radius.button,
            color: 'var(--kuro-color-text-primary, #fff)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Adapters Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
          gap: 12,
        }}
      >
        {adapters.map((ad, idx) => (
          <div
            key={`${ad.name}-${idx}`}
            style={{
              padding: '14px 16px',
              backgroundColor: 'var(--kuro-color-surface, #18191a)',
              border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
              borderRadius: radius.card,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)' }}>{ad.name}</span>
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>{ad.speed_mbps} Mbps</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary, #aaa)' }}>{ad.description}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--kuro-font-mono, monospace)', color: 'var(--kuro-color-text-muted, #888)' }}>
              <span>IP: <strong style={{ color: '#60a5fa' }}>{ad.ipv4 || '—'}</strong></span>
              <span>MAC: {ad.mac}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Active TCP Ports Table ── */}
      <div
        style={{
          backgroundColor: 'var(--kuro-color-surface, #18191a)',
          border: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
          borderRadius: radius.card,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid var(--kuro-color-border, rgba(255,255,255,0.08))',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--kuro-color-text-muted, #888)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Active Listening Ports ({listeners.length})</span>
          <span style={{ fontSize: 10, color: '#10b981' }}>● Sentinel Active</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))',
            gap: 8,
            padding: 12,
            maxHeight: 400,
            overflowY: 'auto',
          }}
        >
          {listeners.map((l, idx) => (
            <div
              key={`${l.port}-${idx}`}
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: radius.card,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'var(--kuro-font-mono, monospace)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Server size={13} color="#60a5fa" />
                <span style={{ fontWeight: 700, color: 'var(--kuro-color-text-primary, #fff)' }}>Port {l.port}</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted, #777)' }}>{l.address}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
