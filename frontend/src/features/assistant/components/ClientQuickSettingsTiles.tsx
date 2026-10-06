import React, { useState, useEffect, useCallback } from 'react'
import {
  Wifi,
  Radio,
  MapPin,
  Bluetooth,
  Bell,
  Vibrate,
  BellOff,
  Zap,
  Plane,
  Lock,
  RefreshCw,
} from 'lucide-react'
import {
  getNodeSystemStatus,
  setNodeSystemSetting,
  sendNodeSystemAction,
  type NodeSystemStatusResponse,
} from '../api/assistant'
import { useSnackbar } from '@/hooks/useSnackbar'

export interface ClientQuickSettingsTilesProps {
  nodeId: string
  onStatusUpdate?: (status: NodeSystemStatusResponse) => void
}

export const QuickSettingIconTile: React.FC<{
  icon: React.ReactNode
  title: string
  subtitle: string
  isActive: boolean
  isLoading?: boolean
  onClick: () => void
  activeColor: string
  glow?: boolean
  pulse?: boolean
}> = ({
  icon,
  title,
  subtitle,
  isActive,
  isLoading,
  onClick,
  activeColor,
  glow,
  pulse,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      title={`${title}: ${subtitle}`}
      aria-label={`${title}: ${subtitle}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 42,
        height: 42,
        borderRadius: 11,
        border: `1px solid ${isActive ? `${activeColor}80` : 'var(--kuro-color-border, rgba(255, 255, 255, 0.08))'}`,
        backgroundColor: isActive ? `${activeColor}22` : 'var(--kuro-color-surface, #1e1e1e)',
        color: isActive ? activeColor : 'var(--kuro-color-text-muted, #a89984)',
        cursor: isLoading ? 'wait' : 'pointer',
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: glow
          ? `0 0 16px ${activeColor}55`
          : isActive
          ? `0 2px 10px ${activeColor}28`
          : 'none',
        position: 'relative',
        flexShrink: 0,
        animation: pulse && isActive ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive && !isLoading) {
          e.currentTarget.style.backgroundColor = 'var(--kuro-color-hover, rgba(255, 255, 255, 0.06))'
          e.currentTarget.style.color = 'var(--kuro-color-text-primary, #ebdbb2)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive && !isLoading) {
          e.currentTarget.style.backgroundColor = 'var(--kuro-color-surface, #1e1e1e)'
          e.currentTarget.style.color = 'var(--kuro-color-text-muted, #a89984)'
          e.currentTarget.style.borderColor = 'var(--kuro-color-border, rgba(255, 255, 255, 0.08))'
        }
      }}
    >
      {isLoading ? <RefreshCw size={18} className="animate-spin" /> : icon}
    </button>
  )
}

export const ClientQuickSettingsTiles: React.FC<ClientQuickSettingsTilesProps> = ({
  nodeId,
  onStatusUpdate,
}) => {
  const { showSnackbar } = useSnackbar()
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // Local optimistic toggle states
  const [torch, setTorch] = useState<boolean>(false)
  const [wifi, setWifi] = useState<boolean>(false)
  const [mobileData, setMobileData] = useState<boolean>(false)
  const [location, setLocation] = useState<boolean>(false)
  const [bluetooth, setBluetooth] = useState<boolean>(false)
  const [ringerMode, setRingerMode] = useState<string>('normal')
  const [airplaneMode, setAirplaneMode] = useState<boolean>(false)
  const [dnd, setDnd] = useState<boolean>(false)

  const fetchStatus = useCallback(
    async (quiet = false) => {
      if (!nodeId) return
      try {
        const data = await getNodeSystemStatus(nodeId)
        if (onStatusUpdate) onStatusUpdate(data)
        if (data.toggles) {
          setTorch(!!data.toggles.torch)
          setWifi(!!data.toggles.wifi)
          setMobileData(!!data.toggles.mobile_data)
          setLocation(!!data.toggles.location)
          setBluetooth(!!data.toggles.bluetooth)
          setRingerMode(data.toggles.ringer_mode || 'normal')
          setAirplaneMode(!!data.toggles.airplane_mode)
          setDnd(!!data.toggles.dnd)
        }
      } catch (e: any) {
        if (!quiet) {
          showSnackbar(`Failed to load device status: ${e.message || 'Offline'}`, 'error')
        }
      }
    },
    [nodeId, onStatusUpdate, showSnackbar]
  )

  useEffect(() => {
    fetchStatus(true)
    const interval = setInterval(() => {
      fetchStatus(true)
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Generic toggle dispatcher with optimistic UI
  const handleToggle = async (setting: string, currentState: boolean, setter: (val: boolean) => void) => {
    const targetState = !currentState
    setter(targetState)
    setActionLoading((prev) => ({ ...prev, [setting]: true }))

    try {
      const res = await setNodeSystemSetting(nodeId, setting, targetState)
      if (res.status?.toggles) {
        if (onStatusUpdate && res.status) onStatusUpdate(res.status)
        setTorch(!!res.status.toggles.torch)
        setWifi(!!res.status.toggles.wifi)
        setMobileData(!!res.status.toggles.mobile_data)
        setLocation(!!res.status.toggles.location)
        setBluetooth(!!res.status.toggles.bluetooth)
        setRingerMode(res.status.toggles.ringer_mode || 'normal')
        setAirplaneMode(!!res.status.toggles.airplane_mode)
        setDnd(!!res.status.toggles.dnd)
      }
      showSnackbar(`${setting.replace('_', ' ').toUpperCase()} turned ${targetState ? 'ON' : 'OFF'}`)
    } catch (e: any) {
      setter(currentState) // Revert on failure
      showSnackbar(`Failed to toggle ${setting}: ${e.message}`, 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [setting]: false }))
    }
  }

  // Sound Mode tri-state switcher: Ring -> Vibrate -> Silent -> Ring
  const handleCycleRingerMode = async () => {
    const current = ringerMode.toLowerCase()
    let nextMode = 'normal'
    if (current === 'normal' || current === 'ring') {
      nextMode = 'vibrate'
    } else if (current === 'vibrate') {
      nextMode = 'silent'
    } else {
      nextMode = 'normal'
    }

    setRingerMode(nextMode)
    setActionLoading((prev) => ({ ...prev, ringer_mode: true }))

    try {
      const res = await setNodeSystemSetting(nodeId, 'ringer_mode', nextMode)
      if (res.status?.toggles) {
        if (onStatusUpdate && res.status) onStatusUpdate(res.status)
        setRingerMode(res.status.toggles.ringer_mode || nextMode)
      }
      const label = nextMode === 'normal' ? 'Ring' : nextMode === 'vibrate' ? 'Vibrate' : 'Silent'
      showSnackbar(`Sound mode set to ${label.toUpperCase()}`)
    } catch (e: any) {
      setRingerMode(current) // Revert on failure
      showSnackbar(`Failed to change sound mode: ${e.message}`, 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, ringer_mode: false }))
    }
  }

  // Lock screen
  const handleLockScreen = async () => {
    try {
      await sendNodeSystemAction(nodeId, 'system.lock')
      showSnackbar('Display locked successfully')
    } catch (e: any) {
      showSnackbar(`Lock screen failed: ${e.message}`, 'error')
    }
  }

  // Determine Sound Mode visual properties
  const normRinger = ringerMode.toLowerCase()
  const isVibrate = normRinger === 'vibrate'
  const isSilent = normRinger === 'silent' || normRinger === 'mute'

  const ringerIcon = isSilent ? (
    <BellOff size={19} />
  ) : isVibrate ? (
    <Vibrate size={19} />
  ) : (
    <Bell size={19} />
  )

  const ringerSubtitle = isSilent ? 'Silent' : isVibrate ? 'Vibrate' : 'Ring'
  const ringerColor = isSilent ? '#ef4444' : isVibrate ? '#f59e0b' : '#b8bb26'

  return (
    <div
      className="quick-settings-icon-dock"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 13,
        backgroundColor: 'var(--kuro-color-surface, #18191a)',
        border: '1px solid var(--kuro-color-border, rgba(255, 255, 255, 0.08))',
        width: 'fit-content',
        maxWidth: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
      }}
    >
      <style>{`
        .quick-settings-icon-dock::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Wi-Fi Tile */}
      <QuickSettingIconTile
        icon={<Wifi size={19} />}
        title="Wi-Fi"
        subtitle={wifi ? 'Enabled' : 'Disabled'}
        isActive={wifi}
        isLoading={actionLoading.wifi}
        onClick={() => handleToggle('wifi', wifi, setWifi)}
        activeColor="#38bdf8"
      />

      {/* Mobile Data Tile */}
      <QuickSettingIconTile
        icon={<Radio size={19} />}
        title="Mobile Data"
        subtitle={mobileData ? 'Active / On' : 'Disabled'}
        isActive={mobileData}
        isLoading={actionLoading.mobile_data}
        onClick={() => handleToggle('mobile_data', mobileData, setMobileData)}
        activeColor="#4ade80"
      />

      {/* Location / GPS Tile */}
      <QuickSettingIconTile
        icon={<MapPin size={19} />}
        title="Location / GPS"
        subtitle={location ? 'High Accuracy' : 'Off'}
        isActive={location}
        isLoading={actionLoading.location}
        onClick={() => handleToggle('location', location, setLocation)}
        activeColor="#f59e0b"
      />

      {/* Bluetooth Tile */}
      <QuickSettingIconTile
        icon={<Bluetooth size={19} />}
        title="Bluetooth"
        subtitle={bluetooth ? 'Enabled' : 'Disabled'}
        isActive={bluetooth}
        isLoading={actionLoading.bluetooth}
        onClick={() => handleToggle('bluetooth', bluetooth, setBluetooth)}
        activeColor="#60a5fa"
      />

      {/* Sound Mode Tile (Tri-state Switcher: Ring -> Vibrate -> Silent) */}
      <QuickSettingIconTile
        icon={ringerIcon}
        title="Sound Mode"
        subtitle={ringerSubtitle}
        isActive={true}
        isLoading={actionLoading.ringer_mode}
        onClick={handleCycleRingerMode}
        activeColor={ringerColor}
      />

      {/* Flashlight / Torch Tile */}
      <QuickSettingIconTile
        icon={<Zap size={19} />}
        title="Flashlight"
        subtitle={torch ? 'Torch ON' : 'Off'}
        isActive={torch}
        isLoading={actionLoading.torch}
        onClick={() => handleToggle('torch', torch, setTorch)}
        activeColor="#eab308"
        glow={torch}
      />

      {/* Do Not Disturb Tile */}
      <QuickSettingIconTile
        icon={<BellOff size={19} />}
        title="Do Not Disturb"
        subtitle={dnd ? 'DND Priority' : 'All Notifications'}
        isActive={dnd}
        isLoading={actionLoading.dnd}
        onClick={() => handleToggle('dnd', dnd, setDnd)}
        activeColor="#ec4899"
      />

      {/* Airplane Mode Tile */}
      <QuickSettingIconTile
        icon={<Plane size={19} />}
        title="Airplane Mode"
        subtitle={airplaneMode ? 'Radios Off' : 'Normal'}
        isActive={airplaneMode}
        isLoading={actionLoading.airplane_mode}
        onClick={() => handleToggle('airplane_mode', airplaneMode, setAirplaneMode)}
        activeColor="#a855f7"
      />

      {/* Lock Screen */}
      <QuickSettingIconTile
        icon={<Lock size={19} />}
        title="Lock Display"
        subtitle="Turn off & lock"
        isActive={false}
        isLoading={false}
        onClick={handleLockScreen}
        activeColor="#94a3b8"
      />
    </div>
  )
}

export default ClientQuickSettingsTiles
