'use client'

import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapPoint, MapMode } from './DiscoveryMap'
import { BLUR_PLACEHOLDER } from './Avatar'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'

// ══════════════════════════════════════════════════════
// LEAFLET MAP — real cartography with monochrome tiles
// Custom markers, popups anchored at marker positions.
// ══════════════════════════════════════════════════════

// Monochrome tile layers — CartoDB Positron (light, clean, no color)
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'

export interface MapBounds { north: number; south: number; east: number; west: number }

interface LeafletMapProps {
  points: MapPoint[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  onHoverPosition?: (data: { id: string; x: number; y: number } | null) => void
  mode: MapMode
  mapSize?: 'hidden' | 'small' | 'large'
  formatFilter?: string
  onBoundsChange?: (bounds: MapBounds) => void
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
  // ── Tiny asset-card marker for all point types ──
  // Every marker is a square thumbnail tile — a miniature Frontfiles asset card.
  // Creator markers use the avatar; asset/story markers use the first sample asset thumbnail.

  const isCreator = point.pointType === 'creator' || mode === 'creators'

  // Size: compact square, slightly larger for selected/hovered
  const s = isSelected ? 40 : isHovered ? 36 : 32

  // Image source: creator avatar or first sample asset matching the active format filter
  const thumbSrc = isCreator
    ? (point.avatarUrl || null)
    : (() => {
        const assets = point.sampleAssets || []
        if (formatFilter && formatFilter !== 'All') {
          const match = assets.find(a => a.format.toLowerCase() === formatFilter.toLowerCase())
          return match ? resolveProtectedUrl(match.id, 'thumbnail') : null
        }
        return assets[0] ? resolveProtectedUrl(assets[0].id, 'thumbnail') : null
      })()

  // Border treatment: hard-edged, visible, editorial
  const borderColor = isSelected ? '#000' : isHovered ? '#000' : 'rgba(0,0,0,0.35)'
  const borderWidth = isSelected ? '2px' : '1px'

  // Selected accent: thin blue top edge
  const accentBar = isSelected
    ? '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:#0000ff;"></div>'
    : ''

  // Count badge: small monospace count in bottom-right corner for clusters
  const count = point.count ?? 0
  const countBadge = count > 1
    ? `<span style="position:absolute;bottom:0;right:0;font-size:7px;font-weight:bold;font-family:monospace;color:white;background:rgba(0,0,0,0.7);padding:0 2px;line-height:1.4;">${count}</span>`
    : ''

  if (thumbSrc) {
    // Primary path: image-driven asset card
    return L.divIcon({
      className: 'leaflet-marker-custom',
      html: `<div style="
        width:${s}px;height:${s}px;
        border:${borderWidth} solid ${borderColor};
        overflow:hidden;position:relative;background:#f1f5f9;
        ${isHovered && !isSelected ? 'transform:scale(1.06);' : ''}
        transition:transform 0.12s;
      "><img src="${thumbSrc}" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;" onerror="this.style.display='none';" />${accentBar}${countBadge}</div>`,
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
    })
  }

  // Fallback: no image — cover-card style with title text on dark background
  if (isCreator) {
    const initials = point.initials || point.label?.slice(0, 2).toUpperCase() || ''
    return L.divIcon({
      className: 'leaflet-marker-custom',
      html: `<div style="width:${s}px;height:${s}px;border:${borderWidth} solid ${borderColor};overflow:hidden;position:relative;background:#e2e8f0;display:flex;align-items:center;justify-content:center;${isHovered && !isSelected ? 'transform:scale(1.06);' : ''}transition:transform 0.12s;"><span style="font-size:9px;font-weight:900;font-family:system-ui,sans-serif;color:rgba(0,0,0,0.35);">${initials}</span>${accentBar}${countBadge}</div>`,
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
    })
  }

  // Text/Audio/other assets without thumbnails — editorial cover card
  const titleText = point.sampleAssets?.[0]?.title || point.label || ''
  const truncTitle = titleText.length > 18 ? titleText.slice(0, 18) : titleText
  const fmtTag = (formatFilter && formatFilter !== 'All' ? formatFilter : point.formats?.[0] || '').toUpperCase()
  return L.divIcon({
    className: 'leaflet-marker-custom',
    html: `<div style="width:${s}px;height:${s}px;border:${borderWidth} solid ${borderColor};overflow:hidden;position:relative;background:#1a1a1a;display:flex;flex-direction:column;justify-content:flex-end;padding:2px;box-sizing:border-box;${isHovered && !isSelected ? 'transform:scale(1.06);' : ''}transition:transform 0.12s;"><span style="font-size:5px;font-weight:800;font-family:system-ui,sans-serif;color:#fff;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${truncTitle}</span><span style="position:absolute;top:1px;left:2px;font-size:4px;font-weight:bold;font-family:monospace;color:rgba(255,255,255,0.4);letter-spacing:0.5px;">${fmtTag}</span>${accentBar}${countBadge}</div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  })
}

function buildPopupHTML(point: MapPoint, mode: MapMode, isSelected: boolean): string {
  const effectiveMode = point.pointType === 'creator' ? 'creators'
    : point.pointType === 'story' ? 'stories'
    : point.pointType === 'asset' ? 'assets'
    : mode

  const trustBadgeHTML = point.trustBadge
    ? `<span style="font-size:5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.3px;padding:0 2px;border:1px solid ${point.trustBadge === 'verified' ? '#2563eb' : 'rgba(0,0,0,0.2)'};color:${point.trustBadge === 'verified' ? '#2563eb' : 'rgba(0,0,0,0.4)'};margin-left:3px;">${point.trustBadge}</span>`
    : ''

  const avatarImgSrc = effectiveMode === 'creators' ? (point.avatarUrl || BLUR_PLACEHOLDER) : ''
  const avatarBlur = effectiveMode === 'creators' && !point.avatarUrl ? 'filter:blur(2px);transform:scale(1.1);' : ''
  const avatarHTML = effectiveMode === 'creators'
    ? `<div style="width:16px;height:16px;flex-shrink:0;overflow:hidden;background:#e2e8f0;border:1px solid rgba(0,0,0,0.1);"><img src="${avatarImgSrc}" style="width:100%;height:100%;object-fit:cover;${avatarBlur}" onerror="this.src='${BLUR_PLACEHOLDER}';this.style.filter='blur(2px)';this.style.transform='scale(1.1)';" /></div>`
    : ''

  const storyImgSrc = effectiveMode === 'stories' ? (point.creatorAvatarUrl || BLUR_PLACEHOLDER) : ''
  const storyBlur = effectiveMode === 'stories' && !point.creatorAvatarUrl ? 'filter:blur(2px);transform:scale(1.1);' : ''
  const storyAvatarHTML = effectiveMode === 'stories'
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
        <img src="${resolveProtectedUrl(a.id, 'thumbnail')}" style="width:100%;height:100%;object-fit:cover;" />
        <span style="position:absolute;bottom:0;left:0;right:0;font-size:4px;font-weight:bold;text-transform:uppercase;letter-spacing:0.2px;background:rgba(0,0,0,0.7);color:white;padding:0 1px;text-align:center;line-height:1.4;">${a.format}</span>
      </div>`
    ).join('')}${point.sampleAssets.length > 4 ? `<div style="flex:1;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.08);font-size:6px;font-family:monospace;color:rgba(0,0,0,0.25);">+${point.sampleAssets.length - 4}</div>` : ''}</div>`
    : ''

  const contextHTML =
    effectiveMode === 'creators' && point.specialties && point.specialties.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:1px;margin-top:2px;">${point.specialties.slice(0, 3).map(s => `<span style="font-size:5px;color:rgba(0,0,0,0.3);border:1px solid rgba(0,0,0,0.06);padding:0 2px;">${s}</span>`).join('')}</div>`
      : effectiveMode === 'stories' && point.dek
        ? `<p style="font-size:6px;color:rgba(0,0,0,0.35);line-height:1.3;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${point.dek}</p>`
        : effectiveMode === 'assets' && point.creatorNames && point.creatorNames.length > 0
          ? `<p style="font-size:6px;color:rgba(0,0,0,0.3);margin-top:2px;">${point.creatorNames.slice(0, 3).join(' · ')}</p>`
          : ''

  const ctaText = effectiveMode === 'creators' ? 'Click to view creator'
    : isSelected ? 'Click "View" below'
    : 'Click to select'

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

export default function LeafletMap({ points, selectedId, hoveredId, onSelect, onHover, onHoverPosition, mode, mapSize, formatFilter, onBoundsChange }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const popupRef = useRef<L.Popup | null>(null)

  // Stable callback refs to avoid stale closures
  const onSelectRef = useRef(onSelect)
  const onHoverRef = useRef(onHover)
  const onHoverPositionRef = useRef(onHoverPosition)
  const onBoundsChangeRef = useRef(onBoundsChange)
  const selectedIdRef = useRef(selectedId)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { onHoverRef.current = onHover }, [onHover])
  useEffect(() => { onHoverPositionRef.current = onHoverPosition }, [onHoverPosition])
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange }, [onBoundsChange])
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // Track previous state for targeted marker icon updates
  const prevPointsRef = useRef<MapPoint[] | null>(null)
  const prevModeRef = useRef<MapMode | null>(null)
  const prevFilterRef = useRef<string | undefined>(undefined)
  const prevHoveredRef = useRef<string | null>(null)
  const prevSelectedRef = useRef<string | null>(null)
  const pointsRef = useRef(points)
  useEffect(() => { pointsRef.current = points }, [points])

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

    // Fire viewport bounds on every move/zoom and on init.
    // Defensive: the map pane's internal `_leaflet_pos` may be unset during
    // StrictMode double-mount or on very early timer fires. Guard with a
    // destroyed flag + try/catch and clear the init timer on cleanup so we
    // never call getBounds() on a torn-down map.
    let destroyed = false
    const fireBounds = () => {
      if (destroyed || mapRef.current !== map) return
      try {
        const b = map.getBounds()
        onBoundsChangeRef.current?.({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        })
      } catch {
        // Map not fully initialized yet (pane position unset) — skip.
      }
    }
    map.on('moveend', fireBounds)
    map.on('zoomend', fireBounds)
    const initBoundsTimer = setTimeout(fireBounds, 200)

    return () => {
      destroyed = true
      clearTimeout(initBoundsTimer)
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [])

  // Invalidate map size when container dimensions change
  useEffect(() => {
    if (!mapRef.current) return
    setTimeout(() => mapRef.current?.invalidateSize(), 50)
  }, [mapSize])

  // Update markers — recreates only when data changes; hover/selection just updates icons
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const dataChanged = points !== prevPointsRef.current || mode !== prevModeRef.current || formatFilter !== prevFilterRef.current || markersRef.current.size === 0

    if (dataChanged) {
      // Full marker recreation — data actually changed
      markersRef.current.forEach(m => m.remove())
      markersRef.current.clear()
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }

      points.forEach(point => {
        const icon = createMarkerIcon(point, mode, point.id === selectedId, point.id === hoveredId, formatFilter)
        const marker = L.marker([point.lat, point.lng], { icon })

        marker.on('click', () => {
          onSelectRef.current(point.id === selectedIdRef.current ? null : point.id)
        })
        marker.on('mouseover', () => {
          onHoverRef.current(point.id)
          if (mapRef.current) {
            const pt = mapRef.current.latLngToContainerPoint(marker.getLatLng())
            onHoverPositionRef.current?.({ id: point.id, x: pt.x, y: pt.y })
          }
        })
        marker.on('mouseout', () => {
          onHoverRef.current(null)
          onHoverPositionRef.current?.(null)
        })

        marker.addTo(map)
        markersRef.current.set(point.id, marker)
      })
    } else {
      // Hover/selection change only — update just the affected markers' icons (no recreation)
      const changed = new Set<string>()
      if (prevHoveredRef.current) changed.add(prevHoveredRef.current)
      if (hoveredId) changed.add(hoveredId)
      if (prevSelectedRef.current) changed.add(prevSelectedRef.current)
      if (selectedId) changed.add(selectedId)

      changed.forEach(id => {
        const marker = markersRef.current.get(id)
        const point = points.find(p => p.id === id)
        if (marker && point) {
          marker.setIcon(createMarkerIcon(point, mode, id === selectedId, id === hoveredId, formatFilter))
        }
      })
    }

    prevPointsRef.current = points
    prevModeRef.current = mode
    prevFilterRef.current = formatFilter
    prevHoveredRef.current = hoveredId
    prevSelectedRef.current = selectedId

    // Update popup for hovered or selected point
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
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
