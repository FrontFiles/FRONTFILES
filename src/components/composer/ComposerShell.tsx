'use client'

import { useState } from 'react'
import { useComposer } from '@/lib/composer/context'
import { checkEditorEligibility } from '@/lib/composer/types'
import { ComposerHeader } from './ComposerHeader'
import { StatusBar } from './StatusBar'
import { SearchRail } from './SearchRail'
import { EditorCanvas } from './EditorCanvas'
import { InspectorPanel } from './InspectorPanel'
import { PublishConfirmation } from './PublishConfirmation'
import type { ContextualPanel } from '@/components/discovery/GeoBoltControlGroup'

export function ComposerShell() {
  const { state } = useComposer()
  const eligibility = checkEditorEligibility(state.eligibility)
  // Mirror of SearchRail's `activePanel`. SearchRail fires
  // `onActivePanelChange` via useEffect, ComposerShell stores the latest
  // value, and collapses its SearchRail column width down to just the rail
  // footprint when neither Geo nor BOLT is open. Default 'geo' matches
  // SearchRail's default `sidebarOpen=true`.
  const [activePanel, setActivePanel] = useState<ContextualPanel>('geo')

  // Gate: editor must be eligible to use the Composer
  if (!eligibility.eligible) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <div className="flex items-center px-6 py-3 border-b-2 border-black">
          <h1 className="text-sm font-black uppercase tracking-widest text-black">Composer</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="w-12 h-12 border-2 border-black flex items-center justify-center mx-auto mb-4">
              <span className="text-lg font-black text-black">!</span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-black mb-3">Editor access denied</h2>
            <p className="text-xs text-slate-500 mb-4">You do not meet the eligibility requirements to compose articles.</p>
            <div className="flex flex-col gap-1.5 text-left mx-auto max-w-xs">
              {eligibility.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-black mt-1 shrink-0" />
                  <span className="text-[10px] text-black">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <ComposerHeader />

      <div className="flex-1 overflow-hidden flex">
        {/* Zone A: Search Rail — width tracks activePanel.
            When Geo or BOLT is active: 580px (room for map / BOLT briefing
            + gallery below). When both closed: 88px — just the 48px Geo/BOLT
            rail + its outer padding, nothing else visible. */}
        {!state.ui.searchRailCollapsed && (
          <div
            className={`${
              activePanel === null
                ? 'w-[88px] min-w-[88px]'
                : 'w-[580px] min-w-[480px]'
            } flex-shrink-0 h-full overflow-hidden flex flex-col border-r-2 border-black`}
          >
            <SearchRail onActivePanelChange={setActivePanel} />
          </div>
        )}

        {/* Zone B: Editor Canvas — fluid center */}
        <div className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
          <EditorCanvas />
        </div>

        {/* Zone C: Inspector — fixed 320px */}
        {!state.ui.inspectorCollapsed && (
          <div className="w-[320px] min-w-[280px] flex-shrink-0 h-full overflow-hidden flex flex-col border-l-2 border-black">
            <InspectorPanel />
          </div>
        )}
      </div>

      <StatusBar />
      <PublishConfirmation />
    </div>
  )
}
