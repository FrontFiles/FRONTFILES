# UX-SPEC-V4 — Vault Upload (Editorial Workspace)

**Status:** DRAFT — pending founder ratification before any code work begins
**Date:** 2026-04-26
**Supersedes:** `UX-SPEC-V3.md` (single-screen, density-aware list — built and shipped as PR #14, now retired as the canonical model)
**Reads underlying:** the Founder Lock below (v2 of the workspace memo); `C2-PLAN.md` for what survives; `v2-types.ts` for the data model that carries forward
**Audience:** founder (ratification), then a future C-style implementation plan and per-phase directives

---

## 0. Status + provenance

This spec retires UX-SPEC-V3 as the design target. UX-SPEC-V3 was built faithfully across C2.1 → C2.6 (PR #14) and is structurally complete. Visual review of the shipped product surfaced that the resulting surface reads as a control-heavy admin tool rather than an editorial workspace. The Founder Lock below is the corrected design intent. UX-SPEC-V4 is the build-governing spec that operationalizes it.

**The C2 spine survives.** V3 reducer, parity contract (76 tests), commit state machine, selectors, action shapes, data model — all carry forward. The component layer rebuilds on top. Migration is dormant-flag-and-rebuild (same coexistence pattern that protected V2 → V3 in C2-PLAN §3.3).

PR #14 should still merge. It establishes the spine and parity contract in main. UX-SPEC-V4 work lands in a separate branch + PR sequence on top.

---

## 1. Founder Lock

> Frontfiles upload is an editorial workspace where assets are the interface.
>
> **Layout:** three-pane in shape, progressively disclosed by user state.
> - Empty: drop affordance fills the screen.
> - Has assets: center contact sheet (zoom slider) + conditional right rail inspector on selection.
> - Has stories: left rail mounts (Stories + Unassigned + "+ New").
>
> **Center:** visual contact sheet. One zoom slider replaces density modes. Filter chips at top: All / Needs info / Ready / Duplicates / Excluded. Whole-window file drop. Multi-select reveals a contextual action bar (set price / set privacy / assign story / accept all suggestions). Compare mode for 2-3 selected assets side-by-side.
>
> **Right rail:** inspector. Mounts when an asset is selected. Large preview, metadata, rights, pricing, license, AI proposal review (full per-field detail lives ONLY here, not on the contact sheet).
>
> **Left rail:** organization destinations only. Stories + Unassigned + "+ New". Drag-asset-onto-story-header is the primary set-cover action. Drag-asset-onto-bucket reassigns. Sequence within a story is a first-class concept on par with Cover.
>
> **Bulk:** contextual on multi-select. Never a persistent toolbar.
>
> **AI:** subtle. Auto-accept high-confidence; surface low-confidence in the inspector. No per-field accept furniture on the contact sheet.
>
> **Story has:** name, sequence (ordered asset list), cover (one asset). Cover defaults to first; user can drag any asset onto the story header to make it cover. Reordering doesn't silently change cover.
>
> **Progressive editorial workspace.** Assets dominate; chrome appears contextually. Three-pane is the END state, not the default.

This Lock is non-negotiable. Every section below operationalizes it. If a downstream directive proposes a structure that contradicts the Lock, the directive is wrong, not the Lock.

---

## 2. Layout system — progressive disclosure

The shell renders one of three layout states based on `state.assetOrder.length` and user action:

| State name | Trigger | What's visible |
|---|---|---|
| `Empty` | `assetOrder.length === 0` | Full-screen drop affordance — large, centered, "Drag assets here or click to browse" + watermark of file types accepted. Nothing else. |
| `Workspace` | `assetOrder.length > 0` | Center pane (contact sheet + filter chips + zoom slider) AND left rail mount together. Left rail at minimum shows Unassigned bucket + "+ New story". Stories appear in left rail as user creates them. Right rail mounts conditionally on single-asset selection. |
| `Comparing` | User invoked Compare with multi-select | Center swaps to side-by-side compare layout. Right rail still conditional. Left rail unchanged. Exit returns to Workspace. |

State transitions are derived, not stored. No new reducer flags. The current `densityForCount` selector dies; `getLayoutState(view)` replaces it.

### 2.0.1 Why left rail mounts at first asset (not first story)

Earlier draft of this spec gated the left rail on `storyGroupOrder.length >= 1` (state called `Organizing`). External review flagged this as too late — the user has no obvious way to discover the organization metaphor or create the first Story. The corrected rule mounts the left rail as soon as any asset exists, with the rail showing:
- Unassigned (N) — counts all assets initially
- "+ New story" — the discoverability surface for organization

Power users who don't want to organize can leave it; the rail doesn't block work.

### 2.1 Pane resize / collapse

- Left rail: fixed 240px width when mounted. Collapsible to a 40px icon strip via toggle button at its top edge. Collapsed state persists per-session via `state.ui.leftRailCollapsed` (new bool flag).
- Right rail: fixed 400px width when mounted. Conditional on `selectedAssetIds.length === 1` OR persistent if user toggles a "pin inspector" affordance. (See IPV4-1.)
- Center: takes remaining horizontal space. Min-width 480px. If viewport too narrow to fit all three: collapse left rail first, then right rail.

### 2.2 Bottom bar

The C2.4 commit bar carries forward unchanged in shape and behavior. Spans the full width across all three columns (it is a sibling of the three-pane row, not nested). Same 5-phase state machine. Same success-replaces-screen behavior at `phase === 'success'` (drop zone + all three panes hide; CommitSuccessPanel takes over). Same `CommitBar` orchestrator + the four sub-panels.

### 2.3 What's NOT in the layout

- No persistent toolbar at the top of the center
- No persistent BulkOpsBar (replaced entirely by the contextual action bar — see §9)
- No persistent DropZone region (replaced by whole-window listener — see §12)
- No persistent SessionDefaultsBar (replaced by a popover from a settings affordance — see §13)

---

## 3. Center pane — contact sheet

### 3.1 Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│  [All] [Needs info] [Ready] [Duplicates] [Excluded]   ⚙   ⊕  │   ← Filter chips + settings + add files
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ▢  ▢  ▢  ▢  ▢  ▢  ▢                                       │
│   ▢  ▢  ▢  ▢  ▢  ▢  ▢          ← Contact sheet grid         │
│   ▢  ▢  ▢  ▢  ▢  ▢  ▢          (virtualized)                │
│   ▢  ▢  ▢  ▢  ▢  ▢  ▢                                       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  ◇ ━━━━━━●━━━━━━━━━ ◆        2,134 assets · 60 ready        │   ← Zoom slider + count footer
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Filter chips

Five exclusive (radio-style) filters at top: All / Needs info / Ready / Duplicates / Excluded. Maps to existing `V2FilterPreset` shape; no new preset types invented. Selected chip = `bg-black text-white`; others = `bg-white text-black border border-black hover:bg-black hover:text-white`. Brutalist square buttons, same as C2 FilterBar.

A search input opens via a magnifying-glass icon in the top-right area (no permanent search field; debounced 200ms when active per existing `SET_SEARCH_QUERY` action).

### 3.3 Contact sheet grid

Virtualized via `react-window` (already pinned to v1.x). Cards arranged in a CSS grid that flexes by zoom level:

| Zoom step | Card width | Approx columns @1280px center | Use case |
|---|---|---|---|
| 1 (smallest) | 80px | ~14 | Browse 1500-asset archive |
| 2 | 120px | ~9 | Browse + scan |
| 3 (default) | 160px | ~7 | Organize |
| 4 | 240px | ~4 | Review / curate |
| 5 (largest) | 360px | ~3 | Detail review without opening inspector |

Each ContactSheetCard renders:
- Thumbnail (object-cover, square crop)
- Filename overlay on hover
- Selection checkbox in top-left corner (visible on hover OR when selected)
- Story badge in top-right corner (story name truncated, only when `storyGroupId !== null`)
- A single status dot in bottom-right: green (ready), yellow (needs info), red (excluded), orange (duplicate), gray (low confidence/processing)

**No per-field ✓ icons. No regenerate buttons. No "Why?" links. No price text.** Per the Lock — "no per-field accept furniture on the contact sheet."

### 3.4 Click model

| Click | Behavior |
|---|---|
| Single-click card | Select (replaces selection); right rail opens with that asset |
| Cmd-click | Add/remove from selection |
| Shift-click | Range-select |
| Double-click | Open inspector full-bleed (right rail expands to take center temporarily; Esc returns) |
| Drag card | Initiate DnD (see §8) |
| Right-click | Contextual menu (deferred to v2 — start with no context menu) |

### 3.5 Zoom slider

A discrete 5-step slider at the bottom-left of the center pane. Single source of truth in `state.ui.contactSheetZoom: 1 | 2 | 3 | 4 | 5` (new field). Default = 3. Persists per-session. Replaces all `densityForCount` logic.

### 3.6 Count footer

Bottom-right of center pane: `{filtered count} of {total included} · {ready count} ready`. Reads from `getV3PublishReadiness`. Updates on filter / search / selection.

---

## 4. Left rail — organization destinations only

### 4.1 Anatomy

```
┌──────────────────┐
│ ⊕ + Add files    │   ← File ingestion entry
│ ⚙ Defaults       │   ← Session defaults popover trigger
├──────────────────┤
│ ▢ Unassigned (12)│   ← System bucket — drop target
├──────────────────┤
│ STORIES (5)      │
│                  │
│ ▦ Lisbon March  │
│   60 · 0 ready   │   ← Story header — drop target
│ ▦ Setúbal Coast  │
│   45 · 12 ready  │
│ ▦ Évora Wildfire │
│   45 · 30 ready  │
│ ▦ ...            │
├──────────────────┤
│ ⊕ + New story    │
└──────────────────┘
```

Width: 240px when mounted, 40px when collapsed. Single column, vertical scroll for large story counts.

### 4.2 Story header

Each StoryHeader renders:
- Cover thumbnail (40x40 square at left, falls back to filename initial if no cover)
- Story name (truncated)
- Asset count + ready count (small slate-500 text)
- Drag-into-here visual feedback (border-blue-600 on dragover)

Click a story header → selects that bucket → center pane filters to assets in that story → no right rail (selection is bucket-level, not asset-level).

### 4.3 Unassigned bucket

Always present. Same shape as a story header but no cover thumbnail (uses a placeholder icon). Click → center filters to `storyGroupId === null` assets.

### 4.4 + New story

Bottom-anchored. Click → inline input → Enter to create. Dispatches existing `CREATE_STORY_GROUP` action.

### 4.5 NOT in left rail

- Exception filter buckets (Needs info, Duplicates, Ready, Excluded). Those live as filter chips at the top of the center pane (§3.2). Different mental model — filter ≠ destination.
- Asset count metrics beyond per-bucket counts.
- Settings, batch info, anything else.

---

## 5. Right rail — inspector

### 5.1 Mount conditions

- `selectedAssetIds.length === 1` → mounts with that asset
- `selectedAssetIds.length === 0` → unmounted (right rail collapses; center expands to full)
- `selectedAssetIds.length > 1` → unmounted; the contextual action bar appears at the bottom of center instead (see §9)
- IPV4-1: optional "pin inspector open" toggle to keep mounted with empty state when nothing selected

### 5.2 Anatomy

Adapts the C2 SideDetailPanel content into the new shell. Same field editor, exceptions section, AI proposal detail body. Differences from C2:

- **Persistent right rail mount** (not push-from-right slide-in)
- **Per-field ✓ + ↻ icons live ONLY here** (stripped from contact sheet per the Lock)
- **Larger thumbnail** — up to 320px tall (vs the 192px C2.6 cap)
- **Progressive disclosure** within the inspector:
  - Always visible: thumbnail, title, caption, price, privacy
  - Collapsible: tags, geography, licences, AI Proposal Detail body, exceptions section
- **No close button** — inspector closes by deselecting (click outside, Esc)

### 5.3 What carries forward verbatim

- `DuplicateResolver` component
- `ConflictResolver` (helper inside SideDetailPanel currently)
- `PriceBasisPanel` component
- `AcceptRow` (✓ + ↻ pair)
- All existing per-field UPDATE_ASSET_FIELD dispatches
- All keyboard handlers (Esc close, J/K nav)

### 5.4 What changes

- Sticky header redesigned as part of the persistent rail (no separate close button)
- Layout moves from push-overlay to flex-child
- Per-field accept icons stay (this surface keeps the AI affordances)

---

## 6. Bottom bar — commit + flow

The C2.4 commit bar carries forward unchanged in component composition and state machine. Re-mounted as a sibling of the three-pane row in UploadShell:

```
┌────────────┬─────────────────────────┬────────────┐
│  Left rail │     Center pane          │ Right rail │
│            │                          │            │
└────────────┴─────────────────────────┴────────────┘
┌──────────────────────────────────────────────────────┐
│  CommitBar (full-width, sticky bottom)               │
└──────────────────────────────────────────────────────┘
```

`CommitBar.tsx`, `CommitSummaryPanel.tsx`, `CommitProgressPanel.tsx`, `CommitSuccessPanel.tsx`, `CommitErrorPanel.tsx`, `useCommitSimulation.ts` — all reused as-is. Phase machine unchanged.

Success phase still replaces the entire screen body — the three-pane row hides, CommitSuccessPanel fills.

---

## 7. Story Cover + Sequencing — first-class

Per the Lock: Cover and Sequence are equally first-class. Both live in the data model.

### 7.1 Data model deltas

`V2StoryGroup` gains:

```typescript
interface V2StoryGroup {
  // ... existing fields
  coverAssetId: string | null  // NEW — null = no explicit cover, falls back to first
  sequence: string[]           // NEW — ordered asset ids; canonical reading order
}
```

The existing `proposedAssetIds: string[]` stays as the AI-proposed grouping. `sequence` is creator-authored. They diverge as soon as the user reorders.

### 7.2 New actions

```typescript
| { type: 'SET_STORY_COVER'; storyGroupId: string; assetId: string | null }
| { type: 'REORDER_ASSETS_IN_STORY'; storyGroupId: string; sequence: string[] }
```

### 7.3 Cover behavior

- Default cover: the first asset in `sequence` (which is the first asset in `proposedAssetIds` until the user reorders)
- User can set explicitly via TWO co-equal primary paths:
  1. **Drag asset onto story header in left rail** → `SET_STORY_COVER`. Visual, fast, satisfies the direct-manipulation principle.
  2. **"Set as cover" button in right rail inspector** when the selected asset is in a story → `SET_STORY_COVER`. Discoverable, explicit, satisfies the command-fallback principle.
- Both paths are first-class. Drag is for visual flow; button is for users who don't think to drag or who want explicit confirmation.
- Reordering does NOT silently change cover — `coverAssetId` is sticky once set
- If cover asset leaves story (assigned elsewhere or excluded):
  - **Default per IPV4-2:** auto-fallback to first asset in `sequence`, no prompt
  - Alternative: prompt the user
- Cover asset thumbnail renders in the story header in left rail

### 7.4 Sequence behavior

- Initialized to `proposedAssetIds` order at story creation
- Sortable contact sheet inside center when filtered to a story:
  - Drag handle on each card
  - Drop reorders
  - Dispatches `REORDER_ASSETS_IN_STORY`
- Reordering visible AND persistent across session

### 7.5 NOT in scope for cover/sequence

- Multi-cover (e.g., social vs hero) → defer
- Sequence per-channel (different orders for vault vs social) → defer

---

## 8. Drag-and-drop interaction model

### 8.1 Library choice

`@dnd-kit/core` + `@dnd-kit/sortable`. Headless, accessible, virtualization-friendly. Replaces native HTML5 DnD which is brittle and hard to style.

(Alternative: `react-dnd`. Less ergonomic; not recommended.)

### 8.2 Draggable / droppable inventory

| Source | Target | Action |
|---|---|---|
| ContactSheetCard | LeftRailStoryHeader | Assign asset to story (`MOVE_ASSET_TO_CLUSTER`); if dropped on header thumbnail area, also `SET_STORY_COVER` |
| ContactSheetCard | LeftRailUnassignedBucket | Unassign (`MOVE_ASSET_TO_UNGROUPED`) |
| ContactSheetCard (when filtered to a story) | Another card position | Reorder (`REORDER_ASSETS_IN_STORY`) |
| Multi-select drag | Same targets | Bulk-equivalent dispatch — loop the action over selected ids in event handler |
| Files from desktop | Window | Add to batch (`ADD_FILES`) |

### 8.3 Visual feedback

- Drag start: card opacity 60%, cursor changes to grabbing
- Multi-select drag: card stack visual (3 cards offset behind cursor) with count badge
- Drop target hover: target border becomes blue-600, optional fill-tint
- Invalid drop target: cursor changes to not-allowed; no drop tint

### 8.4 NOT in scope

- Drag from contact sheet OUT to OS (export) → defer to integrations phase
- Drag between two open Frontfiles tabs → defer
- Drag to reorder stories themselves (left rail) → defer

---

## 9. Multi-select + contextual action bar

Per the Lock: bulk is contextual on multi-select. Never a persistent toolbar.

### 9.1 Trigger

`selectedAssetIds.length >= 2` OR `selectedAssetIds.length === 1 AND user invoked the bulk affordance` (e.g., Cmd-A select all then act).

### 9.2 Mount location

A floating bar at the bottom of the center pane, ABOVE the global commit bar. Width matches center pane width (not full-width). Slide-up animation; respects `prefers-reduced-motion`.

### 9.3 Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ 12 selected │ Set price · Set privacy · Assign story · ✓ AI │
│             │ Compare · Exclude · Clear                     │
└─────────────────────────────────────────────────────────────┘
```

### 9.4 Actions

- Set price → opens inline popover, dispatches `BULK_UPDATE_FIELD`
- Set privacy → dropdown, dispatches `BULK_UPDATE_FIELD`
- Assign story → dropdown of existing stories + "+ New story", dispatches `MOVE_ASSET_TO_CLUSTER` per asset OR `CREATE_STORY_GROUP` then move
- ✓ AI → dispatches `BULK_ACCEPT_PROPOSALS_FOR_SELECTION` (no-op telemetry) + sequenced `UPDATE_ASSET_FIELD` for caption + tags + geography (NEVER price)
- Compare → enters Comparing layout state (see §10)
- Exclude → dispatches `TOGGLE_ASSET_EXCLUDED` per asset
- Clear → dispatches `DESELECT_ALL_ASSETS`

### 9.5 What dies from C2

- `BulkOpsBar.tsx` — replaced entirely. Persistent top-of-list toolbar pattern killed.

---

## 10. Compare mode

### 10.1 Trigger

Multi-select 2 assets → click "Compare" in contextual action bar. (Per IPV4-3 default = (a) 2 only.) ≥3 selected: "Compare" button in the bar disables OR (per IPV4-3 = b) shows a "compare top-2" affordance. Strict 2-up keeps each preview large enough to read; 3-up is a deferred unlock.

### 10.2 Layout

Center pane swaps to a side-by-side layout. Each compared asset gets:
- Large preview (fills its column)
- Filename + selection checkbox
- A small "make canonical" affordance (sets this asset as the keeper for the comparison group; sibling assets get auto-excluded — optional opinion, gated by IPV4-4)

Esc or "Exit compare" button returns to contact sheet view (Comparing → previous layout state).

### 10.3 NOT in scope

- A/B masking / overlay
- Side-by-side EXIF diff
- Pixel-zoom sync between compared assets

---

## 11. AI proposal surfacing — subtler

Per the Lock: subtle. The C2.5 per-field-everywhere treatment retracts.

### 11.1 Auto-accept high-confidence

When `asset.proposal.confidence >= 0.85` (per IPV4-5), the ghost text is auto-accepted into editable fields at hydration time (`hydrateV3FromV2State` change). No UI affordance needed; the field reads as user-authored from the start. The user can still edit it normally.

### 11.2 Surface low-confidence in inspector

When `asset.proposal.confidence < 0.85`, the right rail inspector shows the ghost + ✓ + ↻ pattern (current C2.5 AcceptRow) for the relevant fields. Same UX, different gating.

### 11.3 Contact sheet has zero per-field AI furniture

No ✓, no ↻, no Why?, no per-row "Accept all suggestions". The contact sheet card shows only a single status dot. AI is implicit, not chatty.

### 11.4 Cluster proposals (banners) survive

The `AIProposalBanner` from C2.2 carries forward. Renders at the top of the center pane (above filter chips) when `aiClusterProposals` has pending entries. Same accept/dismiss/details flow as C2.

### 11.5 What dies from C2.5

- Per-row "Accept all suggestions" link in AssetRow (link itself dies; the bulk-accept lives in the contextual action bar's "✓ AI" instead)
- Per-field ✓ + ↻ on the contact sheet card (already not present in this design — contact sheet is preview-first)
- Per-field ✓ + ↻ in Linear-mode AssetRow (Linear mode dies as a concept; replaced by zoom slider)

---

## 12. File ingestion — whole-window drop

### 12.1 Mechanism

`UploadShell` mounts a single `dragover` + `drop` listener at the root container level. Any file dropped anywhere in the window is added via `ADD_FILES`. Visual feedback: full-window outline-only overlay during drag.

The `+ Add files` button in the top of the left rail (or center top when no left rail yet) opens a native file picker. Same `ADD_FILES` dispatch.

### 12.2 Drop on empty state

When in `Empty` layout state, the center renders a full-screen drop affordance (large dashed border + "Drag assets here or click to browse"). Click triggers the file picker.

### 12.3 NOT in scope

- Drag from URL / paste image
- Folder import preserving hierarchy
- Cloud-storage import (Drive, Dropbox)

---

## 13. Session defaults

Lives in a popover triggered by the cog icon in the top of the left rail (or top of center if no left rail yet). Contents: privacy default, licence defaults, tag defaults, watermark mode. Unchanged from C2.1's `SET_DEFAULTS` action shape.

NOT in a persistent bar. NOT in the right rail. NOT in the inspector.

---

## 14. Keyboard model

Adapts and extends C2's keyboard discipline:

| Key | Action | Where |
|---|---|---|
| `Esc` | Close inspector / exit compare / dismiss popover | Anywhere |
| `J` / `K` | Next / prev asset (selection follows) | Contact sheet |
| `Enter` | Open inspector for selected | Contact sheet |
| `Space` | Toggle selection | Contact sheet |
| `Cmd-A` | Select all visible | Contact sheet |
| `Cmd-Click` | Add to selection | Contact sheet |
| `Shift-Click` | Range-select | Contact sheet |
| `Cmd-Enter` | Begin commit (if any ready) | Anywhere |
| `1` `2` `3` `4` `5` | Set zoom level | Contact sheet |

---

## 15. Reducer / data model deltas

### 15.1 V2StoryGroup gains

- `coverAssetId: string | null`
- `sequence: string[]`

### 15.2 V3UIState gains

- `contactSheetZoom: 1 | 2 | 3 | 4 | 5` (default 3)
- `leftRailCollapsed: boolean` (default false)
- `compareAssetIds: string[]` (replaces `Comparing` layout state derivation)

### 15.3 V3UIState loses

- `flatListOverride` (no Archive mode anymore — zoom slider replaces it)
- (no other loss; everything else stays for the 9-month parity window)

### 15.4 New actions

- `SET_STORY_COVER { storyGroupId, assetId }`
- `REORDER_ASSETS_IN_STORY { storyGroupId, sequence }`
- `SET_CONTACT_SHEET_ZOOM { zoom }`
- `TOGGLE_LEFT_RAIL_COLLAPSED`
- `ENTER_COMPARE_MODE { assetIds }`
- `EXIT_COMPARE_MODE`

### 15.5 Selectors

- `getLayoutState(view): 'empty' | 'browsing' | 'organizing' | 'comparing'` — replaces `densityForCount`
- `getStoryCover(group, assetsById): V2Asset | null` — derives effective cover
- All existing selectors carry forward unchanged

### 15.6 Hydration changes

- `hydrateV3FromV2State` initializes `coverAssetId = null` on every story (auto-fallback at render)
- `hydrateV3FromV2State` initializes `sequence = proposedAssetIds` on every story
- AI auto-accept (per §11.1) runs as a post-hydration sweep: for each asset where `proposal.confidence >= 0.85`, copy proposal field values into editable fields

---

## 16. What survives, what dies, what's new (against C2 at PR #14)

### Survives

- V3 reducer + V3State + ~50 V3Action types (additive only — see §15.4)
- Parity contract + 76 parity tests
- Commit state machine + all 5 commit-phase components
- All selectors (carry forward; one new, one renamed: §15.5)
- `DuplicateResolver`, `ConflictResolver`, `PriceBasisPanel`, `AcceptRow` — all unchanged
- `AIProposalBanner` — unchanged
- `useCommitSimulation` hook — unchanged
- All v2-* files (still dormant per coexistence rule)
- The three founder-ratified locks from C2-PLAN §3 (reducer authority, parity contract, temporary coexistence) — unchanged in spirit; coexistence now also covers the C2 component layer being demoted to dormant

### Dies (gets dormant-flagged, deleted in cutover PR)

- `UploadShell` single-screen layout (full rebuild)
- `AssetList` density router
- `densityForCount` (replaced by `getLayoutState`)
- `AssetRow` + `AssetRowCompact` (replaced by `ContactSheetCard`)
- `StoryGroupAccordion` (replaced by left-rail headers + sortable contact sheet)
- `BulkOpsBar` (replaced by contextual action bar)
- `FilterBar` (folds into contact sheet top)
- `SideDetailPanel` push behavior (content adapts into right rail; component itself rebuilt)

### New

- `UploadShellV4.tsx` — three-pane shell with progressive disclosure
- `LeftRail.tsx`, `LeftRailStoryHeader.tsx`, `LeftRailUnassignedBucket.tsx`
- `CenterPane.tsx`, `ContactSheet.tsx`, `ContactSheetCard.tsx`, `ContactSheetFilterChips.tsx`, `ZoomSlider.tsx`
- `RightRailInspector.tsx` — adapts SideDetailPanel content
- `ContextualActionBar.tsx`
- `CompareView.tsx`
- `EmptyState.tsx`
- `SessionDefaultsPopover.tsx`
- DnD wiring (uses `@dnd-kit/core` + `@dnd-kit/sortable`)

---

## 17. Open IPs (decisions still to ratify)

These are genuinely open and need the founder's call before the spec ratifies. Defaults proposed; founder can override.

### IPV4-1 — Right rail "pin open" toggle
Mount only on selection (transient) vs allow user to pin it open with an empty state when nothing is selected.
- **(a)** Mount only on selection. Recommended for the editorial, uncluttered default.
- (b) Pin toggle for power users.
- **Default: (a).**

### IPV4-2 — Cover-leaves-story fallback
When the cover asset is reassigned or excluded:
- **(a)** Auto-fallback to first asset in `sequence` silently. Recommended.
- (b) Prompt the user to pick a new cover.
- (c) Set `coverAssetId = null`, fall back to first at render.
- **Default: (a).**

### IPV4-3 — Compare mode max count
- **(a)** 2 only. Strictest editorial discipline; clearest legibility; standard baseline for compare interfaces.
- (b) 2 or 3 (3 only if center-pane width preserves legibility — collapse to 2 if narrower).
- (c) Up to 4 with a warning above 3.
- **Default: (a).** External review flagged that compare mode works best when limited and intentionally framed; 3+ is a feature to unlock once 2-up is proven, not an opening bid. (b) is the considered upgrade path.

### IPV4-4 — Compare mode "make canonical" affordance
- **(a)** Yes — clicking "make canonical" auto-excludes siblings.
- (b) No — Compare is read-only. User excludes manually after.
- **Default: (b).** Compare is for judgment; the action is a separate dispatch.

### IPV4-5 — AI auto-accept confidence threshold
- **(a)** 0.85 (recommended)
- (b) 0.80 (more permissive)
- (c) 0.90 (more conservative)
- (d) Configurable per-user
- **Default: (a).** A constant in code is fine for V1; configurability is later.

### IPV4-6 — DnD library
- **(a)** `@dnd-kit/core` + `@dnd-kit/sortable`. Recommended.
- (b) `react-dnd`.
- (c) Native HTML5 with custom wrapper.
- **Default: (a).**

### IPV4-7 — Contact sheet virtualization
Already pinned to `react-window` v1.x in C2. Stays?
- **(a)** Yes, reuse react-window. Recommended.
- (b) Switch to TanStack Virtual (more modern, better grid support).
- **Default: (a)** for V1; (b) is a deferred refactor.

### IPV4-8 — Zoom levels
- **(a)** 5 discrete steps as listed in §3.3
- (b) Continuous slider (any width 80-360px)
- **Default: (a).** Discrete steps lock the visual grammar; continuous slider invites fiddling.

---

## 18. Out of scope (deferred)

- Mobile / tablet variants → Phase post-D when desktop V4 is stable
- Drag from URL / paste image
- Folder import preserving hierarchy
- Cloud-storage import (Drive, Dropbox)
- Multi-tab DnD
- Multi-cover per story (social vs hero)
- Per-channel sequence
- A/B compare overlay
- EXIF diff in compare
- Pixel-zoom sync
- Right-click context menus
- Drag stories themselves (reorder left rail)
- Telemetry hooks for ACCEPT_PROPOSAL no-ops
- Component-test infrastructure (jsdom + RTL) — separate ratification still applies

---

## 19. Glossary

Terminology lock — use these terms, not synonyms:

| Term | Meaning | Don't say |
|---|---|---|
| Story | A grouping of assets created by the user (or accepted from an AI proposal). Has name + sequence + cover. | "Story group", "story bucket", "cluster" (cluster is the AI proposal stage; once accepted it's a Story) |
| Sequence | The ordered list of assets in a Story. The editorial reading order. | "Order", "list" |
| Cover | The single canonical thumbnail asset for a Story. | "Hero", "thumbnail" (thumbnail is the rendered preview of any asset) |
| Inspector | The right-rail panel for editing one asset. | "Side panel", "detail panel", "side detail" |
| Contact sheet | The center-pane visual grid of asset cards. | "Asset grid", "list view" |
| Bucket | A non-Story navigation destination in the left rail (currently just Unassigned). | "Folder", "smart group" |
| Zoom | The 5-step contact sheet card-size control. | "Density", "view mode" |
| Compare | The center-pane side-by-side view for 2-3 selected assets. | "Side-by-side", "diff" |
| Layout state | One of `Empty / Browsing / Organizing / Comparing`. Derived, not stored. | "Mode" |
| Drop affordance | The big "Drag here or browse" target shown only in Empty state. | "Drop zone" (drop zone is the C2-era term for a persistent region — V4 has none) |

---

## 20. Migration path (high-level — full plan in D-PLAN.md to come)

1. **PR #14 merges as-is.** C2 lands in main as the V3 single-screen approach. The reducer + parity + commit state machine + selectors live in main from this point.
2. **`docs(upload): UX-SPEC-V4 + Founder Lock`** commit lands on a new branch `feat/d-upload-v4`. This file becomes the canonical spec.
3. **D-PLAN.md** composed next. Mirrors C2-PLAN. Sequences D2.1 (three-pane shell + reducer deltas), D2.2 (left rail), D2.3 (center contact sheet + DnD), D2.4 (right rail inspector — adapts SideDetailPanel), D2.5 (contextual action bar + multi-select), D2.6 (compare mode), D2.7 (AI auto-accept hydration sweep + low-confidence inspector surfacing), D2.8 (story cover + sequencing reducer + DnD wire), D2.9 (file ingestion + session defaults popover).
4. Each D-phase = directive → ratification → script → commit → visual verify, same workflow as C2.
5. **Cutover PR**: deletes the dormant C2 component layer once V4 is stable.

---

## 21. Ratification checklist

Founder reply should be one of:
- `ratify UX-SPEC-V4` — all defaults on IPV4-1…IPV4-8
- itemized override (`IPV4-3=c, IPV4-5=b, ratify rest`)
- `revise <section>` — point at specific area to rework
- `reject` — back to memo discussion

After ratification, the next deliverable is `D-PLAN.md`.
