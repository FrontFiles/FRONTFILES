/**
 * Frontfiles Upload V4 — Top-level Shell (D2.1 §6.1)
 *
 * Spec: UX-SPEC-V4 §2 (three-pane progressive disclosure) + D-PLAN §4.1.
 *
 * The new canonical upload shell. Replaces the C2-era UploadShell at
 * src/app/vault/upload/_components/UploadShell.tsx (now dormant per D2.1
 * §8 dormant-flag pass).
 *
 * Three layout states per spec §2 (resolved by getLayoutState):
 *   'empty'      → EmptyState fills the screen
 *   'workspace'  → three-pane shell with placeholders for D2.2/D2.3/D2.4
 *   'comparing'  → center pane swaps to side-by-side (D2.6 fills)
 *
 * D2.1 ships ONLY the layout primitive + placeholders. Pane content
 * arrives in subsequent D phases:
 *   D2.2 — left rail content (LeftRail + StoryHeader + UnassignedBucket + NewStoryAffordance)
 *   D2.3 — center pane content (ContactSheet + cards + zoom slider + filter chips)
 *   D2.4 — right rail content (RightRailInspector — adapts SideDetailPanel)
 *   D2.5 — contextual action bar
 *   D2.6 — compare view
 *   D2.7 — file ingestion (whole-window listener) + session defaults popover
 *
 * SSR-safe boundary preserved (same as C2 UploadShell): takes batchId +
 * dev params from the server page; V3State computed client-side via
 * useReducer initializer; non-serializable fields never cross the boundary.
 */

'use client'

import { useCallback, useReducer, useRef, useState, type DragEvent } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { v3Reducer, v3InitialState } from '@/lib/upload/v3-state'
import { getLayoutState } from '@/lib/upload/upload-selectors'
import { hydrateV3FromV2State } from '@/lib/upload/v3-hydration'
import { hydrateFromScenario } from '@/lib/upload/v2-hydration'
import { SCENARIOS } from '@/lib/upload/v2-mock-scenarios'
import type { ScenarioId } from '@/lib/upload/v2-scenario-registry'
import type { V3Action, V3State } from '@/lib/upload/v3-types'
// UploadContext lives in C2's _components/ directory and is reused here.
// (Per D2.1 §8 it is NOT dormant-flagged — it's a spine carryover.)
import { UploadContextProvider } from '../_components/UploadContext'
import EmptyState from './EmptyState'
import CenterPane from './CenterPane'
import RightRailInspector from './RightRailInspector'
import LeftRail from './LeftRail'
import { FileIngestProvider } from './lib/FileIngestContext'
import { filesToAssetDescriptors } from './lib/filesToAssetDescriptors'

interface Props {
  batchId: string
  /** Dev-only scenario fixture id; null in production or when no ?scenario= param. */
  devScenarioId: ScenarioId | null
  /** Dev-only commit-failure injection (per C2.4 IPIV-5). null in production. */
  devSimulateFailure: number | null
  /** Dev-only AI cluster banner seeding (per C2.5 IPV-5). false in production. */
  devSeedBanners: boolean
}

export default function UploadShellV4({
  batchId,
  devScenarioId,
  devSimulateFailure,
  devSeedBanners,
}: Props) {
  const [state, dispatch] = useReducer(v3Reducer, { batchId, devScenarioId }, computeInitialState)

  const layout = getLayoutState({
    assetsById: state.assetsById,
    assetOrder: state.assetOrder,
    compareAssetIds: state.ui.compareAssetIds,
  })

  // ── D2.2 DnD plumbing ─────────────────────────────────────────
  //
  // Single PointerSensor with a small activation distance so that clicks
  // (no movement) still register as clicks; only mouse-down + drag past
  // the threshold initiates a drag. Prevents accidental drags on click.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // ── D2.7 file ingest plumbing ────────────────────────────────
  //
  // Single hidden <input type="file" multiple> ref-controlled; both the
  // EmptyState "click to browse" affordance and the LeftRailHeader
  // "+ Add files" button trigger it via FileIngestContext.
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  function handleFiles(files: FileList | File[] | null) {
    if (!files) return
    const descriptors = filesToAssetDescriptors(files)
    if (descriptors.length === 0) return
    dispatch({ type: 'ADD_FILES', files: descriptors } as V3Action)
  }

  function handleFilePickerChange(event: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files)
    // Reset the input value so picking the same file twice still fires onChange.
    event.target.value = ''
  }

  // ── D2.7 whole-window file-drop listener ─────────────────────
  //
  // Per L1: drop listener attaches to a root div inside UploadShellV4.
  // Per L6: gate by dataTransfer.types.includes('Files') so internal
  // @dnd-kit drags don't trigger this. Per IPD7-7 = (b): use a counter
  // to track dragenter/dragleave reliably across child element transitions.
  const [isFileDragging, setIsFileDragging] = useState(false)
  const dragCounterRef = useRef(0)

  function isFileDragEvent(e: DragEvent): boolean {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files')
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    if (!isFileDragEvent(e)) return
    e.preventDefault()
    dragCounterRef.current += 1
    setIsFileDragging(true)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!isFileDragEvent(e)) return
    e.preventDefault() // required to allow drop
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!isFileDragEvent(e)) return
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) {
      setIsFileDragging(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    if (!isFileDragEvent(e)) return
    e.preventDefault()
    dragCounterRef.current = 0
    setIsFileDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  /**
   * Drag-end router. Inspects active.id (the dragged asset) and over.id
   * (the drop target) and dispatches the right action(s).
   *
   * Multi-select: if the dragged asset is in selectedAssetIds AND there's
   * more than one selected, the action applies to all selected (per
   * IPD2-6 + L11). Otherwise applies to the single dragged asset.
   *
   * Cross-context drops route by over.id pattern:
   *   'unassigned'              → MOVE_ASSET_TO_UNGROUPED
   *   'story-{id}-body'         → MOVE_ASSET_TO_CLUSTER
   *   'story-{id}-cover'        → MOVE_ASSET_TO_CLUSTER + SET_STORY_COVER
   *                               (cover is single — only the dragged asset
   *                                gets set as cover, even in multi-select)
   *
   * Sortable peer drops (over.id is another asset id in the same SortableContext):
   *   reorder via arrayMove + dispatch REORDER_ASSETS_IN_STORY (only when
   *   filter.storyGroupId is set; otherwise ignored).
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = String(active.id)
      const overId = String(over.id)

      // Multi-select expansion: if the dragged asset is in selection and
      // selection has >1 assets, apply to all selected. Per IPD2-6 + L11.
      const inSelection = state.ui.selectedAssetIds.includes(activeId)
      const targetAssetIds =
        inSelection && state.ui.selectedAssetIds.length > 1
          ? state.ui.selectedAssetIds
          : [activeId]

      // Cross-context: Unassigned bucket
      if (overId === 'unassigned') {
        for (const id of targetAssetIds) {
          dispatch({ type: 'MOVE_ASSET_TO_UNGROUPED', assetId: id } as V3Action)
        }
        return
      }

      // Cross-context: story header body
      const bodyMatch = overId.match(/^story-(.+)-body$/)
      if (bodyMatch) {
        const storyGroupId = bodyMatch[1]
        for (const id of targetAssetIds) {
          dispatch({
            type: 'MOVE_ASSET_TO_CLUSTER',
            assetId: id,
            clusterId: storyGroupId,
          } as V3Action)
        }
        return
      }

      // Cross-context: story header cover area (move + set cover)
      const coverMatch = overId.match(/^story-(.+)-cover$/)
      if (coverMatch) {
        const storyGroupId = coverMatch[1]
        for (const id of targetAssetIds) {
          dispatch({
            type: 'MOVE_ASSET_TO_CLUSTER',
            assetId: id,
            clusterId: storyGroupId,
          } as V3Action)
        }
        // Cover is single — only the dragged asset becomes cover.
        dispatch({
          type: 'SET_STORY_COVER',
          storyGroupId,
          assetId: activeId,
        } as V3Action)
        return
      }

      // Sortable peer (within-story reorder). over.id is another asset id;
      // the active item's index moves to the over item's index. Only when
      // filter.storyGroupId is set (otherwise sortable mode isn't active).
      const groupId = state.ui.filter.storyGroupId
      if (groupId && state.assetsById[overId] && activeId !== overId) {
        const story = state.storyGroupsById[groupId]
        if (!story) return
        const sequence = story.sequence ?? story.proposedAssetIds
        const fromIdx = sequence.indexOf(activeId)
        const toIdx = sequence.indexOf(overId)
        if (fromIdx === -1 || toIdx === -1) return
        const next = arrayMove(sequence, fromIdx, toIdx)
        dispatch({
          type: 'REORDER_ASSETS_IN_STORY',
          storyGroupId: groupId,
          sequence: next,
        } as V3Action)
        return
      }
    },
    [
      state.ui.selectedAssetIds,
      state.ui.filter.storyGroupId,
      state.storyGroupsById,
      state.assetsById,
      dispatch,
    ],
  )

  // D2.7: hidden file input + drop overlay are sibling DOM nodes that wrap
  // every layout state. Extract a reusable shell wrapper so both Empty
  // and Workspace branches get the file ingest plumbing for free.
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept="image/*,video/*,audio/*,.txt,.svg,.ai,.eps"
      onChange={handleFilePickerChange}
      className="hidden"
      aria-hidden
      tabIndex={-1}
    />
  )

  const dropOverlay = isFileDragging ? (
    <div
      className="fixed inset-4 z-50 border-4 border-dashed border-blue-600 bg-white/70 flex items-center justify-center pointer-events-none"
      aria-hidden
    >
      <div className="text-3xl font-bold uppercase tracking-widest text-blue-600">
        Drop to add files
      </div>
    </div>
  ) : null

  // Empty layout state: EmptyState fills the screen. Three-pane shell + commit
  // bar slot are not mounted — there's nothing yet to populate them. The
  // file ingest provider + drop listener still wrap so empty-state can
  // accept file drops + click-to-browse.
  if (layout === 'empty') {
    return (
      <UploadContextProvider state={state} dispatch={dispatch}>
        <FileIngestProvider value={{ openFilePicker }}>
          <div
            className="flex-1 flex flex-col min-w-0"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {fileInput}
            {dropOverlay}
            <EmptyState />
          </div>
        </FileIngestProvider>
      </UploadContextProvider>
    )
  }

  // Workspace and Comparing both render the three-pane shell. Per spec §2:
  // Comparing is a center-pane variant (CompareView replaces the contact sheet),
  // not a structural layout change. D2.6 wires the actual swap.
  //
  // D2.2: the entire shell is wrapped in DndContext so cards in the center
  // can be dragged onto receivers in the left rail. handleDragEnd routes
  // by over.id pattern (see definition above).
  //
  // D2.7: outer div hosts the file-drop listener (gated by dataTransfer
  // 'Files' check so internal @dnd-kit drags don't trigger). Hidden file
  // input + drop overlay are siblings of the shell content.
  return (
    <UploadContextProvider state={state} dispatch={dispatch}>
      <FileIngestProvider value={{ openFilePicker }}>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            // D2.5b (round 6): h-full + min-h-0. Both required:
            // - h-full sets height: 100% of parent (workspace flex-1)
            // - min-h-0 disables the default min-height: auto on flex items
            //   which would otherwise let this div grow to its content size
            //   (the 771px aside) and break the entire overflow chain.
            // Same chain repeated on every flex ancestor: page.tsx workspace,
            // here, the row, the right-rail wrapper, and finally the aside.
            className="flex flex-col h-full min-h-0 min-w-0"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {fileInput}
            {dropOverlay}
            <div className="flex flex-row flex-1 min-w-0 min-h-0">
              {/* Left rail — LIVE per D2.2.
               *
               * Per UX-SPEC-V4 §2.0.1 (corrected): mounts as soon as
               * assetOrder.length > 0 (NOT gated on storyGroupOrder.length).
               * The rail itself handles the leftRailCollapsed state internally
               * (via LeftRailHeader's toggle button) — it always renders, just
               * at a different width.
               */}
              <div data-region="left-rail" className="border-r border-black flex-shrink-0">
                <LeftRail />
              </div>

          {/* Center pane — LIVE per D2.3 (CenterPane orchestrator inside).
           *
           * Hosts AIProposalBanner + ContactSheetFilterChips + ContactSheet
           * (Workspace) or CompareViewPlaceholder (Comparing — D2.6 fills).
           * Bottom row: ZoomSlider (left) + CountFooter (right).
           *
           * The data-region attr stays as 'center-pane' for visual smoke
           * locator continuity. The dev-fixture banner moves into a small
           * hint inside CenterPane is not needed — the count footer carries
           * the contextual info now. */}
          <div data-region="center-pane" className="flex-1 min-w-0 min-h-0 flex flex-col">
            <CenterPane />
            {devScenarioId && (
              <div className="border-t border-slate-200 px-4 py-1 text-[10px] uppercase tracking-widest text-blue-600">
                dev fixture: {devScenarioId}
              </div>
            )}
          </div>

          {/* Right rail — LIVE per D2.4 (RightRailInspector inside).
           *
           * Mount conditions per L1 + IPD4-12:
           *   - selectedAssetIds.length === 1 (single-asset focus mode)
           *   - commit.phase ∈ {idle, summary} (rail suppressed during
           *     committing / success / partial-failure — editing during
           *     commit is meaningless)
           *
           * Multi-select (length > 1) → contextual action bar (D2.5).
           * No selection → no rail.
           */}
          {state.ui.selectedAssetIds.length === 1 &&
            (state.commit.phase === 'idle' || state.commit.phase === 'summary') && (
              <div
                data-region="right-rail"
                // D2.5b (round 5): h-full + flex flex-col + min-h-0. The
                // min-h-0 is CRITICAL — without it, flex items have
                // min-height: auto (= content size), so the wrapper grew to
                // its child's natural 771px content height instead of being
                // constrained by h-full = 143px (body's allotted space). With
                // min-h-0, the wrapper truly respects h-full, and the inner
                // aside's flex-1 min-h-0 + overflow-y-auto can finally scroll.
                className="border-l border-black bg-white overflow-hidden flex flex-col h-full min-h-0"
                style={{
                  width: '400px',
                  minWidth: '400px',
                  maxWidth: '400px',
                  flex: '0 0 400px',
                }}
              >
                <RightRailInspector />
              </div>
            )}
        </div>

        {/* Commit bar slot — placeholder for the D-phase that re-mounts CommitBar.
         *
         * The C2.4 commit bar (CommitBar.tsx + 4 sub-panels + useCommitSimulation
         * hook) carries forward unchanged in shape and behavior per D-PLAN §4.2.
         * A subsequent D phase remounts it here as a sibling of the three-pane row.
         */}
        <div
          data-region="commit-bar-slot"
          className="border-t border-black px-6 py-3 sticky bottom-0 bg-white min-w-0"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Commit bar slot — re-mounts C2 CommitBar in a later D phase (phase: {state.commit.phase})
          </div>
          {/* devSimulateFailure / devSeedBanners are forwarded here for the
              future re-mount; D2.1 just acknowledges them so the props don't
              dead-code-warn. */}
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">
            {devSimulateFailure !== null && <span>simulateFailure={devSimulateFailure} </span>}
            {devSeedBanners && <span>seedBanners=true</span>}
          </div>
        </div>
          </div>
        </DndContext>
      </FileIngestProvider>
    </UploadContextProvider>
  )
}

/**
 * useReducer initializer. Same shape as C2's UploadShell — see C2.1 directive
 * for the SSR-safety reasoning (V3State computed client-side; non-serializable
 * V2Asset.file never crosses server→client boundary).
 */
function computeInitialState({
  batchId,
  devScenarioId,
}: {
  batchId: string
  devScenarioId: ScenarioId | null
}): V3State {
  if (devScenarioId) {
    const scenario = SCENARIOS[devScenarioId]
    if (scenario) {
      // Hydrate at 'review-assigned' target so cluster accordions populate
      // — same trade-off as Phase 7f of C2 (less faithful to the actual
      // creator flow; more visually inspectable).
      const v2State = hydrateFromScenario(scenario, 'review-assigned')
      return hydrateV3FromV2State(v2State)
    }
  }
  return v3InitialState(batchId)
}
