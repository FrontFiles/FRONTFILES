'use client'

import type { ReactNode } from 'react'
import { DiscoveryMap, type MapSize, type MapPoint } from './DiscoveryMap'
import type { MapBounds } from './LeafletMap'

/**
 * Frontfiles — Canonical Geo Discovery Panel (v3)
 *
 * Single shared geo surface used by BOTH the Discovery search page and the
 * Composer search rail. Pure OPEN-STATE view — consumers decide when to
 * mount it. The collapsed/closed rail state and the Geo↔BOLT mutual-
 * exclusivity toggle live in `GeoBoltControlGroup`, which sits as a sibling
 * in each consumer's layout.
 *
 * v3 correction: this component NO LONGER owns a search input. The product
 * rule is "the main canonical search bar is the only search input" — Geo
 * derives from whatever scope that canonical bar produces, it does not have
 * one of its own. Consumers wire the canonical bar themselves (Discovery:
 * `<AssistantInput>` in the search page header; Composer: a thin search
 * strip at the top of `SearchRail`).
 *
 * This component owns:
 *
 *   • the optional `headerSlot` rendered above the map
 *   • the `DiscoveryMap` (with its internal ViewportSpotlight + map canvas)
 *
 * It does NOT own:
 *
 *   • any search input
 *   • open/close state
 *   • BOLT coordination
 *   • width or outer padding — callers wrap it in whatever column they need
 *
 * State model: PURE CONTROLLED PROPS. No internal state, no context, no
 * shared store.
 */

export interface GeoDiscoveryPanelProps {
  /** Map size state (controlled by the parent so it survives unmount/remount). */
  mapSize: MapSize
  onMapSizeChange: (size: MapSize) => void
  /** Invoked when the DiscoveryMap's internal "hide" button is clicked.
   *  Discovery wires this to closing the whole panel (setSidebarOpen(false));
   *  Composer wires it to its own collapse toggle. */
  onHide?: () => void

  /** DiscoveryMap passthrough props — forwarded verbatim. */
  externalPoints?: MapPoint[]
  hoveredId?: string | null
  selectedId?: string | null
  onHoverChange?: (id: string | null) => void
  onSelectChange?: (id: string | null) => void
  showSearchThisArea?: boolean
  onSearchThisArea?: (bounds: MapBounds) => void
  onMapBoundsChange?: (bounds: MapBounds) => void

  /** When false, omit the ViewportSpotlight list that normally renders
   *  below the map. Composer sets this to false because its own asset
   *  grid immediately below already plays that role. Defaults to true
   *  so Discovery keeps its current behaviour. */
  showSpotlight?: boolean

  /** Optional slot rendered above the map. Composer can use this for its
   *  "in article" sources tray or similar, without having to fork the
   *  shared component. */
  headerSlot?: ReactNode
}

export function GeoDiscoveryPanel({
  mapSize,
  onMapSizeChange,
  onHide,
  externalPoints,
  hoveredId,
  selectedId,
  onHoverChange,
  onSelectChange,
  showSearchThisArea,
  onSearchThisArea,
  onMapBoundsChange,
  showSpotlight = true,
  headerSlot,
}: GeoDiscoveryPanelProps) {
  return (
    <div className="w-full flex flex-col h-full min-h-0">
      {headerSlot}

      {/* Canonical Discovery map + (optional) spotlight */}
      <DiscoveryMap
        mapSize={mapSize}
        onMapSizeChange={onMapSizeChange}
        onHide={onHide}
        externalPoints={externalPoints}
        hoveredId={hoveredId ?? null}
        selectedId={selectedId ?? null}
        onHoverChange={onHoverChange}
        onSelectChange={onSelectChange}
        showSearchThisArea={showSearchThisArea}
        onSearchThisArea={onSearchThisArea}
        onMapBoundsChange={onMapBoundsChange}
        showSpotlight={showSpotlight}
      />
    </div>
  )
}
