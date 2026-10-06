/**
 * Dashboard Icons Catalog Loader & Search Utility
 * Fetches, caches, and indexes icons from walkxcode/dashboard-icons CDN
 */

export interface DashboardIconItem {
  slug: string
  name: string
}

export const WALKXCODE_CDN_PNG = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons@main/png'
export const WALKXCODE_CDN_SVG = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons@main/svg'

const CATALOG_STORAGE_KEY = 'kuro_dashboard_icons_catalog'

// Extensive fallback catalog of popular homelab and self-hosted apps
export const POPULAR_HOMELAB_ICONS: DashboardIconItem[] = [
  { slug: 'immich', name: 'Immich' },
  { slug: 'jellyfin', name: 'Jellyfin' },
  { slug: 'plex', name: 'Plex' },
  { slug: 'emby', name: 'Emby' },
  { slug: 'vaultwarden', name: 'Vaultwarden' },
  { slug: 'bitwarden', name: 'Bitwarden' },
  { slug: 'home-assistant', name: 'Home Assistant' },
  { slug: 'adguard-home', name: 'AdGuard Home' },
  { slug: 'pi-hole', name: 'Pi-hole' },
  { slug: 'nextcloud', name: 'Nextcloud' },
  { slug: 'owncloud', name: 'ownCloud' },
  { slug: 'nginx-proxy-manager', name: 'Nginx Proxy Manager' },
  { slug: 'nginx', name: 'Nginx' },
  { slug: 'traefik', name: 'Traefik' },
  { slug: 'caddy', name: 'Caddy' },
  { slug: 'portainer', name: 'Portainer' },
  { slug: 'docmost', name: 'Docmost' },
  { slug: 'kavita', name: 'Kavita' },
  { slug: 'komga', name: 'Komga' },
  { slug: 'baikal', name: 'Baikal' },
  { slug: 'radarr', name: 'Radarr' },
  { slug: 'sonarr', name: 'Sonarr' },
  { slug: 'lidarr', name: 'Lidarr' },
  { slug: 'readarr', name: 'Readarr' },
  { slug: 'prowlarr', name: 'Prowlarr' },
  { slug: 'bazarr', name: 'Bazarr' },
  { slug: 'overseerr', name: 'Overseerr' },
  { slug: 'jellyseerr', name: 'Jellyseerr' },
  { slug: 'tautulli', name: 'Tautulli' },
  { slug: 'qbittorrent', name: 'qBittorrent' },
  { slug: 'deluge', name: 'Deluge' },
  { slug: 'transmission', name: 'Transmission' },
  { slug: 'sabnzbd', name: 'SABnzbd' },
  { slug: 'paperless-ngx', name: 'Paperless-ngx' },
  { slug: 'uptime-kuma', name: 'Uptime Kuma' },
  { slug: 'grafana', name: 'Grafana' },
  { slug: 'prometheus', name: 'Prometheus' },
  { slug: 'influxdb', name: 'InfluxDB' },
  { slug: 'postgresql', name: 'PostgreSQL' },
  { slug: 'redis', name: 'Redis' },
  { slug: 'mariadb', name: 'MariaDB' },
  { slug: 'mysql', name: 'MySQL' },
  { slug: 'mongodb', name: 'MongoDB' },
  { slug: 'rabbitmq', name: 'RabbitMQ' },
  { slug: 'cloudflare', name: 'Cloudflare' },
  { slug: 'tailscale', name: 'Tailscale' },
  { slug: 'wireguard', name: 'WireGuard' },
  { slug: 'syncthing', name: 'Syncthing' },
  { slug: 'authentik', name: 'Authentik' },
  { slug: 'authelia', name: 'Authelia' },
  { slug: 'navidrome', name: 'Navidrome' },
  { slug: 'audiobookshelf', name: 'Audiobookshelf' },
  { slug: 'watchtower', name: 'Watchtower' },
  { slug: 'dozzle', name: 'Dozzle' },
  { slug: 'dockge', name: 'Dockge' },
  { slug: 'stirling-pdf', name: 'Stirling-PDF' },
  { slug: 'it-tools', name: 'IT-Tools' },
  { slug: 'frigate', name: 'Frigate' },
  { slug: 'scrypted', name: 'Scrypted' },
  { slug: 'mosquitto', name: 'Mosquitto' },
  { slug: 'node-red', name: 'Node-RED' },
  { slug: 'esphome', name: 'ESPHome' },
  { slug: 'zigbee2mqtt', name: 'Zigbee2MQTT' },
  { slug: 'speedtest-tracker', name: 'Speedtest Tracker' },
  { slug: 'changedetection-io', name: 'ChangeDetection' },
  { slug: 'photoprism', name: 'PhotoPrism' },
  { slug: 'romm', name: 'RomM' },
  { slug: 'mealie', name: 'Mealie' },
  { slug: 'grocy', name: 'Grocy' },
  { slug: 'vikunja', name: 'Vikunja' },
  { slug: 'actual-budget', name: 'Actual Budget' },
  { slug: 'visual-studio-code', name: 'VS Code' },
  { slug: 'docker', name: 'Docker' },
  { slug: 'ubuntu', name: 'Ubuntu' },
  { slug: 'debian', name: 'Debian' },
  { slug: 'alpine', name: 'Alpine' },
  { slug: 'arch-linux', name: 'Arch Linux' },
  { slug: 'pi-hole', name: 'Pi-hole' },
  { slug: 'scrutiny', name: 'Scrutiny' },
  { slug: 'netdata', name: 'Netdata' },
  { slug: 'cadvisor', name: 'cAdvisor' },
  { slug: 'glances', name: 'Glances' },
  { slug: 'dashy', name: 'Dashy' },
  { slug: 'homepage', name: 'Homepage' },
  { slug: 'homarr', name: 'Homarr' },
  { slug: 'glance', name: 'Glance' },
  { slug: 'unmanic', name: 'Unmanic' },
  { slug: 'tdarr', name: 'Tdarr' },
  { slug: 'flaresolverr', name: 'FlareSolverr' },
]

/**
 * Formats a slug into a human-readable title, e.g. "nginx-proxy-manager" -> "Nginx Proxy Manager"
 */
export function slugToTitle(slug: string): string {
  if (!slug) return ''
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

let memoryCatalog: DashboardIconItem[] | null = null

/**
 * Loads cached icon catalog from localStorage
 */
export function getCachedIconCatalog(): DashboardIconItem[] {
  if (memoryCatalog) return memoryCatalog
  if (typeof window === 'undefined') return POPULAR_HOMELAB_ICONS

  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCatalog = parsed
        return parsed
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached dashboard icons catalog:', e)
  }

  return POPULAR_HOMELAB_ICONS
}

/**
 * Fetches the full GitHub tree for walkxcode/dashboard-icons (4,000+ icons)
 */
export async function fetchFullIconCatalog(): Promise<DashboardIconItem[]> {
  const cached = getCachedIconCatalog()

  try {
    const response = await fetch('https://api.github.com/repos/walkxcode/dashboard-icons/git/trees/main?recursive=1')
    if (!response.ok) return cached

    const data = await response.json()
    if (!data.tree || !Array.isArray(data.tree)) return cached

    const iconSlugs: string[] = []
    const seen = new Set<string>()

    for (const item of data.tree) {
      if (item.path && item.path.startsWith('png/') && item.path.endsWith('.png')) {
        const slug = item.path.substring(4, item.path.length - 4)
        if (slug && !seen.has(slug)) {
          seen.add(slug)
          iconSlugs.push(slug)
        }
      }
    }

    if (iconSlugs.length > 0) {
      const items: DashboardIconItem[] = iconSlugs.map((slug) => ({
        slug,
        name: slugToTitle(slug),
      }))

      memoryCatalog = items
      try {
        localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(items))
      } catch {
        // LocalStorage quota might be exceeded, keep in memory
      }

      return items
    }
  } catch (e) {
    console.warn('Could not fetch remote dashboard icon catalog:', e)
  }

  return cached
}

/**
 * Filters icon catalog by query
 */
export function searchIconCatalog(catalog: DashboardIconItem[], query: string): DashboardIconItem[] {
  if (!query || !query.trim()) return catalog

  const q = query.trim().toLowerCase()
  return catalog.filter((item) => {
    return (
      item.slug.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q)
    )
  })
}
