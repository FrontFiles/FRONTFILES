# P4 Concern 4A.2.C2 — Offer detail + mutation UI (`/vault/offers/[id]` + compose flow)

**Status:** DRAFT 1, 2026-04-22 — awaiting founder verdict at Gate 0
**Branch:** `feat/p4-offers-c2-detail` (to be cut from `main` at Gate 0 approval)
**Predecessor:** P4 Concern 4A.2.SCAFFOLD (minimal `OfferDetailClient`) — closed 2026-04-22
**Peer concerns (parallel):** 4A.2.C1 (list UI enrichment), 4A.2.D (offer cron)
**Successor:** 4A.2.C — legacy `/api/special-offer/*` retirement (directive: `P4_UI_DEPRECATION_AUDIT.md` Draft 2, Gate 3 approved 2026-04-22).

---

## §CONTEXT

The SCAFFOLD concern shipped a brutalist `OfferDetailClient` at `src/app/vault/offers/[id]/_components/OfferDetailClient.tsx` with a 404 / loading / error / loaded trinity, scaffold-grade rendering (`JSON.stringify` for rights), and zero mutation affordances. B1 + B2 concerns shipped the server-side mutation contract — `POST /api/offers/[id]/accept`, `POST /api/offers/[id]/counter`, `POST /api/offers/[id]/reject`, `POST /api/offers/[id]/cancel`, `POST /api/offers` — all behind `FFF_AUTH_WIRED` + `FFF_ECONOMIC_V1_UI`, zero UI callers today. This concern is the UI half of that contract.

**What C2 owns.** The detail surface. Proper rights renderer (replaces `JSON.stringify`). Money/expiry/actor display polish. State-transition buttons (accept / counter / reject / cancel) wired to the B1/B2 endpoints. Compose flow (new offer creation from `/asset/[id]` entry point + a new `/vault/offers/new` standalone composer). Counter composer modal inside the detail page. Rewrite of the `AssetRightsModule.OfferModal` fragment flagged as **REWRITE** (only non-DELETE consumer) in `P4_UI_DEPRECATION_AUDIT.md` §3.2 row 18.

**What C2 does NOT own.** List surface (filters / sort / pagination / handle lookup) — **C1**. Cron-driven auto-expire / auto-accept — **D**. Assignment UI — **4A.3**. Dispute UI — **4A.4**. Legacy `/api/special-offer/*` handler deletion — **4A.2.C**.

**Governance anchor.** Per `P4_UI_DEPRECATION_AUDIT.md` §3.1 row 1 (Draft 2, 2026-04-22): *"replacement page governed by concern 4A.2.C1/C2 against ECONOMIC_FLOW_v1.md §7 (shape), §8.1 (events), §12 (UX surfaces); product-surface name 'Special Offer' per A.0 D1."* Additional anchors: `ECONOMIC_FLOW_v1.md` §4 (offer state machine), §7.5 (rights template registry), §7.6 (counter round caps per `SPECIAL_OFFER_SPEC.md` §3 — 3-round max), §F15 (rights templates).

---

## §SCOPE

In scope:

1. **Rights renderer.** Replace the scaffold's `JSON.stringify(rights, null, 2)` with a structured renderer keyed on `rights.template`. Supported templates (locked for v1 per `SPECIAL_OFFER_SPEC.md` §3 and `ECONOMIC_FLOW_v1.md` §F15): `editorial_one_time`, `editorial_multi_publication`, `commercial_print`, `commercial_digital`, `syndication`, `broadcast`, `print_only`. Unknown templates fall back to a `template=<name>` line + the scaffold's JSON.stringify block as a safety net.
2. **Money + platform-fee display.** One-line money block: `${gross_fee_display} ${currency} · platform fee ${bps_pct}% · you receive ${net_to_creator} ${currency}` (for creator viewers) or `· you pay ${gross_with_buyer_markup} ${currency}` (for buyer viewers). Currency formatting via `Intl.NumberFormat` (stdlib; no new deps). The fee split references `PLATFORM_BUILD.md` Transaction Economics table (Direct 80/20).
3. **Expiry line polish.** Human-relative rendering via a small pure helper: `expires in 3 days, 4 hours`, `expired 2 days ago`, `expires today`. Fallback to `YYYY-MM-DD` if the delta exceeds ±30 days.
4. **Counterparty display.** Consumes the `/api/actors/handles` endpoint C1 is shipping (explicit dependency on C1 merge or on the endpoint landing on `main` ahead of C2's final merge — see §D10). Renders handle + display_name; falls back to ID prefix if RLS-gated.
5. **State-transition buttons.** Four buttons, all rendered against the current offer state + current user's role per the authority table at `ECONOMIC_FLOW_v1.md` §4.2:
   - **Accept** — visible when `state === 'pending' || state === 'countered'` AND (current user is the party the offer is awaiting). Hits `POST /api/offers/[id]/accept`. The accept RPC may transition to `accepted_pending_checkout` or `accepted` depending on whether a Stripe capture is needed — this concern does NOT handle the checkout handoff (see §D11). On success, refetch the detail row and rerender.
   - **Counter** — same visibility as Accept. Opens a counter composer modal (see §F5). Hits `POST /api/offers/[id]/counter` on submit.
   - **Reject** — same visibility as Accept. Opens a confirmation dialog (plain `<dialog>` element). Hits `POST /api/offers/[id]/reject` on confirm.
   - **Cancel** — visible when `state === 'pending' || state === 'countered'` AND current user is the party that last proposed. Hits `POST /api/offers/[id]/cancel`.
6. **Counter composer modal.** Native `<dialog>` element with a single numeric input (the counter amount), an optional note field (≤ 500 chars), and a submit button. Client-side validation: amount > 0, amount ≠ current offer amount, counter round ≤ 3 per thread. Server is the authority on round-limit enforcement — the client check is a UX courtesy.
7. **Reject confirmation dialog.** Native `<dialog>` element with "Reject this offer? This is terminal." + confirm / cancel buttons.
8. **Compose flow — two entry points:**
   a. **`/asset/[id]` REWRITE.** Rewire `src/components/asset/AssetRightsModule.tsx` `OfferModal` sub-component (flagged REWRITE in audit §3.2) — the submit handler currently sets a local `submitted` state without calling any API. Replace with a `POST /api/offers` call. Do NOT reshape the modal UI; only swap the handler.
   b. **`/vault/offers/new` standalone composer.** New server-component wrapper at `src/app/vault/offers/new/page.tsx` (flag-gated per §F2 of SCAFFOLD directive) + a new client component `OfferComposerClient` that lets a signed-in buyer build a fresh offer against a specified asset or pack. Entry points: from `/vault/offers` list "New offer" button (visible in C1 only if C2 merges first; see §D12) and from any asset page.
9. **Error-state wiring for mutations.** All four mutation buttons surface a single error line above the button strip: plain text, one of `Could not accept offer.` / `Could not counter offer.` / `Could not reject offer.` / `Could not cancel offer.`. Detailed error codes from the server are mapped to human sentences; the 4-letter error code is shown in a `<details>` disclosure for support handoff.
10. **Tests.** Pure-helper coverage per the SCAFFOLD §R6-pure pattern. No RTL, no jsdom. Coverage budget: ~28 new test cases.

Out of scope (enforced at review):

- List surface enrichments (filters, sort, pagination, handle lookup endpoint) — **C1**.
- Auto-expire / auto-accept state transitions — **D**.
- Stripe-capture UI on accept → checkout handoff — deferred to a dedicated **checkout-UI concern** after C1+C2+D merge.
- Rights-template editor (lets creators define custom rights) — **far future**; v1 uses the fixed template registry at `ECONOMIC_FLOW_v1.md` §F15.
- Optimistic UI updates — v2+; every mutation refetches the full detail row on success.
- Touch / mobile breakpoint polish — deferred to Phase B.
- Dispute initiation from the offer surface — the dispute surface is assignment-scoped, not offer-scoped; **4A.4**.
- Assignment preview on accept — v2+; accept transitions to `accepted_pending_checkout` and the UI simply refetches.

---

## §NON-SCOPE — explicit denials

| Request | Refusal reason |
|---|---|
| "Add a rights-template editor" | v1 registry is fixed. Editor is far future. |
| "Swap the native `<dialog>` for a Radix / Headless UI modal" | §D3 no-new-deps inherited. |
| "Add optimistic state transitions" | v2+. Server roundtrip + refetch is the v1 shape. |
| "Handle the Stripe capture flow inline on accept" | Checkout handoff is a dedicated concern. |
| "Add keyboard shortcuts (A=accept, R=reject)" | Accessibility + shortcut concerns are separate. |
| "Persist counter-composer draft in localStorage" | v2+. |
| "Add a Wizard for the compose flow (multi-step)" | Brutalist baseline. Single form, single submit. |
| "Derive rights-display fields via an LLM call" | No. Fixed template registry renders deterministically. |

---

## §REVISIONS

(None yet — directive is Draft 1.)

---

## §F — Functional requirements

### §F1 — `OfferDetailClient` rewrite

**File:** `src/app/vault/offers/[id]/_components/OfferDetailClient.tsx` (existing scaffold — rewrite).

Structure (§R6-pure):

- Component shell owns: `useSession()`, fetch of `/api/offers/[id]`, reducer for local mutation state (`idle` / `submitting` / `error`), four mutation handlers.
- Pure helper: `renderOfferDetailBody(view: OfferDetailView, selfUserId: string, handles: HandleMap, mutationState: MutationState): ReactElement`.
- View state: `loading` / `error: <code>` / `not_found` / `loaded: { offer: OfferRow, handles: HandleMap }`.
- Mutation handlers: `onAccept()`, `onCounter(amount, note)`, `onReject()`, `onCancel()`. Each fires the corresponding POST, awaits response, refetches the detail row on success, surfaces error on failure.

**LoC budget:** ~520 LoC (component + pure helper combined; replaces the scaffold's ~180 LoC).

### §F2 — Rights renderer

**File:** `src/lib/offer/rights-display.ts` (new) + `src/lib/offer/__tests__/rights-display.test.ts`.

Pure function `renderRights(rights: RightsShape): ReactElement` keyed on `rights.template`. One case per supported template; `default` branch renders the JSON fallback.

**LoC budget:** ~180 LoC code + ~120 LoC tests.

### §F3 — Money + expiry helpers

**Files:**
- `src/lib/offer/money-display.ts` (new) + test — `formatGrossFee(gross_fee, currency, platform_fee_bps, viewer_role)`. ~70 LoC code + ~80 LoC test.
- `src/lib/offer/expiry-display.ts` (new) + test — `formatExpiry(expires_at: string, now: Date): string`. ~60 LoC code + ~80 LoC test (includes time-mock via `vi.setSystemTime`).

### §F4 — State-transition button strip

**File:** `src/app/vault/offers/[id]/_components/OfferActions.tsx` (new).

Receives the current offer, current user role, and the four mutation handlers. Renders the button strip per the visibility matrix in §SCOPE item 5. Buttons are plain `<button>` with `border border-black` baseline. Disabled state during mutation submit.

**LoC budget:** ~140 LoC + ~100 LoC test.

### §F5 — Counter composer modal

**File:** `src/app/vault/offers/[id]/_components/CounterComposerDialog.tsx` (new).

Native `<dialog>` element. Amount input + optional note textarea + submit button. Local validation per §SCOPE item 6. Ref-forwarded open / close methods so the parent component controls visibility.

**LoC budget:** ~160 LoC + ~100 LoC test.

### §F6 — Reject confirmation dialog

**File:** `src/app/vault/offers/[id]/_components/RejectConfirmDialog.tsx` (new).

Native `<dialog>` element. Copy + confirm / cancel buttons. Symmetric with §F5 on structure.

**LoC budget:** ~90 LoC + ~60 LoC test.

### §F7 — `POST /api/offers` compose from `/asset/[id]` REWRITE

**File:** `src/components/asset/AssetRightsModule.tsx` (existing — scope: `OfferModal` sub-component at L~185).

- Rewire the submit handler. Current shape sets `submitted: true` in local state without network activity.
- New shape: calls `POST /api/offers` with a body assembled from the modal form state (asset_id, rights template, gross_fee, currency, expires_at, note), surfaces success / error.
- On success, redirects to `/vault/offers/[new_offer_id]` via `router.push()`.
- Preserve the modal's existing UI shell + form fields. Only the submit handler changes.

**LoC budget:** ~80 LoC diff on `AssetRightsModule.tsx`; test coverage goes through the existing test file if present, else new.

### §F8 — `/vault/offers/new` standalone composer

**Files:**
- `src/app/vault/offers/new/page.tsx` (new) — server-component flag-gate wrapper, canonical shape from SCAFFOLD §F2. Takes `?asset=<id>` query param to pre-fill.
- `src/app/vault/offers/new/_components/OfferComposerClient.tsx` (new) — ~320 LoC client component. Form with asset/pack selector, rights template dropdown, amount input, expiry input, note textarea. Submits to `POST /api/offers`.
- Paired test file — ~200 LoC.

### §F9 — Styling baseline

Inherited verbatim from SCAFFOLD §F6 + C1 §F6. Native `<dialog>` elements styled with the same 1px black border, no rounded corners, no shadow, `max-w-lg mx-auto` container. Error lines `text-red-700` are **not allowed** — per the design lock, destructive maps to black (`PLATFORM_BUILD.md` Design System Lock). Errors use bold black + a short error-code disclosure.

### §F10 — Tests

All tests follow the SCAFFOLD §R6-pure pattern.

Coverage summary (~28 new cases):
- Rights renderer: 7 (one per supported template) + 1 unknown-template fallback.
- Money display: 4 (buyer view / creator view / EUR / USD).
- Expiry display: 6 (past / future / today / day-plural / hour / fallback).
- OfferActions visibility: 6 (one per state × role combination).
- CounterComposerDialog: 3 (valid / invalid amount / round-limit warning).
- RejectConfirmDialog: 1 (confirm fires handler).

Extends `OfferDetailClient.test.tsx` with 4 cases (accept flow / counter flow / reject flow / cancel flow — all integration-level within the pure-helper pattern).

Plus paired tests for §F7 REWRITE (1 case) and §F8 composer (3 cases).

**Test baseline.** Prompt 1 captures the post-SCAFFOLD + post-C1 (if C1 merges first) baseline.

---

## §AC — Acceptance criteria (for exit report)

| # | Criterion | Verification |
|---|---|---|
| AC1 | `OfferDetailClient` renders structured rights per template | smoke + visual |
| AC2 | Money line renders correct viewer-role fee math | test |
| AC3 | Expiry line renders relative time for ±30d deltas | test |
| AC4 | Counterparty handle renders (real, not ID prefix) when RLS-visible | smoke |
| AC5 | Accept button visible only under the right state × role combos | test |
| AC6 | Accept button hits `POST /api/offers/[id]/accept` and refetches on success | test + curl |
| AC7 | Counter modal validates amount > 0 and ≠ current client-side | test |
| AC8 | Counter submit hits `POST /api/offers/[id]/counter` | test |
| AC9 | Reject dialog requires confirm click before firing | test |
| AC10 | Cancel button visible only when caller proposed last | test |
| AC11 | Compose from `/asset/[id]` modal hits `POST /api/offers` on submit | test |
| AC12 | Compose from `/vault/offers/new` hits `POST /api/offers` and redirects on success | test |
| AC13 | Scaffold's `OfferDetailClient` `JSON.stringify` fallback is gone | grep |
| AC14 | No imports of `@supabase/ssr` or `next/headers` | grep |
| AC15 | No new dependencies in `package.json` | git diff |
| AC16 | Error color is black, not red | grep for `text-red` and `bg-red` |
| AC17 | Native `<dialog>` used — no Radix / Headless / custom modal | grep |
| AC18 | Vitest baseline ≥ captured floor + 28 new cases, 0 failing | `npm run test` |
| AC19 | `npm run build` clean | CI / local |
| AC20 | No new lint errors beyond the floor at §AC12 | `npm run lint` |
| AC21 | `/api/special-offer/*` files not touched (owned by 4A.2.C) | git diff |
| AC22 | List surface files (`OffersListClient.tsx`, `OffersFilterBar.tsx`, `OffersSortControl.tsx`, `OfferRow.tsx`) not modified (C1 owns) | git diff |
| AC23 | Cron / RPC changes not introduced (D owns) | git diff |

---

## §D — Directives

- **§D1–§D4, §D9 (inherited).** From SCAFFOLD: no SSR auth; server-component gates only; no new deps; brutalist baseline; no cleanup drift.
- **§D5 (new).** Rights rendering is template-keyed. Every supported template has a named case; adding a new template is a registry edit + a new case, never an inline conditional.
- **§D6 (new).** Mutation handlers refetch on success. No optimistic updates. No client-side derivation of the post-transition state.
- **§D7 (new).** Error color is black. The Design System Lock at `PLATFORM_BUILD.md` is authoritative — destructive maps to black. Any `text-red-*` / `bg-red-*` class introduced in this concern is a lint-gated error.
- **§D8 (new).** The `AssetRightsModule.OfferModal` REWRITE touches the submit handler only. The modal shell, form fields, and visual layout do not change in this concern.
- **§D9 (new).** Counter-round limit enforcement is server-authoritative (per B2 `rpc_counter_offer` check). Client-side round-count check is a UX courtesy; server rejection is the source of truth and must surface cleanly.
- **§D10 (dependency).** The `/api/actors/handles` endpoint from C1 is a hard dependency for handle rendering. If C1 has not merged by the time C2 reaches Prompt 6, C2 either (a) waits for C1 merge, or (b) renders handles via ID-prefix fallback with a TODO comment and adds a blocking item to the exit report. Founder picks at Gate 2.
- **§D11 (scope-boundary).** The accept handler surfaces the server's returned state verbatim. If accept transitions to `accepted_pending_checkout`, the UI simply refetches and renders the new state chip. The `/checkout/[asset_id]` handoff, Stripe capture UX, and post-checkout redirect are **out of scope for C2** and belong to a follow-up checkout-UI concern.
- **§D12 (peer-concern seam).** The "New offer" button on the `/vault/offers` list page is owned by **C1**. C2's responsibility is the compose composer itself + the `/asset/[id]` modal entry point. If C1 merges first, C1 adds the list-page button wired to C2's `/vault/offers/new` route. If C2 merges first, C2's `/vault/offers/new` route is reachable only from `/asset/[id]` until C1 lands.

---

## §PROMPTS — execution sequence

| # | Title | Output | LoC est. |
|---|---|---|---|
| 1 | **Pre-flight audit** — post-SCAFFOLD + post-C1-if-merged baseline; confirm `JSON.stringify` is the only rights-render path; confirm `AssetRightsModule.OfferModal` still sets `submitted: true` (no intervening rewrite). | `§AUDIT-1` appended. | 0 |
| 2 | **Build `rights-display.ts`** + tests | module + test | ~300 |
| 3 | **Build `money-display.ts`** + `expiry-display.ts` + tests | 2 modules + 2 tests | ~290 |
| 4 | **Build `OfferActions.tsx`** + tests | component + test | ~240 |
| 5 | **Build `CounterComposerDialog.tsx`** + `RejectConfirmDialog.tsx` + tests | 2 components + 2 tests | ~410 |
| 6 | **Rewrite `OfferDetailClient.tsx`** to compose all above + wire mutations + refetch-on-success | full rewrite | ~520 |
| 7 | **REWRITE `AssetRightsModule.OfferModal`** submit handler | diff + test | ~80 |
| 8 | **Build `/vault/offers/new` page + `OfferComposerClient.tsx`** + tests | page + component + test | ~600 |
| 9 | **Extend `OfferDetailClient.test.tsx`** with mutation flow cases | test diff | ~200 |
| 10 | **Verification pass** — full test suite + build + lint | text-only report | 0 |
| 11 | **Exit report** — mirror SCAFFOLD exit structure | new doc `P4_CONCERN_4A_2_C2_EXIT_REPORT.md` | ~250 |

**Total LoC budget:** ~2 900 (larger than C1 due to the compose flow + modal family; test mass ~55 %).

**Total prompts:** 11. Wall-clock estimate: 5-6 days solo, verdicts within ~2 hours.

---

## §APPROVAL GATES

- **Gate 0 (now):** founder verdict on this directive.
- **Gate 1:** after Prompt 1 — if `AssetRightsModule.OfferModal` has drifted since the 2026-04-20 audit, pause and rescope §F7.
- **Gate 2:** after Prompt 5 — if C1 has not merged, founder picks between waiting and proceeding with ID-prefix handle fallback per §D10.
- **Gate 3:** after Prompt 10 — verification pass must show zero regression beyond the AC18/AC20 floor.

---

## §OPEN-Q — founder decisions owed before Gate 0 closes

| # | Question | Options |
|---|---|---|
| 1 | Branch name | `feat/p4-offers-c2-detail` proposed. |
| 2 | Sequencing vs C1 | Propose: strict parallel, disjoint files (C1 owns list + helpers endpoint, C2 owns detail + mutations + compose). Accept? |
| 3 | Sequencing vs 4A.2.C retirement | Propose: C2 merges before 4A.2.C; the `AssetRightsModule.OfferModal` REWRITE must land in C2, not C. Accept? |
| 4 | Native `<dialog>` element support matrix | v1 support matrix is modern evergreen Chromium / Firefox / Safari. IE / legacy webviews out of scope. Accept? |
| 5 | Compose route path | `/vault/offers/new` proposed. Alternative `/offers/new` considered and rejected (non-vault parent). Accept? |
| 6 | Accept-flow Stripe handoff | Propose: out of scope per §D11 — followup concern. Accept? |
| 7 | Counter-round client check | Propose: UX courtesy only; server is the source of truth per §D9. Accept? |

---

**End of directive.**
