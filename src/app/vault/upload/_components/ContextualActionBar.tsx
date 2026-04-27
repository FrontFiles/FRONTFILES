/**
 * Frontfiles Upload V4 — Contextual Action Bar (D2.5 §1.1)
 *
 * Spec: UX-SPEC-V4 §9 + D-PLAN §11 + D2.5-DIRECTIVE.
 *
 * The multi-select counterpart to the right-rail inspector. Mounts at the
 * bottom of CenterPane (sticky bottom-0) when selectedAssetIds.length >= 2
 * and commit.phase ∈ {idle, summary}. The right-rail inspector mounts at
 * length === 1 — these two are mutually exclusive by selection-count
 * branching at the shell level.
 *
 * Anatomy (left → right):
 *   [N selected]  │  Set price · Set privacy · Assign story · ✓ AI  │  Compare · Exclude · Clear
 *
 * Animation: slide-up from translateY(100%) opacity-0 → translateY(0)
 * opacity-100 over 150ms. Respects prefers-reduced-motion.
 *
 * Keyboard:
 *   Esc with popover open → popover handles it (stops propagation), bar persists
 *   Esc with no popover open → DESELECT_ALL_ASSETS (bar dismisses)
 *
 * Per spec §9 "bulk is contextual on multi-select. Never a persistent
 * toolbar." — early-return null when selection drops below 2.
 */

'use client'

import { useEffect, useState } from 'react'
import { useUploadContext } from './UploadContext'
import SetPricePopover from './bar/SetPricePopover'
import SetPrivacyPopover from './bar/SetPrivacyPopover'
import AssignStoryPopover from './bar/AssignStoryPopover'
import { computeAcceptAIDispatches } from './lib/computeAcceptAIDispatches'

type PopoverId = 'price' | 'privacy' | 'story' | null

const COUNT = 'text-[11px] font-bold uppercase tracking-widest text-black font-mono'
const BTN =
  'border border-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black bg-white hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-black disabled:cursor-not-allowed'
const BTN_ACTIVE = 'border border-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-black text-white'

export default function ContextualActionBar() {
  const { state, dispatch } = useUploadContext()
  const selectedIds = state.ui.selectedAssetIds
  const selectedCount = selectedIds.length
  const [popover, setPopover] = useState<PopoverId>(null)

  // Slide-up animation: mounted=false on first render, flip to true after
  // first paint via useEffect. Tailwind transition handles the rest.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // requestAnimationFrame ensures the initial render commits with
    // translate-y-full, then the next frame transitions to translate-y-0.
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Bar-level Esc handler — only fires when no popover is open (popovers
  // stop propagation in their own Esc handlers).
  useEffect(() => {
    if (popover !== null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Don't steal Esc when typing in inputs (e.g., inspector field editor)
        const t = e.target as HTMLElement | null
        const tag = t?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        dispatch({ type: 'DESELECT_ALL_ASSETS' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [popover, dispatch])

  // Mount conditions per D2.5-DIRECTIVE §5.3
  if (selectedCount < 2) return null
  if (state.commit.phase !== 'idle' && state.commit.phase !== 'summary') return null
  // D2.6 IPD6-1: bar is suppressed during compare mode (founder lock L5 —
  // bulk is contextual on multi-select in the workspace layout, not in
  // compare). Selection persists across compare so the bar reappears
  // cleanly on exit (EXIT_COMPARE_MODE → compareAssetIds.length !== 2).
  if (state.ui.compareAssetIds.length === 2) return null

  // ── Derived enable states ──────────────────────────────────────
  // ✓ AI enabled if at least one selected asset has a proposal
  const aiEnabled = selectedIds.some(id => state.assetsById[id]?.proposal != null)
  // Compare enabled only at exactly 2 selected (per IPV4-3 default = a)
  const compareEnabled = selectedCount === 2

  function handleAcceptAI() {
    const dispatches = computeAcceptAIDispatches(state, selectedIds)
    for (const d of dispatches) dispatch(d)
  }

  function handleCompare() {
    if (!compareEnabled) return
    dispatch({ type: 'ENTER_COMPARE_MODE', assetIds: selectedIds })
  }

  // Per IPD5-2 = (b) ratified: Exclude sets all selected to excluded; assets
  // already excluded stay excluded. We dispatch TOGGLE_ASSET_EXCLUDED only
  // for assets where excluded === false — TOGGLE flips, so calling it on a
  // currently-excluded asset would un-exclude it (wrong). Filter first.
  function handleExclude() {
    for (const id of selectedIds) {
      const asset = state.assetsById[id]
      if (asset && !asset.excluded) {
        dispatch({ type: 'TOGGLE_ASSET_EXCLUDED', assetId: id })
      }
    }
  }

  function handleClear() {
    dispatch({ type: 'DESELECT_ALL_ASSETS' })
  }

  function togglePopover(id: PopoverId) {
    setPopover(prev => (prev === id ? null : id))
  }

  return (
    <div
      data-region="contextual-action-bar"
      role="toolbar"
      aria-label={`${selectedCount} assets selected — bulk actions`}
      className={`absolute bottom-2 left-4 right-4 z-30 border-2 border-black bg-white shadow-lg transition-all duration-150 motion-reduce:transition-none ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
    >
      <div className="flex items-center gap-x-3 gap-y-2 flex-wrap px-4 py-2 min-w-0">
        {/* Group 1 — count */}
        <span className={COUNT}>{selectedCount} selected</span>

        <Sep />

        {/* Group 2 — field operations */}
        <div className="relative">
          <button
            type="button"
            onClick={() => togglePopover('price')}
            className={popover === 'price' ? BTN_ACTIVE : BTN}
            aria-expanded={popover === 'price'}
          >
            Set price
          </button>
          {popover === 'price' && <SetPricePopover onClose={() => setPopover(null)} />}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => togglePopover('privacy')}
            className={popover === 'privacy' ? BTN_ACTIVE : BTN}
            aria-expanded={popover === 'privacy'}
          >
            Set privacy
          </button>
          {popover === 'privacy' && <SetPrivacyPopover onClose={() => setPopover(null)} />}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => togglePopover('story')}
            className={popover === 'story' ? BTN_ACTIVE : BTN}
            aria-expanded={popover === 'story'}
          >
            Assign story
          </button>
          {popover === 'story' && <AssignStoryPopover onClose={() => setPopover(null)} />}
        </div>

        <button
          type="button"
          onClick={handleAcceptAI}
          disabled={!aiEnabled}
          className={BTN}
          title={
            aiEnabled
              ? 'Accept AI proposals (caption, tags, geography) for selected assets — never price'
              : 'No selected asset has an AI proposal'
          }
        >
          ✓ AI
        </button>

        <Sep />

        {/* Group 3 — selection operations */}
        <button
          type="button"
          onClick={handleCompare}
          disabled={!compareEnabled}
          className={BTN}
          title={compareEnabled ? 'Compare 2 assets side by side' : 'Compare supports 2 assets at a time'}
        >
          Compare
        </button>

        <button type="button" onClick={handleExclude} className={BTN} title="Exclude selected from this batch">
          Exclude
        </button>

        <button type="button" onClick={handleClear} className={`${BTN} ml-auto`} title="Clear selection (Esc)">
          Clear
        </button>
      </div>
    </div>
  )
}

/** Vertical-rule separator. Brutalist 1px black line, full bar height. */
function Sep() {
  return <span className="self-stretch border-l border-black" aria-hidden />
}
