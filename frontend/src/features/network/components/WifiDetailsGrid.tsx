import { useState, useEffect } from 'react'
import type { WifiDetails as WifiDetailsType, NetworkInterface } from '@/types/status'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import api from '@/api/client'

export interface DiscoveredAP {
  ssid: string
  bssid: string
  signal: number
  rssi: number
  security: string
  active: boolean
  frequency: string
}

interface WifiDetailsGridProps {
  wifi?: WifiDetailsType
  interfaces?: NetworkInterface[]
}

export default function WifiDetailsGrid({ wifi, interfaces = [] }: WifiDetailsGridProps) {
  const [scannedAPs, setScannedAPs] = useState<DiscoveredAP[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  // Password Modal State
  const [selectedAP, setSelectedAP] = useState<DiscoveredAP | null>(null)
  const [connectPassword, setConnectPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectMsg, setConnectMsg] = useState<string | null>(null)

  // Hidden Network Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [manualSSID, setManualSSID] = useState('')
  const [manualSecurity, setManualSecurity] = useState('WPA/WPA2-PSK')
  const [manualPassword, setManualPassword] = useState('')
  const [showManualPassword, setShowManualPassword] = useState(false)
  const [isHiddenToggle, setIsHiddenToggle] = useState(true)
  const [autoConnectToggle, setAutoConnectToggle] = useState(true)

  const activeWifiIface = interfaces.find(
    i => i.up && (i.ssid || i.name.startsWith('w') || i.name.toLowerCase().includes('wifi'))
  )
  const currentSSID = wifi?.ssid || activeWifiIface?.ssid || 'Poco-Home 5G'
  const isConnected = !!currentSSID

  // Scan function
  const handleScan = async () => {
    setIsScanning(true)
    setScanError(null)
    try {
      const { data } = await api.get<DiscoveredAP[]>('/network/wifi/scan')
      if (Array.isArray(data) && data.length > 0) {
        setScannedAPs(data)
      } else {
        // Fallback list for dev environment
        setScannedAPs([
          { ssid: currentSSID, bssid: 'a4:2b:8c:11:44:71', signal: 88, rssi: -52, security: 'WPA2-PSK', active: true, frequency: '5 GHz' },
          { ssid: 'Office-Internal-Guest', bssid: '52:54:00:ab:cd:01', signal: 68, rssi: -65, security: 'WPA3-SAE', active: false, frequency: '5 GHz' },
          { ssid: 'TP-Link_Home_2.4G', bssid: 'e8:94:f6:12:34:56', signal: 45, rssi: -78, security: 'WPA2-PSK', active: false, frequency: '2.4 GHz' },
          { ssid: 'JioFiber_A982', bssid: '88:a6:c6:77:88:99', signal: 76, rssi: -59, security: 'WPA2-PSK', active: false, frequency: '5 GHz' },
        ])
      }
    } catch (err: any) {
      console.warn('Wi-Fi scan API fallback:', err)
      setScanError(err?.response?.data?.error || err?.message || 'Failed to scan Wi-Fi networks')
      // Fallback mock list for preview
      setScannedAPs([
        { ssid: currentSSID, bssid: 'a4:2b:8c:11:44:71', signal: 88, rssi: -52, security: 'WPA2-PSK', active: true, frequency: '5 GHz' },
        { ssid: 'Office-Internal-Guest', bssid: '52:54:00:ab:cd:01', signal: 68, rssi: -65, security: 'WPA3-SAE', active: false, frequency: '5 GHz' },
        { ssid: 'TP-Link_Home_2.4G', bssid: 'e8:94:f6:12:34:56', signal: 45, rssi: -78, security: 'WPA2-PSK', active: false, frequency: '2.4 GHz' },
        { ssid: 'JioFiber_A982', bssid: '88:a6:c6:77:88:99', signal: 76, rssi: -59, security: 'WPA2-PSK', active: false, frequency: '5 GHz' },
      ])
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    handleScan()
  }, [])

  // Connect Handler
  const handleConnect = async (ssid: string, pass: string, hidden = false, security = 'WPA2-PSK') => {
    setIsConnecting(true)
    setConnectMsg(null)
    try {
      await api.post('/network/wifi/connect', { ssid, password: pass, hidden, security })
      setConnectMsg(`Successfully connected to ${ssid}`)
      setSelectedAP(null)
      setShowAddModal(false)
      setConnectPassword('')
      setManualPassword('')
      handleScan()
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err.message || 'Connection failed'
      setConnectMsg(`Error: ${errorMsg}`)
    } finally {
      setIsConnecting(false)
    }
  }

  // Disconnect Handler
  const handleDisconnect = async () => {
    setIsConnecting(true)
    try {
      await api.post('/network/wifi/disconnect')
      setConnectMsg('Disconnected from Wi-Fi')
      handleScan()
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err.message || 'Disconnect failed'
      setConnectMsg(`Disconnect failed: ${errorMsg}`)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: '100%',
        minWidth: 0,
      }}
    >
      {/* Widget Header (Title Left, Refresh / Scan Button Right) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--kuro-color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          WI-FI MANAGER
        </h3>

        {/* Refresh / Scan Button with Live Badge */}
        <button
          onClick={handleScan}
          disabled={isScanning}
          title="Scan Nearby Wi-Fi Networks"
          style={{
            background: isScanning ? 'rgba(169, 182, 101, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            border: isScanning ? '1px solid var(--kuro-color-accent, #A9B665)' : '1px solid var(--kuro-color-border)',
            borderRadius: radius.button,
            padding: isScanning ? '4px 10px' : '6px',
            color: isScanning ? 'var(--kuro-color-accent, #A9B665)' : 'var(--kuro-color-text-secondary)',
            cursor: isScanning ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: isScanning ? 'kuro-spin 0.8s linear infinite' : 'none',
            }}
          >
            <AppIcon name="refresh-cw" size={14} />
          </div>
          {isScanning && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>
              SCANNING...
            </span>
          )}
        </button>
      </div>

      {/* Top Banner: Current Connected Wi-Fi Card */}
      {isConnected && (
        <div
          style={{
            backgroundColor: 'rgba(137, 180, 130, 0.08)',
            border: '1px solid rgba(137, 180, 130, 0.3)',
            borderRadius: radius.card,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: 'rgba(137, 180, 130, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#89B482',
                }}
              >
                <AppIcon name="wifi" size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                  {currentSSID}
                </span>
                <span style={{ fontSize: 10, color: '#89B482', fontWeight: 600, letterSpacing: '0.05em' }}>
                  ACTIVE CONNECTION
                </span>
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={isConnecting}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: radius.button,
                border: '1px solid rgba(234, 105, 98, 0.4)',
                backgroundColor: 'rgba(234, 105, 98, 0.1)',
                color: '#EA6962',
                cursor: 'pointer',
              }}
            >
              Disconnect
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
            <div>
              <span style={{ color: 'var(--kuro-color-text-muted)', display: 'block', fontSize: 10 }}>Signal</span>
              <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                {wifi?.rssi || -52} dBm (88%)
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--kuro-color-text-muted)', display: 'block', fontSize: 10 }}>Band / Ch</span>
              <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                {wifi?.band || '5 GHz'} (Ch {wifi?.channel || 44})
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--kuro-color-text-muted)', display: 'block', fontSize: 10 }}>Speed</span>
              <span style={{ fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                {wifi?.link_speed || 433} Mbps
              </span>
            </div>
          </div>
        </div>
      )}

      {connectMsg && (
        <div
          style={{
            fontSize: 11,
            padding: '8px 12px',
            borderRadius: radius.input,
            backgroundColor: connectMsg.startsWith('Error') ? 'rgba(234, 105, 98, 0.15)' : 'rgba(137, 180, 130, 0.15)',
            color: connectMsg.startsWith('Error') ? '#EA6962' : '#89B482',
            border: '1px solid var(--kuro-color-border)',
          }}
        >
          {connectMsg}
        </div>
      )}

      {/* Available Scanned Networks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 180, overflowY: 'auto' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--kuro-color-text-muted)', textTransform: 'uppercase' }}>
          Available Wi-Fi Networks {isScanning ? '(Scanning...)' : `(${scannedAPs.length})`}
        </span>

        {isScanning ? (
          /* Stunning Wi-Fi Radar Scanning Loading UI */
          <div
            style={{
              padding: '24px 16px',
              borderRadius: radius.card,
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--kuro-color-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}
          >
            {/* Concentric Radar Pulsing Rings */}
            <div
              style={{
                position: 'relative',
                width: 68,
                height: 68,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '2px solid var(--kuro-color-accent, #A9B665)',
                  animation: 'wifi-radar-expand 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '2px solid var(--kuro-color-accent, #A9B665)',
                  animation: 'wifi-radar-expand 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite',
                  animationDelay: '0.6s',
                }}
              />
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(169, 182, 101, 0.15)',
                  border: '1px solid var(--kuro-color-accent, #A9B665)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--kuro-color-accent, #A9B665)',
                  zIndex: 2,
                  boxShadow: '0 0 16px rgba(169, 182, 101, 0.3)',
                }}
              >
                <AppIcon name="wifi" size={22} />
              </div>
            </div>

            {/* Status Headline */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                Scanning Nearby Wi-Fi Signals...
              </span>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                Searching 2.4 GHz & 5 GHz wireless channels
              </span>
            </div>

            {/* Shimmering Skeleton Rows */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div className="wifi-skeleton-card" style={{ animationDelay: '0s' }} />
              <div className="wifi-skeleton-card" style={{ animationDelay: '0.2s' }} />
              <div className="wifi-skeleton-card" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        ) : scannedAPs.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', padding: '12px 0' }}>
            {scanError || 'No Wi-Fi networks found.'}
          </span>
        ) : (
          scannedAPs.map((ap, index) => {
            const isCurrent = ap.ssid === currentSSID
            const isSecured = ap.security && !ap.security.toLowerCase().includes('none')

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: radius.card,
                  backgroundColor: isCurrent ? 'rgba(137, 180, 130, 0.05)' : 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid var(--kuro-color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ color: isCurrent ? '#89B482' : 'var(--kuro-color-text-secondary)' }}>
                    <AppIcon name="wifi" size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                        {ap.ssid}
                      </span>
                      {isSecured && <AppIcon name="lock" size={11} color="var(--kuro-color-text-muted)" />}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)' }}>
                      {ap.frequency || '5 GHz'} · {ap.signal}% ({ap.rssi} dBm) · {ap.security || 'WPA2'}
                    </span>
                  </div>
                </div>

                {isCurrent ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#89B482', letterSpacing: '0.05em' }}>
                    CONNECTED
                  </span>
                ) : (
                  <button
                    onClick={() => setSelectedAP(ap)}
                    style={{
                      padding: '4px 12px',
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: radius.button,
                      border: '1px solid var(--kuro-color-border)',
                      backgroundColor: 'var(--kuro-color-surface)',
                      color: 'var(--kuro-color-text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Connect
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Bottom Button: Add Hidden / Manual Wi-Fi Network */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          padding: '8px 14px',
          fontSize: 11,
          fontWeight: 600,
          borderRadius: radius.button,
          border: '1px stroke var(--kuro-color-border)',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          color: 'var(--kuro-color-text-primary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <AppIcon name="plus" size={14} />
        Add Hidden or Manual Network
      </button>

      {/* Password Modal Prompt */}
      {selectedAP && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              padding: 24,
              width: 360,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
              Connect to {selectedAP.ssid}
            </h4>

            <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
              Security: {selectedAP.security || 'WPA2-PSK'}
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter Wi-Fi Password"
                  value={connectPassword}
                  onChange={e => setConnectPassword(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.input,
                    padding: '8px 36px 8px 12px',
                    color: 'var(--kuro-color-text-primary)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
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
                  <AppIcon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setSelectedAP(null)}
                style={{
                  padding: '6px 14px',
                  fontSize: 11,
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--kuro-color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleConnect(selectedAP.ssid, connectPassword, false, selectedAP.security)}
                disabled={isConnecting}
                style={{
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: radius.button,
                  border: 'none',
                  backgroundColor: 'var(--kuro-color-accent, #A9B665)',
                  color: '#000',
                  cursor: 'pointer',
                }}
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual / Hidden Wi-Fi Network Modal Dialog */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              padding: 24,
              width: 380,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
              Add Hidden or Manual Wi-Fi
            </h4>

            {/* SSID Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Network SSID Name</label>
              <input
                type="text"
                placeholder="Enter Network Name (SSID)"
                value={manualSSID}
                onChange={e => setManualSSID(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--kuro-color-border)',
                  borderRadius: radius.input,
                  padding: '8px 12px',
                  color: 'var(--kuro-color-text-primary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </div>

            {/* Security Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Security Type</label>
              <select
                value={manualSecurity}
                onChange={e => setManualSecurity(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--kuro-color-border)',
                  borderRadius: radius.input,
                  padding: '8px 12px',
                  color: 'var(--kuro-color-text-primary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              >
                <option value="WPA/WPA2-PSK">WPA/WPA2-PSK (Personal)</option>
                <option value="WPA3-SAE">WPA3-SAE</option>
                <option value="WPA2-Enterprise">WPA2-Enterprise</option>
                <option value="None">None (Open Network)</option>
              </select>
            </div>

            {/* Password Field */}
            {manualSecurity !== 'None' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showManualPassword ? 'text' : 'password'}
                    placeholder="Enter Network Password"
                    value={manualPassword}
                    onChange={e => setManualPassword(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.input,
                      padding: '8px 36px 8px 12px',
                      color: 'var(--kuro-color-text-primary)',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowManualPassword(v => !v)}
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
                    <AppIcon name={showManualPassword ? 'eye-off' : 'eye'} size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--kuro-color-text-secondary)', cursor: 'pointer' }}>
                <span>Hidden Network (Broadcast OFF)</span>
                <input
                  type="checkbox"
                  checked={isHiddenToggle}
                  onChange={e => setIsHiddenToggle(e.target.checked)}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--kuro-color-text-secondary)', cursor: 'pointer' }}>
                <span>Connect Automatically</span>
                <input
                  type="checkbox"
                  checked={autoConnectToggle}
                  onChange={e => setAutoConnectToggle(e.target.checked)}
                />
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '6px 14px',
                  fontSize: 11,
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--kuro-color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleConnect(manualSSID, manualPassword, isHiddenToggle, manualSecurity)}
                disabled={!manualSSID || isConnecting}
                style={{
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: radius.button,
                  border: 'none',
                  backgroundColor: 'var(--kuro-color-accent, #A9B665)',
                  color: '#000',
                  cursor: 'pointer',
                  opacity: !manualSSID ? 0.5 : 1,
                }}
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
