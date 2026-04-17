'use client'

/**
 * MapBand — Full-width map band that sits above the results grid.
 *
 * Replaces the old GeoDiscoveryPanel sidebar. No spotlight grid,
 * no format filters, no view toolbar. Just the Leaflet map canvas
 * with zoom controls. The main results grid handles all filtering
 * and display — this component only provides geographic context.
 *
 * Blue border when geo filter is active (queryAreaBounds !== null).
 */

import dynamic from 'next/dynamic'
import type { MapPoint, MapMode } from './DiscoveryMap'
import type { MapBounds } from './LeafletMap'

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

interface MapBandProps {
  points: MapPoint[]
  hoveredId: string | null
  selectedId: string | null
  onHoverChange: (id: string | null) => void
  onSelectChange: (id: string | null) => void
  onBoundsChange: (bounds: MapBounds) => void
  /** True when the map is actively filtering results */
  active: boolean
  mode?: MapMode
}

export function MapBand({
  points,
  hoveredId,
  selectedId,
  onHoverChange,
  onSelectChange,
  onBoundsChange,
  active,
  mode = 'assets',
}: MapBandProps) {
  return (
    <div
      className={`w-full h-full border transition-colors ${
        active ? 'border-[#0000ff]' : 'border-black/15'
      }`}
    >
      <LeafletMap
        points={points}
        hoveredId={hoveredId}
        selectedId={selectedId}
        onHover={onHoverChange}
        onSelect={onSelectChange}
        onBoundsChange={onBoundsChange}
        mode={mode}
      />
    </div>
  )
}
