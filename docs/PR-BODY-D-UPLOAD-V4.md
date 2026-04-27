# V4 Upload Redesign — single-pane editorial workspace

Replaces the C2 "single-screen / 3-region density-aware list" UI with a
progressively-disclosed three-pane editorial workspace where assets are
the interface, plus a substantial set of inspector + bulk-editing
affordances.

23 commits over two days. Branch is fully tested, smoke-verified, and
ships zero console warnings.

## What's in this PR

| Phase | Headline |
|---|---|
| **D2.1 → D2.8** | V4 shell + reducer/data deltas / left rail + DnD / center pane (contact sheet + zoom + filter chips) / right rail inspector / contextual action bar / file ingest + session defaults / compare mode / cutover (delete dormant C2, collapse `_components_v4` → `_components`). |
| **D2.9** | Layout polish (pane contrast / cards-as-images / inspector preview-first / left-rail visual story navigator at 320px / filter chip recede / spacing rhythm) + AI provenance tagging via FieldProvenanceTag (`UPDATE_ASSET_FIELD` + 4 other reducer cases set `metadataSource[field] = 'creator'`) + cover-slot in contact sheet (drag-to-set-cover, `SET_STORY_COVER`). |
| **D2.9 follow-up** | Creative Commons added to `LicenceType` (both upload + main type unions); `socialLicensable: boolean` field on `AssetEditableFields` with provenance tracking; cover slot integrated as first grid cell (was orphan above); story-membership tracking — pre-existing D2.2-era bug fixed (six reducer cases now maintain `proposedAssetIds` + `sequence` consistently). |
| **D2.10** | Story-level metadata (`location: string`, `date: string \| null`) on `V2StoryGroup`; new `UPDATE_STORY_FIELD` action; `ContactSheetStoryHeader.tsx` (editable name + location + date + "Apply to all in story" composing via two BULK_UPDATE_FIELD dispatches); per-field `→ all` button on every applicable field (excluded: price, per L6); select-all checkbox in filter-chip area with indeterminate state. |
| **D2.10 follow-up** | `InspectorEmbeddedMetadataSection.tsx` — read-only EXIF / GPS / IPTC dump in the inspector (between Exceptions and AI Proposal Detail), with empty-state branch for assets with `extractedMetadata: null`. |
| **dnd-kit hydration silence** | Stable `DndContext` id seeded via `useId()` (defensive) + `suppressHydrationWarning` on draggable card root. The "only acceptable warning" per D2.9-DIRECTIVE.md §6 is now eliminated. |

## Numbers

| Metric | Pre-branch | Post-branch |
|---|---|---|
| Vitest passing | 185 (subset run) → 1886 (full) | **1898** |
| `v3-state.test.ts` cases | 0 (didn't exist) | **94** |
| Pre-existing tsc errors | 8 (all tolerated) | 8 (all tolerated, **zero new**) |
| Console warnings | 1 (dnd-kit hydration) | **0** |

## Files changed

- **35+ new components** in `src/app/vault/upload/_components/` (V4 shell + inspector + bar + compare + lib subfolders)
- **3 deleted dormant C2 components** (`UploadShell.tsx`, `AssetList.tsx`, `AssetRow.tsx`, `AssetRowCompact.tsx`, `StoryGroupAccordion.tsx`, `SideDetailPanel.tsx`, `BulkOpsBar.tsx`, `FilterBar.tsx`)
- **2 deleted V4-era components** (`InspectorAcceptRow.tsx`, `SetAsCoverButton.tsx` — both replaced by D2.9 affordances)
- **`src/lib/upload/v3-state.ts`** — extensive reducer changes (membership tracking, metadataSource side effects, story field updates)
- **`src/lib/upload/v2-types.ts`** — `socialLicensable` field, `V2StoryGroup.location` + `.date` fields
- **`src/lib/upload/v3-types.ts`** — `UPDATE_STORY_FIELD` action variant
- **`src/lib/types.ts`** + **`src/lib/upload/types.ts`** — `creative_commons` added to both `LicenceType` unions
- **`src/lib/upload/price-engine.ts`** — `LICENCE_PREMIUM[creative_commons]: 0`
- **Test fixtures** updated in 3 test files for new shape
- **2 new directives** committed (`docs/upload/D2.9-DIRECTIVE.md`, `docs/upload/UX-SPEC-V4.md` — V3 retired by V4)
- **Session wraps** — `docs/SESSION-WRAP-2026-04-27.md` (current), `2026-04-26.md` carries stale-banner pointing to the 27th wrap

## Founder locks preserved (L1–L6)

| | |
|---|---|
| **L1** Reducer authority | No new action types in D2.9 main; new types only when adding genuine new behavior (UPDATE_STORY_FIELD). Side effects on existing actions per D2.9 directive. |
| **L2** V2Asset parity | `metadataSource` was already declared; D2.9 just populates it. New fields (`socialLicensable`, `V2StoryGroup.location/.date`) are additive optionals. |
| **L3** Single-folder coexistence | Shipped at D2.8; unchanged. |
| **L4** 16:9 lock | Cover slot, contact-sheet cards, inspector thumbnail, compare cards, left-rail covers — all 16:9. |
| **L5** Bulk-only-when-bulk | ContextualActionBar mount conditions unchanged. |
| **L6** Price + title never auto-accepted | Hydration sweep still excludes them; price has NO `→ all` button (per spec §9.2). |

## Out of scope (intentional)

- **PR 5 cutover** — wiring the new UI to the real backend behind `FFF_REAL_UPLOAD=true`. Blocked on E2-E6 + F2-F11 + WM-D1 + WM-D3.
- **AI pipeline E1.5 detail brief** — model pin, prompt text, confidence values. Pending ratification.
- **Price calibration F1.5** — 252-cell `format_defaults` + 63-cell platform floors. Pending founder calibration.
- **8 pre-existing tsc errors** — `reaper.ts` env type, `storage-bridge.ts` DerivativeRole literal, `v2-mock-scenarios.ts` declaration / licence literals, `v3-state.test.ts:43-44` Record cast, `upload-selectors.ts:30` AssetFormat re-export, `computeAcceptAIDispatches.test.ts:79` DuplicateStatus. Quiet maintenance directive, ~20 min.
- **Watermark retirement (D1.5)** — triple-gated; defer until PR 5 lives + non-zero real creator usage + watermark profiles approved.

## Smoke verified

`localhost:3000/vault/upload?scenario=archive_150_mixed`:

- ✓ Pane contrast: left rail recedes (slate-50), center bright white, right rail 2px black left edge
- ✓ Cards: no internal borders, 2px blue selection outline (no layout shift), 4px outline on cover slot
- ✓ Inspector: filename header, 24px gap, slate-300 input borders, all `→ all` buttons + AI provenance tags rendering, embedded metadata empty-state branch correct
- ✓ Left rail at 320px: cover-first story rows, active outline on filtered story
- ✓ Filter chips recede, search affordance recedes, select-all checkbox with indeterminate state
- ✓ Story header: editable name + location + date + "Apply to all in story" button
- ✓ Cover slot drag-and-drop: drops swap cover (verified in left-rail thumbnail)
- ✓ Drag-reorder within story-filtered view: works (the membership-tracking fix)
- ✓ Drag from contact sheet to left-rail story: row bg-blue-100 highlight on drag-over
- ✓ Compare mode: 2-up side-by-side, Esc exits cleanly
- ✓ Console: zero warnings on hard-refresh

## Reviewer guidance

The single highest-leverage file to read is **`docs/SESSION-WRAP-2026-04-27.md`** — it carries the full state, what's pending, and the don't-do list to avoid common pitfalls. Everything else flows from the locks.

If you want to spot-check the most consequential change, **`src/lib/upload/v3-state.ts`** carries the reducer surface — particularly the membership-tracking fix in `MOVE_ASSET_TO_CLUSTER` / `MOVE_ASSET_TO_UNGROUPED` / `CREATE_STORY_GROUP_AND_MOVE` / `SPLIT_CLUSTER` / `MERGE_CLUSTERS` / `REMOVE_FILE`, all of which now maintain `proposedAssetIds` + `sequence` correctly (was a pre-existing D2.2-era silent no-op for the manual-creation flow).
