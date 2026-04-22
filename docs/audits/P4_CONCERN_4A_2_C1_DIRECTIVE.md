# P4 Concern 4A.2.C1 — Offer list UI enrichment (`/vault/offers`)

**Status:** DRAFT 1, 2026-04-22 — awaiting founder verdict at Gate 0
**Branch:** `feat/p4-offers-c1-list` (to be cut from `main` at Gate 0 approval)
**Predecessor:** P4 Concern 4A.2.SCAFFOLD (minimal `/vault/offers` + `OffersListClient`) — closed, see `P4_CONCERN_4A_2_SCAFFOLD_EXIT_REPORT.md`
**Peer concerns (parallel):** 4A.2.C2 (detail + mutation UI), 4A.2.D (offer cron)
**Successor:** 4A.2.C — legacy `/api/special-offer/*` retirement (directive: `P4_UI_DEPRECATION_AUDIT.md` Draft 2, Gate 3 approved 2026-04-22). C1 ships ahead of C retirement per the sequencing locked at `P4_CONCERN_4A_2_B2_EXIT_REPORT.md:230` ("after C1 + C2 + D land, 4A.2.C rewrite is materially easier").

---

## §CONTEXT

The SCAFFOLD concern (closed 2026-04-22) shipped a brutalist minimal `OffersListClient` at `src/app/vault/offers/_components/OffersListClient.tsx` with three states (loading/error/loaded), one row per offer, ID-prefix counterparty fallback, and a hard-cap-100 `truncated` flag. It is deliberately incomplete — the scaffold's §1.3 explicitly punted compose / accept / state-transition UI / counterparty profiles / design polish / error-state refinement to *"subsequent product-UI concerns"*. This is the list-half of that punt.

**What C1 owns.** The list surface. Filter / sort / search affordances. Proper counterparty handle resolution (replaces the `actor_id.slice(0, 8)` fallback). Pagination scaffolding (cursor-based; replaces the 100-row hard cap + `truncated` banner). List-level empty/error-state copy polish. Row-level status chip rendering against the 6-state offer state machine (pending / countered / accepted / rejected / expired / cancelled) per `ECONOMIC_FLOW_v1.md` §4 and `PLATFORM_BUILD.md` type system.

**What C1 does NOT own.** Detail-page enrichment, mutation UI (accept / counter / reject / cancel), compose/create-offer flow — **all C2**. Cron-driven state transitions (auto-expire, auto-accept) — **all D**. Assignment surface (`/vault/assignments`) — **4A.3**. Dispute surface (`/vault/disputes`) — **4A.4**. Legacy `/api/special-offer/*` retirement — **4A.2.C** (now executable after Gate 3 approval).

**Governance anchor.** Per `P4_UI_DEPRECATION_AUDIT.md` §3.1 row 1 (Draft 2, 2026-04-22): *"replacement page governed by concern 4A.2.C1/C2 against ECONOMIC_FLOW_v1.md §7 (shape), §8.1 (events), §12 (UX surfaces); product-surface name 'Special Offer' per A.0 D1."*

---

## §SCOPE

In scope:

1. **Counterparty handle resolution.** Replace `buyer_id.slice(0, 8)` / `creator_id.slice(0, 8)` with real handles via a new read-only endpoint `GET /api/actors/handles?ids=<csv>` that returns `{ [actor_id]: { handle, display_name } }` under party-only RLS. Endpoint hard-caps at 50 ids per request.
2. **Row-level status chip.** Render one of six state chips (pending / countered / accepted / rejected / expired / cancelled) using the black-on-white brutalist baseline from SCAFFOLD §F6 plus a single `border-black` frame. Chip label maps 1:1 to the `state` enum value — no translation.
3. **Filter bar.** Four filter dimensions, all client-side against the fetched set (no server-side filtering in v1):
   - State (multi-select among the six enum values; default: all selected)
   - My-role (buyer / creator / both; default: both)
   - Target type (single_asset / asset_pack / single_brief / brief_pack; default: all)
   - Expiry window (expired / expiring ≤ 72h / active; default: all)
4. **Sort control.** Three options: `created_at DESC` (default — same as scaffold), `expires_at ASC` (most urgent first), `gross_fee DESC`. Pure client-side `Array.sort`.
5. **Pagination.** Cursor-based via `?cursor=<offer_id>&direction=before|after`. Replace SCAFFOLD's hard-cap-100-plus-`truncated`-banner with a proper "Load more" button at the bottom of the list. Page size: 25 rows.
6. **Empty-state polish.** Differentiate three empty states: no offers at all (copy: *"You have no offers."*), no offers match the active filters (copy: *"No offers match your filters. Clear filters."* with a reset-filters link), query still loading (copy unchanged from SCAFFOLD).
7. **Error-state polish.** Surface the 4 error codes from `GET /api/offers` (`FEATURE_DISABLED`, `UNAUTHENTICATED`, `ACTOR_NOT_FOUND`, `INTERNAL`) with distinct plain-text copy lines. No retry button in v1 — the reload affordance stays the browser refresh.
8. **Tests.** Pure-helper coverage per the SCAFFOLD §R6-pure pattern. No RTL, no jsdom, no new dev dependencies (inherited §D3 lock). Coverage budget: ~14 new test cases across three new `*.test.tsx` files.

Out of scope (enforced at review):

- Compose / create-offer UI — **C2**.
- Accept / counter / reject / cancel buttons — **C2**.
- Detail-page rights renderer — **C2**.
- Auto-expire / auto-accept state transitions — **D**.
- Server-side filter / sort / search (keeps the list endpoint dumb) — revisit post-launch if p99 latency signal demands it.
- Full-text search across notes — out of v1 entirely.
- Bulk actions (mark read, archive, etc.) — v2+.
- Virtualized list rendering — v2+; 25-row page + "Load more" is sufficient for launch traffic profile.
- Saved filter presets — v2+.
- Counterparty avatars / profile links — profile surface is a separate concern.
- Touch / mobile breakpoint polish — deferred to the Phase B design pass.

---

## §NON-SCOPE — explicit denials

| Request | Refusal reason |
|---|---|
| "Add a 'New offer' button to the list header" | Compose flow is **C2**. |
| "Swipe-to-accept on mobile" | Phase B mobile-polish concern; and accept UI is **C2**. |
| "Use Zustand / Jotai / Redux for filter state" | No new dependencies (§D3 inherited). Use `useState`/`useReducer`. |
| "Add a date-range picker for expiry filter" | Three coarse buckets (expired / ≤72h / active) only in v1; finer-grained filter is v2+. |
| "Persist filter state in URL query string" | v2+. In-memory component state only in v1. |
| "Add ARIA live regions for filter-applied announcements" | Accessibility audit is a dedicated WCAG concern; beyond the scaffold-grade a11y floor here. |
| "Fetch all pages on mount, then filter client-side" | No. Cursor pagination, explicit "Load more". |
| "Add infinite scroll" | No. Click-to-load only. Simpler to test, simpler to reason about error states. |

---

## §REVISIONS

(None yet — directive is Draft 1.)

---

## §F — Functional requirements

### §F1 — `GET /api/actors/handles` (NEW)

**File:** `src/app/api/actors/handles/route.ts`

**Contract:**
- Auth: same shape as `GET /api/offers` — `requireActor()` → 404 / 401 / 403; Bearer token re-extracted.
- Query: `?ids=<uuid>,<uuid>,…` — up to 50 ids. >50 returns 400 `TOO_MANY_IDS`. Zero ids returns 400 `MISSING_IDS`.
- RLS: the handles table is subject to a party-only policy — the caller can resolve handles only for counterparties they share an offer / assignment / dispute thread with. Not-visible ids are **omitted** from the response (no 404 per-id), matching the convention of batched read endpoints.
- Response shape on 200:
  ```ts
  { data: { handles: Record<string, { handle: string, display_name: string | null }> } }
  ```
- Error surface mirrors `GET /api/offers` exactly.

**LoC budget:** ~120 LoC handler + ~180 LoC paired test file at `src/app/api/actors/handles/__tests__/get.route.test.ts`.

### §F2 — `OffersListClient` refactor

**File:** `src/app/vault/offers/_components/OffersListClient.tsx` (existing scaffold — rewrite, not touch-up).

Structure (§R6-pure pattern, preserved from SCAFFOLD):

- **Component shell.** Owns `useSession()`, fetches on `status === 'authenticated'`, reduces to a view state, delegates JSX to a pure helper.
- **Pure helper signature.** `renderOffersListBody(view: OffersListView, selfUserId: string, handles: HandleMap, filterState: FilterState, sortKey: SortKey): ReactElement`. Takes all data as arguments; zero hooks; zero network.
- **View states.** `loading` / `error: <code>` / `loaded: { offers: OfferRow[], nextCursor: string | null, prevCursor: string | null }`.
- **Handle map.** Fetched in parallel with the offer list — union of `buyer_id` + `creator_id` across the current page's offers, batched through the new `/api/actors/handles` endpoint. If a handle is missing from the response (RLS-gated), fall back to `actor_id.slice(0, 8)` with the same comment the scaffold carried.
- **Filter + sort.** All four filter dimensions + three sort options implemented client-side against the loaded page. Filter / sort controls live above the list in a `<div>` row with `border-b border-black` separation.
- **Pagination.** "Load more" button below the list when `nextCursor !== null`. Clicking triggers a fetch with `?cursor=<last_id>&direction=after&limit=25`, appends results to the current array.

**LoC budget:** ~380 LoC (component + pure helper combined; replaces the scaffold's ~150 LoC).

### §F3 — `GET /api/offers` contract extension

**File:** `src/app/api/offers/route.ts` — extend the existing GET export.

- New query params: `?cursor=<uuid>&direction=before|after&limit=<n>` — `limit` defaults to 25, caps at 100.
- Behavior: adds keyset pagination ordered by `(created_at DESC, id DESC)` — same ordering as scaffold, now page-sliceable. Absent `cursor` returns the first page. `direction=after` with a cursor returns rows strictly after (older than) the cursor; `direction=before` returns rows strictly before (newer than).
- Response shape extends:
  ```ts
  { data: { offers: OfferRow[], nextCursor: string | null, prevCursor: string | null } }
  ```
- SCAFFOLD's `truncated` field is **removed** from the response shape in v1 of this concern — superseded by cursor semantics. AC gate: any remaining consumer of `truncated` in the repo must be migrated inside this concern (grep check in §AC).

**LoC budget:** +~80 LoC to the existing handler.

### §F4 — Row component + status chip

**File:** `src/app/vault/offers/_components/OfferRow.tsx` (new).

- Receives one `OfferRow` + the resolved counterparty handle + the current user's role for this row.
- Renders as a single CSS-grid row: `[status-chip] [counterparty-handle] [target-type] [money] [expires] [chevron]`.
- Status chip: plain `<span>` with `border border-black px-2 py-0.5 text-xs uppercase tracking-widest`. Chip label = `state` enum value (verbatim).
- Entire row wrapped in `<Link href={\`/vault/offers/${offer.id}\`}>` (unchanged from scaffold).

**LoC budget:** ~90 LoC.

### §F5 — Filter + sort control components

**Files:**
- `src/app/vault/offers/_components/OffersFilterBar.tsx` (new, ~180 LoC)
- `src/app/vault/offers/_components/OffersSortControl.tsx` (new, ~60 LoC)

Brutalist baseline: `<select>` / `<input type="checkbox">` native elements only. No custom dropdowns, no combobox libraries. `border-black` frames, black text on white, system sans.

### §F6 — Styling baseline

Inherited verbatim from SCAFFOLD §F6. Explicit re-statement:

- System sans. Type scale `text-xs` (chip / filter label) / `text-sm` (body) / `text-base` (row content) / `text-lg` (page header).
- Black on white. Blue-600 only on the chevron link target and on the "Clear filters" / "Load more" affordances.
- 1px `border-black` between rows; `border-b border-black` under the filter bar.
- No shadows, no rounded corners, no animations, no icons beyond the text chevron (`›`).

### §F7 — Tests

All tests follow the SCAFFOLD §R6-pure pattern (`renderToString` against the pure helper; no RTL, no jsdom).

**Files:**
- `src/app/api/actors/handles/__tests__/get.route.test.ts` (new) — 6 cases mirroring the `GET /api/offers` test matrix from SCAFFOLD.
- `src/app/vault/offers/_components/__tests__/OffersListClient.test.tsx` (existing — **extend**) — add ~4 cases: filter applies reduces visible rows, sort reorders without mutating the fetched array, "Load more" fires a fetch with the correct cursor, missing handle falls back to ID prefix.
- `src/app/vault/offers/_components/__tests__/OffersFilterBar.test.tsx` (new) — 4 cases covering each filter dimension's reducer behavior.
- `src/app/vault/offers/_components/__tests__/OffersSortControl.test.tsx` (new) — 3 cases (one per sort option).
- `src/app/vault/offers/_components/__tests__/OfferRow.test.tsx` (new) — 6 cases (one per state enum value) asserting chip label + row cell content.

**Test baseline.** Prompt 1 captures the post-SCAFFOLD baseline (expected ≥ 1276 passing after SCAFFOLD AUTH GATE2; AC10 floor = captured value + 23 new cases).

---

## §AC — Acceptance criteria (for exit report)

| # | Criterion | Verification |
|---|---|---|
| AC1 | `GET /api/actors/handles` exists and matches §F1 contract | curl + paired test |
| AC2 | `GET /api/actors/handles` RLS-gates non-party ids (omits, not errors) | test in §F7 |
| AC3 | `GET /api/offers` accepts `cursor` + `direction` + `limit` query params | curl + test |
| AC4 | `GET /api/offers` no longer returns `truncated` field | grep repo-wide for `.truncated`; test asserts absence |
| AC5 | `OffersListClient` renders counterparty handles (real, not ID prefix) when RLS-visible | smoke + visual |
| AC6 | Filter bar reduces visible row set without re-fetching | test |
| AC7 | Sort control reorders client-side without re-fetching | test |
| AC8 | "Load more" fires a follow-up fetch and appends | test |
| AC9 | Status chip renders the `state` enum verbatim, one chip per row | test + visual |
| AC10 | Vitest baseline ≥ SCAFFOLD exit floor + 23 new cases, 0 failing | `npm run test` |
| AC11 | `npm run build` clean | CI / local |
| AC12 | No new lint errors beyond the SCAFFOLD exit floor (69 errors / 346 warnings, or the then-current floor after 4A.2.C retirement if C lands first) | `npm run lint` |
| AC13 | Brutalist styling constraints from §F6 honored | manual visual check |
| AC14 | No new dependencies in `package.json` | `git diff package.json` |
| AC15 | No imports of `@supabase/ssr` or `next/headers` introduced | grep |
| AC16 | `/api/special-offer/*` files not touched (owned by 4A.2.C) | git diff |
| AC17 | Detail page (`OfferDetailClient.tsx`) not modified (owned by C2) | git diff |
| AC18 | Scaffold's §F6 constraints re-asserted in this directive and honored | visual |

---

## §D — Directives

- **§D1 (inherited).** No SSR auth infrastructure. No `@supabase/ssr`, no `next/headers`, no server-component Supabase client.
- **§D2 (inherited).** Server components are flag gates only. All data work lives in client components.
- **§D3 (inherited).** No new dependencies.
- **§D4 (inherited).** Brutalist baseline non-negotiable. Reject embellishment beyond §F6.
- **§D5 (new).** `truncated` field in the `GET /api/offers` response is **deleted**, not deprecated. Concurrent consumers must be migrated in this concern, not shimmed.
- **§D6 (new).** The new `GET /api/actors/handles` endpoint is scoped to party-visible ids only. It does NOT become a general-purpose handle lookup surface — attempts to widen its scope (e.g., resolve arbitrary creator handles for the public profile surface) belong to a separate directive.
- **§D7 (new).** Filter / sort state is component-local. Do not introduce URL-query-string synchronization, localStorage persistence, or a global store.
- **§D8 (inherited from 4A.2.C).** The `/api/special-offer/*` retirement happens under its own concern (4A.2.C, governing directive = `P4_UI_DEPRECATION_AUDIT.md` Draft 2). Do not delete or modify those route handlers in C1.
- **§D9 (inherited).** No "while I'm here" cleanups. Pre-existing lint errors stay untouched.

---

## §PROMPTS — execution sequence

| # | Title | Output | LoC est. |
|---|---|---|---|
| 1 | **Pre-flight audit** — capture post-SCAFFOLD test/lint baseline; confirm `truncated` has exactly one consumer (SCAFFOLD's `OffersListClient`); confirm no `@supabase/ssr` drift since SCAFFOLD closure. | `§AUDIT-1` appended to this directive. | 0 |
| 2 | **Build `GET /api/actors/handles`** + paired test file | route.ts (new), test (new) | ~300 |
| 3 | **Extend `GET /api/offers`** with cursor pagination; remove `truncated` from response shape | route.ts diff; existing test extended | ~80 + test updates |
| 4 | **Build `OfferRow`** + pure-helper tests | component (new), test (new) | ~160 |
| 5 | **Build `OffersFilterBar`** + `OffersSortControl` + tests | two components (new) + two tests (new) | ~360 |
| 6 | **Rewrite `OffersListClient`** to compose filter bar + sort control + row component; add handle-map fetch; add cursor pagination | full rewrite | ~380 |
| 7 | **Extend** `OffersListClient.test.tsx` with the 4 new cases | test diff | ~120 |
| 8 | **Verification pass** — full test suite + build + lint; capture deltas | text-only report | 0 |
| 9 | **Exit report** — mirror SCAFFOLD exit structure | new doc `P4_CONCERN_4A_2_C1_EXIT_REPORT.md` | ~200 |

**Total LoC budget:** ~1 400 (ambitious but bounded; mostly test mass).

**Total prompts:** 9. Wall-clock estimate: 3-4 days solo, verdicts within ~2 hours.

---

## §APPROVAL GATES

- **Gate 0 (now):** founder verdict on this directive — approve / approve-with-corrections / revise / reject.
- **Gate 1:** after Prompt 1 — if the `truncated`-consumer audit surfaces more than the one expected consumer, pause and re-scope.
- **Gate 2:** after Prompt 3 — if the cursor-pagination response shape breaks more consumers than the SCAFFOLD `OffersListClient`, pause and surface.
- **Gate 3:** after Prompt 8 — verification pass must show zero baseline regression beyond the AC12 floor.

---

## §OPEN-Q — founder decisions owed before Gate 0 closes

| # | Question | Options |
|---|---|---|
| 1 | Branch name | `feat/p4-offers-c1-list` proposed; alternatives? |
| 2 | Sequencing vs 4A.2.C retirement | Propose: C1 + C2 + D land in parallel on separate branches; 4A.2.C merges last (per B2 exit report §230). Accept? |
| 3 | Sequencing vs C2 | Propose: strictly parallel — C1 and C2 touch disjoint files. Accept? |
| 4 | 25-row page size | Accept, or tune (15? 50?)? |
| 5 | Status chip color for terminal states (rejected / expired / cancelled) | Propose: stay black-on-white (brutalist); visual de-emphasis only via opacity-60. Accept? |
| 6 | Handle-lookup endpoint scope | Propose: narrow (party-visible only) per §D6. Accept? |

---

**End of directive.**
