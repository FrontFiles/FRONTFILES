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

import { useUploadContext } from '../_components/UploadContext'
import { getLayoutState } from '@/lib/upload/upload-selectors'
import AIProposalBanner from '../_components/AIProposalBanner'
import ContactSheet from './ContactSheet'
import ContactSheetFilterChips from './ContactSheetFilterChips'
import ZoomSlider from './ZoomSlider'
import CountFooter from './CountFooter'

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

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {layout === 'comparing' ? (
          <CompareViewPlaceholder />
        ) : (
          <ContactSheet />
        )}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-black px-4 py-2 min-w-0">
        <ZoomSlider />
        <CountFooter />
      </div>
    </div>
  )
}

/**
 * D2.6 will replace this with the real CompareView. For D2.3, just a
 * placeholder so the layout-state branch compiles.
 */
function CompareViewPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
      Compare view — placeholder for D2.6
    </div>
  )
}
