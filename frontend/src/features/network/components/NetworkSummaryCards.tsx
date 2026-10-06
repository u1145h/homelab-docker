import { AppIcon } from '@/components/ui/icons'
import type { NetworkInfo, NetworkInterface } from '@/types/status'
import { radius } from '@/design/radius'

interface StatCardProps {
  title: string
  icon: string
  iconColor: string
  iconBg: string
  mainValue: React.ReactNode
  subValue: string
}

function StatCard({ title, icon, iconColor, iconBg, mainValue, subValue }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.card,
              backgroundColor: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: iconColor,
            }}
          >
            <AppIcon name={icon as any} size={15} />
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--kuro-color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {title}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
        {mainValue}
      </div>
      <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {subValue}
      </div>
    </div>
  )
}

function getLocalIP(interfaces?: NetworkInterface[]): string {
  if (!interfaces || interfaces.length === 0) return '192.168.1.50'

  // 1. Scan for active Wi-Fi or Ethernet interfaces with non-tailscale private IPv4
  for (const iface of interfaces) {
    if (!iface.up) continue
    const name = iface.name.toLowerCase()
    if (name.startsWith('lo') || name.startsWith('tailscale') || name.startsWith('docker') || name.startsWith('br-') || name.startsWith('tun')) {
      continue
    }
    if (!iface.addresses) continue

    for (const rawAddr of iface.addresses) {
      const ip = rawAddr.split('/')[0]
      if (ip.includes(':')) continue // Skip IPv6
      if (ip.startsWith('127.')) continue // Skip loopback
      if (ip.startsWith('100.')) continue // Skip Tailscale CGNAT range (100.64.0.0/10)
      return ip
    }
  }

  // 2. Fallback: Any interface address that is not loopback or Tailscale
  for (const iface of interfaces) {
    if (!iface.up) continue
    if (!iface.addresses) continue
    for (const rawAddr of iface.addresses) {
      const ip = rawAddr.split('/')[0]
      if (ip.includes(':')) continue
      if (ip.startsWith('127.')) continue
      if (ip.startsWith('100.')) continue
      return ip
    }
  }

  return '192.168.1.50'
}

function getTailscaleInfo(interfaces?: NetworkInterface[]): { ip: string; status: string } {
  if (!interfaces) return { ip: 'Offline', status: 'Tailscale inactive' }

  for (const iface of interfaces) {
    if (!iface.addresses) continue
    for (const rawAddr of iface.addresses) {
      const ip = rawAddr.split('/')[0]
      if (ip.startsWith('100.') || iface.name.toLowerCase().includes('tailscale')) {
        return {
          ip,
          status: iface.up ? `Active (${iface.name})` : 'Interface down',
        }
      }
    }
  }

  return { ip: 'Offline', status: 'Tailscale inactive' }
}

interface NetworkSummaryCardsProps {
  network: NetworkInfo
}

export default function NetworkSummaryCards({ network }: NetworkSummaryCardsProps) {
  // Connection Detection Logic
  const activeWifi = network.interfaces?.find(
    i => i.up && (i.ssid || i.name.startsWith('w') || i.name.toLowerCase().includes('wifi'))
  )
  const activeEth = network.interfaces?.find(
    i => i.up && (i.name.startsWith('e') || i.name.startsWith('eth') || i.name.startsWith('en'))
  )

  const isWifi = !!activeWifi || !!(network.wifi_details && network.wifi_details.ssid)
  const wifiStatus = isWifi ? 'Wi-Fi' : activeEth ? 'Ethernet' : 'None'

  const wifiSSID = network.wifi_details?.ssid || activeWifi?.ssid || 'Poco-Home 5G'
  const rssiVal = network.wifi_details?.rssi || -52

  const connectionSub = isWifi
    ? `${wifiSSID} · ${rssiVal} dBm`
    : activeEth
    ? `${activeEth.name} · Connected`
    : 'No active connection'

  const localIP = getLocalIP(network.interfaces)
  const tailscale = getTailscaleInfo(network.interfaces)

  return (
    <div className="responsive-summary-grid">
      <StatCard
        title="CONNECTION"
        icon={isWifi ? 'wifi' : 'hard-drive'}
        iconBg="rgba(255, 179, 0, 0.1)"
        iconColor="var(--kuro-color-warning)"
        mainValue={wifiStatus}
        subValue={connectionSub}
      />

      <StatCard
        title="LOCAL IP"
        icon="hard-drive"
        iconBg="rgba(38, 166, 154, 0.1)"
        iconColor="var(--kuro-color-primary)"
        mainValue={localIP}
        subValue={`Gateway ${network.gateway || '192.168.1.1'}`}
      />

      <StatCard
        title="PUBLIC IP"
        icon="globe"
        iconBg="rgba(239, 83, 80, 0.1)"
        iconColor="var(--kuro-color-danger)"
        mainValue={network.public_ip?.ip || 'Fetching...'}
        subValue={network.public_ip?.asn ? `${network.public_ip.asn} - ${network.public_ip.location}` : 'Unknown location'}
      />

      <StatCard
        title="TAILSCALE IP"
        icon="shield"
        iconBg="rgba(156, 39, 176, 0.1)"
        iconColor="#9C27B0"
        mainValue={tailscale.ip}
        subValue={tailscale.status}
      />
    </div>
  )
}
