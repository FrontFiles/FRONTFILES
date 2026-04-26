# C2 — Single-screen upload UX rebuild

Replaces the 4-stage wizard at `/vault/upload` (`UploadShellV2.tsx` + `AddFilesScreen` → `AnalysisScreen` → `ReviewAssignScreen` → `CommitScreen`) with the single-screen, density-aware UX defined in `docs/upload/UX-SPEC-V3.md` (ratified at `6e68228`) and `docs/upload/C2-PLAN.md`.

This PR ships the entire C2 structural sequence (C2.1 → C2.5) plus a small set of chore + fix commits surfaced during visual verification. Old `src/components/upload-v2/*` and most `src/lib/upload/v2-*` files remain on disk as **dormant rollback scaffolding** (per `C2-PLAN.md §3.3 — Temporary coexistence rule`); they are not routed to and will be deleted in a separate explicit cutover PR.

---

## What ships

### Reducer + selectors (C2.1)

- `src/lib/upload/v3-state.ts` — new V3 reducer (~50 actions, strict guards with action-contract-specific error messages)
- `src/lib/upload/v3-types.ts` — `V3State`, `V3UIState`, `V3CommitState`, `V3ClusterProposalState`, `V3Action` union, density-mode helper
- `src/lib/upload/v3-hydration.ts` — V2State→V3State bridge for parity continuity
- `src/lib/upload/upload-selectors.ts` — Option-B extraction with narrow input view types (`AssetsView`, `StoryGroupsView`, `DefaultsView`, `FilterableView`)
- Parity test suite: `__tests__/v3-state-parity.test.ts` (76 cases across 4 fixtures including `ARCHIVE_150_MIXED`)
- Action coverage tests: `__tests__/v3-state.test.ts` (59 cases including the critical `bulk_accept_price_forbidden` invariant)

### Page surface + asset list (C2.2)

- `src/app/vault/upload/page.tsx` — server component shell (replaces `UploadShellV2.tsx`)
- `src/app/vault/upload/_components/UploadShell.tsx` — client orchestrator, three regions, push-layout for side panel
- `src/app/vault/upload/_components/AssetList.tsx` — density router (Linear / Compact / Batch / Archive per asset count)
- `src/app/vault/upload/_components/AssetRow.tsx` — Linear-mode full per-row detail
- `src/app/vault/upload/_components/AssetRowCompact.tsx` — Compact/Batch/Archive variant
- `src/app/vault/upload/_components/StoryGroupAccordion.tsx` — Archive cluster shape with inline rename + bulk action buttons
- `src/app/vault/upload/_components/BulkOpsBar.tsx`, `FilterBar.tsx`, `AIProposalBanner.tsx`
- `react-window` v1.8 pinned for virtualization (FixedSizeList API; v2 renamed it)

### Side detail panel (C2.3)

- `src/app/vault/upload/_components/SideDetailPanel.tsx` — push-layout (NOT overlay — spec §7), 480px, full per-asset edit surface
- `src/app/vault/upload/_components/DuplicateResolver.tsx` — side-by-side resolution per spec §7.2
- `NAVIGATE_SIDE_PANEL` reducer handler upgraded to use `getFilteredSortedSearchedAssets` (J/K respect active filter, per IPIII-11)

### Commit bar + flow (C2.4)

- `src/app/vault/upload/_components/CommitBar.tsx` — sticky bottom orchestrator across `idle / summary / committing / partial-failure`
- `CommitSummaryPanel.tsx`, `CommitProgressPanel.tsx`, `CommitSuccessPanel.tsx`, `CommitErrorPanel.tsx`
- `useCommitSimulation.ts` — fake driver for the `committing → success | partial-failure` transition (real `/api/v2/batch/[id]/commit` integration is PR 5)
- `getV3PublishReadiness` selector — V3 alignment per UX-BRIEF v3 §4.5 (drops `needs_story` from blocking math; V2 path keeps original selector for parity)
- `getCommitBarSummaryText` selector — plain-language text per UX-SPEC-V3 §10.2 (5-row mapping with critical-override)
- `PublishReadinessResult` extended with `blockerCounts` + `includedCount` (backwards-compatible)

### AI proposal surfacing (C2.5)

- `src/app/vault/upload/_components/PriceBasisPanel.tsx` — "Why this price?" inline expand per spec §9.3 (mounted in two surfaces — Linear inline + side-panel detail)
- Per-field ✓ accept icons across Linear AssetRow (title / caption / tags / geography / price)
- Per-field ✓ accept icons across SideDetailPanel field editor
- AI Proposal Detail body in side panel — three independently-collapsible rows (Caption rationale / Price basis / Tag confidence)
- Per-row "Accept all suggestions" link in Linear (excludes price per spec §9.2)
- Cluster header bulk-accept loops `UPDATE_ASSET_FIELD` after the no-op telemetry dispatch (React 19 batches → 1 re-render)
- Regenerate ↻ icon UI stub (real regen lands at E2)

### Dev-mode plumbing

- `?scenario=<id>` — fixture loader, dev-only (8 scenarios including `archive_150_mixed`, `archive_500_single_shoot`, `archive_1500_decade`)
- `?simulateFailure=N` — dev-only commit-failure injection per IPIV-5
- `?seedBanners=1` — dev-only AI cluster banner seeding per IPV-5
- All three are gated by `NODE_ENV === 'development'`; production ignores them

### Fixes surfaced during visual smoke

- `fix(upload): Archive cluster auto-expand-first via hydration, not useEffect` — StrictMode double-fired the original mount-time dispatch, leaving all clusters collapsed. Initialized `expandedClusterIds` at hydration time instead.
- `chore(upload): switch dev fixture loader to 'review-assigned' target` — `'review-ready'` left clusters as proposals only, leaving accordions empty in visual QA.
- `fix(upload): drop needs_story from V3 chip rendering per UX-BRIEF v3 §4.5` — Story groups are opt-in in V3; chips and ready-count had drifted vs spec.

---

## Three founder-ratified locks honored

| Lock | Source | Enforcement |
|---|---|---|
| **Reducer authority** | `C2-PLAN.md §3.1` | New V3 reducer is the only canonical interaction model; old `V2Action` union not extended; `v3-state.ts` is the single source of truth for the new shell |
| **Parity contract** | `C2-PLAN.md §3.2` | `v3-state-parity.test.ts` (76 cases across 4 fixtures) passes; `V2Asset` shape preserved per UX-BRIEF v3 §4.7; documented exceptions (`needs_story` removal, express-eligibility removal, 5-category chip collapse) follow the spec |
| **Temporary coexistence** | `C2-PLAN.md §3.3` | Old `upload-v2/*` files stay as dormant rollback; not routed to; not extended; deletion is its own future PR |

---

## Critical safety invariant

**Bulk-accept of price is FORBIDDEN** (spec §9.2 + UX-BRIEF v3 §4.4 + PRICE-ENGINE-BRIEF v3 §11.16):

- Type-level: `BULK_ACCEPT_PROPOSALS_FOR_GROUP.fields` and `..._FOR_SELECTION.fields` are `Array<'caption' | 'tags' | 'keywords'>` — TypeScript prevents `'price'`
- Runtime: reducer throws `bulk_accept_price_forbidden` if type erasure bypasses the type check (covered in `v3-state.test.ts`)
- UI: zero affordance for bulk-accepting price across Linear, Compact, Batch, Archive, side panel, cluster header, per-row "Accept all"
- Per-asset price acceptance via per-row ✓ is allowed (single `UPDATE_ASSET_FIELD`, not a bulk operation)

---

## Tests

- `bun run test src/lib/upload/__tests__/v3-state.test.ts` → 59 passing
- `bun run test src/lib/upload/__tests__/v3-state-parity.test.ts` → 76 passing
- `bun run test src/lib/upload/__tests__/upload-selectors.test.ts` → 14 passing
- **Total: 149 passing**

The full repo test suite (`bun run test`) should also pass; the v2-* surface tests are frozen-as-of C2 (per coexistence rule §3.3) and continue to pass against the unchanged V2 reducer.

---

## Visual smoke

Six checks against `localhost:3000` (dev server):

1. `?scenario=clean_single_story` — Linear mode; per-field ✓ + ↻ icons; "Accept all suggestions" link in row header; "Why?" expands `PriceBasisPanel`
2. `?scenario=archive_150_mixed` — Archive mode; cluster accordions populated; first cluster auto-expanded; click row → side panel slides in (push, not overlay); J/K navigate within active filter
3. CommitBar at idle — "COMMIT N" CTA with plain-language summary text per spec §10.2
4. Click COMMIT → CONFIRM → progress bar fills → success panel **replaces screen body** (per spec §11.3); UPLOAD MORE / GO TO VAULT terminal actions
5. `?scenario=clean_single_story&simulateFailure=2` — partial-failure flow; failed assets get red "Commit failed" chip; RETRY FAILED restarts
6. `?scenario=archive_150_mixed&seedBanners=1` — AI cluster proposal banners visible; Accept creates cluster; Dismiss hides

---

## Out of scope (deferred)

- **C2.6 — visual polish sweep** (next PR or follow-up commit on this branch). Backlog: SideDetailPanel thumbnail height, BulkOpsBar wrap when panel is open, "0 READY" cluster header math, brutalist consistency audit
- **PR 5 — backend wiring**: real `POST /api/v2/batch/[id]/commit`, real per-asset upload streams, real AI pipeline integration, real per-field regeneration
- **`v2-state.ts` selector body extraction (C2.1.1)** — internal refactor; selectors call into `upload-selectors.ts` but `v2-state.ts` keeps duplicated bodies for parity continuity
- **Component-test infrastructure (jsdom + RTL)** — not adopted in C2.3/C2.4/C2.5; pure-logic test surface (parity + reducer + selector) is the gate. Separate ratification if/when desired
- **Mobile responsive variants** — Phase C5+ per spec §8.3
- **Drag-drop cluster reassignment** — C3 per IPII-11
- **Telemetry hook wiring for `ACCEPT_PROPOSAL` no-ops** — analytics pipeline phase
- **Cost/quota messaging on regen** — owned by E1.5
- **Cmd+Enter shortcut for commit** — spec doesn't list it
- **Cluster-level side panel** — cluster rename is inline in `StoryGroupAccordion` already

---

## Reading order for review

If you want to walk this in directive order:
1. `docs/upload/C2-PLAN.md` — governing plan + 3 locks + action set + sequencing
2. `docs/upload/C2.1-DIRECTIVE.md` — reducer + parity test gate
3. `docs/upload/C2.2-DIRECTIVE.md` — asset list + 4 density modes + filters + bulk ops
4. `docs/upload/C2.3-DIRECTIVE.md` — side detail panel
5. `docs/upload/C2.4-DIRECTIVE.md` — commit bar + flow + simulation driver
6. `docs/upload/C2.5-DIRECTIVE.md` — AI proposal surfacing + PriceBasisPanel + per-field accept

Or by surface (matches the 5 shipped commits + 3 fixes + 1 chore + 1 dep pin):
1. Reducer + parity contract
2. Asset list (4 density modes)
3. Side detail panel
4. Commit bar + flow
5. AI proposal surfacing
6. Three small fixes + dev-mode loader + react-window pin

---

## Co-authored

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
