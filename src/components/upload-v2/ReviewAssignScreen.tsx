'use client'

import { useEffect } from 'react'
import { useUploadV2 } from './UploadV2Context'
import { getExpressEligibility, getIncludedAssets, getStoryGroups, getAssets, getUnassignedAssets } from '@/lib/upload/v2-state'
import { ReviewHeaderBar } from './ReviewHeaderBar'
import { StoryGroupsPanel } from './StoryGroupsPanel'
import { AssetTable } from './AssetTable'
import { AssetDetailPanel } from './AssetDetailPanel'
import { PublishBar } from './PublishBar'
import { ExpressCard } from './ExpressCard'
import { StoryProposalsBanner } from './StoryProposalsBanner'

export function ReviewAssignScreen() {
  const { state, dispatch } = useUploadV2()
  const express = getExpressEligibility(state)
  const included = getIncludedAssets(state)
  const groups = getStoryGroups(state)
  const allAssets = getAssets(state)
  const unassigned = getUnassignedAssets(state)

  // Auto-activate newsroom mode for large batches
  useEffect(() => {
    if (allAssets.length >= 30 && !state.batch.newsroomMode) {
      dispatch({ type: 'ACTIVATE_NEWSROOM_MODE', active: true })
    }
  }, [allAssets.length])

  // Show express card if eligible and not yet accepted
  if (express.eligible && !state.ui.expressAccepted) {
    return (
      <div className="flex flex-col h-full">
        <ExpressCard />
      </div>
    )
  }

  const inspectorCollapsed = state.ui.inspectorCollapsed
  const hasProposals = groups.some(g => g.kind === 'proposed' && g.proposedAssetIds.length > 0)
  const showBanner = state.ui.storyProposalsBannerOpen && hasProposals && unassigned.length > 0

  // Mobile fallback: stacked layout with tab switcher
  const mobileTab = state.ui.mobileTab

  return (
    <div className="flex flex-col h-full">
      {/* Top Header Bar */}
      <ReviewHeaderBar
        totalAssets={included.length}
        totalGroups={groups.length}
      />

      {/* Story Proposals Banner (collapsible, above table) */}
      {showBanner && <StoryProposalsBanner />}

      {/* Desktop: 3-zone layout with fixed side panels */}
      <div className="flex-1 overflow-hidden hidden md:flex">
        {/* Zone A: Story Groups — fixed width */}
        <div className="w-[240px] min-w-[200px] flex-shrink-0 h-full overflow-hidden flex flex-col border-r-2 border-black">
          <StoryGroupsPanel />
        </div>

        {/* Zone B: Asset Table — fluid center */}
        <div className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
          <AssetTable />
        </div>

        {/* Zone C: Asset Detail (Inspector) — fixed width, conditionally shown */}
        {!inspectorCollapsed && (
          <div className="w-[320px] min-w-[280px] flex-shrink-0 h-full overflow-hidden flex flex-col border-l-2 border-black">
            <AssetDetailPanel />
          </div>
        )}
      </div>

      {/* Mobile: Stacked layout with tab switcher */}
      <div className="flex-1 overflow-hidden flex flex-col md:hidden">
        {/* Mobile tab bar */}
        <MobileTabBar />

        {/* Mobile content */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === 'stories' && <StoryGroupsPanel />}
          {mobileTab === 'assets' && <AssetTable />}
          {mobileTab === 'detail' && <AssetDetailPanel />}
        </div>
      </div>

      {/* Bottom bar: Publish gate */}
      <PublishBar />
    </div>
  )
}

function MobileTabBar() {
  const { state, dispatch } = useUploadV2()
  const tabs: Array<{ id: 'stories' | 'assets' | 'detail'; label: string }> = [
    { id: 'stories', label: 'Stories' },
    { id: 'assets', label: 'Assets' },
    { id: 'detail', label: 'Detail' },
  ]

  return (
    <div className="flex border-b-2 border-black bg-white flex-shrink-0">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => dispatch({ type: 'SET_MOBILE_TAB', tab: tab.id })}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            state.ui.mobileTab === tab.id
              ? 'bg-black text-white'
              : 'text-slate-500 hover:text-black'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
