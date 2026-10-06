import type { ContainerSummary, ContainerFilter, ContainerOrGroup } from "../types"

export function filterContainers(
  containers: ContainerSummary[],
  search: string,
  filter: ContainerFilter,
): ContainerSummary[] {
  let result = containers

  if (filter !== "all") {
    result = result.filter((c) => c.state === filter)
  }

  if (search.trim() !== "") {
    const q = search.toLowerCase()
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.image.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    )
  }

  return result
}

export function getContainerStateColor(state: string): "success" | "warning" | "error" | "default" {
  switch (state) {
    case "running":
      return "success"
    case "paused":
      return "warning"
    case "restarting":
      return "warning"
    case "exited":
    case "dead":
      return "error"
    default:
      return "default"
  }
}

export function getContainerStateLabel(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1)
}

import { formatDateTime } from "@/utils/format"

export function formatTime(iso: string): string {
  if (!iso || iso === '0001-01-01T00:00:00Z') return "--"
  return formatDateTime(iso)
}

export function formatCreated(iso: string): string {
  if (!iso) return "--"
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d ago`
  const hours = Math.floor(diff / 3600000)
  if (hours > 0) return `${hours}h ago`
  const minutes = Math.floor(diff / 60000)
  return `${minutes}m ago`
}

export function getIconForContainer(name: string, index: number = 0): string {
  const lowerName = name.toLowerCase()
  if (lowerName.includes('immich')) return '/docker-icons/immich.svg'
  if (lowerName.includes('vaultwarden')) return '/docker-icons/vaultwarden.svg'
  if (lowerName.includes('home-assistant') || lowerName.includes('hass')) return '/docker-icons/home-assistant.svg'
  if (lowerName.includes('baikal')) return '/docker-icons/baikal.svg'
  if (lowerName.includes('jellyfin')) return '/docker-icons/jellyfin.svg'
  if (lowerName.includes('navidrome')) return '/docker-icons/navidrome.svg'
  if (lowerName.includes('paperless')) return '/docker-icons/paperless-ng.svg'
  if (lowerName.includes('deluge')) return '/docker-icons/deluge.svg'
  if (lowerName.includes('cloudflare') || lowerName.includes('cloudflared')) return '/docker-icons/cloudflare-color.svg'
  if (lowerName.includes('webdav')) return '/docker-icons/webdav.png'
  
  const fallbacks = [
    'immich.svg',
    'vaultwarden.svg',
    'home-assistant.svg',
    'baikal.svg',
    'jellyfin.svg',
    'navidrome.svg',
  ]
  return `/docker-icons/${fallbacks[index % fallbacks.length]}`
}


export function groupContainers(containers: ContainerSummary[]): ContainerOrGroup[] {
  const groups = new Map<string, ContainerSummary[]>()
  const standalone: ContainerSummary[] = []

  for (const c of containers) {
    let groupName = c.project

    // Fallback: If no project, check for a common prefix (e.g., immich_server -> immich)
    if (!groupName) {
      const parts = c.name.replace(/^\//, '').split(/[-_]/)
      if (parts.length > 1) {
        groupName = parts[0]
      }
    }

    if (groupName) {
      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName)!.push(c)
    } else {
      standalone.push(c)
    }
  }

  const result: ContainerOrGroup[] = []

  for (const [name, groupContainers] of groups.entries()) {
    if (groupContainers.length === 1) {
      // If a group only has 1 container, it's just standalone
      result.push(groupContainers[0])
    } else {
      // Create a ContainerGroup
      const allRunning = groupContainers.every((c) => c.state === 'running')
      const allStopped = groupContainers.every((c) => c.state === 'exited' || c.state === 'dead' || c.state === 'created')
      const state = allRunning ? 'running' : allStopped ? 'stopped' : 'mixed'

      result.push({
        isGroup: true,
        name,
        containers: groupContainers.sort((a, b) => a.name.localeCompare(b.name)),
        state,
      })
    }
  }

  // Add standalone containers
  result.push(...standalone)

  // Sort groups and standalone containers alphabetically by name
  return result.sort((a, b) => {
    const nameA = ('isGroup' in a ? a.name : a.name.replace(/^\//, '')).toLowerCase()
    const nameB = ('isGroup' in b ? b.name : b.name.replace(/^\//, '')).toLowerCase()
    return nameA.localeCompare(nameB)
  })
}
