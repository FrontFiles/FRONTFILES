/**
 * Frontfiles Upload V4 — Center Pane (D2.3 §1.1)
 *
 * Spec: UX-SPEC-V4 §3 (canonical) + D-PLAN §9.
 *
 * Orchestrator inside the workspace layout. Reads getLayoutState. For D2.3,
 * renders only the contact sheet variant. The 'comparing' branch is a
 * placeholder for D2.6 — CompareView will mount there once selectedAssetIds
 * has 2 + the user invokes Compare from the contextual action bar (D2.5).
 *
 * Layout (per spec §3.1 anatomy):
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  AIProposalBanner (when pending — reuses C2 component)     │
 *   ├───────────────────────────────────────────────────────────┤
 *   │  ContactSheetFilterChips                                   │
 *   ├───────────────────────────────────────────────────────────┤
 *   │                                                            │
 *   │              ContactSheet (virtualized grid)               │
 *   │                                                            │
 *   ├───────────────────────────────────────────────────────────┤
 *   │  ZoomSlider                              CountFooter       │
 *   └───────────────────────────────────────────────────────────┘
 */

'use client'

import { useUploadContext } from './UploadContext'
import { getLayoutState } from '@/lib/upload/upload-selectors'
import AIProposalBanner from './AIProposalBanner'
import ContactSheet from './ContactSheet'
import ContactSheetFilterChips from './ContactSheetFilterChips'
// D2.10 — story metadata header rendered between filter chips and the
// contact sheet when filtered to a story. Self-gates on
// state.ui.filter.storyGroupId; CenterPane mounts unconditionally.
import ContactSheetStoryHeader from './ContactSheetStoryHeader'
import ZoomSlider from './ZoomSlider'
import CountFooter from './CountFooter'
// D2.5: contextual action bar for multi-select. Component handles its own
// mount gating (length >= 2 + commit.phase guard) — CenterPane unconditionally
// renders the slot; the bar early-returns null when conditions aren't met.
import ContextualActionBar from './ContextualActionBar'
// D2.6: compare view (2-up side-by-side). Mounts in the layout='comparing'
// branch (replaces the D2.3 placeholder).
import CompareView from './CompareView'

export default function CenterPane() {
  const { state } = useUploadContext()

  const layout = getLayoutState({
    assetsById: state.assetsById,
    assetOrder: state.assetOrder,
    compareAssetIds: state.ui.compareAssetIds,
  })

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-white">
      {/* AIProposalBanner mounts above filter chips per spec §11.4.
          Only renders when state.aiClusterProposals has pending entries. */}
      <AIProposalBanner />

      <ContactSheetFilterChips />

      {/* D2.10 — story metadata header. Self-gates on filter.storyGroupId;
          renders nothing when not filtered to a story. */}
      <ContactSheetStoryHeader />

      {/* Grid wrapper is `relative` so the contextual action bar (D2.5) can
          float over the contact sheet via absolute positioning without
          taking layout space (no jiggle when the bar mounts/unmounts on
          selection changes). */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {layout === 'comparing' ? (
          <CompareView />
        ) : (
          <ContactSheet />
        )}
        {/* D2.5: contextual action bar floats at the bottom of the grid
            wrapper. Mount-gated inside the component (length >= 2 +
            commit.phase guard + D2.6 compareAssetIds.length === 2 suppression).
            Popovers anchored to the bar buttons extend upward into the grid
            wrapper; on short viewports they may clip — acceptable trade-off. */}
        <ContextualActionBar />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-black px-4 py-2 min-w-0">
        <ZoomSlider />
        <CountFooter />
      </div>
    </div>
  )
}

