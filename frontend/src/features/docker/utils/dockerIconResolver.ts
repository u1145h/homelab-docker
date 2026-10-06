/**
 * Walkxcode Dashboard Icons CDN Resolver and Normalizer
 */

export const WALKXCODE_CDN_BASE = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons@main'
export const WALKXCODE_RAW_BASE = 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main'
export const SELFHST_CDN_BASE = 'https://cdn.jsdelivr.net/gh/selfhst/icons'

export const POPULAR_ICON_PRESETS = [
  { slug: 'immich', name: 'Immich' },
  { slug: 'jellyfin', name: 'Jellyfin' },
  { slug: 'plex', name: 'Plex' },
  { slug: 'vaultwarden', name: 'Vaultwarden' },
  { slug: 'home-assistant', name: 'Home Assistant' },
  { slug: 'adguard-home', name: 'AdGuard Home' },
  { slug: 'pi-hole', name: 'Pi-hole' },
  { slug: 'nextcloud', name: 'Nextcloud' },
  { slug: 'nginx-proxy-manager', name: 'Nginx Proxy Manager' },
  { slug: 'traefik', name: 'Traefik' },
  { slug: 'caddy', name: 'Caddy' },
  { slug: 'portainer', name: 'Portainer' },
  { slug: 'docmost', name: 'Docmost' },
  { slug: 'kavita', name: 'Kavita' },
  { slug: 'baikal', name: 'Baikal' },
  { slug: 'radarr', name: 'Radarr' },
  { slug: 'sonarr', name: 'Sonarr' },
  { slug: 'prowlarr', name: 'Prowlarr' },
  { slug: 'qbittorrent', name: 'qBittorrent' },
  { slug: 'deluge', name: 'Deluge' },
  { slug: 'transmission', name: 'Transmission' },
  { slug: 'paperless-ngx', name: 'Paperless-ngx' },
  { slug: 'uptime-kuma', name: 'Uptime Kuma' },
  { slug: 'grafana', name: 'Grafana' },
  { slug: 'prometheus', name: 'Prometheus' },
  { slug: 'postgresql', name: 'PostgreSQL' },
  { slug: 'redis', name: 'Redis' },
  { slug: 'mariadb', name: 'MariaDB' },
  { slug: 'mongodb', name: 'MongoDB' },
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
  { slug: 'mosquitto', name: 'Mosquitto' },
  { slug: 'node-red', name: 'Node-RED' },
  { slug: 'esphome', name: 'ESPHome' },
  { slug: 'speedtest-tracker', name: 'Speedtest Tracker' },
]

/**
 * Common image / container name aliases mapped to Walkxcode CDN slugs
 */
export const HOMELAB_ICON_ALIASES: Record<string, string> = {
  // Media, Photos & Books
  immich: 'immich',
  'immich-server': 'immich',
  'immich-microservices': 'immich',
  'immich-machine-learning': 'immich',
  'immich-web': 'immich',
  jellyfin: 'jellyfin',
  plex: 'plex',
  plexmediaserver: 'plex',
  emby: 'emby',
  photoprism: 'photoprism',
  navidrome: 'navidrome',
  audiobookshelf: 'audiobookshelf',
  calibre: 'calibre-web',
  'calibre-web': 'calibre-web',
  komga: 'komga',
  kavita: 'kavita',
  romm: 'romm',

  // *arr stack & Downloads
  radarr: 'radarr',
  sonarr: 'sonarr',
  lidarr: 'lidarr',
  readarr: 'readarr',
  prowlarr: 'prowlarr',
  bazarr: 'bazarr',
  overseerr: 'overseerr',
  jellyseerr: 'jellyseerr',
  tautulli: 'tautulli',
  qbittorrent: 'qbittorrent',
  qbit: 'qbittorrent',
  deluge: 'deluge',
  transmission: 'transmission',
  'transmission-openvpn': 'transmission',
  sabnzbd: 'sabnzbd',
  unmanic: 'unmanic',
  tdarr: 'tdarr',
  flaresolverr: 'flaresolverr',

  // Security, Auth & Passwords
  vaultwarden: 'vaultwarden',
  bitwarden: 'vaultwarden',
  authentik: 'authentik',
  authelia: 'authelia',

  // Networking, DNS & Reverse Proxy
  adguard: 'adguard-home',
  'adguard-home': 'adguard-home',
  adguardhome: 'adguard-home',
  pihole: 'pi-hole',
  'pi-hole': 'pi-hole',
  cloudflare: 'cloudflare',
  cloudflared: 'cloudflare',
  tailscale: 'tailscale',
  wireguard: 'wireguard',
  'nginx-proxy-manager': 'nginx-proxy-manager',
  npm: 'nginx-proxy-manager',
  nginx: 'nginx',
  traefik: 'traefik',
  caddy: 'caddy',

  // Smart Home & IoT
  'home-assistant': 'home-assistant',
  homeassistant: 'home-assistant',
  hass: 'home-assistant',
  zigbee2mqtt: 'zigbee2mqtt',
  mosquitto: 'mosquitto',
  'node-red': 'node-red',
  nodered: 'node-red',
  esphome: 'esphome',
  frigate: 'frigate',
  scrypted: 'scrypted',
  tasmoadmin: 'tasmoadmin',
  'zwave-js-ui': 'z-wave',

  // Cloud, Docs, Notes & Sync
  docmost: 'docmost',
  nextcloud: 'nextcloud',
  owncloud: 'owncloud',
  'paperless-ngx': 'paperless-ngx',
  paperless: 'paperless-ngx',
  'paperless-ng': 'paperless-ngx',
  syncthing: 'syncthing',
  webdav: 'webdav',
  baikal: 'baikal',
  'baïkal': 'baikal',
  minio: 'minio',
  duplicati: 'duplicati',
  restic: 'restic',
  'stirling-pdf': 'stirling-pdf',
  'it-tools': 'it-tools',
  'changedetection-io': 'changedetection-io',
  changedetection: 'changedetection-io',

  // Monitoring & Dashboards
  'uptime-kuma': 'uptime-kuma',
  kuma: 'uptime-kuma',
  grafana: 'grafana',
  prometheus: 'prometheus',
  influxdb: 'influxdb',
  loki: 'loki',
  portainer: 'portainer',
  'portainer-ce': 'portainer',
  watchtower: 'watchtower',
  dockge: 'dockge',
  dozzle: 'dozzle',
  glances: 'glances',
  cadvisor: 'cadvisor',
  dashy: 'dashy',
  homepage: 'homepage',
  homarr: 'homarr',
  glance: 'glance',
  'speedtest-tracker': 'speedtest-tracker',
  speedtest: 'speedtest-tracker',
  scrutiny: 'scrutiny',
  netdata: 'netdata',

  // Databases & Brokers
  postgres: 'postgresql',
  postgresql: 'postgresql',
  redis: 'redis',
  mariadb: 'mariadb',
  mysql: 'mysql',
  mongo: 'mongodb',
  mongodb: 'mongodb',
  rabbitmq: 'rabbitmq',

  // Productivity
  mealie: 'mealie',
  grocy: 'grocy',
  vikunja: 'vikunja',
  'actual-budget': 'actual-budget',
  actual: 'actual-budget',
  vscode: 'visual-studio-code',
  'code-server': 'visual-studio-code',
}

/**
 * Extracts a clean slug from an image string, e.g. "ghcr.io/immich-app/immich-server:v1.94.0" -> "immich-server"
 */
export function extractSlugFromImage(image: string): string {
  if (!image) return ''
  // 1. Remove tag or hash (@sha256:... or :latest)
  let clean = image.split('@')[0].split(':')[0]
  // 2. Remove registry prefix (ghcr.io/, docker.io/, quay.io/)
  const parts = clean.split('/')
  const lastPart = parts[parts.length - 1]
  return lastPart.toLowerCase().trim()
}

/**
 * Normalizes container or stack name, stripping leading slash and common suffix descriptors
 */
export function extractSlugFromName(name: string): string {
  if (!name) return ''
  let clean = name.replace(/^\//, '').toLowerCase().trim()
  // Strip trailing descriptors like " stack", "-stack", "_stack", "-app", " App", "-server", etc.
  clean = clean.replace(/[-_\s]+(stack|group|compose|server|web|app|backend|frontend|service|db|redis|postgres|postgresql|mysql|mariadb|worker|\d+)$/i, '')
  clean = clean.replace(/[-_\s]+(stack|group|compose|server|web|app|backend|frontend|service|db|redis|postgres|postgresql|mysql|mariadb|worker|\d+)$/i, '')
  return clean.trim()
}

/**
 * Detects the most accurate icon slug for a container or group
 */
export function detectContainerSlug(input: string | { name: string; image?: string; labels?: Record<string, string> }): string {
  if (typeof input === 'string') {
    const raw = input.toLowerCase().trim()
    if (HOMELAB_ICON_ALIASES[raw]) return HOMELAB_ICON_ALIASES[raw]
    
    const fromName = extractSlugFromName(raw)
    if (HOMELAB_ICON_ALIASES[fromName]) return HOMELAB_ICON_ALIASES[fromName]
    
    for (const [key, slug] of Object.entries(HOMELAB_ICON_ALIASES)) {
      if (raw === key || raw.startsWith(`${key}-`) || raw.startsWith(`${key}_`) || raw.startsWith(`${key} `) || raw.includes(key)) {
        return slug
      }
    }
    return fromName || raw
  }

  // 1. Check explicit container labels
  if (input.labels) {
    const labelKeys = ['net.homelab.icon', 'kuro.icon', 'homepage.icon', 'glance.icon', 'dashy.icon', 'icon']
    for (const k of labelKeys) {
      if (input.labels[k]) {
        const lVal = input.labels[k].toLowerCase().trim()
        if (HOMELAB_ICON_ALIASES[lVal]) return HOMELAB_ICON_ALIASES[lVal]
        return lVal
      }
    }
  }

  // 2. Check image name
  if (input.image) {
    const imgSlug = extractSlugFromImage(input.image)
    if (HOMELAB_ICON_ALIASES[imgSlug]) return HOMELAB_ICON_ALIASES[imgSlug]
    // Check if any alias keyword is contained in image
    for (const [key, slug] of Object.entries(HOMELAB_ICON_ALIASES)) {
      if (imgSlug === key || imgSlug.includes(key)) return slug
    }
  }

  // 3. Check container name
  const nameSlug = extractSlugFromName(input.name)
  if (HOMELAB_ICON_ALIASES[nameSlug]) return HOMELAB_ICON_ALIASES[nameSlug]
  for (const [key, slug] of Object.entries(HOMELAB_ICON_ALIASES)) {
    const rawLower = input.name.toLowerCase()
    if (nameSlug === key || nameSlug.includes(key) || rawLower.includes(key)) return slug
  }

  return nameSlug || 'docker'
}

/**
 * Returns candidate icon URLs in priority order for `<ContainerIcon />`
 */
export function getDockerIconUrls(
  input: string | { name: string; image?: string; labels?: Record<string, string> },
  customOverride?: string | null
): string[] {
  const urls: string[] = []

  // 1. Custom override (if user provided a full URL or custom slug)
  if (customOverride && customOverride.trim()) {
    const trimmed = customOverride.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('data:')) {
      urls.push(trimmed)
    } else {
      const customSlug = detectContainerSlug(trimmed)
      urls.push(`${WALKXCODE_CDN_BASE}/png/${customSlug}.png`)
      urls.push(`${WALKXCODE_CDN_BASE}/svg/${customSlug}.svg`)
      urls.push(`${WALKXCODE_RAW_BASE}/png/${customSlug}.png`)
      urls.push(`${WALKXCODE_RAW_BASE}/svg/${customSlug}.svg`)
      urls.push(`${SELFHST_CDN_BASE}/png/${customSlug}.png`)
      urls.push(`/docker-icons/${customSlug}.svg`)
      urls.push(`/docker-icons/${customSlug}.png`)
    }
  }

  // 2. Auto-detected slug from Walkxcode CDN & fallbacks
  const slug = detectContainerSlug(input)
  if (slug) {
    urls.push(`${WALKXCODE_CDN_BASE}/png/${slug}.png`)
    urls.push(`${WALKXCODE_CDN_BASE}/svg/${slug}.svg`)
    urls.push(`${WALKXCODE_RAW_BASE}/png/${slug}.png`)
    urls.push(`${WALKXCODE_RAW_BASE}/svg/${slug}.svg`)
    urls.push(`${SELFHST_CDN_BASE}/png/${slug}.png`)
    urls.push(`${SELFHST_CDN_BASE}/svg/${slug}.svg`)
    urls.push(`/docker-icons/${slug}.svg`)
    urls.push(`/docker-icons/${slug}.png`)
    urls.push(`/docker-icons/${slug}.webp`)
  }

  return urls
}
