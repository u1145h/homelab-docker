import { useMemo, useRef, useState, useEffect } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { NetworkWidgetProps } from './types'
import { AppIcon } from '@/components/ui/icons'

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1000000000) return `${(bytesPerSec / 1000000000).toFixed(1)} GB/s`
  if (bytesPerSec >= 1000000) return `${(bytesPerSec / 1000000).toFixed(1)} MB/s`
  if (bytesPerSec >= 1000) return `${(bytesPerSec / 1000).toFixed(1)} KB/s`
  return `${Math.round(bytesPerSec)} B/s`
}

interface SpeedHistoryPoint {
  time: string
  downMB: number
  upMB: number
  signalPct: number
  downFormatted: string
  upFormatted: string
}

// Low-Power Throttled Rate & Chart History Hook
function useNetworkMetrics(rxBytes: number, txBytes: number, signalPct: number) {
  const prevRef = useRef<{ rx: number; tx: number; time: number } | null>(null)
  const [speed, setSpeed] = useState({ down: 0, up: 0 })
  const [history, setHistory] = useState<SpeedHistoryPoint[]>([])

  useEffect(() => {
    const now = Date.now()
    if (!prevRef.current) {
      prevRef.current = { rx: rxBytes, tx: txBytes, time: now }
      return
    }

    const dt = (now - prevRef.current.time) / 1000
    if (dt >= 0.8) {
      const dRx = Math.max(0, rxBytes - prevRef.current.rx)
      const dTx = Math.max(0, txBytes - prevRef.current.tx)
      const downRate = dRx / dt
      const upRate = dTx / dt

      setSpeed({ down: downRate, up: upRate })
      prevRef.current = { rx: rxBytes, tx: txBytes, time: now }

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      const newPoint: SpeedHistoryPoint = {
        time: timeStr,
        downMB: +(downRate / 1000000).toFixed(2),
        upMB: +(upRate / 1000000).toFixed(2),
        signalPct: Math.round(signalPct),
        downFormatted: formatSpeed(downRate),
        upFormatted: formatSpeed(upRate),
      }

      setHistory(prev => {
        const updated = [...prev, newPoint]
        return updated.slice(-12)
      })
    }
  }, [rxBytes, txBytes, signalPct])

  return { speed, history }
}

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: 'rgba(15, 17, 23, 0.95)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 10, fontWeight: 600 }}>{label}</span>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color }} />
            <span style={{ color: 'var(--kuro-color-text-secondary)' }}>{entry.name}:</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>
              {entry.name === 'Signal'
                ? `${entry.value}%`
                : entry.payload[`${entry.dataKey === 'downMB' ? 'downFormatted' : 'upFormatted'}`] || `${entry.value} MB/s`}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function NetworkWidget({ data }: NetworkWidgetProps) {
  if (!data || !data.interfaces) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kuro-color-text-secondary)', fontSize: 11 }}>
        No network data available
      </div>
    )
  }

  // Aggregate cumulative RX and TX bytes across all active non-loopback network interfaces
  const { totalRxBytes, totalTxBytes, activeCount } = useMemo(() => {
    if (!data.interfaces) return { totalRxBytes: 0, totalTxBytes: 0, activeCount: 0 }
    const activeInterfaces = data.interfaces.filter(i => i.up && !i.name.toLowerCase().startsWith('lo'))
    const rx = activeInterfaces.reduce((sum, i) => sum + (i.rx_bytes || 0), 0)
    const tx = activeInterfaces.reduce((sum, i) => sum + (i.tx_bytes || 0), 0)
    return { totalRxBytes: rx, totalTxBytes: tx, activeCount: activeInterfaces.length }
  }, [data.interfaces])

  const activeWifiIface = data.interfaces.find(
    i => i.up && (i.ssid || i.name.startsWith('w') || i.name.toLowerCase().includes('wifi'))
  )
  const activeIface = data.interfaces.find(i => i.up) || data.interfaces[0]
  const isConnected = activeCount > 0 || data.interfaces.some(i => i.up)

  const wifiSSID = data.wifi_details?.ssid || activeWifiIface?.ssid
  const isWifi = !!wifiSSID || !!activeWifiIface || /^w/i.test(activeIface?.name || '')
  const networkType = isWifi ? 'Wi-Fi' : 'Ethernet'
  const connectionLabel = wifiSSID || (isWifi ? 'Wireless Network' : activeIface?.name || 'Ethernet')
  
  // Calculate clean Signal % only (no dBm)
  const rssiVal = data.wifi_details?.rssi ?? -52
  const signalPct = Math.min(100, Math.max(0, Math.round(data.link_quality?.signal ?? (rssiVal + 100) * (100 / 70))))

  const { speed, history } = useNetworkMetrics(totalRxBytes, totalTxBytes, signalPct)

  // Seed chart with baseline if history is initializing
  const chartData = useMemo(() => {
    if (history.length > 0) return history
    return [
      { time: 'now', downMB: 1.2, upMB: 0.4, signalPct, downFormatted: '1.2 MB/s', upFormatted: '400 KB/s' },
      { time: 'now', downMB: 2.5, upMB: 0.8, signalPct, downFormatted: '2.5 MB/s', upFormatted: '800 KB/s' },
    ]
  }, [history, signalPct])

  const activeLedBlocks = Math.min(10, Math.max(1, Math.ceil(signalPct / 10)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', height: '100%', minHeight: 220 }}>
      {/* Top Bar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          NETWORKS
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isWifi && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#89B482', backgroundColor: 'rgba(137, 180, 130, 0.15)', padding: '2px 8px', borderRadius: 4 }}>
              {signalPct}%
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
            {networkType}
          </span>
        </div>
      </div>

      {/* Main Connection Status Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AppIcon name={isWifi ? 'wifi' : 'activity'} size={16} color={isConnected ? '#89B482' : '#EA6962'} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Green LED Segmented Signal Blocks */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((block) => (
              <span
                key={block}
                style={{
                  width: 6,
                  height: 10,
                  borderRadius: 1,
                  backgroundColor: isConnected && block <= activeLedBlocks ? '#89B482' : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: isConnected && block <= activeLedBlocks ? '0 0 4px rgba(137, 180, 130, 0.5)' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        <span style={{ fontSize: 12, fontWeight: 700, color: '#89B482', letterSpacing: '0.02em' }}>
          {connectionLabel}
        </span>
      </div>

      {/* Speed & Signal Area Chart */}
      <div
        style={{
          flex: '1 1 0%',
          minHeight: 130,
          width: '100%',
          marginTop: 0,
          background: 'transparent',
          borderRadius: 0,
          padding: 0,
          border: 0,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="signalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7DAEA3" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#7DAEA3" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="downSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#89B482" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#89B482" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="upSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E78A4E" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#E78A4E" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
            <XAxis dataKey="time" stroke="var(--kuro-color-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" hide domain={[0, 'auto']} />
            <YAxis yAxisId="right" orientation="right" hide domain={[0, 100]} />
            <Tooltip content={<CustomChartTooltip />} />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="signalPct"
              name="Signal"
              stroke="#7DAEA3"
              fill="url(#signalGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="downMB"
              name="Download"
              stroke="#89B482"
              fill="url(#downSpeedGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="upMB"
              name="Upload"
              stroke="#E78A4E"
              fill="url(#upSpeedGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Download & Upload Speed Meter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontFamily: 'var(--kuro-font-family-mono, monospace)', paddingTop: 4, width: '100%' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--kuro-color-text-secondary)' }}>
          <AppIcon name="arrow-down" size={13} color="#89B482" />
          <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 10, fontWeight: 600 }}>DOWNLOAD:</span>
          <strong style={{ color: '#89B482', fontWeight: 700, marginLeft: 2 }}>{formatSpeed(speed.down)}</strong>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--kuro-color-text-secondary)' }}>
          <AppIcon name="arrow-up" size={13} color="#E78A4E" />
          <span style={{ color: 'var(--kuro-color-text-muted)', fontSize: 10, fontWeight: 600 }}>UPLOAD:</span>
          <strong style={{ color: '#E78A4E', fontWeight: 700, marginLeft: 2 }}>{formatSpeed(speed.up)}</strong>
        </span>
      </div>
    </div>
  )
}
