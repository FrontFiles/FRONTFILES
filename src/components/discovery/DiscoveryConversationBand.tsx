'use client'

// ═══════════════════════════════════════════════════════════════
// Frontfiles — Discovery Conversation Band
//
// The bottom dock for the Discovery surface. Vertical stack:
// agent answer on top (scrollable), search input anchored at the
// bottom — the same pattern Claude / Perplexity use for their
// chat-with-context input zone.
//
// SCOPE
//
// Pure layout shell. Owns sticky-bottom positioning, max-width
// alignment with the rest of the page, the dock elevation, and
// the desktop/mobile responsive split. Does NOT own:
//
//   - the agent state (that's `useDiscoveryAgent` in the parent)
//   - the search input (that's `AssistantInput`, passed in as
//     `inputSlot` so the band stays unaware of how the input
//     commits queries)
//   - any router calls
//
// LAYOUT
//
// Desktop (≥ 1024px):
//   ┌────────────────────────────────────────────────────────┐
//   │ Agent answer area (scrolls if overflow, ~120-220px max)│
//   ├────────────────────────────────────────────────────────┤
//   │ Toolbar (filters / overlay / view mode, ~40px)         │
//   ├────────────────────────────────────────────────────────┤
//   │ Search input (anchored, ~88px)                         │
//   └────────────────────────────────────────────────────────┘
//
//   Width: max-w-[1800px] mirroring the page wrapper.
//   Padding: px-6 mirroring the page wrapper.
//   Border: 2px black top divider — feels like a dock.
//   Background: white. Subtle shadow above to lift it off the
//   results region behind.
//
// Mobile (< 1024px):
//   The agent area collapses into a sheet that can be expanded
//   by tapping a handle. The search input stays anchored.
//   `collapsedOnMobile` controls the initial state.
//
// The band does NOT control whether it's mounted — the parent
// page decides. When the parent unmounts the band (e.g. on a
// non-Discovery route) the layout reverts naturally.
// ═══════════════════════════════════════════════════════════════

import { useState, type ReactNode } from 'react'

export interface DiscoveryConversationBandProps {
  /**
   * The agent answer view (DiscoveryAgentPanel). Lives in the
   * top region of the band.
   */
  agentSlot: ReactNode

  /**
   * The grid toolbar (filters, overlay mode, view mode, geo
   * chip). Lives between the agent answer and the search input
   * so all the controls a user touches per query are clustered
   * in the same dock. Optional — when omitted (e.g. on a future
   * non-grid surface that reuses the band) the slot collapses.
   */
  toolbarSlot?: ReactNode

  /**
   * The search input (AssistantInput). Lives in the bottom
   * region of the band, anchored so it never scrolls away.
   */
  inputSlot: ReactNode

  /**
   * Initial mobile state. Defaults to `expanded` so first-time
   * users see the agent. Persisting the choice across sessions
   * is a parent concern (localStorage if you want it).
   */
  defaultMobileState?: 'expanded' | 'collapsed'
}

// ═══════════════════════════════════════════════════════════════

export function DiscoveryConversationBand({
  agentSlot,
  toolbarSlot,
  inputSlot,
  defaultMobileState = 'expanded',
}: DiscoveryConversationBandProps) {
  // Mobile expand/collapse — affects the agent slot only on
  // small viewports via Tailwind responsive classes. Desktop
  // (lg+) ignores this state entirely.
  const [mobileExpanded, setMobileExpanded] = useState(
    defaultMobileState === 'expanded',
  )

  // The band no longer owns its own horizontal max-width or
  // mx-auto — it's mounted inside the page's center column,
  // which already sits inside the page-level `max-w-[1800px]
  // mx-auto px-6` container. The band fills the column and
  // takes its horizontal padding from the column instead. This
  // is what lets the left and right rails extend down PAST the
  // band: the band is now a child of the same flex row as the
  // rails, not a sibling of <main>.
  return (
    <aside
      role="complementary"
      aria-label="Discovery conversation band"
      className="shrink-0 border-t border-black/8 bg-white shadow-[0_-2px_8px_-6px_rgba(0,0,0,0.06)] py-2 flex flex-col gap-2"
    >
      {/* Mobile-only handle. Tapping it expands/collapses the
          agent slot. Hidden on lg+ where the agent is always
          visible above the input. */}
      <button
        type="button"
        onClick={() => setMobileExpanded((v) => !v)}
        aria-expanded={mobileExpanded}
        aria-label={mobileExpanded ? 'Hide vault agent' : 'Show vault agent'}
        className="lg:hidden self-center w-16 h-1.5 bg-black/15 hover:bg-black/30 transition-colors rounded-full"
      />

      {/* Toolbar slot — filters, view mode, overlay. Top line. */}
      {toolbarSlot && <div className="shrink-0">{toolbarSlot}</div>}

      {/* Agent slot — suggested prompts / agent answers. Below filters. */}
      <div
        className={`
          ${mobileExpanded ? 'block' : 'hidden'}
          lg:block
          max-h-[60px] overflow-y-auto
        `}
      >
        {agentSlot}
      </div>

      {/* Input slot. Always visible on every viewport. */}
      <div className="shrink-0">{inputSlot}</div>
    </aside>
  )
}
