# Vault Upload — D Implementation Plan (D2.1–D2.8)

**Status:** DRAFT — pending founder ratification before any sub-prompt directive composes
**Date:** 2026-04-26
**Scope:** Phase D (UI rebuild atop C2 spine) sub-phases D2.1–D2.8, governing the entire D slice in one place
**Governs:** Implementation directives D2.1, D2.2, D2.3, D2.4, D2.5, D2.6, D2.7, D2.8 (composed separately as standalone prompts after this plan ratifies)
**Reads underlying:** `docs/upload/UX-SPEC-V4.md` (ratified), `docs/upload/C2-PLAN.md` (the predecessor that this mirrors and extends), `src/lib/upload/v3-types.ts` + `v3-state.ts` + `upload-selectors.ts` (the C2 spine that survives), PR #14 components

---

## 1. What this plan is

A build-governing record of how Phase D implements UX-SPEC-V4 — the three-pane progressive editorial workspace at `/vault/upload`. The plan covers all eight D2 sub-prompts (D2.1 shell + reducer/data deltas, D2.2 left rail, D2.3 center contact sheet, D2.4 right rail inspector, D2.5 contextual action bar, D2.6 compare mode, D2.7 file ingestion + session defaults, D2.8 cutover) under one ratifiable head so contradictions across sub-prompts can be resolved at the plan level rather than mid-implementation.

This plan is build-governing. If a later directive proposes a structure that contradicts §3 (locks), §5 (action set), §7-§14 (sub-prompt specs), or §15 (sequencing), the directive is wrong, not the plan. Drift requires an explicit revision pass on this document.

The plan is NOT itself an implementation directive — no code lands from this doc. D2.1 is composed as a separate prompt directive after this plan ratifies.

---

## 2. Current-state read (one paragraph)

PR #14 ships C2 (single-screen, density-aware list per the retired UX-SPEC-V3) and lands the V3 reducer + parity contract + commit state machine + selectors as the load-bearing spine of `/vault/upload`. Component layer (UploadShell, AssetList, AssetRow, AssetRowCompact, StoryGroupAccordion, BulkOpsBar, FilterBar, SideDetailPanel + the C2.5 AI surfacing + the C2.6 polish) reads as a control-heavy admin tool — diagnosed in the founder's Workspace Memo (now §1 of UX-SPEC-V4). Phase D rebuilds the component layer atop the surviving C2 spine to operationalize the editorial workspace pattern. Reducer + parity contract + commit state machine + 149 tests + DuplicateResolver + ConflictResolver + PriceBasisPanel + AcceptRow + AIProposalBanner + the 5 commit-phase panels + useCommitSimulation all carry forward unchanged. Old C2 components get dormant-flagged (`// DORMANT — replaced by D2 (new shell at app/vault/upload). Scheduled for deletion at the explicit cutover PR.`) and deleted at D2.8.

---

## 3. Three governing locks (founder-ratified, extended from C2-PLAN §3)

These three locks are non-negotiable. Every implementation directive in D2.1–D2.8 must respect them; quality assurance must verify each before any sub-prompt lands. Locks 1 + 2 carry forward from C2-PLAN unchanged. Lock 3 expands to cover the C2 component layer.

### 3.1 Reducer authority (carries forward)

The V3 reducer at `src/lib/upload/v3-state.ts` is the canonical interaction model for both the C2 component layer (now dormant) and the new D2 component layer. The action union grows ADDITIVELY in D2.1 (six new action types per spec §15.4); no existing action is removed or renamed. Selectors in `upload-selectors.ts` carry forward; one new (`getLayoutState`), one renamed (`densityForCount` → demoted to internal helper, no longer a selector).

**Implication:** any code that imports from `v2-state.ts` is part of the dormant scaffolding. New D2 components consume the V3 reducer + V3 selectors only.

### 3.2 Parity contract (carries forward)

The mock-scenario fixtures in `v2-mock-scenarios.ts` and the V2Asset shape in `v2-types.ts` are the data-model contract. Every existing scenario must continue to pass through the V3 reducer with the same readiness/exception selector outputs. The 76 parity tests in `v3-state-parity.test.ts` re-run as the D-phase regression gate.

**Specific spec exceptions (per UX-SPEC-V4):**
- `V2StoryGroup` gains `coverAssetId: string | null` and `sequence: string[]` (additive — old fixtures parse cleanly; cover defaults to null, sequence defaults to a copy of `proposedAssetIds`)
- `V3UIState` gains `contactSheetZoom`, `leftRailCollapsed`, `compareAssetIds` (additive)
- `V3UIState` loses `flatListOverride` (Archive override mode dies with density auto-detection)
- AI auto-accept hydration sweep (per spec §11.1) modifies asset.editable values where confidence ≥ threshold — explicitly authorized per spec; tests update to reflect

Beyond those documented changes, behavior parity is non-negotiable.

### 3.3 Temporary coexistence (extended)

Two layers of dormant scaffolding now exist:

1. **V2 layer (carries forward from C2-PLAN §3.3)** — `src/components/upload-v2/*` and most `src/lib/upload/v2-*` files. Already dormant per C2-PLAN. Deletion still pending the explicit V2-cutover PR.

2. **C2 layer (new under D)** — the entire `src/app/vault/upload/_components/*` set as it stands at PR #14 head. Dormant-flagged at D2.1 with the same `// DORMANT — replaced by D2 (new shell). Scheduled for deletion at D2.8 cutover. DO NOT extend.` header. NOT routed to from D2.1 onward (the new shell replaces them at the page level).

**Procedural rules:**
- The new shell at `app/vault/upload/page.tsx` is the only routed upload surface
- Old C2 components are NOT imported anywhere from D2.1 onward (D2 components import their own primitives + the surviving spine: DuplicateResolver, ConflictResolver, PriceBasisPanel, AcceptRow, AIProposalBanner, all 5 commit-phase panels, useCommitSimulation hook)
- C2 component tests stay green during D2 but are no longer expanded (frozen-as-of D2 land)
- D2.8 is the explicit cutover PR — deletes both V2 dormant scaffolding and the C2 dormant component layer in one shot

A future PR (D2.8) deletes the dormant files. Until that PR, the C2 component layer is fallback-only safety.

---

## 4. Architecture (the rebuild target)

### 4.1 New page surface (replaces the C2 layout)

Single screen at `/vault/upload` per UX-SPEC-V4. Three-pane progressive disclosure with a sticky bottom bar:

```
src/app/vault/upload/page.tsx                                ← server component shell (UPDATED — no new file; same path)
src/app/vault/upload/_components_v4/                         ← all new D2 client components (parallel to C2's _components/)
  UploadShellV4.tsx                                          ← top-level orchestrator with progressive disclosure (3 layout states)
  EmptyState.tsx                                             ← Empty layout state — full-window drop affordance
  LeftRail.tsx                                               ← Left rail container (mounts when assetOrder.length > 0)
  LeftRailHeader.tsx                                         ← + Add files button + cog → SessionDefaultsPopover
  LeftRailStoryHeader.tsx                                    ← per-story row in the left rail, drop target, drag-set-cover affordance
  LeftRailUnassignedBucket.tsx                               ← system bucket
  LeftRailNewStoryAffordance.tsx                             ← inline + new story input
  CenterPane.tsx                                             ← center container, hosts contact sheet OR compare view
  ContactSheet.tsx                                           ← virtualized grid of cards (zoom-aware)
  ContactSheetCard.tsx                                       ← single asset card; preview-first; only a status dot, no per-field furniture
  ContactSheetFilterChips.tsx                                ← top-of-center filter row + search affordance
  ZoomSlider.tsx                                             ← bottom-left of center; 5-step discrete slider
  CountFooter.tsx                                            ← bottom-right; reads getV3PublishReadiness
  RightRailInspector.tsx                                     ← right rail; mounts on single-asset selection; adapts SideDetailPanel content
  ContextualActionBar.tsx                                    ← floating bar on multi-select; bulk actions
  CompareView.tsx                                            ← Comparing layout state — center swaps to side-by-side
  SessionDefaultsPopover.tsx                                 ← cog popover; defaults editor
  CommitBar.tsx                                              ← REUSED from C2 (carries forward unchanged); re-mounted as full-width sibling
```

Note: parallel directory `_components_v4/` keeps the C2 dormant components readable for rollback. Cutover PR (D2.8) deletes `_components/` and renames `_components_v4/ → _components/`.

### 4.2 Reused from C2 (no rewrite — imported into the V4 shell as-is)

- `CommitBar.tsx`, `CommitSummaryPanel.tsx`, `CommitProgressPanel.tsx`, `CommitSuccessPanel.tsx`, `CommitErrorPanel.tsx`
- `useCommitSimulation.ts`
- `DuplicateResolver.tsx`
- `PriceBasisPanel.tsx`
- `AIProposalBanner.tsx` (re-mounted in CenterPane top, above filter chips)
- The `AcceptRow` helper component currently lives inside SideDetailPanel — extract to its own file for reuse in RightRailInspector

### 4.3 Reused from C2.1 (the spine)

- `src/lib/upload/v3-state.ts` — additive only (six new action handlers per §5)
- `src/lib/upload/v3-types.ts` — additive only (V2StoryGroup + V3UIState gain fields per §5)
- `src/lib/upload/v3-hydration.ts` — modified to seed cover/sequence defaults + run AI auto-accept sweep
- `src/lib/upload/upload-selectors.ts` — `getLayoutState(view)` added; `densityForCount` demoted to internal helper or removed
- `src/lib/upload/v2-mock-scenarios.ts`, `v2-simulation-engine.ts`, `v2-simulation.ts` — unchanged

### 4.4 Preserved files (no change at all)

Same set as C2-PLAN §4.3.

---

## 5. Action set deltas + selector deltas (per UX-SPEC-V4 §15)

### 5.1 New V3Action types

```typescript
| { type: 'SET_STORY_COVER'; storyGroupId: string; assetId: string | null }
| { type: 'REORDER_ASSETS_IN_STORY'; storyGroupId: string; sequence: string[] }
| { type: 'SET_CONTACT_SHEET_ZOOM'; zoom: 1 | 2 | 3 | 4 | 5 }
| { type: 'TOGGLE_LEFT_RAIL_COLLAPSED' }
| { type: 'ENTER_COMPARE_MODE'; assetIds: string[] }
| { type: 'EXIT_COMPARE_MODE' }
```

All additive. Reducer handlers added in D2.1.

### 5.2 V3UIState additions

```typescript
contactSheetZoom: 1 | 2 | 3 | 4 | 5  // default 3
leftRailCollapsed: boolean            // default false
compareAssetIds: string[]             // default []
```

### 5.2.1 V3UIState removal

```typescript
flatListOverride: boolean  // dies in D2.1; Archive mode dies with density auto-detection
```

This is technically a non-additive change — but it's safe because:
- No production consumer (C2 dormant components used it; they're flagged out)
- Parity tests don't reference it
- Hydration zeros it out anyway

### 5.3 V2StoryGroup additions (data model)

```typescript
coverAssetId: string | null  // default null
sequence: string[]           // default = copy of proposedAssetIds
```

Both additive. Hydration paths populate sensibly. V2 fixtures parse cleanly without these fields (TypeScript optional via the additive interface).

### 5.4 New selectors

- `getLayoutState(view: AssetsView): 'empty' | 'workspace' | 'comparing'` — derived from `assetOrder.length` + `compareAssetIds.length`
- `getStoryCover(group: V2StoryGroup, assetsById): V2Asset | null` — resolves effective cover (explicit `coverAssetId` OR first in `sequence`)

### 5.5 Hydration changes (D2.1)

- `hydrateV3FromV2State` populates `coverAssetId = null` and `sequence = [...proposedAssetIds]` on every story
- `hydrateV3FromV2State` runs AI auto-accept sweep: for each asset where `proposal.confidence >= 0.85` (per IPV4-5 default), copy proposal field values into the corresponding `editable` fields. Threshold is a constant in the hydration module.

---

## 6. Coexistence + cutover plan

### 6.1 D2.1 — old C2 components dormant-flag

D2.1's first commit:
1. Adds `// DORMANT — replaced by D2 (new shell). Scheduled for deletion at D2.8 cutover. DO NOT extend.` header to every file in `src/app/vault/upload/_components/*`
2. Updates `app/vault/upload/page.tsx` to import `UploadShellV4` from `_components_v4/` instead of `UploadShell` from `_components/`
3. Old components NOT removed yet — they sit dormant in the file tree as rollback safety

After D2.1: production routes to V4 shell; C2 components are present but not imported by any production code path.

### 6.2 D2.8 — cutover PR

D2.8's commit:
1. Delete entire `src/app/vault/upload/_components/` directory
2. Rename `src/app/vault/upload/_components_v4/` → `src/app/vault/upload/_components/`
3. Delete `src/components/upload-v2/*` and most `src/lib/upload/v2-*` files (the V2-era dormant scaffolding still pending from C2 — finally cutover here)
4. Update any test paths
5. Confirm 149+ tests still pass

This is its own focused PR. No new features. Pure deletion.

### 6.3 If D2 stalls or rolls back

Three rollback levels:
- **L1 — D2.1 land but unstable:** revert D2.1 commit; production routes back to C2 shell; D2 components stay in `_components_v4/` for fix
- **L2 — D2 fully landed but a regression discovered:** revert each D-phase commit in reverse order; same result
- **L3 — D2 too broken to fix:** revert the D-phase merge into main; PR #14 (C2) becomes the head again until V5 design

The dormant coexistence rule means rollback is always trivial.

---

## 7. D2.1 — Shell + reducer/data deltas + AI auto-accept hydration

### 7.1 Scope

- New `UploadShellV4.tsx` with three-pane layout primitive (no actual pane content yet — placeholder text in each region)
- New `EmptyState.tsx` for the Empty layout state
- New `getLayoutState` selector in `upload-selectors.ts`
- Six new V3Action types added to V3Action union with strict reducer handlers
- V3UIState + V2StoryGroup field additions per §5.2 + §5.3
- Removal of `flatListOverride` from V3UIState
- `hydrateV3FromV2State` updated: cover/sequence defaults + AI auto-accept sweep
- Dormant-flag header added to every C2 `_components/*` file
- `app/vault/upload/page.tsx` re-routes to `UploadShellV4`

### 7.2 Acceptance criteria

- Empty state at `?scenario=` (no fixture) shows full-window drop affordance
- `?scenario=clean_single_story` renders three panes (placeholders), commit bar at bottom
- All 149 existing tests still pass (reducer + parity + selector regression gate)
- New reducer tests for the six new action types
- New selector test for `getLayoutState`
- Visual: AI suggestions on `clean_single_story` come pre-accepted (high confidence in the fixture); `archive_150_mixed` keeps suggestions ghostly (lower confidence)
- C2 components remain importable but are not on the production code path

### 7.3 Out of scope (deferred to subsequent D phases)

- Actual pane content beyond placeholders (lands in D2.2/D2.3/D2.4)
- DnD wiring (lands incrementally with rails + center)
- Compare mode UI (lands in D2.6)

### 7.4 Companion implementation script

Single bash file: file writes + edits + targeted vitest run + commit. Same pattern as C2 phase scripts.

---

## 8. D2.2 — Left rail

### 8.1 Scope

- `LeftRail.tsx`, `LeftRailHeader.tsx`, `LeftRailStoryHeader.tsx`, `LeftRailUnassignedBucket.tsx`, `LeftRailNewStoryAffordance.tsx`
- DnD receiver wiring on story headers + Unassigned bucket (drop accepts `MOVE_ASSET_TO_CLUSTER` / `MOVE_ASSET_TO_UNGROUPED` payloads)
- Drag-onto-story-header-thumbnail-area also dispatches `SET_STORY_COVER` per spec §8.2
- Rail collapse/expand with `TOGGLE_LEFT_RAIL_COLLAPSED`
- Cover thumbnail rendering in story header (uses `getStoryCover` selector)

### 8.2 Acceptance criteria

- `?scenario=clean_single_story` shows left rail with Unassigned (5) + + New story
- `?scenario=archive_150_mixed` shows left rail with Unassigned + 3 cluster stories with cover thumbnails + + New story
- + New story creates a story via `CREATE_STORY_GROUP`
- Click story header filters center pane to that story (selector behavior)
- Collapse toggle works; state persists per-session
- Drop a card on a story header (visually wired in D2.3) → asset assigned

### 8.3 Out of scope

- Drag-source wiring (in D2.3)
- Sequence reorder within story (in D2.3 + D2.8 split)

---

## 9. D2.3 — Center pane (contact sheet)

### 9.1 Scope

- `CenterPane.tsx`, `ContactSheet.tsx`, `ContactSheetCard.tsx`, `ContactSheetFilterChips.tsx`, `ZoomSlider.tsx`, `CountFooter.tsx`
- Virtualized grid (`react-window` v1.x reused — IPV4-7 default)
- Zoom slider dispatches `SET_CONTACT_SHEET_ZOOM`; grid re-flows
- Filter chips reuse `SET_FILTER_PRESET` action; search affordance reuses debounced `SET_SEARCH_QUERY`
- DnD source wiring on cards (paired with D2.2 receivers)
- Sortable mode within a Story-filtered view: dispatch `REORDER_ASSETS_IN_STORY`
- Single-click selects (replaces selection); Cmd/Shift modifiers; double-click opens inspector full-bleed

### 9.2 Acceptance criteria

- `?scenario=archive_150_mixed` renders 60 cards in default zoom (level 3)
- Zoom slider 1→5 changes card density visibly
- Filter chip "Needs info" filters
- Search field filters
- Drag a card to a left-rail story → assigned
- In a story-filtered view, drag a card to a new position → sequence updates
- Card shows ONLY: thumbnail + filename overlay (hover) + selection checkbox + story badge + status dot. NO ✓/↻/Why?/price text/chips array.

### 9.3 Out of scope

- Multi-select bar (D2.5)
- Compare layout (D2.6)
- AI per-field accept (lives only in inspector — D2.4)

---

## 10. D2.4 — Right rail inspector

### 10.1 Scope

- `RightRailInspector.tsx` — adapts the C2 SideDetailPanel content (FieldEditor, ExceptionsSection, AIProposalDetailSection)
- New: "Set as cover" button in the inspector when the asset is in a story
- Per-field ✓ + ↻ icons (AcceptRow) live ONLY here per spec §11.3 — extracted to its own file for reuse
- Persistent rail mount when `selectedAssetIds.length === 1` (no push slide-in animation)
- Empty state: "Select an asset to edit" when nothing selected (per IPV4-1 default = mount on selection only — no pin needed)
- Progressive disclosure within the inspector per spec §5.2 (always-visible: thumbnail/title/caption/price/privacy; collapsible: tags/geography/licences/AI Proposal Detail/exceptions)

### 10.2 Acceptance criteria

- Single-click a card → right rail mounts with that asset's editor
- All field edits dispatch `UPDATE_ASSET_FIELD`
- "Set as cover" button visible when asset has a `storyGroupId`; click dispatches `SET_STORY_COVER`
- DuplicateResolver, ConflictResolver, PriceBasisPanel, AcceptRow all imported from C2 spine and rendered here
- Esc closes (deselects)
- J/K nav between cards (selection follows; right rail re-renders)
- AI auto-accept already happened at hydration (D2.1) — only low-confidence fields show ghost + ✓ + ↻

### 10.3 Out of scope

- Inspector pin (IPV4-1=a default — no pin)
- Multi-select inspector (multi-select shows contextual bar instead — D2.5)

---

## 11. D2.5 — Contextual action bar

### 11.1 Scope

- `ContextualActionBar.tsx`
- Mounts at the bottom of CenterPane (above CommitBar) when `selectedAssetIds.length >= 2`
- Actions: Set price · Set privacy · Assign story · ✓ AI · Compare (enables when 2 selected per IPV4-3 default = a) · Exclude · Clear
- "✓ AI" dispatches no-op `BULK_ACCEPT_PROPOSALS_FOR_SELECTION` THEN sequenced `UPDATE_ASSET_FIELD` for caption + tags + geography. NEVER price (L5 + spec §9.4).
- "Assign story" opens dropdown of existing stories + + New story option
- Slide-up animation; respects `prefers-reduced-motion`

### 11.2 Acceptance criteria

- Multi-select 2+ assets → bar appears
- Set price / privacy → BULK_UPDATE_FIELD dispatched per asset
- ✓ AI → assets in selection get caption/tags/geography from their proposals
- Compare button enables only when exactly 2 selected (per IPV4-3)
- Bar disappears on Clear or deselect
- BulkOpsBar is no longer present (dormant per §6.1)

### 11.3 Out of scope

- Compare layout itself (D2.6)
- Right-click context menus (deferred per spec §3.4)

---

## 12. D2.6 — Compare mode

### 12.1 Scope

- `CompareView.tsx`
- Compare button in ContextualActionBar dispatches `ENTER_COMPARE_MODE { assetIds }` (writes to `compareAssetIds`)
- `getLayoutState` returns 'comparing' when `compareAssetIds.length === 2`
- CenterPane swaps to side-by-side layout
- Esc OR "Exit compare" button dispatches `EXIT_COMPARE_MODE`
- Right rail still conditional; left rail unchanged
- Per IPV4-3 = a (2-only): if user selects 3+ then clicks Compare, "compare top-2" affordance appears; (b) variant deferred

### 12.2 Acceptance criteria

- Multi-select 2 → Compare → side-by-side renders both assets at large preview size
- Esc returns to Workspace layout
- Right rail can still open on either compared asset
- Multi-select 3+ → Compare button shows "compare top-2" affordance per IPV4-3

### 12.3 Out of scope

- A/B mask, EXIF diff, pixel-zoom sync (per spec §10.3)
- 3-up compare (IPV4-3=b — deferred unlock)

---

## 13. D2.7 — File ingestion + session defaults

### 13.1 Scope

- Whole-window drag/drop listener at `UploadShellV4` root → `ADD_FILES`
- Visual feedback during drag: full-window outline overlay
- `EmptyState.tsx` already shows the drop affordance (D2.1); reuse here
- "+ Add files" button in LeftRailHeader → opens native file picker
- `SessionDefaultsPopover.tsx` — triggered from cog icon in LeftRailHeader; contents: privacy default, licence defaults, tag defaults, watermark mode; dispatches `SET_DEFAULTS`

### 13.2 Acceptance criteria

- Drop a file anywhere in the window (including over a card or rail) → added via ADD_FILES
- Empty state: drop affordance fills the screen
- + Add files opens native picker
- Cog → popover with defaults editor; saves dispatch `SET_DEFAULTS`
- Popover dismisses on click-outside or Esc

### 13.3 Out of scope

- URL paste / cloud import / folder import (per spec §12.3)

---

## 14. D2.8 — Cutover

### 14.1 Scope

Single deletion PR (no new features):
- Delete `src/app/vault/upload/_components/` (the C2 dormant component layer)
- Rename `src/app/vault/upload/_components_v4/` → `src/app/vault/upload/_components/`
- Delete `src/components/upload-v2/*` and remaining V2-era dormant files
- Update any test imports broken by the rename
- Confirm 149+ tests still pass (regression gate)
- Final visual smoke across all V4 surfaces

### 14.2 Acceptance criteria

- `_components_v4/` → `_components/` rename complete
- All tests pass
- No production code paths reference the deleted directories
- PR diff is delete-only + rename — no new functionality

### 14.3 Out of scope

- Anything else. This phase is pure cleanup.

---

## 15. Sequencing

D2.1 must land first (sets up the shell + reducer surface). D2.2 + D2.3 + D2.4 can be interleaved or sequential — they touch different panes. D2.5 needs D2.3 (multi-select happens on cards). D2.6 needs D2.5 (Compare button lives in the bar). D2.7 can land any time after D2.1 (shell-level). D2.8 must be last.

Recommended linear order:
1. D2.1 (shell + reducer)
2. D2.3 (center — most visible work; gives the surface its character)
3. D2.4 (right rail — makes the inspector functional)
4. D2.2 (left rail — connects organization)
5. D2.5 (contextual bar)
6. D2.6 (compare)
7. D2.7 (file ingestion + defaults)
8. D2.8 (cutover)

Eight phases. The D2.x stack lands as one PR per phase (matching C2's pattern), totaling 8 PRs after PR #14 merges. OR all eight commits stack onto a single `feat/d-upload-v4` branch and merge as one large PR — founder choice (call it a meta-IP at this plan level).

### 15.1 Rough effort estimate

| Phase | Code complexity | New tests |
|---|---|---|
| D2.1 | Medium-high (reducer additions, hydration sweep, dormant-flag pass) | ~10 reducer + 1 selector |
| D2.2 | Medium (5 new components, DnD receiver wiring) | 0 (visual-smoke gated) |
| D2.3 | High (virtualized grid, zoom slider, DnD source, sortable, filter+search) | ~3 selector |
| D2.4 | Medium (mostly content adaptation from SideDetailPanel) | 0 |
| D2.5 | Medium (contextual mounting, bulk loop dispatches) | 0 |
| D2.6 | Low-medium (layout swap, single new component) | 0 |
| D2.7 | Low (whole-window listener, popover, native file picker) | 0 |
| D2.8 | Trivial (delete + rename) | regression only |

---

## 16. Risk register

| Risk | Mitigation |
|---|---|
| DnD across virtualized boundaries — `react-window` + `@dnd-kit` interaction is non-trivial | D2.3 directive surfaces this as an explicit IP; spike before committing if unclear |
| AI auto-accept sweep modifies asset.editable values — could surprise users | Show clearly in inspector (no ghost = accepted); regen icon in inspector lets user re-trigger |
| Two parallel `_components/` and `_components_v4/` directories during D2.1-D2.7 — confusion potential | Strict naming convention; cutover at D2.8 resolves; no shared component names |
| Story cover fallback when cover asset leaves story — silent vs prompt | IPV4-2 = silent fallback (default); reconsider if user testing surfaces confusion |
| Compare mode locks at 2-only per IPV4-3=a — may be too strict | Built as a flag-controlled limit; IPV4-3=b unlock is small follow-up code change |
| `flatListOverride` removal — non-additive change to V3UIState | C2 dormant components reference it; they're flagged out so unreachable; parity tests don't check it; safe |
| react-window v1 vs TanStack Virtual choice (IPV4-7=a default = react-window) | TanStack Virtual is a deferred refactor; not a D2 concern |

---

## 17. Out of scope (links to spec §18)

All deferrals from UX-SPEC-V4 §18 carry forward unchanged. Notable:

- Mobile / tablet variants — Phase post-D
- Drag from URL / paste image
- Folder import preserving hierarchy
- Cloud-storage import
- Multi-tab DnD
- Multi-cover per Story
- Per-channel sequence
- A/B compare overlay, EXIF diff, pixel-zoom sync
- Right-click context menus
- Drag stories themselves
- Component-test infrastructure (jsdom + RTL) — separate ratification

---

## 18. Open IPs (deferred to per-sub-phase directives)

The eight UX-SPEC-V4 IPs (IPV4-1 to IPV4-8) are already ratified. Per-sub-phase IPs surface in each directive as needed (paralleling C2.1's IPI-* / C2.2's IPII-* / etc. — naming convention: D2.1 → IPD1-*, D2.2 → IPD2-*, etc.).

One plan-level IP:

### IPD0-1 — Single PR or multiple?

D2.1 → D2.8 lands as:
- **(a)** Single `feat/d-upload-v4` branch with 8 stacked commits, one PR. Reviewer sees the whole rebuild in context.
- (b) Eight separate PRs (one per phase). Smaller review surface; harder to see the whole.
- **Default: (a).** Same as how C2 stack landed in PR #14.

---

## 19. Ratification checklist

Founder reply should be:
- `ratify D-PLAN` — proceeds to D2.1 directive composition
- itemized override (`IPD0-1=b, ratify rest`)
- `revise <section>` — point at specific area
- `reject` — back to UX-SPEC-V4 conversation

After ratification, the next deliverable is `docs/upload/D2.1-DIRECTIVE.md`.
