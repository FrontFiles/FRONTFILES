# Bulk Upload v2

## Where it lives

- **Route:** `/vault/upload` (`src/app/vault/upload/page.tsx`)
- **Shell:** `src/components/upload-v2/UploadShellV2.tsx`
- **State:** `src/lib/upload/v2-state.ts` (reducer + selectors)
- **Types:** `src/lib/upload/v2-types.ts`
- **Mock data:** `src/lib/upload/v2-mock-scenarios.ts`
- **Simulation:** `src/lib/upload/v2-simulation.ts`

## 4-Step Flow

1. **Add Files** — Drop files or load a demo scenario. Set optional defaults (privacy, licences). No default Story field.
2. **Analysis** — Simulated upload + analysis pipeline. Creates Story group proposals with `proposedAssetIds`. Never assigns stories. Early transition to Review available.
3. **Review & Assign** — The hero screen. Three-zone layout: Story Groups (left), Asset Table (center), Asset Detail (right), Publish Bar (bottom). All editing inline. All Story assignment through explicit creator actions.
4. **Commit to Vault** — Pre-commit summary with per-Story breakdown and 3-state outcome indicators. Post-commit completion with Story links and total listed value.

## Reducer Structure

Single `useReducer` in `UploadV2Context.tsx`. State shape:

```
V2State
  batch: { id, currentStage, createdAt, committedAt }
  assetsById: Record<string, V2Asset>
  assetOrder: string[]
  storyGroupsById: Record<string, V2StoryGroup>
  storyGroupOrder: string[]
  ui: { selectedAssetIds, focusedAssetId, filter, sort, expressEligible, ... }
  defaults: { privacy, licences, tags }
```

All Story assignment, metadata editing, pricing, and privacy changes flow through the reducer. No screen maintains local state for data that matters downstream.

## Selectors

Pure functions computed every render. Key selectors:

- `getAssets`, `getIncludedAssets`, `getAssignedAssets`, `getUnassignedAssets`
- `getAssetsForStoryGroup`
- `getAssetExceptions` — computes blocking/advisory exceptions per asset
- `getBlockingExceptions`, `getAdvisoryExceptions`
- `getPublishReadiness` — ready boolean + human-readable blocker summary
- `getExpressEligibility` — eligible boolean + reasons array
- `getStoryCoverageSummary`
- `getTotalListedValue`
- `getCompletionSummary`
- `getFilteredAssets`
- `getAnalysisProgress`

## Mock Scenarios

Three demo scenarios toggled in the Add Files screen:

1. **clean_single_story** — 5 photos, 1 event, express-eligible
2. **messy_multi_story** — 15 files, 3 stories, 1 duplicate, 1 manifest-invalid
3. **scale_batch_50_plus** — 55 files, 5 stories, mixed formats, mixed quality

## Architecture: Single Authoritative State

The entire upload workflow is governed by one `useReducer` call. The context provider (`UploadV2Context`) distributes `state` and `dispatch` to all screens. No component maintains `useState` for Story assignment, metadata, pricing, or privacy.

### Why storyGroupId is only set by creator actions

The reducer's `UPDATE_ANALYSIS_RESULT` action populates `proposal` (including `storyCandidates`) and auto-fills `editable` fields (title, description, tags, geography, privacy, licences) from proposals. It never writes `storyGroupId`.

Story group proposals are created via `ADD_STORY_GROUP_PROPOSAL` with `proposedAssetIds` — a read-only list of which assets the system believes belong in each group.

`storyGroupId` is set only by:
- `ASSIGN_ASSET_TO_STORY` — single asset, explicit dropdown or drag
- `BULK_ASSIGN_ASSETS` — multiple selected assets
- `ACCEPT_ALL_PROPOSED_ASSIGNMENTS` — applies proposedAssetIds, skips already-assigned
- `APPLY_EXPRESS_FLOW` — single creator action accepting all suggestions

### How exception computation works

Exceptions are computed by `getAssetExceptions(asset)`, a pure function called on every render. It returns an array of `{ type, severity, label }` objects.

Blocking exceptions: needs_story, needs_privacy, manifest_invalid, needs_price (PUBLIC/RESTRICTED only), needs_licences (PUBLIC/RESTRICTED only).

Advisory exceptions: no_price_private, no_licences_private, duplicate_unresolved, low_confidence, provenance_pending.

PRIVATE assets may commit without price or licences. Excluded assets generate zero exceptions.

The Publish button (`PublishBar`) is disabled when `getPublishReadiness(state).ready` is false. The blocker summary generates human-readable messages like "3 assets need Story assignment".

## Known Limitations

- No drag-and-drop between Story groups (uses dropdown assignment)
- No keyboard shortcuts (J/K navigation, Space to select)
- No split/merge Story group operations
- No duplicate resolution wizard (side-by-side comparison)
- No group size warnings for groups >15 files
- Mock simulation only — no real file upload or backend integration
- No undo for actions
- Pre-existing `/search` page build error (unrelated to upload v2)
