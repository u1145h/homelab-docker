import { NetworkWidget } from './Component'
import type { NetworkWidgetProps } from './types'

const mockData: NetworkWidgetProps = {
  data: {
    interfaces: [
      { name: 'eth0', up: true, mtu: 1500, mac: '00:11:22:33:44:55', addresses: ['192.168.1.100'], rx_bytes: 1500000000, tx_bytes: 750000000, ssid: '' },
      { name: 'wlan0', up: false, mtu: 1500, mac: '66:77:88:99:aa:bb', addresses: null, rx_bytes: 0, tx_bytes: 536870912, ssid: '' },
    ],
    public_ip: { ip: "1.2.3.4", location: "Local", asn: "ISP" },
    gateway: "192.168.1.1",
    wifi_details: { ssid: "Mock-5G", security: "WPA3", band: "5GHz", channel: 36, link_speed: 1200, rssi: -50 },
    link_quality: { signal: 80, latency: 15, jitter: 2, loss: 0 },
    logs: [],
    speed_test_history: []
  },
}

export function NetworkPreview() {
  return <NetworkWidget {...mockData} />
}
