'use client'

import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapPoint, MapMode } from './DiscoveryMap'
import { BLUR_PLACEHOLDER } from './Avatar'

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
  mapSize?: 'hidden' | 'small' | 'large'
  formatFilter?: string
}

// Format-specific SVG icons (24x24 viewBox, white fill)
const FORMAT_ICONS: Record<string, string> = {
  photo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>`,
  video: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
  audio: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M12 3v9.28a4.5 4.5 0 1 0 2 3.72V7h4V3h-6zM9.5 19a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`,
  text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
  infographic: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>`,
  illustration: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z"/></svg>`,
  vector: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 14H7v-4h4v4zm0-6H7V7h4v4zm6 6h-4v-4h4v4zm0-6h-4V7h4v4z"/></svg>`,
  story: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>`,
  article: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 7h10v3H7V7zm0 5h4v5H7v-5zm6 5v-5h4v5h-4z"/></svg>`,
  collection: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="100%" height="100%"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>`,
}

function getFormatIcon(formats?: string[]): string {
  if (!formats || formats.length === 0) return FORMAT_ICONS.photo
  const f = formats[0].toLowerCase()
  // Handle 'photograph' → 'photo' alias
  const key = f === 'photograph' ? 'photo' : f
  return FORMAT_ICONS[key] || FORMAT_ICONS.photo
}

function createMarkerIcon(point: MapPoint, mode: MapMode, isSelected: boolean, isHovered: boolean, formatFilter?: string): L.DivIcon {
  const size = mode === 'assets' ? Math.min(14 + (point.count ?? 0) * 1.5, 36) : 14

  if (mode === 'creators') {
    const borderColor = isSelected ? '#2563eb' : isHovered ? '#000' : 'rgba(0,0,0,0.3)'
    const borderWidth = isSelected ? '3px' : isHovered ? '2px' : '1.5px'
    const s = point.avatarUrl ? (isSelected ? size + 10 : isHovered ? size + 6 : size + 2) : (isSelected ? size + 8 : isHovered ? size + 4 : size)
    const imgSrc = point.avatarUrl || BLUR_PLACEHOLDER
    const blurStyle = point.avatarUrl ? '' : 'filter:blur(1px);'
    return L.divIcon({
      className: 'leaflet-marker-custom',
      html: `<div style="
        width:${s}px;height:${s}px;
        border:${borderWidth} solid ${borderColor};
        overflow:hidden;
        ${isSelected ? 'box-shadow:0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3);' : ''}
      "><img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;${blurStyle}" onerror="this.src='${BLUR_PLACEHOLDER}';this.style.filter='blur(1px)';" /></div>`,
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
    })
  }

  if (mode === 'assets') {
    const bg = isSelected ? '#1d4ed8' : '#2563eb'
    const opacity = isHovered && !isSelected ? '0.9' : isSelected ? '1' : '0.85'
    const count = point.count ?? 0
    const showCount = count > 1
    const filterKey = formatFilter?.toLowerCase()
    const iconSvg = filterKey && filterKey !== 'all' && FORMAT_ICONS[filterKey]
      ? FORMAT_ICONS[filterKey]
      : getFormatIcon(point.formats)
    const iconSize = Math.round(size * 0.55)
    return L.divIcon({
      className: 'leaflet-marker-custom',
      html: `<div style="
        width:${size}px;height:${size}px;
        background:${bg};opacity:${opacity};
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0px;
        ${isSelected ? 'box-shadow:0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3);' : ''}
        ${isHovered ? 'transform:scale(1.15);' : ''}
        transition:transform 0.15s;
      "><div style="width:${iconSize}px;height:${iconSize}px;">${iconSvg}</div>${showCount ? `<span style="font-size:6px;font-weight:bold;font-family:monospace;color:white;line-height:1;margin-top:-1px;">${count}</span>` : ''}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
  }

  // Stories mode — icon varies by filter (story/article/collection)
  const bg = isSelected ? '#1d4ed8' : '#2563eb'
  const s = isSelected ? 20 : isHovered ? 18 : 14
  const storyFilterKey = formatFilter?.toLowerCase()
  const storyIcon = storyFilterKey === 'article' ? FORMAT_ICONS.article
    : storyFilterKey === 'collection' ? FORMAT_ICONS.collection
    : FORMAT_ICONS.story
  const storyIconSize = Math.round(s * 0.6)
  return L.divIcon({
    className: 'leaflet-marker-custom',
    html: `<div style="
      width:${s}px;height:${s}px;
      background:${bg};
      display:flex;align-items:center;justify-content:center;
      ${isSelected ? 'box-shadow:0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3);' : ''}
      ${isHovered ? 'transform:scale(1.15);' : ''}
      transition:transform 0.15s;
    "><div style="width:${storyIconSize}px;height:${storyIconSize}px;">${storyIcon}</div></div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  })
}

function buildPopupHTML(point: MapPoint, mode: MapMode, isSelected: boolean): string {
  const trustBadgeHTML = point.trustBadge
    ? `<span style="font-size:5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.3px;padding:0 2px;border:1px solid ${point.trustBadge === 'verified' ? '#2563eb' : 'rgba(0,0,0,0.2)'};color:${point.trustBadge === 'verified' ? '#2563eb' : 'rgba(0,0,0,0.4)'};margin-left:3px;">${point.trustBadge}</span>`
    : ''

  const avatarImgSrc = mode === 'creators' ? (point.avatarUrl || BLUR_PLACEHOLDER) : ''
  const avatarBlur = mode === 'creators' && !point.avatarUrl ? 'filter:blur(2px);transform:scale(1.1);' : ''
  const avatarHTML = mode === 'creators'
    ? `<div style="width:16px;height:16px;flex-shrink:0;overflow:hidden;background:#e2e8f0;border:1px solid rgba(0,0,0,0.1);"><img src="${avatarImgSrc}" style="width:100%;height:100%;object-fit:cover;${avatarBlur}" onerror="this.src='${BLUR_PLACEHOLDER}';this.style.filter='blur(2px)';this.style.transform='scale(1.1)';" /></div>`
    : ''

  const storyImgSrc = mode === 'stories' ? (point.creatorAvatarUrl || BLUR_PLACEHOLDER) : ''
  const storyBlur = mode === 'stories' && !point.creatorAvatarUrl ? 'filter:blur(2px);transform:scale(1.1);' : ''
  const storyAvatarHTML = mode === 'stories'
    ? `<div style="width:12px;height:12px;flex-shrink:0;overflow:hidden;background:#e2e8f0;border:1px solid rgba(0,0,0,0.1);"><img src="${storyImgSrc}" style="width:100%;height:100%;object-fit:cover;${storyBlur}" onerror="this.src='${BLUR_PLACEHOLDER}';this.style.filter='blur(2px)';this.style.transform='scale(1.1)';" /></div>`
    : ''

  const statsHTML = [
    point.count !== undefined ? `<span style="font-size:6px;font-family:monospace;color:rgba(0,0,0,0.3);">${point.count} assets</span>` : '',
    point.storyCount !== undefined && point.storyCount > 0 ? `<span style="font-size:6px;color:rgba(0,0,0,0.15);">·</span><span style="font-size:6px;font-family:monospace;color:rgba(0,0,0,0.3);">${point.storyCount} stories</span>` : '',
    point.formats && point.formats.length > 0 ? `<span style="font-size:6px;text-transform:uppercase;letter-spacing:0.3px;color:rgba(0,0,0,0.25);">${point.formats.join(', ')}</span>` : '',
  ].filter(Boolean).join(' ')

  const thumbsHTML = point.sampleAssets.length > 0
    ? `<div style="display:flex;gap:1px;margin-top:3px;">${point.sampleAssets.slice(0, 4).map(a =>
      `<div style="flex:1;aspect-ratio:1;overflow:hidden;background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.08);position:relative;">
        <img src="${a.thumbnailUrl}" style="width:100%;height:100%;object-fit:cover;" />
        <span style="position:absolute;bottom:0;left:0;right:0;font-size:4px;font-weight:bold;text-transform:uppercase;letter-spacing:0.2px;background:rgba(0,0,0,0.7);color:white;padding:0 1px;text-align:center;line-height:1.4;">${a.format}</span>
      </div>`
    ).join('')}${point.sampleAssets.length > 4 ? `<div style="flex:1;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.08);font-size:6px;font-family:monospace;color:rgba(0,0,0,0.25);">+${point.sampleAssets.length - 4}</div>` : ''}</div>`
    : ''

  const contextHTML =
    mode === 'creators' && point.specialties && point.specialties.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:1px;margin-top:2px;">${point.specialties.slice(0, 3).map(s => `<span style="font-size:5px;color:rgba(0,0,0,0.3);border:1px solid rgba(0,0,0,0.06);padding:0 2px;">${s}</span>`).join('')}</div>`
      : mode === 'stories' && point.dek
        ? `<p style="font-size:6px;color:rgba(0,0,0,0.35);line-height:1.3;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${point.dek}</p>`
        : mode === 'assets' && point.creatorNames && point.creatorNames.length > 0
          ? `<p style="font-size:6px;color:rgba(0,0,0,0.3);margin-top:2px;">${point.creatorNames.slice(0, 3).join(' · ')}</p>`
          : ''

  const ctaText = isSelected ? 'Click "View" below' : 'Click to select'

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;min-width:120px;max-width:140px;">
      <div style="padding:4px 5px;border-bottom:1px solid rgba(0,0,0,0.08);">
        <div style="display:flex;align-items:flex-start;gap:4px;">
          ${avatarHTML}${storyAvatarHTML}
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;">
              <span style="font-size:8px;font-weight:bold;color:#000;line-height:1.2;">${point.label}</span>
              ${trustBadgeHTML}
            </div>
            <p style="font-size:6px;color:rgba(0,0,0,0.35);margin-top:1px;line-height:1;">${point.sublabel}</p>
            <div style="display:flex;align-items:center;gap:2px;margin-top:2px;">${statsHTML}</div>
          </div>
        </div>
      </div>
      ${thumbsHTML ? `<div style="padding:3px 4px;">${thumbsHTML}</div>` : ''}
      ${contextHTML ? `<div style="padding:0 4px 3px;">${contextHTML}</div>` : ''}
      <div style="padding:2px 4px;background:rgba(0,0,0,0.015);border-top:1px solid rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.3px;color:#2563eb;">${ctaText}</span>
        ${isSelected ? '<span style="width:3px;height:3px;background:#2563eb;display:inline-block;"></span>' : ''}
      </div>
    </div>
  `
}

export default function LeafletMap({ points, selectedId, hoveredId, onSelect, onHover, mode, mapSize, formatFilter }: LeafletMapProps) {
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

    // Add zoom control top-left (mode switcher occupies top-right)
    L.control.zoom({ position: 'topleft' }).addTo(map)

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

  // Invalidate map size when container dimensions change
  useEffect(() => {
    if (!mapRef.current) return
    setTimeout(() => mapRef.current?.invalidateSize(), 50)
  }, [mapSize])

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

      const icon = createMarkerIcon(point, mode, isSelected, isHovered, formatFilter)
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
  }, [points, selectedId, hoveredId, mode, formatFilter])

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
