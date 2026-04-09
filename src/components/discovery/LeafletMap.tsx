'use client'

import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapPoint, MapMode } from './DiscoveryMap'

// ══════════════════════════════════════════════════════
// LEAFLET MAP — real cartography with monochrome tiles
// Custom markers, popups anchored at marker positions.
// ══════════════════════════════════════════════════════

// Monochrome tile layers — CartoDB Positron (light, clean, no color)
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'

interface LeafletMapProps {
  points: MapPoint[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  mode: MapMode
}

function createMarkerIcon(point: MapPoint, mode: MapMode, isSelected: boolean, isHovered: boolean): L.DivIcon {
  const size = mode === 'assets' ? Math.min(12 + (point.count ?? 0) * 1.5, 32) : 14

  if (mode === 'creators' && point.avatarUrl) {
    const borderColor = isSelected ? '#2563eb' : isHovered ? '#000' : 'rgba(0,0,0,0.3)'
    const borderWidth = isSelected ? '3px' : isHovered ? '2px' : '1.5px'
    const ringSize = isSelected ? size + 10 : isHovered ? size + 6 : size + 2
    return L.divIcon({
      className: 'leaflet-marker-custom',
      html: `<div style="
        width:${ringSize}px;height:${ringSize}px;
        border:${borderWidth} solid ${borderColor};
        background:url(${point.avatarUrl}) center/cover;
        ${isSelected ? 'box-shadow:0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3);' : ''}
      "></div>`,
      iconSize: [ringSize, ringSize],
      iconAnchor: [ringSize / 2, ringSize / 2],
    })
  }

  if (mode === 'creators' && point.initials) {
    const bg = isSelected ? '#2563eb' : '#000'
    const s = isSelected ? size + 8 : isHovered ? size + 4 : size
    return L.divIcon({
      className: 'leaflet-marker-custom',
      html: `<div style="
        width:${s}px;height:${s}px;
        background:${bg};color:white;
        display:flex;align-items:center;justify-content:center;
        font-size:7px;font-weight:bold;letter-spacing:0.5px;
        ${isSelected ? 'box-shadow:0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3);' : ''}
      ">${point.initials}</div>`,
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
    })
  }

  if (mode === 'assets') {
    const bg = isSelected ? '#2563eb' : '#000'
    const opacity = isHovered && !isSelected ? '0.6' : isSelected ? '1' : '0.8'
    const count = point.count ?? 0
    const showCount = count > 1
    return L.divIcon({
      className: 'leaflet-marker-custom',
      html: `<div style="
        width:${size}px;height:${size}px;
        background:${bg};opacity:${opacity};
        display:flex;align-items:center;justify-content:center;
        font-size:8px;font-weight:bold;font-family:monospace;color:white;
        ${isSelected ? 'box-shadow:0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3);' : ''}
      ">${showCount ? count : ''}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
  }

  // Stories mode — dot marker
  const bg = isSelected ? '#2563eb' : '#000'
  const s = isSelected ? 12 : isHovered ? 10 : 8
  return L.divIcon({
    className: 'leaflet-marker-custom',
    html: `<div style="
      width:${s}px;height:${s}px;
      background:${bg};
      ${isSelected ? 'box-shadow:0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3);' : ''}
    "></div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  })
}

function buildPopupHTML(point: MapPoint, mode: MapMode, isSelected: boolean): string {
  const trustBadgeHTML = point.trustBadge
    ? `<span style="font-size:7px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;padding:1px 4px;border:1px solid ${point.trustBadge === 'verified' ? '#2563eb' : 'rgba(0,0,0,0.2)'};color:${point.trustBadge === 'verified' ? '#2563eb' : 'rgba(0,0,0,0.4)'};margin-left:6px;">${point.trustBadge}</span>`
    : ''

  const avatarHTML = mode === 'creators' && point.avatarUrl
    ? `<div style="width:32px;height:32px;flex-shrink:0;overflow:hidden;background:#f1f5f9;border:1px solid rgba(0,0,0,0.1);"><img src="${point.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" /></div>`
    : mode === 'creators' && point.initials
      ? `<div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#000;color:white;font-size:10px;font-weight:bold;">${point.initials}</div>`
      : ''

  const storyAvatarHTML = mode === 'stories' && point.creatorAvatarUrl
    ? `<div style="width:24px;height:24px;flex-shrink:0;overflow:hidden;border:1px solid rgba(0,0,0,0.1);"><img src="${point.creatorAvatarUrl}" style="width:100%;height:100%;object-fit:cover;" /></div>`
    : ''

  const statsHTML = [
    point.count !== undefined ? `<span style="font-size:8px;font-family:monospace;color:rgba(0,0,0,0.3);">${point.count} assets</span>` : '',
    point.storyCount !== undefined && point.storyCount > 0 ? `<span style="font-size:8px;color:rgba(0,0,0,0.15);">·</span><span style="font-size:8px;font-family:monospace;color:rgba(0,0,0,0.3);">${point.storyCount} stories</span>` : '',
    point.formats && point.formats.length > 0 ? `<span style="font-size:8px;text-transform:uppercase;letter-spacing:0.5px;color:rgba(0,0,0,0.25);">${point.formats.join(', ')}</span>` : '',
  ].filter(Boolean).join(' ')

  const thumbsHTML = point.sampleAssets.length > 0
    ? `<div style="display:flex;gap:2px;margin-top:6px;">${point.sampleAssets.slice(0, 5).map(a =>
      `<div style="flex:1;aspect-ratio:1;overflow:hidden;background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.08);position:relative;">
        <img src="${a.thumbnailUrl}" style="width:100%;height:100%;object-fit:cover;" />
        <span style="position:absolute;bottom:0;left:0;right:0;font-size:5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.3px;background:rgba(0,0,0,0.7);color:white;padding:0 2px;text-align:center;line-height:1.4;">${a.format}</span>
      </div>`
    ).join('')}${point.sampleAssets.length > 5 ? `<div style="flex:1;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.08);font-size:8px;font-family:monospace;color:rgba(0,0,0,0.25);">+${point.sampleAssets.length - 5}</div>` : ''}</div>`
    : ''

  const contextHTML =
    mode === 'creators' && point.specialties && point.specialties.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:4px;">${point.specialties.map(s => `<span style="font-size:7px;color:rgba(0,0,0,0.3);border:1px solid rgba(0,0,0,0.06);padding:1px 3px;">${s}</span>`).join('')}</div>`
      : mode === 'stories' && point.dek
        ? `<p style="font-size:8px;color:rgba(0,0,0,0.35);line-height:1.4;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${point.dek}</p>`
        : mode === 'assets' && point.creatorNames && point.creatorNames.length > 0
          ? `<p style="font-size:8px;color:rgba(0,0,0,0.3);margin-top:4px;">${point.creatorNames.slice(0, 3).join(' · ')}</p>`
          : ''

  const ctaText = isSelected ? 'Click "View" below' : 'Click marker to select'

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;min-width:240px;max-width:280px;">
      <div style="padding:8px 10px;border-bottom:1px solid rgba(0,0,0,0.08);">
        <div style="display:flex;align-items:flex-start;gap:8px;">
          ${avatarHTML}${storyAvatarHTML}
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;">
              <span style="font-size:11px;font-weight:bold;color:#000;line-height:1.2;">${point.label}</span>
              ${trustBadgeHTML}
            </div>
            <p style="font-size:8px;color:rgba(0,0,0,0.35);margin-top:2px;line-height:1;">${point.sublabel}</p>
            <div style="display:flex;align-items:center;gap:4px;margin-top:4px;">${statsHTML}</div>
          </div>
        </div>
      </div>
      ${thumbsHTML ? `<div style="padding:6px 8px;">${thumbsHTML}</div>` : ''}
      ${contextHTML ? `<div style="padding:0 8px 6px;">${contextHTML}</div>` : ''}
      <div style="padding:4px 8px;background:rgba(0,0,0,0.015);border-top:1px solid rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:7px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#2563eb;">${ctaText}</span>
        ${isSelected ? '<span style="width:5px;height:5px;background:#2563eb;display:inline-block;"></span>' : ''}
      </div>
    </div>
  `
}

export default function LeafletMap({ points, selectedId, hoveredId, onSelect, onHover, mode }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const popupRef = useRef<L.Popup | null>(null)

  // Stable callback refs to avoid stale closures
  const onSelectRef = useRef(onSelect)
  const onHoverRef = useRef(onHover)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { onHoverRef.current = onHover }, [onHover])

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [30, 20],
      zoom: 2,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: false,
      attributionControl: false,
    })

    // Add zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map)

    // Add attribution bottom-right (small)
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map)

    // Monochrome tiles
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update markers when points/mode/selection/hover change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current.clear()

    // Close any open popup
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    // Add new markers
    points.forEach(point => {
      const isSelected = point.id === selectedId
      const isHovered = point.id === hoveredId

      const icon = createMarkerIcon(point, mode, isSelected, isHovered)
      const marker = L.marker([point.lat, point.lng], { icon })

      marker.on('click', () => {
        onSelectRef.current(point.id === selectedId ? null : point.id)
      })
      marker.on('mouseover', () => {
        onHoverRef.current(point.id)
      })
      marker.on('mouseout', () => {
        onHoverRef.current(null)
      })

      marker.addTo(map)
      markersRef.current.set(point.id, marker)
    })

    // Show popup for hovered or selected point
    const activeId = hoveredId ?? selectedId
    const activePoint = activeId ? points.find(p => p.id === activeId) : null
    if (activePoint) {
      const popup = L.popup({
        closeButton: false,
        closeOnClick: false,
        className: 'discovery-popup',
        maxWidth: 300,
        minWidth: 240,
        offset: [0, -8],
        autoPan: false,
      })
        .setLatLng([activePoint.lat, activePoint.lng])
        .setContent(buildPopupHTML(activePoint, mode, !!selectedId && selectedId === activeId))
        .openOn(map)

      popupRef.current = popup
    }
  }, [points, selectedId, hoveredId, mode])

  // Inject custom styles for the popup
  useEffect(() => {
    const styleId = 'discovery-popup-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .discovery-popup .leaflet-popup-content-wrapper {
        border-radius: 0 !important;
        padding: 0 !important;
        border: 2px solid #000 !important;
        box-shadow: 6px 6px 0 rgba(0,0,0,0.06) !important;
      }
      .discovery-popup .leaflet-popup-content {
        margin: 0 !important;
      }
      .discovery-popup .leaflet-popup-tip {
        border: 2px solid #000 !important;
        background: white !important;
        box-shadow: none !important;
      }
      .leaflet-marker-custom {
        background: transparent !important;
        border: none !important;
      }
      .leaflet-control-zoom a {
        border-radius: 0 !important;
        border: 2px solid #000 !important;
        color: #000 !important;
        font-weight: bold !important;
        width: 28px !important;
        height: 28px !important;
        line-height: 24px !important;
        font-size: 14px !important;
      }
      .leaflet-control-zoom a:hover {
        background: #000 !important;
        color: white !important;
      }
      .leaflet-control-zoom-in {
        border-bottom: none !important;
      }
      .leaflet-control-attribution {
        font-size: 7px !important;
        background: rgba(255,255,255,0.7) !important;
        color: rgba(0,0,0,0.3) !important;
      }
      .leaflet-control-attribution a {
        color: rgba(0,0,0,0.4) !important;
      }
    `
    document.head.appendChild(style)
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full" />
  )
}
