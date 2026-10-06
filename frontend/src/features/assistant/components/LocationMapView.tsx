import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import { useThemeMode } from '@/hooks/useThemeMode'
import { formatDateTime } from '@/utils/format'
import type { DeviceLocation } from '../types'

interface LocationMapViewProps {
  currentLocation?: DeviceLocation | null
  locations?: DeviceLocation[]
  height?: number | string
  isLiveTracking?: boolean
  onToggleLiveTrack?: () => void
  isTogglingLiveTrack?: boolean
}

export default function LocationMapView({
  currentLocation,
  locations = [],
  height = 460,
  isLiveTracking = false,
  onToggleLiveTrack,
  isTogglingLiveTrack = false,
}: LocationMapViewProps) {
  const { mode, isAmoled } = useThemeMode()
  const isDark = mode === 'dark' || !!isAmoled
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const liveMarkerRef = useRef<L.Marker | null>(null)
  const accuracyCircleRef = useRef<L.Circle | null>(null)
  const historyLayerGroupRef = useRef<L.LayerGroup | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)

  const [showHistoryTrail, setShowHistoryTrail] = useState(true)

  // Default coordinate: homelab default or live location or first history item
  const activeLat = currentLocation?.latitude || (locations.length > 0 ? locations[0].latitude : 20.5937)
  const activeLon = currentLocation?.longitude || (locations.length > 0 ? locations[0].longitude : 78.9629)
  const hasValidLocation = (currentLocation && (currentLocation.latitude !== 0 || currentLocation.longitude !== 0)) ||
    (locations.length > 0 && (locations[0].latitude !== 0 || locations[0].longitude !== 0))

  // 1. Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [activeLat, activeLon],
        zoom: hasValidLocation ? 16 : 4,
        zoomControl: false,
        attributionControl: false,
      })

      // Add custom positioned zoom controls
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Add clean attribution
      L.control.attribution({ position: 'bottomleft', prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors')
        .addTo(map)

      // Add High-Visibility Keyless Dark Theme Tile Layer
      const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      const newTileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: 'abc',
        className: 'kuro-dark-map-tiles',
      }).addTo(map)
      tileLayerRef.current = newTileLayer

      historyLayerGroupRef.current = L.layerGroup().addTo(map)
      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // 3. Render Live Marker, Accuracy Halo, and Historical Track
  useEffect(() => {
    const map = mapInstanceRef.current
    const historyGroup = historyLayerGroupRef.current
    if (!map || !historyGroup) return

    historyGroup.clearLayers()

    // ── Live Marker ──
    if (liveMarkerRef.current) {
      map.removeLayer(liveMarkerRef.current)
      liveMarkerRef.current = null
    }
    if (accuracyCircleRef.current) {
      map.removeLayer(accuracyCircleRef.current)
      accuracyCircleRef.current = null
    }

    const activePoint = currentLocation || (locations.length > 0 ? locations[0] : null)

    if (activePoint && (activePoint.latitude !== 0 || activePoint.longitude !== 0)) {
      const lat = activePoint.latitude
      const lon = activePoint.longitude

      // Pulsing live custom icon
      const livePulseHtml = `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background-color: rgba(215, 153, 33, 0.35); animation: kuroPulse 2s infinite ease-out;"></div>
          <div style="width: 14px; height: 14px; border-radius: 50%; background-color: #d79921; border: 2.5px solid #FFFFFF; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>
        </div>
      `

      const liveIcon = L.divIcon({
        className: 'kuro-live-marker',
        html: livePulseHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

      const liveMarker = L.marker([lat, lon], { icon: liveIcon, zIndexOffset: 1000 }).addTo(map)

      const popupContent = `
        <div style="font-family: inherit; min-width: 190px; padding: 2px 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-family: var(--kuro-font-mono, monospace); font-weight: 800; font-size: 11.5px; color: #d79921; background: rgba(215, 153, 33, 0.18); border: 1px solid rgba(215, 153, 33, 0.3); padding: 2px 7px; border-radius: 5px;">
              ● LIVE POSITION
            </span>
            ${activePoint.accuracy ? `<span style="font-size: 10px; font-weight: 600; color: #a89984; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">±${activePoint.accuracy.toFixed(0)}m</span>` : ''}
          </div>
          <div style="font-size: 14.5px; font-weight: 700; color: #fbf1c7; line-height: 1.3; margin-bottom: 6px; font-family: var(--kuro-font-mono, monospace);">
            ${formatDateTime(activePoint.timestamp)}
          </div>
          <div style="font-size: 11.5px; font-weight: 600; color: #d5c4a1; font-family: var(--kuro-font-mono, monospace); margin-bottom: ${activePoint.address ? '4px' : '8px'};">
            ${lat.toFixed(6)}, ${lon.toFixed(6)}
          </div>
          ${activePoint.address ? `
            <div style="font-size: 11px; color: #a89984; line-height: 1.35; margin-bottom: 8px; border-left: 2px solid rgba(215, 153, 33, 0.4); padding-left: 6px;">
              ${activePoint.address}
            </div>
          ` : ''}
          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; margin-top: 4px;">
            <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}" target="_blank" style="font-size: 11px; color: #d79921; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              OpenStreetMap ↗
            </a>
          </div>
        </div>
      `

      liveMarker.bindPopup(popupContent, {
        className: isDark ? 'kuro-dark-popup' : 'kuro-light-popup',
      })

      liveMarkerRef.current = liveMarker

      // Accuracy radius halo
      if (activePoint.accuracy && activePoint.accuracy > 0 && activePoint.accuracy < 1000) {
        const circle = L.circle([lat, lon], {
          radius: activePoint.accuracy,
          color: '#d79921',
          weight: 1,
          opacity: 0.4,
          fillColor: '#d79921',
          fillOpacity: 0.08,
        }).addTo(map)
        accuracyCircleRef.current = circle
      }
    }

    // ── Location History Breadcrumb Polyline & Waypoints ──
    if (showHistoryTrail && locations.length > 1) {
      // Sort chronologically ascending for polyline path
      const sortedLocations = [...locations].sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
      const latLngs: [number, number][] = sortedLocations
        .filter((l) => l.latitude !== 0 || l.longitude !== 0)
        .map((l) => [l.latitude, l.longitude])

      if (latLngs.length > 1) {
        const polyline = L.polyline(latLngs, {
          color: isDark ? '#a9b665' : '#7daea3',
          weight: 3,
          opacity: 0.75,
          dashArray: '5, 8',
          lineCap: 'round',
        })
        historyGroup.addLayer(polyline)
        polylineRef.current = polyline
      }

      // Add small circle waypoints
      sortedLocations.forEach((loc, idx) => {
        if (loc.latitude === 0 && loc.longitude === 0) return

        const isLatest = idx === sortedLocations.length - 1
        if (isLatest) return // already handled by live marker

        const waypointIcon = L.divIcon({
          className: 'kuro-waypoint-marker',
          html: `
            <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${isDark ? '#8ec07c' : '#458588'}; border: 1.5px solid #FFFFFF; box-shadow: 0 0 4px rgba(0,0,0,0.4); cursor: pointer;"></div>
          `,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        })

        const marker = L.marker([loc.latitude, loc.longitude], { icon: waypointIcon })
        marker.bindPopup(`
          <div style="font-family: inherit; min-width: 190px; padding: 2px 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-family: var(--kuro-font-mono, monospace); font-weight: 800; font-size: 13px; color: #b8bb26; background: rgba(184, 187, 38, 0.18); border: 1px solid rgba(184, 187, 38, 0.3); padding: 2px 8px; border-radius: 6px;">
                #${idx + 1}
              </span>
              ${loc.accuracy ? `<span style="font-size: 10px; font-weight: 600; color: #a89984; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">±${loc.accuracy.toFixed(0)}m</span>` : ''}
            </div>
            <div style="font-size: 14.5px; font-weight: 700; color: #fbf1c7; line-height: 1.3; margin-bottom: 6px; font-family: var(--kuro-font-mono, monospace);">
              ${formatDateTime(loc.timestamp)}
            </div>
            <div style="font-size: 11.5px; font-weight: 600; color: #d5c4a1; font-family: var(--kuro-font-mono, monospace); margin-bottom: ${loc.address ? '4px' : '8px'};">
              ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}
            </div>
            ${loc.address ? `
              <div style="font-size: 11px; color: #a89984; line-height: 1.35; margin-bottom: 8px; border-left: 2px solid rgba(184, 187, 38, 0.4); padding-left: 6px;">
                ${loc.address}
              </div>
            ` : ''}
            <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; margin-top: 4px;">
              <a href="https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=17/${loc.latitude}/${loc.longitude}" target="_blank" style="font-size: 11px; color: #b8bb26; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                OpenStreetMap ↗
              </a>
            </div>
          </div>
        `, {
          className: isDark ? 'kuro-dark-popup' : 'kuro-light-popup',
        })

        historyGroup.addLayer(marker)
      })
    }
  }, [currentLocation, locations, showHistoryTrail, isDark])

  // 4. Auto-pan map to live coordinate during Live Tracking
  useEffect(() => {
    if (!isLiveTracking || !currentLocation || !mapInstanceRef.current) return
    if (currentLocation.latitude !== 0 || currentLocation.longitude !== 0) {
      mapInstanceRef.current.panTo([currentLocation.latitude, currentLocation.longitude], { animate: true, duration: 0.8 })
    }
  }, [isLiveTracking, currentLocation?.latitude, currentLocation?.longitude])

  // Center to live location
  const handleRecenter = () => {
    const map = mapInstanceRef.current
    if (!map) return
    const activePoint = currentLocation || (locations.length > 0 ? locations[0] : null)
    if (activePoint && (activePoint.latitude !== 0 || activePoint.longitude !== 0)) {
      map.flyTo([activePoint.latitude, activePoint.longitude], 16, { duration: 1.2 })
      if (liveMarkerRef.current) {
        liveMarkerRef.current.openPopup()
      }
    }
  }

  // Fit all historical points in view
  const handleFitBounds = () => {
    const map = mapInstanceRef.current
    if (!map || locations.length === 0) return
    const validLocs = locations.filter((l) => l.latitude !== 0 || l.longitude !== 0)
    if (validLocs.length === 0) return
    const bounds = L.latLngBounds(validLocs.map((l) => [l.latitude, l.longitude]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }

  const latestPoint = currentLocation || (locations.length > 0 ? locations[0] : null)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: radius.card,
        overflow: 'hidden',
        border: '1px solid var(--kuro-color-border)',
        backgroundColor: isDark ? '#141516' : '#FAFAFA',
      }}
    >
      <style>{`
        @keyframes kuroPulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .kuro-dark-popup .leaflet-popup-content-wrapper {
          background-color: #1a1b1d !important;
          color: #f3f3f3 !important;
          border: 1px solid #2e3135 !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
        }
        .kuro-dark-popup .leaflet-popup-tip {
          background-color: #1a1b1d !important;
        }
        .kuro-light-popup .leaflet-popup-content-wrapper {
          background-color: #ffffff !important;
          color: #1a1b1d !important;
          border: 1px solid #e0e0e0 !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
        }
        .kuro-light-popup .leaflet-popup-tip {
          background-color: #ffffff !important;
        }
      `}</style>

      {/* Map DOM Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Top Floating Controls Bar */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {/* Coordinates & Status Badge Overlay */}
        <div
          style={{
            backgroundColor: isDark ? 'rgba(20, 21, 22, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.button,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            pointerEvents: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: hasValidLocation ? '#8ec07c' : '#fe8019',
              boxShadow: hasValidLocation ? '0 0 6px rgba(142,192,124,0.6)' : 'none',
              flexShrink: 0,
            }}
          />
          {latestPoint ? (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--kuro-color-text-primary)',
                fontFamily: 'monospace',
                letterSpacing: 0.2,
              }}
            >
              {latestPoint.latitude.toFixed(4)}, {latestPoint.longitude.toFixed(4)}
            </span>
          ) : (
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--kuro-color-text-muted)' }}>
              No GPS fix
            </span>
          )}
        </div>

        {/* Top-Right Utility Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
          {locations.length > 1 && (
            <button
              onClick={handleFitBounds}
              title="Fit all waypoints into view"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                backgroundColor: isDark ? 'rgba(20, 21, 22, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                border: '1px solid var(--kuro-color-border)',
                color: 'var(--kuro-color-text-primary)',
                borderRadius: radius.button,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}
            >
              <AppIcon name="maximize-2" size={14} />
            </button>
          )}

          <button
            onClick={handleRecenter}
            title="Recenter to live device location"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              backgroundColor: isDark ? 'rgba(20, 21, 22, 0.88)' : 'rgba(255, 255, 255, 0.92)',
              border: '1px solid var(--kuro-color-border)',
              color: 'var(--kuro-color-primary)',
              borderRadius: radius.button,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            <AppIcon name="crosshair" size={14} />
          </button>
        </div>
      </div>

      {/* Bottom-Left Controls: Route and Live Track */}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 12,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'auto',
        }}
      >
        {locations.length > 1 && (
          <button
            onClick={() => setShowHistoryTrail(!showHistoryTrail)}
            title={showHistoryTrail ? 'Hide history track' : 'Show history track'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: showHistoryTrail ? 'rgba(215, 153, 33, 0.18)' : (isDark ? 'rgba(20, 21, 22, 0.88)' : 'rgba(255, 255, 255, 0.92)'),
              border: `1px solid ${showHistoryTrail ? 'var(--kuro-color-primary)' : 'var(--kuro-color-border)'}`,
              color: showHistoryTrail ? 'var(--kuro-color-primary)' : 'var(--kuro-color-text-primary)',
              borderRadius: radius.button,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            <AppIcon name="git-commit" size={13} />
            <span>Route</span>
          </button>
        )}

        {onToggleLiveTrack && (
          <button
            onClick={onToggleLiveTrack}
            disabled={isTogglingLiveTrack}
            title={isLiveTracking ? 'Stop Live GPS Streaming' : 'Start Live GPS Streaming'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: isLiveTracking ? 'rgba(235, 111, 146, 0.22)' : 'rgba(215, 153, 33, 0.18)',
              border: `1px solid ${isLiveTracking ? '#eb6f92' : 'var(--kuro-color-primary)'}`,
              color: isLiveTracking ? '#eb6f92' : 'var(--kuro-color-primary)',
              borderRadius: radius.button,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 700,
              cursor: isTogglingLiveTrack ? 'not-allowed' : 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: isLiveTracking ? '0 0 12px rgba(235, 111, 146, 0.4)' : '0 2px 8px rgba(0,0,0,0.12)',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: isLiveTracking ? '#eb6f92' : 'var(--kuro-color-primary)',
                animation: isLiveTracking ? 'kuroPulse 1.2s infinite' : 'none',
              }}
            />
            <AppIcon name="radio" size={13} />
            <span>{isTogglingLiveTrack ? 'Connecting...' : (isLiveTracking ? 'Live Tracking (ON)' : 'Live Track')}</span>
          </button>
        )}
      </div>

      <style>{`
        .kuro-dark-map-tiles .leaflet-tile {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) !important;
        }
        .kuro-dark-popup .leaflet-popup-content-wrapper,
        .kuro-dark-popup .leaflet-popup-tip {
          background-color: #18191a !important;
          color: #ebdbb2 !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
        }
        .leaflet-container {
          background-color: #14161b !important;
        }
      `}</style>
    </div>
  )
}
