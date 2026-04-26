# Vault Upload — C2 Implementation Plan (C2.1–C2.5)

**Status:** DRAFT — pending founder ratification before any code work begins
**Date:** 2026-04-26
**Scope:** Phase C (UI rebuild) sub-phases C2.1–C2.5, governing the entire C2 slice in one place
**Governs:** Implementation directives C2.1, C2.2, C2.3, C2.4, C2.5 (composed separately as standalone prompts after this plan ratifies)
**Reads underlying:** `docs/upload/UX-SPEC-V3.md` (C1, ratified at `6e68228`), `docs/upload/UX-BRIEF.md` v3 (architectural locks), `src/lib/upload/v2-types.ts` (V2Asset preservation contract), `src/lib/upload/v2-state.ts` (existing action inventory), `src/components/upload-v2/*` (current surface)

---

## 1. What this plan is

A build-governing record of how Phase C C2 implements UX-SPEC-V3 — the new shell + state + interaction model for `/vault/upload`. The plan covers all five C2 sub-prompts (C2.1 page-surface + reducer skeleton, C2.2 asset list + density modes, C2.3 side detail panel, C2.4 commit bar + flow, C2.5 AI proposal surfacing) under one ratifiable head so contradictions across sub-prompts can be resolved at the plan level rather than mid-implementation.

This plan is build-governing. If a later implementation directive proposes a structure that contradicts §3 (locks), §5 (action set), §7-§11 (sub-prompt specs), or §13 (sequencing), the directive is wrong, not the plan. Drift requires an explicit revision pass on this document.

The plan is NOT itself an implementation directive — no code lands from this doc. C2.1 is composed as a separate prompt directive after this plan ratifies.

---

## 2. Current-state read (one paragraph)

The current `/vault/upload` surface is a 4-stage wizard built on `UploadShellV2.tsx` orchestrating `AddFilesScreen` → `AnalysisScreen` → `ReviewAssignScreen` → `CommitScreen`. State is held in a 1,431-line `v2-state.ts` reducer with 41 action types, many of which are stage-coupled or coupled to the retired express-path bifurcation. The data model in `v2-types.ts` (357 lines, with `V2Asset`, `AssetProposal`, `V2StoryGroup`, `ExceptionType`, etc.) is sound and is preserved. Mock fixtures in `v2-mock-scenarios.ts` (947 lines), the simulation engine (485 lines), and the pure verification selectors (`getAssetExceptions`, `getPublishReadiness`, `getTotalListedValue`, `getCompletionSummary` — 422 lines) all survive intact and become the parity contract for the new reducer.

---

## 3. Three governing locks (founder-ratified)

These three locks are non-negotiable. Every implementation directive in C2.1–C2.5 must respect them; quality assurance must verify each before any sub-prompt lands.

### 3.1 Reducer authority

The new reducer is the canonical interaction model for the new UI. The current `V2Action` union (41 types in `v2-state.ts`) does NOT survive — it is coupled to the retired stage model, the retired express path, and the demoted Story-groups-as-primary concept. Selectors in `v2-verification.ts` survive (they compute facts, not layout). The new reducer ships in a new file (`src/lib/upload/v3-state.ts` per default; see §14 IP-1) with a new `V3Action` union derived from UX-SPEC-V3 §3-§11 interactions.

**Implication:** any code that imports from `v2-state.ts` is part of the dormant scaffolding and gets redirected to `v3-state.ts` only when the consumer is on the new shell. Mixed reducer consumption is a regression.

### 3.2 Parity contract

The mock-scenario fixtures in `v2-mock-scenarios.ts` and the V2Asset shape in `v2-types.ts` are the data-model contract. Every existing scenario must pass through the new reducer with the **same readiness/exception selector outputs** unless UX-SPEC-V3 explicitly redefines the field.

**Specific exceptions where the spec redefines:**
- `needs_story` exception is removed from the user-visible model per UX-BRIEF v3 §4.5 (Story groups are now opt-in)
- The 5-category collapse for chip rendering is a UI concern; internal types stay granular for selector composition
- Express-eligibility (`expressEligible`, `expressAccepted`) is removed from `V2UIState`

Beyond those documented changes, behavior parity is non-negotiable. C2.1 ships a parity test suite as the gatekeeping artifact.

### 3.3 Temporary coexistence rule

The old `src/components/upload-v2/*` files and `src/lib/upload/v2-*` files (except those preserved per §6) stay on disk after C2 lands as **dormant rollback scaffolding** — nothing more. They are NOT a parallel product surface. They are NOT routed to. They are NOT updated alongside the new code. They exist solely to provide a rollback option during C2-C5 stabilization.

**Procedural rules:**
- The new shell at `app/vault/upload/page.tsx` is the only routed upload surface
- Old `UploadShellV2` is NOT imported anywhere in production code paths
- Tests for old upload-v2 files stay green during C2 but are no longer expanded; they're frozen-as-of C2 land
- Each old file gets a `// DORMANT — replaced by C2 (new shell at app/vault/upload). Scheduled for deletion at the explicit cutover PR (PR 5+). DO NOT extend.` header comment as part of C2.1
- Deletion happens as a separate, explicit PR — never quietly inside another change

A future PR (the explicit cutover PR, after PR 5 makes the new flow live and stable) deletes the dormant files. Until that PR, the working assumption is that the old surface is a fallback-only safety net.

---

## 4. Architecture (the rebuild target)

### 4.1 New page surface

Single screen at `/vault/upload` per UX-SPEC-V3 §2. Three vertically stacked regions, all present from first interaction:

```
src/app/vault/upload/page.tsx                      ← server component shell (replaces UploadShellV2.tsx)
src/app/vault/upload/_components/                  ← all new client components
  UploadShell.tsx                                  ← top-level client orchestrator
  DropZone.tsx                                     ← Region 1 (top, persistent) per spec §2.1
  SessionDefaultsBar.tsx                           ← collapsible defaults header (privacy, licences, tags, watermark)
  AssetList.tsx                                    ← Region 2 (center, virtualized) — density-aware container
  AssetRow.tsx                                     ← per-row component, density-aware variants
  SideDetailPanel.tsx                              ← Region 3 overlay-from-right per spec §7
  CommitBar.tsx                                    ← Region 3 (bottom, sticky) per spec §2.2
  CommitSummaryPanel.tsx                           ← inline expand from CommitBar per spec §11.1
  CommitProgressPanel.tsx                          ← post-confirm state per spec §11.2
  CommitSuccessPanel.tsx                           ← terminal success per spec §11.3
  CommitErrorPanel.tsx                             ← terminal partial-failure per spec §11.4
  AIProposalBanner.tsx                             ← per-cluster banner per spec §5.2
  StoryGroupAccordion.tsx                          ← Archive mode cluster shape per spec §6.1
  BulkOpsBar.tsx                                   ← Compact + Batch + Archive bulk actions
  FilterBar.tsx                                    ← Batch + Archive filters per spec §5.1
  PriceBasisPanel.tsx                              ← "Why this price?" expand per spec §9.3
  DuplicateResolver.tsx                            ← in-side-panel resolver per spec §7.2
```

### 4.2 New reducer

`src/lib/upload/v3-state.ts` (new file) — see §5 for action inventory.

### 4.3 Preserved files (no change)

- `src/lib/upload/v2-types.ts` — V2Asset and supporting types (the parity contract)
- `src/lib/upload/v2-mock-scenarios.ts` — fixture data (extended in C2.2 with Archive-scale scenarios; see §7.4)
- `src/lib/upload/v2-simulation-engine.ts` — async lifecycle simulator
- `src/lib/upload/v2-simulation.ts` — simulation harness
- `src/lib/upload/v2-scenario-registry.ts` — fixture lookup
- `src/lib/upload/v2-verification.ts` — pure selectors (facts not layout); the parity contract's enforcement layer
- `src/components/upload-v2/DevHarness.tsx` — dev-only test runner; left alone for now (see §14 IP-7)

### 4.4 Rebuilt initial-state hydration

`src/lib/upload/v3-hydration.ts` (new file) — replaces `v2-hydration.ts`. Adapts mock fixtures into the new V3State shape while preserving the V2Asset shape inside.

---

## 5. Reducer + action set

### 5.1 V3State shape (proposed)

```typescript
export interface V3State {
  batch: {
    id: string
    createdAt: string
    committedAt: string | null
    // No `currentStage` — single-screen model
  }
  assetsById: Record<string, V2Asset>          // V2Asset preserved
  assetOrder: string[]
  storyGroupsById: Record<string, V2StoryGroup>  // overlay only
  storyGroupOrder: string[]
  defaults: V2Defaults                           // session defaults (preserved)
  ui: V3UIState
  commit: V3CommitState                          // new commit-flow state machine
  aiClusterProposals: V3ClusterProposalState[]   // banners surfacing per cluster
}

export interface V3UIState {
  selectedAssetIds: string[]
  sidePanelOpenAssetId: string | null            // single source of truth for panel
  storyGroupOverlayOn: boolean                   // opt-in; default per density mode
  bulkOpsBarOpen: boolean                        // Compact mode toggle; auto-true in Batch/Archive
  expandedClusterIds: string[]                   // Archive mode accordion state
  filter: V2Filter                               // preserved
  searchQuery: string
  sortField: ...                                 // preserved
  sortDirection: 'asc' | 'desc'
  sessionDefaultsBarCollapsed: boolean
  priceBasisOpenAssetId: string | null           // "Why this price?" expand state, single asset at a time
  // Density is COMPUTED from assetOrder.length, not stored. See §7.1.
  // No `mobileTab`, `visibleColumns`, `inspectorCollapsed`, `expressEligible`, `expressAccepted`, `reviewEnteredEarly`.
}

export interface V3CommitState {
  phase: 'idle' | 'summary' | 'committing' | 'success' | 'partial-failure'
  perAssetProgress: Record<string, number>      // 0-100 during committing
  failed: Array<{ assetId: string; error: string }>
}

export interface V3ClusterProposalState {
  proposalId: string
  clusterName: string
  proposedAssetIds: string[]
  rationale: string
  confidence: number
  status: 'pending' | 'accepted' | 'dismissed'
}
```

### 5.2 Action inventory mapping (old → new)

41 old actions, classified:

| Old action | Fate | Notes |
|---|---|---|
| `ADD_FILES` | **KEEP** | Renamed payload shape only if needed |
| `REMOVE_FILE` | **KEEP** | |
| `UPDATE_ASSET_FIELD` | **KEEP** | Auto-commits AI proposal acceptance per spec §9.1 |
| `BULK_UPDATE_FIELD` | **KEEP** | |
| `TOGGLE_ASSET_EXCLUDED` | **KEEP** | |
| `SELECT_ASSET` | **KEEP** | |
| `TOGGLE_ASSET_SELECTION` | **KEEP** | |
| `SELECT_ASSETS` | **KEEP** | |
| `DESELECT_ALL_ASSETS` | **KEEP** | |
| `SELECT_RANGE` | **KEEP** | |
| `SET_FILTER` | **KEEP** | |
| `SET_FILTER_PRESET` | **KEEP** | |
| `SET_SORT` | **KEEP** | |
| `SET_SEARCH_QUERY` | **KEEP** | |
| `SET_DEFAULTS` | **KEEP** | |
| `RESOLVE_CONFLICT` | **KEEP** | |
| `UPDATE_ANALYSIS_PROGRESS` | **KEEP** | Per-asset, no stage gate |
| `UPDATE_ANALYSIS_RESULT` | **KEEP** | Per-asset, no stage gate |
| `ANALYSIS_FAILED` | **KEEP** | Per-asset, no stage gate |
| `CREATE_STORY_GROUP` | **KEEP** | Manual creation per spec §8.2 |
| `RENAME_STORY_GROUP` | **KEEP** | Per spec §8.4 |
| `DELETE_STORY_GROUP` | **KEEP** | Per spec §8.4 |
| `FOCUS_ASSET` | **REPLACED** | → `OPEN_SIDE_PANEL` |
| `SELECT_STORY_GROUP` | **REMOVED** | No story-group-as-primary selection state |
| `START_ANALYSIS` | **REMOVED** | Analysis runs inline; no batch transition |
| `COMPLETE_ANALYSIS` | **REMOVED** | Same |
| `SET_STAGE` | **REMOVED** | No stages |
| `ENTER_REVIEW_EARLY` | **REMOVED** | No review stage |
| `ADD_STORY_GROUP_PROPOSAL` | **REPLACED** | → `RECEIVE_AI_CLUSTER_PROPOSAL` (banner-shape) |
| `ASSIGN_ASSET_TO_STORY` | **REPLACED** | → `MOVE_ASSET_TO_CLUSTER` (drag-drop driven) |
| `UNASSIGN_ASSET_FROM_STORY` | **KEEP** | Renamed `MOVE_ASSET_TO_UNGROUPED` for clarity |
| `BULK_ASSIGN_ASSETS` | **REMOVED** | Replaced by accept-AI-cluster-proposal flow |
| `ACCEPT_ALL_PROPOSED_ASSIGNMENTS` | **REMOVED** | Replaced by per-cluster `ACCEPT_AI_CLUSTER_PROPOSAL` |
| `CONFIRM_PROPOSAL` | **REPLACED** | → `ACCEPT_PROPOSAL` (per-field; price excluded from bulk) |
| `DISMISS_PROPOSAL` | **REPLACED** | → `REGENERATE_PROPOSAL` for re-gen; `UPDATE_ASSET_FIELD` auto-commits on edit per spec §9.1 |
| `CLEAR_DUPLICATE_STATUS` | **REPLACED** | → `RESOLVE_DUPLICATE` with explicit `kind: 'keep_both' \| 'mark_as_duplicate'` per spec §7.2 |
| `SET_DENSITY` | **REMOVED** | Density is computed from `assetOrder.length`, not toggled |
| `SET_COLUMN_VISIBILITY` | **REMOVED** | No table view |
| `SET_MOBILE_TAB` | **REMOVED** | Mobile flow is Phase C5+ scope |
| `TOGGLE_INSPECTOR` | **REPLACED** | → `OPEN_SIDE_PANEL` / `CLOSE_SIDE_PANEL` |
| `TOGGLE_STORY_PROPOSALS_BANNER` | **REPLACED** | → `DISMISS_AI_CLUSTER_PROPOSAL` (per-cluster) |
| `ACTIVATE_NEWSROOM_MODE` | **REMOVED** | See §14 IP-2 |
| `APPLY_EXPRESS_FLOW` | **REMOVED** | Express path retired |
| `DISMISS_EXPRESS` | **REMOVED** | Same |
| `COMMIT_BATCH` | **REPLACED** | → `BEGIN_COMMIT` (opens summary), `CONFIRM_COMMIT` (fires) |
| `COMPLETE_COMMIT` | **REPLACED** | → `COMMIT_SUCCEEDED` and `COMMIT_PARTIALLY_FAILED` |
| `RESET_FLOW` | **KEEP** | "Upload more" returns to fresh state per spec §11.3 |

### 5.3 New actions (added per UX-SPEC-V3)

```typescript
// Side panel
| { type: 'OPEN_SIDE_PANEL'; assetId: string }
| { type: 'CLOSE_SIDE_PANEL' }
| { type: 'NAVIGATE_SIDE_PANEL'; direction: 'next' | 'prev' }   // J/K keyboard per §7.1

// Session defaults bar
| { type: 'TOGGLE_SESSION_DEFAULTS_BAR' }

// Density override (Archive mode only — "View as flat list" per §6.3)
| { type: 'TOGGLE_FLAT_LIST_OVERRIDE' }

// Bulk ops bar (Compact mode toggle; Batch+Archive auto-show)
| { type: 'TOGGLE_BULK_OPS_BAR' }

// Story group overlay (opt-in per §8.1)
| { type: 'TOGGLE_STORY_GROUP_OVERLAY' }

// AI proposal acceptance (per-field, per-asset)
| { type: 'ACCEPT_PROPOSAL'; assetId: string; field: 'caption' | 'tags' | 'keywords' | 'price' }
| { type: 'BULK_ACCEPT_PROPOSALS_FOR_GROUP'; clusterId: string; fields: Array<'caption' | 'tags' | 'keywords'> }  // NOT 'price' per spec §9.2
| { type: 'BULK_ACCEPT_PROPOSALS_FOR_SELECTION'; assetIds: string[]; fields: Array<'caption' | 'tags' | 'keywords'> }  // NOT 'price' per spec §9.2
| { type: 'REGENERATE_PROPOSAL'; assetId: string; field: 'caption' | 'tags' | 'keywords' | 'price' }

// AI cluster proposal banners
| { type: 'RECEIVE_AI_CLUSTER_PROPOSAL'; proposal: V3ClusterProposalState }
| { type: 'ACCEPT_AI_CLUSTER_PROPOSAL'; proposalId: string }
| { type: 'DISMISS_AI_CLUSTER_PROPOSAL'; proposalId: string }

// Manual cluster operations (per §8.4)
| { type: 'MOVE_ASSET_TO_CLUSTER'; assetId: string; clusterId: string }
| { type: 'MOVE_ASSET_TO_UNGROUPED'; assetId: string }
| { type: 'SPLIT_CLUSTER'; clusterId: string; assetIds: string[]; newClusterName: string }
| { type: 'MERGE_CLUSTERS'; sourceClusterId: string; targetClusterId: string }

// Archive accordion (cluster expand/collapse)
| { type: 'TOGGLE_CLUSTER_EXPANDED'; clusterId: string }

// Cluster bulk operations (Archive mode)
| { type: 'BULK_EDIT_CAPTION_TEMPLATE'; clusterId: string; template: string }
| { type: 'BULK_SET_PRICE_FOR_CLUSTER'; clusterId: string; priceCents: number }   // Note: SET, not accept-AI-suggestion. Per-asset accept rule still holds.

// Duplicate resolution (per §7.2)
| { type: 'RESOLVE_DUPLICATE'; assetId: string; kind: 'keep_both' | 'mark_as_duplicate'; otherAssetId: string }

// Price basis panel ("Why this price?" per §9.3)
| { type: 'TOGGLE_PRICE_BASIS_PANEL'; assetId: string }

// Commit flow state machine (per §11)
| { type: 'BEGIN_COMMIT' }                                         // Click COMMIT N → expand summary
| { type: 'CANCEL_COMMIT' }                                        // BACK from summary
| { type: 'CONFIRM_COMMIT' }                                       // Fire actual commit
| { type: 'COMMIT_PROGRESS_UPDATE'; assetId: string; progress: number }
| { type: 'COMMIT_SUCCEEDED' }                                     // All assets succeeded
| { type: 'COMMIT_PARTIALLY_FAILED'; failed: Array<{ assetId: string; error: string }> }
| { type: 'RETRY_FAILED_COMMITS' }                                 // Per §11.4
```

### 5.4 Net counts

- **Old action union:** 41 types
- **Survivors (kept):** 22 types (renames documented inline)
- **Replacements:** 9 types replaced by new shapes
- **Removed:** 10 types
- **New additions:** ~28 new types
- **New action union total:** ~50 types

The net larger count reflects the more granular interaction model in the spec — what was previously implicit (e.g., commit as a single transition) is now explicit in the state machine.

---

## 6. C2.1 — Page surface + reducer skeleton

### 6.1 Scope

- New file: `src/app/vault/upload/page.tsx` (server component shell; reads V3 reducer initial state from `v3-hydration.ts`)
- New file: `src/app/vault/upload/_components/UploadShell.tsx` (top-level client orchestrator)
- New file: `src/lib/upload/v3-state.ts` (reducer + V3Action union + V3State + reducer function)
- New file: `src/lib/upload/v3-hydration.ts` (initial-state population from mock fixtures, preserving V2Asset shape)
- New file: `src/lib/upload/v3-types.ts` (V3UIState, V3CommitState, V3ClusterProposalState, V3State — V2Asset and dependencies re-exported from v2-types)
- Update: `src/components/upload-v2/UploadShellV2.tsx` — add dormancy header comment per §3.3
- Update: every other dormant `upload-v2/` file — same dormancy header
- Tests: `src/lib/upload/__tests__/v3-state.test.ts` — full reducer test suite (action coverage + state transitions)
- Tests: `src/lib/upload/__tests__/v3-state-parity.test.ts` — **mock-scenario parity test**: every existing v2-mock-scenarios fixture, when fed through new reducer, produces identical readiness/exception selector outputs except where spec explicitly redefines (per §3.2)

### 6.2 Acceptance criteria

- [ ] `/vault/upload` route renders the new UploadShell (server component shell loads, client component mounts)
- [ ] V3 reducer accepts every action in §5 union and produces correct state transitions
- [ ] `getAssetExceptions(state.assetsById[id], state.defaults)` returns the same exceptions array as the old reducer for every fixture (parity contract)
- [ ] `getPublishReadiness(state)` returns the same `{ ready, total }` count as the old reducer for every fixture (parity contract)
- [ ] `getTotalListedValue(state)` returns the same value as the old reducer for every fixture (parity contract)
- [ ] All 14 dormant upload-v2 files have the dormancy header comment added
- [ ] No production code path imports from `v2-state.ts` (verified by lint or import-check)

### 6.3 Out of scope (for C2.1)

- Visual rendering of the asset list (C2.2)
- Side detail panel (C2.3)
- Commit bar UI (C2.4)
- AI proposal surfacing UI (C2.5)
- New mock scenarios for Archive scale (deferred to C2.2 §7.4)
- E2E browser tests (deferred to C5+)

---

## 7. C2.2 — Asset list + density modes

### 7.1 Auto-density logic

Density is **computed**, not stored:

```typescript
function densityForCount(count: number): 'linear' | 'compact' | 'batch' | 'archive' {
  if (count <= 5) return 'linear'
  if (count <= 19) return 'compact'
  if (count <= 99) return 'batch'
  return 'archive'
}
```

Mode auto-switches as count crosses thresholds. No dispatched action; pure derivation. Override exists only in Archive mode via `TOGGLE_FLAT_LIST_OVERRIDE`.

### 7.2 Scope

- `AssetList.tsx` — virtualized container; switches between Linear/Compact/Batch/Archive variants based on density
- `AssetRow.tsx` — Linear variant per spec §3.1 (full per-row detail)
- `AssetRowCompact.tsx` — Compact variant per spec §4.1 (~64px tall)
- `StoryGroupAccordion.tsx` — Archive cluster shape per spec §6.1
- `BulkOpsBar.tsx` — Compact + Batch + Archive bulk actions per spec §4.2
- `FilterBar.tsx` — Batch + Archive filters per spec §5.1
- Tests: per-density behavior, virtualization correctness, bulk-select coverage

### 7.3 Acceptance criteria

- [ ] 1–5 files → Linear mode renders per spec §3.1
- [ ] 6–19 files → Compact mode renders per spec §4.1; bulk ops bar hidden by default
- [ ] 20–99 files → Batch mode; bulk ops bar visible by default; filter bar present
- [ ] 100+ files → Archive mode; cluster accordion; per-cluster bulk actions
- [ ] Adding a 6th file mid-session auto-switches Linear → Compact (smooth, no jump)
- [ ] "View as flat list" toggle in Archive mode dispatches `TOGGLE_FLAT_LIST_OVERRIDE`; flips to Compact-style list
- [ ] Multi-select via row left-edge click (Compact+) per spec §4.1
- [ ] Filter chips reflect §10 exception categories
- [ ] Sort + search bind to existing reducer fields

### 7.4 New mock scenarios (added in C2.2)

To exercise Archive mode, add three new scenarios to `v2-mock-scenarios.ts`:
- `archive-150-mixed` — 150 assets across 3 implied clusters
- `archive-500-single-shoot` — 500 assets from one event (single-cluster archive)
- `archive-1500-decade` — 1,500 assets across 12 clusters (stress test)

Each scenario must thread through the parity contract — readiness selector outputs validated.

### 7.5 Out of scope (for C2.2)

- Side detail panel (C2.3)
- AI cluster proposal banners (C2.5)
- Real virtualization library choice — defaults to react-window or equivalent; can swap if perf doesn't hold

---

## 8. C2.3 — Side detail panel

### 8.1 Scope

- `SideDetailPanel.tsx` — slide-in-from-right panel per spec §7.1; ~480px wide
- `DuplicateResolver.tsx` — embedded duplicate resolution per spec §7.2
- Keyboard handlers: `Esc` close, `J/K` navigate
- Tests: open/close, edit syncs to row, J/K cursor navigation, duplicate resolution flows

### 8.2 Acceptance criteria

- [ ] Click row in Compact/Batch/Archive opens side panel; row stays selected
- [ ] Linear mode does NOT open side panel (full row already visible)
- [ ] All editable fields per spec §7.1 render and sync to row immediately (no save button)
- [ ] Exceptions section lists active blocking exceptions with resolve affordances
- [ ] AI Proposal Detail section is collapsible; expanded view shows basis breakdown per field
- [ ] Duplicate resolver renders both thumbnails side-by-side with "Keep both" / "Mark as duplicate" buttons per spec §7.2
- [ ] `Esc` dispatches `CLOSE_SIDE_PANEL`
- [ ] `J/K` dispatches `NAVIGATE_SIDE_PANEL` with direction; selection follows
- [ ] Panel pushes asset list left; does NOT overlay (preserves multi-row context)

### 8.3 Out of scope (for C2.3)

- "Why this price?" basis panel — that's C2.5 (AI proposal surfacing scope)
- Mobile responsive behavior for the panel (collapses to fullscreen on narrow viewports — Phase C5+ scope)

---

## 9. C2.4 — Commit bar + flow

### 9.1 Scope

- `CommitBar.tsx` — sticky bottom bar per spec §2.2; ready/total count + plain-language exception summary + commit CTA
- `CommitSummaryPanel.tsx` — inline expand from CTA per spec §11.1
- `CommitProgressPanel.tsx` — per-asset progress + aggregate bar per spec §11.2
- `CommitSuccessPanel.tsx` — terminal success per spec §11.3 (replaces screen body)
- `CommitErrorPanel.tsx` — partial-failure handling per spec §11.4
- New actions in v3-state: `BEGIN_COMMIT`, `CANCEL_COMMIT`, `CONFIRM_COMMIT`, `COMMIT_PROGRESS_UPDATE`, `COMMIT_SUCCEEDED`, `COMMIT_PARTIALLY_FAILED`, `RETRY_FAILED_COMMITS`, `RESET_FLOW`
- Tests: state machine transitions; CTA disabled when blocking exceptions present; summary expand/collapse; progress accumulation; partial-failure recovery

### 9.2 Acceptance criteria

- [ ] Commit bar always visible (bottom, sticky)
- [ ] CTA reads `COMMIT N` where N = ready count
- [ ] CTA disabled (opacity 0.4) if N=0 or any blocking exception remains
- [ ] Click CTA → `BEGIN_COMMIT` → bar expands upward into summary panel per §11.1
- [ ] Summary shows privacy distribution + total listed value + Story groups
- [ ] BACK button → `CANCEL_COMMIT` → returns to asset list view
- [ ] CONFIRM COMMIT → `CONFIRM_COMMIT` → progress panel renders
- [ ] During commit: per-asset progress accumulates via simulation engine
- [ ] All-success → `COMMIT_SUCCEEDED` → success panel replaces screen body
- [ ] Partial-failure → `COMMIT_PARTIALLY_FAILED` → error panel with RETRY FAILED + CONTINUE TO VAULT
- [ ] RETRY FAILED only re-attempts failed assets; preserves succeeded ones
- [ ] UPLOAD MORE button → `RESET_FLOW` → fresh empty drop zone state
- [ ] GO TO VAULT navigates to `/vault`

### 9.3 Wiring note (per spec §11.1)

The actual commit network call (POST `/api/v2/batch/[id]/commit`) is **wired in PR 5** (the cutover PR), not C2.4. C2.4 dispatches CONFIRM_COMMIT and the simulation engine fires fake per-asset uploads. Real wiring lands at PR 5.

### 9.4 Out of scope (for C2.4)

- Real `/api/v2/batch/[id]/commit` integration (PR 5)
- Real per-asset upload streaming (PR 5)

---

## 10. C2.5 — AI proposal surfacing

### 10.1 Scope

- AI proposal visual treatment per spec §9.1 (italic + muted; ✓ accept icon)
- Per-field accept rules per spec §9.2 (NEVER bulk-accept price)
- "Why this price?" expand per spec §9.3
- Re-generate per spec §9.4
- AI cluster proposal banners per spec §5.2 (Batch + Archive modes)
- New actions in v3-state: `ACCEPT_PROPOSAL`, `BULK_ACCEPT_PROPOSALS_FOR_GROUP`, `BULK_ACCEPT_PROPOSALS_FOR_SELECTION`, `REGENERATE_PROPOSAL`, `RECEIVE_AI_CLUSTER_PROPOSAL`, `ACCEPT_AI_CLUSTER_PROPOSAL`, `DISMISS_AI_CLUSTER_PROPOSAL`, `TOGGLE_PRICE_BASIS_PANEL`
- New component: `PriceBasisPanel.tsx` per spec §9.3
- New component: `AIProposalBanner.tsx` per spec §5.2
- Tests: per-field accept rules; price-bulk-accept REJECTION; banner accept/dismiss/details flows; price-basis expand/collapse

### 10.2 Acceptance criteria

- [ ] AI-suggested fields render in italic + `text-slate-400` per §9.1
- [ ] ✓ accept icon appears to the right of the field for unaccepted suggestions
- [ ] Editing a field auto-commits the suggestion (ghost text disappears, value becomes creator-authored) per §9.1
- [ ] One-click ✓ → `ACCEPT_PROPOSAL` for that asset+field
- [ ] Bulk-accept (per-row "Accept all suggestions" link in Linear; bulk action in Compact+) → `BULK_ACCEPT_PROPOSALS_FOR_*` with caption + tags + keywords (price excluded per spec §9.2)
- [ ] Attempting to bulk-accept price RAISES — UI must prevent the action; reducer must reject the action shape (price never in `fields` array)
- [ ] "Why?" link expands `PriceBasisPanel` inline below the price field per §9.3
- [ ] Click "Why?" again collapses panel
- [ ] AI cluster proposal banners render in Batch + Archive when `aiClusterProposals` has entries with `status='pending'`
- [ ] Accept banner → `ACCEPT_AI_CLUSTER_PROPOSAL` → cluster created from proposed assets; banner hidden
- [ ] Dismiss banner → `DISMISS_AI_CLUSTER_PROPOSAL` → banner hidden; doesn't recur this session
- [ ] Multiple banners stack independently per spec §5.2

### 10.3 Dependency on E1.5 (AI pipeline detail brief)

The AI proposal SHAPE (confidence values, basis text format, keywords-vs-tags split) is governed by E1.5 (currently pending ratification per the wrap §3). C2.5 builds against the **mock proposals** in `v2-mock-scenarios.ts` which match the AssetProposal shape in `v2-types.ts`. When E1.5 ratifies and E2 ships the schema, the proposal SHAPE may evolve — C2.5 must rev along with that.

**Mitigation:** C2.5's components consume `V2Asset.proposal` via a typed adapter function (`getProposalView(asset)`) that returns the per-field display shape. If `AssetProposal` evolves in E2, only the adapter changes; the components don't.

### 10.4 Out of scope (for C2.5)

- Real AI pipeline integration (E2-E6)
- Comparables drill-down inside the price basis panel (v2 of price engine, deferred per `PRICE-ENGINE-BRIEF.md` v3)
- Cost/quota messaging when AI generation hits ceiling (E1.5 will define)

---

## 11. Test strategy

Per founder ratification of IP-4 — **both targets are in scope, neither deferred**.

### 11.1 Mock-scenario parity (non-negotiable)

`src/lib/upload/__tests__/v3-state-parity.test.ts` — for every fixture in `v2-mock-scenarios.ts`:
1. Hydrate into V3State via `v3-hydration.ts`
2. Run `getAssetExceptions`, `getPublishReadiness`, `getTotalListedValue`, `getCompletionSummary` on the hydrated state
3. Assert outputs match the equivalent v2 outputs (computed from V2State hydration of the same fixture)
4. Document spec-explicit exceptions (e.g., `needs_story` removed) as named-skip cases

This test is the gatekeeping artifact for the parity lock (§3.2). It must pass before C2.1 lands.

### 11.2 New action coverage

`src/lib/upload/__tests__/v3-state.test.ts` — for every action in §5.3 (the ~28 new types):
- One happy-path transition test
- One precondition / invalid-action test where applicable (e.g., bulk-accept-price MUST reject)
- One state-shape invariant test (e.g., closing side panel doesn't lose selection)

### 11.3 Component tests

For each new component (~15 in `app/vault/upload/_components/`), one focused unit test covering:
- Render in primary mode
- Primary user interaction → action dispatched
- Edge case (empty state, error state, etc.)

Total: ~45 component tests across C2.

### 11.4 Integration tests

Per sub-prompt:
- C2.1: shell mounts; reducer connected
- C2.2: density transitions
- C2.3: side panel open/close + edit sync
- C2.4: full commit flow simulation
- C2.5: per-field accept paths + price bulk-accept rejection

### 11.5 Dev harness

`DevHarness.tsx` (777 lines) is preserved. It currently feeds the v2 reducer. Decision: leave it on the v2 reducer for now (it's a dev-only tool; v2 reducer survives as dormant code). When the new reducer stabilizes (post-C5), a follow-up directive can rewire DevHarness to v3 if useful. See §14 IP-7.

### 11.6 Total test budget for C2

- Parity suite: ~30 fixtures × selector outputs ≈ 120 assertions
- New action tests: ~28 actions × 3 cases ≈ 84 tests
- Component tests: ~45 tests
- Integration tests: ~5 tests
- **Total: ~150-180 new tests across C2.1-C2.5**

After full C2 lands: full vitest suite expected to land around **~1,850 passing** (current 1,694 + new C2 tests).

---

## 12. File inventory (delete / preserve / rebuild / new)

| Path | Treatment | Notes |
|---|---|---|
| `src/app/vault/upload/page.tsx` | **NEW** (C2.1) | Server component shell |
| `src/app/vault/upload/_components/UploadShell.tsx` | **NEW** (C2.1) | Top-level orchestrator |
| `src/app/vault/upload/_components/DropZone.tsx` | **NEW** (C2.1) | Region 1 |
| `src/app/vault/upload/_components/SessionDefaultsBar.tsx` | **NEW** (C2.1) | Collapsible defaults |
| `src/app/vault/upload/_components/AssetList.tsx` | **NEW** (C2.2) | Density-aware container |
| `src/app/vault/upload/_components/AssetRow.tsx` | **NEW** (C2.2) | Linear variant |
| `src/app/vault/upload/_components/AssetRowCompact.tsx` | **NEW** (C2.2) | Compact variant |
| `src/app/vault/upload/_components/StoryGroupAccordion.tsx` | **NEW** (C2.2) | Archive cluster shape |
| `src/app/vault/upload/_components/BulkOpsBar.tsx` | **NEW** (C2.2) | Compact+ bulk actions |
| `src/app/vault/upload/_components/FilterBar.tsx` | **NEW** (C2.2) | Batch+ filters |
| `src/app/vault/upload/_components/SideDetailPanel.tsx` | **NEW** (C2.3) | Spec §7.1 |
| `src/app/vault/upload/_components/DuplicateResolver.tsx` | **NEW** (C2.3) | Spec §7.2 |
| `src/app/vault/upload/_components/CommitBar.tsx` | **NEW** (C2.4) | Sticky bottom |
| `src/app/vault/upload/_components/CommitSummaryPanel.tsx` | **NEW** (C2.4) | Spec §11.1 |
| `src/app/vault/upload/_components/CommitProgressPanel.tsx` | **NEW** (C2.4) | Spec §11.2 |
| `src/app/vault/upload/_components/CommitSuccessPanel.tsx` | **NEW** (C2.4) | Spec §11.3 |
| `src/app/vault/upload/_components/CommitErrorPanel.tsx` | **NEW** (C2.4) | Spec §11.4 |
| `src/app/vault/upload/_components/AIProposalBanner.tsx` | **NEW** (C2.5) | Spec §5.2 |
| `src/app/vault/upload/_components/PriceBasisPanel.tsx` | **NEW** (C2.5) | Spec §9.3 |
| `src/lib/upload/v3-state.ts` | **NEW** (C2.1) | New reducer |
| `src/lib/upload/v3-types.ts` | **NEW** (C2.1) | V3State, V3UIState, V3CommitState, V3ClusterProposalState |
| `src/lib/upload/v3-hydration.ts` | **NEW** (C2.1) | Initial state from fixtures |
| `src/lib/upload/__tests__/v3-state.test.ts` | **NEW** (C2.1) | Reducer unit tests |
| `src/lib/upload/__tests__/v3-state-parity.test.ts` | **NEW** (C2.1) | **Parity contract gatekeeper** |
| `src/lib/upload/v2-types.ts` | **PRESERVE** | V2Asset shape; data-model contract |
| `src/lib/upload/v2-mock-scenarios.ts` | **PRESERVE + EXTEND** (C2.2) | Add 3 Archive-scale scenarios |
| `src/lib/upload/v2-simulation-engine.ts` | **PRESERVE** | Test fixture |
| `src/lib/upload/v2-simulation.ts` | **PRESERVE** | Harness wrapper |
| `src/lib/upload/v2-scenario-registry.ts` | **PRESERVE** | Fixture lookup |
| `src/lib/upload/v2-verification.ts` | **PRESERVE** | Pure selectors (parity contract enforcement) |
| `src/lib/upload/v2-state.ts` | **DORMANT** | Add header comment per §3.3; no consumers in production code |
| `src/lib/upload/v2-hydration.ts` | **DORMANT** | Same |
| `src/components/upload-v2/UploadShellV2.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/AddFilesScreen.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/AnalysisScreen.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/ReviewAssignScreen.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/CommitScreen.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/AssetTable.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/AssetDetailPanel.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/PublishBar.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/ReviewHeaderBar.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/StoryGroupsPanel.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/StoryProposalsBanner.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/ExpressCard.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/UploadV2Context.tsx` | **DORMANT** | Same |
| `src/components/upload-v2/DevHarness.tsx` | **PRESERVE** (special) | Dev-only; left on v2 reducer; see §14 IP-7 |
| `src/components/upload-v2/README.md` | **UPDATE** (C2.1) | Add note pointing to new shell + dormancy explanation |

**Final tally:**
- New files: ~24
- Preserved + extended: 1 (mock scenarios)
- Preserved unchanged: 5
- Dormant (with header comment): 14
- Special-preserve (DevHarness): 1

---

## 13. Sequencing within C2

Sub-prompts compose in this order, each as its own ratifiable directive:

| # | Directive | Depends on | Estimated complexity |
|---|---|---|---|
| C2.1 | Page surface + reducer skeleton + parity test | This plan | Largest single prompt; ~24 hrs equivalent compose+implement+test cycle |
| C2.2 | Asset list + 4 density modes + new mock scenarios | C2.1 | ~16 hrs |
| C2.3 | Side detail panel + duplicate resolver | C2.1 | ~10 hrs |
| C2.4 | Commit bar + commit flow state machine | C2.1 | ~12 hrs |
| C2.5 | AI proposal surfacing + price basis panel + cluster banners | C2.1, partially C2.2 (banners need Batch/Archive) | ~14 hrs |

C2.3, C2.4, C2.5 can parallelize after C2.1 lands (they touch disjoint surface — side panel, commit bar, proposal layer). C2.2 needs to land before C2.5's cluster banner work has somewhere to render.

After C2 fully lands: C3 (Story groups overlay implementation), C4 (bulk-ops UX polish), C5 (mobile + accessibility passes), then PR 5 cutover.

---

## 14. Open IPs / HALT items (compose against this plan must surface as HALT)

These need founder ratification before C2.1 directive composes. Defaults are noted; founder may override.

| IP | Question | Default |
|---|---|---|
| **IP-1** | New reducer file path: `src/lib/upload/v3-state.ts` (`v3-` namespace, parallel to `v2-`)? Or rename ALL v2 files to v3 + drop the version suffix? | `v3-` namespace (matches existing pattern; clear coexistence) |
| **IP-2** | Newsroom mode (`activateNewsroomMode` action + `newsroomMode` field) — UX-SPEC-V3 doesn't mention it. Is newsroom mode a thing for `/vault/upload`, or is it strictly for `/newsroom/.../packs/.../assets`? | Strictly newsroom-side; remove from V3State entirely |
| **IP-3** | Mobile responsive behavior — UX-SPEC-V3 doesn't detail mobile. Defer to C5+ or include a basic mobile spec in C2.2? | Defer to C5+; document in §15 out of scope |
| **IP-4** | Watermark mode in session defaults bar (§2.1) — UX-SPEC-V3 doesn't list it explicitly but the existing `V2Defaults.watermarkMode` exists. Include in defaults bar UI for C2.1? | Include; preserves V2Defaults shape; minimal UI cost |
| **IP-5** | AI proposal acceptance state — store in V3State (per-asset, per-field acceptance flags) or derive from comparison of `editable` vs `proposal` fields via selector? | Selector-derived (no new state); cleaner; matches §9.1 auto-commit semantics |
| **IP-6** | Density mode auto-transition — when count crosses 6 mid-session, auto-switch from Linear to Compact? Or only on initial load? | Auto-switch (matches "guidelines, not hard gates" per spec §6.3) |
| **IP-7** | DevHarness — keep on v2 reducer (no rewrite this phase) OR rewire to v3 reducer in C2.1? | Keep on v2; dev-only; defer rewire to a future cleanup directive |
| **IP-8** | New action `NAVIGATE_SIDE_PANEL` (J/K keyboard nav per §7.1) — should it dispatch to next/prev within the FILTERED visible assets, or across the full ordered list? | Filtered visible (matches user mental model of "what I'm looking at") |
| **IP-9** | Commit flow's `BEGIN_COMMIT` action — does it block further field edits while summary is showing, or allow edit + cancel-back? | Allow edit + cancel-back (no modal; spec §11.1 implies expansion is non-modal) |
| **IP-10** | C2.5 dependency on E1.5 — proceed against current `AssetProposal` shape in `v2-types.ts`? Or block C2.5 on E1.5 ratification? | Proceed; use the proposal-view adapter (§10.3); minor rev if E1.5/E2 changes shape |

---

## 15. Out of scope (explicitly deferred to other phases)

- **Mobile responsive completion** — Phase C5+ scope (per IP-3). However, C2 must NOT make decisions that make later responsive work harder. Specifically: avoid fixed pixel widths without min-width semantics; avoid hover-only interactions for primary affordances (provide click/tap equivalents); avoid layouts that assume horizontal mouse-friendly density without a graceful fallback; ensure side detail panel is structured to collapse to fullscreen on narrow viewports later (don't hard-wire desktop-only push-content behavior). Mobile UI is C5+ scope; mobile-aware design discipline is C2 scope.
- **Real `/api/v2/batch/[id]/commit` integration** — PR 5 cutover scope
- **Real per-asset upload streaming** — PR 5 scope
- **Real AI pipeline integration** — Phase E2-E6 scope
- **Comparables drill-down in price basis panel** — Phase F v2 (price engine v2)
- **Story groups overlay implementation in detail** — Phase C3 (this plan only includes the toggle action + banner accept; full overlay UX in C3)
- **DevHarness rewrite** — post-C5 cleanup (per IP-7)
- **Old upload-v2 file deletion** — explicit cutover PR after PR 5 stabilizes (per §3.3)
- **E2E browser tests** — Phase C5+ scope; C2 covers vitest unit + integration only
- **Performance benchmarking** — Phase C5+ scope; C2 ships react-window or equivalent default

---

## 16. Don't-do list

1. **Don't extend the V2 reducer.** Any new action belongs in V3. Modifying `v2-state.ts` outside of the dormancy-header addition is a regression of the dormancy lock (§3.3).
2. **Don't import V2 components from new shell.** UploadShell, AssetList, etc. must NOT import from `src/components/upload-v2/`. Reuse comes via NEW components in `_components/`.
3. **Don't conflate density modes with toggleable density.** Density is computed per §7.1 — there is NO `SET_DENSITY` action in V3.
4. **Don't store AI proposal acceptance state separately.** Acceptance is a derived view (per IP-5 default).
5. **Don't allow bulk-accept of prices.** Per spec §9.2 + UX-BRIEF v3 §4.4 + PRICE-ENGINE-BRIEF v3 §11.16. The reducer rejects the action shape; the UI doesn't expose the affordance.
6. **Don't introduce stages.** No `currentStage` in V3State.batch. No SET_STAGE action. Single screen per spec §2.
7. **Don't make Story groups visible by default in Linear/Compact.** Opt-in toggle per spec §8.1.
8. **Don't render parity-failing tests as warnings.** The parity test suite is hard-failing per §3.2.
9. **Don't ship C2.x prompts without parity verification.** Every sub-prompt's tests must include the parity assertion against the affected scenarios.
10. **Don't import DevHarness in production code paths.** Dev-only; tree-shaken from prod bundles.

---

## 17. Approval gate

Before any of C2.1–C2.5 implementation directives compose:

1. The three locks in §3 stand
2. The new file architecture in §4 is the target
3. The action set mapping in §5 is the canonical V3Action union
4. Sub-prompt scopes in §6-§10 are the targets
5. The 10 IPs in §14 are answered (defaults acceptable)
6. The test strategy in §11 is the verification posture
7. The file inventory in §12 is the change footprint
8. The sequencing in §13 is the order

If any of those is wrong, push corrections back. I revise. Then C2.1 implementation directive composes.

Recommended ratification path: read this doc end-to-end (~30 min), flag any IP answers you want overridden, push corrections back. I revise + integrate. Then C2.1 composes as a separate prompt directive that produces the page surface + reducer + parity test.

---

End of C2-PLAN.
