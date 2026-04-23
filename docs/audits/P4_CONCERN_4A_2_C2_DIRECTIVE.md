# P4 Concern 4A.2.C2 — Offer detail + mutation UI (`/vault/offers/[id]` + compose flow)

**Changelog:** Draft 2 — replaced `'pending'` with `'sent'` in §SCOPE item 5 (Accept and Cancel visibility expressions) to align with the `offer_state` enum (DDL L37-44).

**Status:** DRAFT 3.1, 2026-04-23 — Prompt 1 baseline captured: AC18_floor = 1276, AC20_floor = 68. V9/V10/V11/V13/V14 PASS; V12 SOFT — `/api/offers/party-profiles` (file `src/app/api/offers/party-profiles/route.ts`) + `PartyProfileMap` type absent on `main`; §D10 stub-fallback path active, carry-forward to Gate 2 per §APPROVAL GATES. Gate 0 closed 2026-04-22; Gate 1 pending Prompt 2 entry.
**Branch:** `feat/p4-offers-c2-detail` (to be cut from `main` at Gate 0 approval)
**Predecessor:** P4 Concern 4A.2.SCAFFOLD (minimal `OfferDetailClient`) — closed 2026-04-22
**Peer concerns (parallel):** 4A.2.C1 (list UI enrichment), 4A.2.D (offer cron)
**Successor:** 4A.2.C — legacy `/api/special-offer/*` retirement (directive: `P4_UI_DEPRECATION_AUDIT.md` Draft 2, Gate 3 approved 2026-04-22).

---

## §CONTEXT

The SCAFFOLD concern shipped a brutalist `OfferDetailClient` at `src/app/vault/offers/[id]/_components/OfferDetailClient.tsx` with a 404 / loading / error / loaded trinity, scaffold-grade rendering (`JSON.stringify` for rights), and zero mutation affordances. B1 + B2 concerns shipped the server-side mutation contract — `POST /api/offers/[id]/accept`, `POST /api/offers/[id]/counter`, `POST /api/offers/[id]/reject`, `POST /api/offers/[id]/cancel`, `POST /api/offers` — all behind `FFF_AUTH_WIRED` + `FFF_ECONOMIC_V1_UI`, zero UI callers today. This concern is the UI half of that contract.

**What C2 owns.** The detail surface. Proper rights renderer (replaces `JSON.stringify`). Money/expiry/actor display polish. State-transition buttons (accept / counter / reject / cancel) wired to the B1/B2 endpoints. Compose flow (new offer creation from `/asset/[id]` entry point + a new `/vault/offers/new` standalone composer). Counter composer modal inside the detail page. Rewrite of the `AssetRightsModule.OfferModal` fragment flagged as **REWRITE** (only non-DELETE consumer) in `P4_UI_DEPRECATION_AUDIT.md` §3.2 row 18.

**What C2 does NOT own.** List surface (filters / sort / pagination / handle lookup) — **C1**. Cron-driven auto-expire / auto-accept — **D**. Assignment UI — **4A.3**. Dispute UI — **4A.4**. Legacy `/api/special-offer/*` handler deletion — **4A.2.C**.

**Governance anchor.** Per `P4_UI_DEPRECATION_AUDIT.md` §3.1 row 1 (Draft 2, 2026-04-22): *"replacement page governed by concern 4A.2.C1/C2 against ECONOMIC_FLOW_v1.md §7 (shape), §8.1 (events), §12 (UX surfaces); product-surface name 'Special Offer' per A.0 D1."* Additional anchors: `ECONOMIC_FLOW_v1.md` §4 (offer state machine), §F15 + §F15.1.a–d (rights template registry + per-template params/render contract); `docs/specs/SPECIAL_OFFER_SPEC.md` §C.3 L109-111 (counter round caps — 3-round max).

---

## §SCOPE

In scope:

1. **Rights renderer.** Replace the scaffold's `JSON.stringify(rights, null, 2)` with a structured renderer keyed on `rights.template`. Supported templates (locked for v1 per `ECONOMIC_FLOW_v1.md` §F15 + §F15.1.a–d): `editorial_one_time`, `editorial_with_archive_12mo`, `commercial_restricted`, `custom`. Unknown templates fall back to the §F15.1.f render shape (production appearance = P1 incident trigger per §F15.1.f).
2. **Money + platform-fee display.** One-line money block: `${gross_fee_display} ${currency} · platform fee ${bps_pct}% · you receive ${net_to_creator} ${currency}` (for creator viewers) or `· you pay ${gross_with_buyer_markup} ${currency}` (for buyer viewers). Currency formatting via `Intl.NumberFormat` (stdlib; no new deps). The fee split references `PLATFORM_BUILD.md` Transaction Economics table (Direct 80/20).
3. **Expiry line polish.** Human-relative rendering via a small pure helper: `expires in 3 days, 4 hours`, `expired 2 days ago`, `expires today`. Fallback to `YYYY-MM-DD` if the delta exceeds ±30 days.
4. **Counterparty display.** Consumes the `/api/offers/party-profiles` endpoint C1 is shipping (explicit dependency on C1 merge or on the endpoint landing on `main` ahead of C2's final merge — see §D10). Renders handle + display_name; falls back to ID prefix if RLS-gated.
5. **State-transition buttons.** Four buttons, all rendered against the current offer state + current user's role per the authority table at `ECONOMIC_FLOW_v1.md` §4:
   - **Accept** — visible when `state === 'sent' || state === 'countered'` AND (current user is the party the offer is awaiting). Hits `POST /api/offers/[id]/accept`. The accept RPC may transition to `accepted_pending_checkout` or `accepted` depending on whether a Stripe capture is needed — this concern does NOT handle the checkout handoff (see §D11). On success, refetch the detail row and rerender.
   - **Counter** — same visibility as Accept. Opens a counter composer modal (see §F5). Hits `POST /api/offers/[id]/counter` on submit.
   - **Reject** — same visibility as Accept. Opens a confirmation dialog (plain `<dialog>` element). Hits `POST /api/offers/[id]/reject` on confirm.
   - **Cancel** — visible when `state === 'sent' || state === 'countered'` AND current user is the party that last proposed. Hits `POST /api/offers/[id]/cancel`.
6. **Counter composer modal.** Native `<dialog>` element with a single numeric input (the counter amount), an optional note field (≤ 500 chars), and a submit button. Client-side validation: amount > 0, counter round ≤ 3 per thread. Spec is silent on same-amount counters — client accepts them as valid-but-pointless and relies on server-side `rpc_counter_offer` rejection if business rules apply. Server is the authority on round-limit enforcement — the client check is a UX courtesy.
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

- R1 (2026-04-21) — Draft 1. Initial authoring against SCAFFOLD §§F1-F10 + C1 §§F1-F6. Status: superseded.
- R2 (2026-04-22) — Draft 2. NEW-B2 fallout from C1 Draft 3 Gate 0: `/api/actors/handles` route retired; C1 now ships `/api/offers/party-profiles` with `PartyProfileMap` response shape. Status: REJECTED at Gate 0 (20 active findings catalogued — see R3).
- R3 (2026-04-22) — Draft 3.0. Catalog v2.1 applied: 11 blocking + 7 substantive + 2 minor findings closed (NEW-B1-B5, B7-B12, S1-S7, M1-M2). NEW-B6 cleared at Gate 0 verification (`POST /api/offers/[id]/reject` canonical route confirmed). §F15.1 (per-template params + render contract) ratified into `ECONOMIC_FLOW_v1.md` revision 9 before this Draft. Status: APPROVED at Gate 0 (2026-04-22) — §OPEN-Q rows 1-7 ratified per appended decisions.
- R4 (2026-04-23) — Draft 3.1. Prompt 1 baseline captured: AC18_floor = 1276, AC20_floor = 68. V9/V10/V11/V13/V14 PASS; V12 SOFT trigger — `/api/offers/party-profiles` (file `src/app/api/offers/party-profiles/route.ts`) + `PartyProfileMap` type (`src/lib/offer/`) absent on `main`; §D10 stub-fallback path active, carry-forward to Gate 2 per §APPROVAL GATES. Status: APPROVED at Prompt 1 baseline lock — Gate 1 verdict pending Prompt 2 entry.

---

## §PROMPT 1 PREREQUISITES

Prompt 1 (pre-flight audit per §PROMPTS) is gated on six V-checks + two baseline captures. Hard-HALT gates (V9/V10/V13) block Prompt 2 entry on failure; soft-fail gates (V11/V12/V14) re-scope affected downstream work without HALT. Each baseline capture must be locked into the §STATUS header as **Draft 3.1** before Gate 1 closes.

**V9 — Rights template consistency.**

- **Purpose:** Verify §F15.1.a–d template names match `ECONOMIC_FLOW_v1.md §7` L94 rights-jsonb union literal. NEW-B1 regression trigger.
- **Verification command:** `grep -nE "'editorial_one_time'|'editorial_with_archive_12mo'|'commercial_restricted'|'custom'" docs/specs/ECONOMIC_FLOW_v1.md`
- **Expected result:** Four template names present in §7 L94 union literal AND matching §F15.1.a/b/c/d subsection headings at L406/428/446/474.
- **Action on failure:** HARD HALT — block Prompt 2 entry; report divergence; re-confirm §F15.1 ratification before resuming.

**V10 — `OfferState` / `OfferRow` type source.**

- **Purpose:** Verify canonical type definitions at `src/lib/offer/types.ts` (singular `offer` — API route paths stay plural per Next.js convention).
- **Verification command:** `grep -nE "^export (type|interface) Offer(State|Row)" src/lib/offer/types.ts`
- **Expected result:** Both `OfferState` and `OfferRow` exported from `src/lib/offer/types.ts`.
- **Action on failure:** HARD HALT — if either type renamed/moved/sourced from a generated db-types file, re-anchor §F1/§F2/§F4 import paths and re-release directive.

**V11 — `AssetRightsModule.OfferModal` submit-handler shape unchanged.**

- **Purpose:** Verify stub state (`submitted: true`); no intervening concern has wired a production `fetch` call inside the modal body.
- **Verification command:** `grep -nE "setSubmitted\(true\)|fetch\(" src/components/asset/AssetRightsModule.tsx`
- **Expected result:** `setSubmitted(true)` present in `OfferModal` body; no production `fetch(` call inside the same function.
- **Action on failure:** SOFT — re-scope Prompt 1 §F1 to handle-prop rename only; defer submit-handler refactor to §D10.

**V12 — C1 `/api/offers/party-profiles` endpoint shipped.**

- **Purpose:** Verify C1 Draft 3.1 successor shipped the endpoint + `PartyProfileMap` type before C2 Prompt 6 reaches the handle-rendering path.
- **Verification command:** `ls src/app/api/offers/party-profiles/route.ts` AND `grep -rnE "^export (type|interface) PartyProfileMap" src/lib/offer/`
- **Expected result:** Endpoint handler file present AND `PartyProfileMap` type exported.
- **Action on failure:** SOFT — proceed with §D10 stub fallback per C1 handoff; do not block Prompt 1 kickoff.

**V13 — P4 4A.2 concern-ladder B1/B2 RPC names on `main`.**

- **Purpose:** Verify the 5 offer-mutation RPCs shipped in B1 + B2 migrations.
- **Verification command:** `grep -nE "CREATE OR REPLACE FUNCTION public\.rpc_(accept|counter|reject|cancel)_offer\b" supabase/migrations/20260421000011_rpc_offer_business.sql` AND `grep -n "rpc_accept_offer_commit" supabase/migrations/20260421000012_offer_accept_stripe.sql`
- **Expected result:** Four RPCs at `20260421000011_rpc_offer_business.sql` (`rpc_accept_offer`, `rpc_counter_offer`, `rpc_reject_offer`, `rpc_cancel_offer`) + one Stripe variant `rpc_accept_offer_commit` at `20260421000012_offer_accept_stripe.sql`.
- **Action on failure:** HARD HALT — B1/B2 not shipped to `main`; scope re-evaluation required (C2 mutation handlers cannot target non-existent RPCs).

**V14 — SCAFFOLD `OfferDetailClient.tsx` rights-render placeholder unchanged.**

- **Purpose:** Verify scaffold-grade `JSON.stringify(offer.rights, null, 2)` still present (no intervening concern has replaced the stub).
- **Verification command:** `grep -n "JSON.stringify(offer.rights" src/app/vault/offers/[id]/_components/OfferDetailClient.tsx`
- **Expected result:** At least one hit (line-drift tolerance: content is the signal, not the line number).
- **Action on failure:** SOFT — §F2 (rights-display implementation) re-scopes against whatever shape now exists in the SCAFFOLD component; Prompt 6 (§F1 rewrite) proceeds under the revised §F2 contract.

### Baseline capture (feeds AC18 + AC20)

At Prompt 1 kickoff, post-V9–V14 pass:

1. Run `npm run test` — capture **passing count** (post-SCAFFOLD + post-C1-if-merged baseline). This becomes the floor referenced by AC18 (anchor: `grep -n "AC18" docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md`).
2. Run `npm run lint` — capture **error count**. This becomes the ceiling referenced by AC20 (anchor: `grep -n "AC20" docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md`).
3. Replace `TBD-at-Prompt-1` tokens across the §STATUS header (anchor: `grep -n "^\*\*Status:\*\*" docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md`), AC18 row, and AC20 row with the captured numbers.
4. Re-release directive as **Draft 3.1** before Gate 1 verdict.
5. `§AUDIT-1` appended per §PROMPTS item 1 records the raw captured numbers as audit-trail evidence.

---

## §F — Functional requirements

### §F1 — `OfferDetailClient` rewrite

**File:** `src/app/vault/offers/[id]/_components/OfferDetailClient.tsx` (existing scaffold — rewrite).

Structure (§R6-pure):

- Component shell owns: `useSession()`, fetch of `/api/offers/[id]`, reducer for local mutation state (`idle` / `submitting` / `error`), four mutation handlers.
- Pure helper: `renderOfferDetailBody(view: OfferDetailView, selfUserId: string, profiles: PartyProfileMap, mutationState: MutationState): ReactElement`.
- View state: `loading` / `error: <code>` / `not_found` / `loaded: { offer: OfferRow, profiles: PartyProfileMap }`.
- Mutation handlers: `onAccept()`, `onCounter(amount, note)`, `onReject()`, `onCancel()`. Each fires the corresponding POST, awaits response, refetches the detail row on success, surfaces error on failure.
- State-chip rendering: imports `offerStateChip` from `@/lib/offer/state-copy` per C1 Draft 3.1 §F4. All offer-state rendering in the detail view passes through this SSOT; no raw enum values (`'sent'`, `'countered'`, etc.) appear in user-facing copy.

**LoC budget:** ~520 LoC (component + pure helper combined; replaces the scaffold's ~180 LoC).

### §F2 — Rights renderer

**File:** `src/lib/offer/rights-display.ts` (new) + `src/lib/offer/__tests__/rights-display.test.ts`.

Pure function `renderRights(rights: RightsShape): ReactElement` keyed on `rights.template`. Each supported template's render output MUST match the ordered-line render-shape spec at `ECONOMIC_FLOW_v1.md`:

- `editorial_one_time` → §F15.1.a render-shape (4 lines).
- `editorial_with_archive_12mo` → §F15.1.b render-shape (6 lines = F15.1.a lines 1–4 + 2 archive lines).
- `commercial_restricted` → §F15.1.c render-shape (7 lines + conditional `is_transfer` line 8).
- `custom` → §F15.1.d render-shape (3 lines + conditional `is_transfer` line 4).

`default` branch → §F15.1.f unknown-template fallback shape (3 lines). Production surfacing of this branch is a P1 incident trigger per §F15.1.f.

Server-side `params`-field validation at `offer.created` / `offer.countered` emits the error codes enumerated in §F15.1.e (`PARAMS_UNKNOWN_KEY`, `PARAMS_MISSING_FIELD`, `PARAMS_INVALID_VALUE`, `TEMPLATE_UNKNOWN`, `TRANSFER_NOT_ALLOWED`). The client renderer assumes server-validated input; defensive re-validation is not required.

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

Inherited verbatim from SCAFFOLD §F6. Native `<dialog>` elements styled with the same 1px black border, no rounded corners, no shadow, `max-w-lg mx-auto` container. Error lines `text-red-700` are **not allowed** — per the design lock, destructive maps to black (`PLATFORM_BUILD.md` Design System Lock). Errors use bold black + a short error-code disclosure.

### §F10 — Tests

All tests follow the SCAFFOLD §R6-pure pattern.

Coverage summary (25 new cases — see breakdown below; total C2 vitest additions including §F1/§F7/§F8 extensions = 33 per AC18):
- Rights renderer: 4 (one per canonical template per §F15.1.a–d) + 1 unknown-template fallback (§F15.1.f).
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
| AC1 | `OfferDetailClient` renders structured rights per template | unit tests in `src/lib/offer/__tests__/rights-display.test.ts` — one per template (§F15.1.a–d) + unknown fallback (§F15.1.f) |
| AC2 | Money line renders correct viewer-role fee math | test |
| AC3 | Expiry line renders relative time for ±30d deltas | test |
| AC4 | Counterparty handle renders (real, not ID prefix) when RLS-visible | integration test: seed `PartyProfileMap` fixture with known `username` / `display_name`; assert `renderOfferDetailBody` output contains those strings |
| AC5 | Accept button visible only under the right state × role combos | test |
| AC6 | Accept button hits `POST /api/offers/[id]/accept` and refetches on success | integration test — mutation handler fires `fetch` to `/api/offers/[id]/accept` with correct body; on 200, refetch invoked exactly once |
| AC7 | Counter modal validates amount > 0 client-side | test |
| AC8 | Counter submit hits `POST /api/offers/[id]/counter` | test |
| AC9 | Reject dialog requires confirm click before firing | test |
| AC10 | Cancel button visible only when caller proposed last | test |
| AC11 | Compose from `/asset/[id]` modal hits `POST /api/offers` on submit | test |
| AC12 | Compose from `/vault/offers/new` hits `POST /api/offers` and redirects on success | test |
| AC13 | Scaffold's `OfferDetailClient` `JSON.stringify` fallback is gone | grep |
| AC14 | No imports of `@supabase/ssr` or `next/headers` | grep |
| AC15 | No new dependencies in `package.json` | git diff |
| AC16 | Error color is black, not red | `grep -rEn "text-red-\|bg-red-" src/app/vault/offers/[id]/ src/app/vault/offers/new/ src/components/asset/AssetRightsModule.tsx` returns zero |
| AC17 | Native `<dialog>` used — no Radix / Headless / custom modal | `grep -rEn "from ['\"]@(radix-ui\|headlessui)" src/app/vault/offers/[id]/ src/app/vault/offers/new/` returns zero (scope: C2-introduced modal surfaces only; `AssetRightsModule.tsx` modal architecture preserved per §F7 REWRITE scope — submit-handler only) |
| AC18 | Vitest baseline ≥ **1276** + 33 new cases (25 per §F10 explicit list + 4 `OfferDetailClient` mutation extensions + 4 §F7/§F8 composer tests), 0 failing | `npm run test` |
| AC19 | `npm run build` clean | CI / local |
| AC20 | No new lint errors beyond the **SCAFFOLD / C1 exit lint floor (68)** | `npm run lint` |
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
- **§D10 (dependency).** The `/api/offers/party-profiles` endpoint from C1 is a hard dependency for handle rendering. If C1 has not merged by the time C2 reaches Prompt 6, C2 either (a) waits for C1 merge, or (b) renders handles via ID-prefix fallback with a TODO comment and adds a blocking item to the exit report. Founder picks at Gate 2.
- **§D11 (scope-boundary).** The accept handler surfaces the server's returned state verbatim. If accept transitions to `accepted_pending_checkout`, the UI simply refetches and renders the new state chip. The `/checkout/[asset_id]` handoff, Stripe capture UX, and post-checkout redirect are **out of scope for C2** and belong to a follow-up checkout-UI concern.
- **§D12 (peer-concern seam).** The "New offer" button on the `/vault/offers` list page is owned by **C1**. C2's responsibility is the compose composer itself + the `/asset/[id]` modal entry point. If C1 merges first, C1 adds the list-page button wired to C2's `/vault/offers/new` route. If C2 merges first, C2's `/vault/offers/new` route is reachable only from `/asset/[id]` until C1 lands.

---

## §PROMPTS — execution sequence

**LoC estimate methodology.** Per-prompt LoC = sum of §F body LoC budget for code + test LoC where specified. Rounded to nearest 10 LoC. Rollup total = sum of per-prompt estimates (no markup; corrected from pre-Phase-6 `~2 900` rollup to precise itemized sum 2 890).

| # | Title | Output | §F / §AC anchors | Exit artifact | LoC est. |
|---|---|---|---|---|---|
| 1 | **Pre-flight audit** — V9–V14 per §PROMPT 1 PREREQUISITES + AC18/AC20 baseline capture (see §PROMPT 1 PREREQUISITES for gate details) | `§AUDIT-1` appended (in-directive) | §PROMPT 1 PREREQUISITES (V9–V14); AC18 + AC20 baseline-capture anchors | in-directive `§AUDIT-1` section | 0 |
| 2 | **Build `rights-display.ts`** + tests | module + test | §F2; AC1 | `src/lib/offer/rights-display.ts` + `src/lib/offer/__tests__/rights-display.test.ts` | 300 |
| 3 | **Build `money-display.ts`** + `expiry-display.ts` + tests | 2 modules + 2 tests | §F3; AC2, AC3 | `src/lib/offer/money-display.ts`, `src/lib/offer/expiry-display.ts` + paired `__tests__/*.test.ts` | 290 |
| 4 | **Build `OfferActions.tsx`** + tests | component + test | §F4; AC5, AC10 | `src/app/vault/offers/[id]/_components/OfferActions.tsx` + paired `__tests__/OfferActions.test.tsx` | 240 |
| 5 | **Build `CounterComposerDialog.tsx`** + `RejectConfirmDialog.tsx` + tests | 2 components + 2 tests | §F5, §F6; AC7, AC9 | `src/app/vault/offers/[id]/_components/CounterComposerDialog.tsx`, `RejectConfirmDialog.tsx` + paired tests | 410 |
| 6 | **Rewrite `OfferDetailClient.tsx`** to compose all above + wire mutations + refetch-on-success | full rewrite | §F1; AC4, AC6, AC8 | `src/app/vault/offers/[id]/_components/OfferDetailClient.tsx` (rewrite of existing scaffold) | 520 |
| 7 | **REWRITE `AssetRightsModule.OfferModal`** submit handler | diff + test | §F7; AC11 | `src/components/asset/AssetRightsModule.tsx` (submit-handler diff only; modal shell preserved) | 80 |
| 8 | **Build `/vault/offers/new` page + `OfferComposerClient.tsx`** + tests | page + component + test | §F8; AC12 | `src/app/vault/offers/new/page.tsx`, `src/app/vault/offers/new/_components/OfferComposerClient.tsx` + paired test | 600 |
| 9 | **Extend `OfferDetailClient.test.tsx`** with mutation flow cases | test diff | §F10 (OfferDetailClient extensions, 4 cases); AC6, AC8 | `src/app/vault/offers/[id]/_components/__tests__/OfferDetailClient.test.tsx` (extension; base file exists at HEAD) | 200 |
| 10 | **Verification pass** — full test suite + build + lint + AC13–AC23 mechanical greps | text-only report | AC13–AC23 (mechanical verification) | in-session verification output (no committed artifact) | 0 |
| 11 | **Exit report** — mirror SCAFFOLD exit structure | new doc | full §AC table; §APPROVAL GATES closure | `docs/audits/P4_CONCERN_4A_2_C2_EXIT_REPORT.md` | 250 |

**Total LoC budget:** **2 890** (itemized sum). Corrected from pre-Phase-6 rollup `~2 900`.

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
| 1 | Branch name | `feat/p4-offers-c2-detail` proposed. **Ratified 2026-04-22: Accept.** |
| 2 | Sequencing vs C1 | Propose: strict parallel, disjoint files (C1 owns list + helpers endpoint, C2 owns detail + mutations + compose). Accept? **Ratified 2026-04-22: Accept — strict parallel, disjoint files.** |
| 3 | Sequencing vs 4A.2.C retirement | Propose: C2 merges before 4A.2.C; the `AssetRightsModule.OfferModal` REWRITE must land in C2, not C. Accept? **Ratified 2026-04-22: Accept — C2 merges before 4A.2.C; REWRITE lands in C2.** |
| 4 | Native `<dialog>` element support matrix | v1 support matrix is modern evergreen Chromium / Firefox / Safari. IE / legacy webviews out of scope. Accept? **Ratified 2026-04-22: Accept — modern evergreen Chromium/Firefox/Safari only.** |
| 5 | Compose route path | `/vault/offers/new` proposed. Alternative `/offers/new` considered and rejected (non-vault parent). Accept? **Ratified 2026-04-22: Accept — `/vault/offers/new`.** |
| 6 | Accept-flow Stripe handoff | Propose: out of scope per §D11 — followup concern. Accept? **Ratified 2026-04-22: Accept — out of scope per §D11.** |
| 7 | Counter-round client check | Propose: UX courtesy only; server is the source of truth per §D9. Accept? **Ratified 2026-04-22: Accept — UX courtesy (disabled Counter button + helper text at 3/3 rounds); server §D9 remains authoritative.** |

---

## §EXIT CRITERIA (Gate 0 → Gate 3)

Directive-level gate closure. Distinct from §AC (exit-report content the Claude Code agent proves at end of Prompt 10/11) — E-criteria are what founder verifies at Gates 1/2/3.

### E1 — §AC functional criteria green (AC1–AC12)

- **Criterion:** All 12 functional AC rows (AC1 through AC12) pass at end of Prompt 10 verification.
- **Verification:** Prompt 10 report enumerates each AC1–AC12 with PASS / FAIL + evidence (test output, integration run result, or mechanical check).
- **Expected:** 12/12 PASS.
- **Action on failure:** HARD HALT at Gate 3 — any FAIL blocks exit-report publication until resolved in a corrective prompt.

### E2 — §AC mechanical criteria green (AC13–AC23)

- **Criterion:** All 11 mechanical AC rows (AC13–AC23) pass via grep, git-diff, or CI/lint output.
- **Verification:** Prompt 10 mechanical greps return expected results per each AC's verification column.
- **Expected:** 11/11 PASS.
- **Action on failure:** HARD HALT at Gate 3.

### E3 — AC18/AC20 TBD resolution + Draft 3.1 re-release

- **Criterion:** AC18 vitest baseline and AC20 lint floor captured at Prompt 1 per §PROMPT 1 PREREQUISITES Baseline-capture sub-block; all `TBD-at-Prompt-1` tokens replaced with captured numbers; directive re-released as Draft 3.1 before Gate 1 closes.
- **Verification:** `grep -cE "^\*\*Status:\*\* DRAFT 3\.1,|Vitest baseline ≥ \*\*[0-9]+\*\*|lint floor \([0-9]+\)|^- R4 \(" docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md` returns **4**.
- **Expected:** Status header L5 reads `DRAFT 3.1`; AC18 and AC20 rows carry numeric baselines inline; §REVISIONS contains R4 (Draft 3.1 re-release) entry.
- **Action on failure:** HARD HALT at Gate 1 — Draft 3.1 re-release is a pre-Gate-1 obligation (per D1 ratification + M1 status header + B8/B9 AC rows).

### E4 — §OPEN-Q closure at Gate 0

- **Criterion:** All 7 §OPEN-Q rows ratified (founder decisions recorded) before Gate 0 verdict closes.
- **Verification:** §OPEN-Q table "Options" column updated to show founder-ratified decisions per row; §REVISIONS entry notes the Gate 0 closure.
- **Expected:** 7/7 §OPEN-Q rows show ratified decisions.
- **Action on failure:** HARD HALT at Gate 0 — unratified §OPEN-Q items block execution.

### E5 — Explicit out-of-scope items (downstream carry-forward)

- **Criterion:** The following items are EXPLICITLY OUT OF SCOPE for Draft 3.0 and carry forward as downstream items:
  1. §F9 styling drift — `max-w-lg` (dialog) vs SCAFFOLD §F6 `max-w-3xl` (page). Deferred to a future §F9 cleanup concern.
  2. Same-amount-counters spec silence — `ECONOMIC_FLOW_v1.md` does not rule on whether offer X → counter X is permitted, blocked, or coerced to accept. Deferred to `ECONOMIC_FLOW_v1.md` amendment cycle.
- **Verification:** n/a (documented carve-outs only).
- **Expected:** Items acknowledged; no Draft 3.0 action required.
- **Action on failure:** N/A — this criterion cannot fail. Prevents these items from re-surfacing as blockers.

### E6 — No regression beyond baseline

- **Criterion:** Vitest test count at end of Prompt 10 ≥ captured AC18 floor + 33 new cases (0 failing). Lint error count ≤ captured AC20 floor (no new errors).
- **Verification:** `npm run test` and `npm run lint` final Prompt 10 invocation. Deltas compared against AC18/AC20 captured-at-Prompt-1 numbers.
- **Expected:** test count meets or exceeds floor+33; lint count equal to floor (0 regressions).
- **Action on failure:** HARD HALT at Gate 3 — baseline regression blocks exit.

### E7 — Exit report published + Gate 3 verdict recorded

- **Criterion:** `docs/audits/P4_CONCERN_4A_2_C2_EXIT_REPORT.md` committed to working tree per §PROMPTS item 11. Founder Gate 3 verdict recorded in §REVISIONS as R5 (or separate commit message / follow-up audit entry).
- **Verification:** `ls docs/audits/P4_CONCERN_4A_2_C2_EXIT_REPORT.md` returns file. §REVISIONS has R5 entry with Gate 3 status.
- **Expected:** exit report file present; Gate 3 verdict logged.
- **Action on failure:** HARD HALT at Gate 3 — directive not closable without exit-report publication.

---

## §SELF-VERDICT — Claude Code discipline rubric

Claude-Code-side discipline check (distinct from §EXIT CRITERIA, which is founder-owned). Each SV item must PASS before Prompt 10 verification report is submitted for founder Gate 3 verdict. Failure of any SV blocks exit-report publication.

**SV-1 — R-1 discipline (scope-expansion-as-proposal).** Every phase composed edit was surfaced as an explicit proposal with interpretive choices flagged before application; zero silent composition.

- **Self-check:** Audit phase reports (Phase 1 through Phase 7). Each composed-edit application is preceded by a "proposal + HALT + ratification" cycle.
- **Pass/fail:** PASS if all composed edits (Phase 1 B7, Phase 2 B1/B5, Phase 3 B11/S1/S2/S3, Phase 4 S4–S7/B8/B9 + drifts, Phase 5 §PROMPT 1 PREREQUISITES, Phase 6 §PROMPTS, Phase 7 §EXIT CRITERIA + self-verdict) followed the propose-first discipline. FAIL if any composed edit slipstreamed without explicit proposal.

**SV-2 — R-2 discipline (HALT on count/location/content mismatch).** Pre-edit verbatim reads matched expected state at every phase; any mismatch HALTed for ratification before proceeding.

- **Self-check:** Audit pre-edit read outputs across phases. Mismatches (e.g., Phase 3 line-drift from Phase 1/2, Phase 5 V11 line drift L185→L197) were surfaced, not silently accommodated.
- **Pass/fail:** PASS if every mismatch produced a HALT + ratification. FAIL if any mismatch was silently worked around.

**SV-3 — R-2* discipline (line-number-backed-by-grep).** Every line-number assertion in proposals or reports was backed by current-state grep, not working-memory or pre-edit line numbers.

- **Self-check:** Audit line-number citations in phase reports. Each citation anchored by grep command or re-anchor-grep pattern.
- **Pass/fail:** PASS if all line numbers grep-verified at execute-time. FAIL if any line-number claim relied on stale (pre-edit or working-memory) anchor. **Known historical failure caught and corrected:** Phase 4 initial L146 claim for §F10 header (actual L171); corrective discipline adopted as R-2* calibration.

**SV-4 — Per-finding-HALT discipline.** Each finding received its own mini-report (pre-edit read + edit + post-edit extraction + R-3 byte-compare); phase-level HALT batched all mini-reports.

- **Self-check:** Audit phase reports for per-finding structure. Each finding has a mini-report section; phase-level HALT at end.
- **Pass/fail:** PASS if all findings got mini-reports. FAIL if any finding was bundled without individual traceability.

**SV-5 — Phase-closure residual sweep.** Each phase closed with grep-based retirement-target verification (0 hits on retired patterns).

- **Self-check:** Audit each phase's closure report for residual sweep section. Retired patterns (e.g., fabricated template names in Phase 2, `smoke + visual` / `test + curl` / `§AC12` in Phase 4, `HandleMap` / `C1 §F6` in Phase 3, `test mass` in Phase 6) all returned 0 hits post-phase.
- **Pass/fail:** PASS if every phase closed residual sweep with 0 hits on retired targets. FAIL if any residual leaked past its retirement phase.

**SV-6 — R-3 byte-exact content fidelity (FIXED).** Every edit's post-apply extraction byte-compared against the Phase prompt's ratified spec text (not against the Edit call's own `new_string` parameter per R-3 calibration lock).

- **Self-check:** Audit phase reports for R-3 byte-compare results. Each edit extraction byte-matches ratified spec.
- **Pass/fail:** PASS if all edits byte-match. FAIL if any edit drifted. **Known historical failure caught and corrected:** Phase 1 initial M1 dropped clauses + B7 prose composition; corrective pass applied, R-3 calibration lock adopted (compare against Phase prompt spec, not Edit input).

---

## §AUDIT-1 — Prompt 1 baseline capture

**Execution date:** 2026-04-23. **Phase:** Prompt 1 (pre-flight audit per §PROMPTS item 1).

**V-check results:**

| V# | Verbatim command | Output (summary) | Classification | Action |
|---|---|---|---|---|
| V9 | `grep -nE "'editorial_one_time'\|'editorial_with_archive_12mo'\|'commercial_restricted'\|'custom'" docs/specs/ECONOMIC_FLOW_v1.md` | 1 hit (L94) | PASS | NONE |
| V10 | `grep -nE "^export (type\|interface) Offer(State\|Row)" src/lib/offer/types.ts` | 2 hits (L49, L95) | PASS | NONE |
| V11 | `grep -nE "setSubmitted\(true\)\|fetch\(" src/components/asset/AssetRightsModule.tsx` | 1 hit (L197) | PASS | NONE |
| V12 | `ls src/app/api/offers/party-profiles/route.ts` + `grep -rnE "^export (type\|interface) PartyProfileMap" src/lib/offer/` | 0 hits + 0 hits | FAIL | SOFT — §D10 stub fallback |
| V13 | `grep -nE "CREATE OR REPLACE FUNCTION public\.rpc_(accept\|counter\|reject\|cancel)_offer\b" supabase/migrations/20260421000011_rpc_offer_business.sql` + `grep -n "rpc_accept_offer_commit" supabase/migrations/20260421000012_offer_accept_stripe.sql` | 4 hits + 9 hits | PASS | NONE |
| V14 | `grep -n "JSON.stringify(offer.rights" src/app/vault/offers/[id]/_components/OfferDetailClient.tsx` | 1 hit (L192) | PASS | NONE |

**Baseline capture:**

- **AC18_floor = 1276.** `npm run test` verbatim summary: `Test Files 68 passed | 1 skipped (69); Tests 1276 passed | 10 skipped (1286); Duration 11.14s`.
- **AC20_floor = 68.** `npm run lint` verbatim summary: `✖ 414 problems (68 errors, 346 warnings)`.

**Tooling versions:**

- Vitest: v4.1.5
- Node: v25.9.0
- ESLint: v9.39.4

**V12 SOFT — downstream impact:** the `/api/offers/party-profiles` endpoint (file: `src/app/api/offers/party-profiles/route.ts`) is absent on `main`, and `PartyProfileMap` is not exported from `src/lib/offer/`. Per C1 handoff contract, §D10 stub-fallback path is active for this concern. Carry-forward to Gate 2 per §APPROVAL GATES.

---

**End of directive.**
