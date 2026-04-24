# P4 Concern 4A.2.C1 — Offer counterparty-profile endpoint + offer-state translation

**Status:** DRAFT 3.2, 2026-04-23 — Draft 3.1 + test-path micropatch. `src/lib/offer/__tests__/` references aligned to the live module convention (`src/lib/offer/tests/`), matching C2 directive Draft 3.2 R5(b) and the 6 existing test files at `src/lib/offer/tests/`. App-router `src/app/api/offers/party-profiles/__tests__/` path unchanged (app-router convention, correct as-is). Draft 3.1 context preserved: corrective pass over Draft 3; tombstone-aware rendering deferred to P6 (NEW-B4 ratification 1b); OfferState path corrected per V8 ratification 2; cosmetic fixes per ratification 3 (a, b, c).

**Governance anchor:** `P4_UI_DEPRECATION_AUDIT.md` §3.1 row 1; `ECONOMIC_FLOW_v1.md` §4, §7, §8.7, §8.7.1, §12, §12.1.

**Branch:** `feat/p4-offers-c1-party-profiles` (cut from `main` at Gate 0 approval).

**Predecessor:** P4 Concern 4A.2.SCAFFOLD (minimal `/vault/offers` + `OffersListClient`) — closed 2026-04-22.

**Peer concerns (parallel):** 4A.2.C2 (detail + mutation UI), 4A.2.D (offer cron).

**Successor:** 4A.2.C — legacy `/api/special-offer/*` retirement (directive: `P4_UI_DEPRECATION_AUDIT.md` Draft 2, Gate 3 approved).

---

## §CONTEXT

Counterparty identity on the offer card today reads `actor_handles` — wrong table. `actor_handles` is the ledger pseudonymisation layer per [spec §8.4](../specs/ECONOMIC_FLOW_v1.md) — a uuid pseudonym mapped to `auth.users` via `auth_user_id`, with no display-bearing columns. It exists so ledger events can reference parties without leaking identity. Counterparty UI identity must come from `public.users` ([identity DDL L39-62](../../supabase/migrations/20260408230009_identity_tables.sql)) which carries the authoritative `username` (unique, public-URL-bearing) and `display_name`. Meanwhile, state badges on the offer card currently render the `offer_state` enum tokens verbatim (`sent`, `countered`, …) — [spec §12.1 line 427](../specs/ECONOMIC_FLOW_v1.md) licenses translated chip copy (*"Allowed: 'Offer pending,' 'Rights grant complete,' 'Pack delivered.'"*) and the `P4_UI_DEPRECATION_AUDIT.md` §3.1 row 1 replacement audit requires the translation be applied.

---

## §SCOPE

Two surfaces. Nothing else.

1. **New endpoint `GET /api/offers/party-profiles`** returning `{id, username, display_name, account_state}` for the counterparty users implicated by the caller's offer set.

2. **New translation map at `src/lib/offer/state-copy.ts`** mapping offer_state → chip copy. All six persisted enum values present; compile-time exhaustiveness via `satisfies Record<OfferState, string>`:

   | Enum value | Chip copy |
   |---|---|
   | `sent` | `Offer pending` |
   | `countered` | `Counter pending` |
   | `accepted` | `Accepted` |
   | `rejected` | `Rejected` |
   | `expired` | `Expired` |
   | `cancelled` | `Cancelled` |

   Single source of truth for chip copy. All badge renderers import from this file.

**NO migrations. NO RPC. NO `SECURITY DEFINER`. NO read of `actor_handles` from this endpoint.** The `public.users.tombstoned_at` column and `account_state = 'tombstoned'` schema support — if they are not already present at HEAD — are forward-compat work owned by the GDPR runbook (P6), not this concern. C1 reads whatever is on `public.users` at Prompt 1 and does not propose schema changes.

---

## §PROMPT 1 PREREQUISITES

**V8 — `OfferState` type source.** Verify `src/lib/offer/types.ts` (singular `offer`) exists at HEAD and exports a type named `OfferState`. If absent, renamed, moved, or sourced from a generated db-types file (e.g. `Database["public"]["Enums"]["offer_state"]`): HALT Prompt 1 entry, report the discovered source, await retargeting. Phase 0 also confirms the §F4 translation-map file (`src/lib/offer/state-copy.ts`) and its paired test (`src/lib/offer/tests/state-copy.test.ts`) co-locate at the same singular `offer` tree. Note: API route paths remain plural (`/api/offers/...`) per Next.js convention — only the `src/lib/offer/` lib tree is singular. Do NOT touch the API route paths.

---

## §F1 — Endpoint contract

**File:** `src/app/api/offers/party-profiles/route.ts` (new).

**Route:** `GET /api/offers/party-profiles?ids=<uuid>,<uuid>,…`

**Auth:** authenticated only when `FFF_AUTH_WIRED = true` (see §F3). `requireActor()` error surface — match the helper's contract verbatim; verify at Prompt 1.

**Query:**
- `ids` — comma-separated uuid list. Max 100 per request. **>100 returns 414 `TOO_MANY_IDS`.** Zero ids returns 400 `MISSING_IDS`. Duplicate ids inside the csv are accepted server-side (the SQL `ANY` clause auto-dedups); the client is expected to pre-dedup per AC (downstream performance concern, not a correctness concern).

**Response on 200:**
```ts
{ users: Array<{ id: string, username: string, display_name: string, account_state: string }> }
```

Users whose id was in the query but with whom the caller has no co-party offer are **silently filtered** by the EXISTS clause — no per-id 403, no `not_found: [...]` carve-out. Convention matches batched read endpoints elsewhere in the repo.

---

## §F2 — SQL (SECURITY INVOKER, inline)

The route handler invokes the following query directly against the user-JWT Supabase client — no RPC, no `SECURITY DEFINER`, no stored procedure. The existing [`users_auth_read` RLS policy](../../supabase/migrations/20260419100000_rls_core_policies.sql) (L48-51) permits authenticated SELECT with `USING (true)`; the column-level GRANT in [`rls_all_tables.sql` L149-164](../../supabase/migrations/20260420000000_rls_all_tables.sql) confirms public fields are readable to `authenticated`. `SECURITY INVOKER` is sufficient — the party-scope enforcement lives in the EXISTS clause below, not in RLS.

```sql
SELECT u.id, u.username, u.display_name, u.account_state
FROM   public.users u
WHERE  u.id = ANY($1::uuid[])
  AND  auth.uid() IS NOT NULL
  AND  EXISTS (
         SELECT 1 FROM public.offers o
         WHERE (o.buyer_id   = auth.uid() AND o.creator_id = u.id)
            OR (o.creator_id = auth.uid() AND o.buyer_id   = u.id)
       );
```

**Bind parameters:** one — `$1` as `uuid[]` bound from the parsed csv. No separate viewer-id parameter is trusted from the client; `auth.uid()` is authoritative.

**EXISTS semi-join, not inner join.** A row in `users` appears at most once regardless of how many offer threads the caller shares with the target — idempotent against the offer count.

**`auth.uid() IS NOT NULL` guard.** Belt-and-braces defense — if `FFF_AUTH_WIRED = true` but the route reaches the query with a null `auth.uid()` (should not happen under `requireActor()`), the query returns zero rows rather than leaking the unjoined `u.id = ANY(...)` projection.

**Index usage.** [DDL L116-117](../../supabase/migrations/20260421000004_economic_flow_v1_ddl.sql) provides `offers_buyer_id_idx` and `offers_creator_id_idx` — the OR branch resolves as two index scans unioned at the EXISTS level. `users.id` is the primary key. No additional indexes needed.

---

## §F3 — `FFF_AUTH_WIRED` dependency

The flag [`FFF_AUTH_WIRED`](../../src/lib/env.ts) (default `false`; flipped at 4B) gates the entire offer-surface read path. This endpoint honors the same convention as existing offer endpoints ([`/api/offers`](../../src/app/api/offers/route.ts)):

- **`FFF_AUTH_WIRED = false`** → return `{ users: [], flag: 'AUTH_WIRED_OFF' }` with HTTP **200**. Do NOT 401. Do NOT 404. The response shape degrades gracefully so C1 UI code can render an empty state without branching on HTTP status.
- **`FFF_AUTH_WIRED = true` AND `auth.uid()` is null** → 401 `UNAUTHENTICATED`.
- **`FFF_AUTH_WIRED = true` AND `auth.uid()` present** → normal §F2 query path.

This matches the SCAFFOLD `GET /api/offers` short-circuit pattern verbatim; the UI treats flag-off as "no data" rather than "error".

---

## §F4 — Translation map

**File:** `src/lib/offer/state-copy.ts` (new).

```ts
import type { OfferState } from '@/lib/offer/types'

export const OFFER_STATE_COPY = {
  sent:      'Offer pending',
  countered: 'Counter pending',
  accepted:  'Accepted',
  rejected:  'Rejected',
  expired:   'Expired',
  cancelled: 'Cancelled',
} as const satisfies Record<OfferState, string>

export function offerStateChip(state: OfferState): string {
  return OFFER_STATE_COPY[state]
}
```

**Import rule:** every renderer of offer-state badges imports `offerStateChip` or `OFFER_STATE_COPY` from this file. No other file constructs chip copy from enum strings by concatenation, switch statement, or conditional. The §F6 AC includes a repo grep gate to catch drift. An ESLint rule scoping this constraint is a future hygiene concern — called out here, not authored in this pass.

**Exhaustiveness:** `satisfies Record<OfferState, string>` is a compile-time gate. If a new enum value lands without a matching copy entry, `tsc` fails. Runtime exhaustiveness is asserted in §F5 via `Object.keys(OFFER_STATE_COPY).sort()` comparison against the enum's runtime-known key set.

---

## §F5 — Tests (vitest)

Paired with the endpoint at `src/app/api/offers/party-profiles/__tests__/get.route.test.ts` (app-router convention, matches existing `src/app/api/offers/**/__tests__/` pattern) and the translation map at `src/lib/offer/tests/state-copy.test.ts` (module convention, matches existing `src/lib/offer/tests/` pattern).

**Unit:**
- `OFFER_STATE_COPY` exhaustiveness — compile-time via `satisfies` + runtime: `expect(Object.keys(OFFER_STATE_COPY).sort())` equals the enum's runtime-known key set sorted.
- `offerStateChip('sent')` returns `'Offer pending'`; one case per enum value.

**Integration (route handler):**
- **ids length > 100.** Supply 101 ids; expect 414 `TOO_MANY_IDS`.
- **Cross-party probe.** Request a uuid the caller has no offer with. Expect 200 with empty `users[]` (silent filter, NOT 403).
- **`FFF_AUTH_WIRED = false` short-circuit.** Stub the flag off; expect 200 with `{ users: [], flag: 'AUTH_WIRED_OFF' }`.

---

## §F6 — Acceptance criteria

| # | Criterion | Verification |
|---|---|---|
| AC1 | Counterparty identity reads `public.users`, not `actor_handles` | repo grep gate: `grep -n 'actor_handles' src/app/api/offers/party-profiles/` returns zero |
| AC2 | Chip copy comes from `src/lib/offer/state-copy.ts` | repo grep gate: `grep -En "'(Offer pending|Counter pending|Accepted|Rejected|Expired|Cancelled)'" src/app src/components` returns hits only inside `src/lib/offer/state-copy.ts` and its test file (and inside `src/lib/offer/state-copy.ts` import sites, which reference the constant, not the literal) |
| AC3 | Endpoint enforces party-scope via EXISTS; cross-party probe returns empty | integration test in §F5 |
| AC4 | `FFF_AUTH_WIRED = false` → 200 `{ users: [], flag: 'AUTH_WIRED_OFF' }` | integration test in §F5 |
| AC5 | All six enum values translated; no `'pending'` token leaks past the translation boundary | repo grep gate: `grep -rn "'pending'" src/app src/components` returns zero state-comparison hits (chip-copy-adjacent discussion in comments is permitted) |
| AC6 (perf) | Endpoint p95 latency under load-test harness ≤ **TBD baseline** captured at Prompt 1 instrumentation pass | perf test; budget locked at Gate 1 |

---

## §DEPENDENCIES

- **`ECONOMIC_FLOW_v1.md` §8.7.1** — Phase 1 of this Gate 0 pass; must land before C1 builds. *(Landed 2026-04-22.)*
- **`FFF_AUTH_WIRED` flag** — existing; see [`src/lib/env.ts`](../../src/lib/env.ts) and [`src/lib/flags.ts`](../../src/lib/flags.ts).
- **Existing `public.users` RLS** — [`users_auth_read`](../../supabase/migrations/20260419100000_rls_core_policies.sql) + column grants in [`rls_all_tables.sql`](../../supabase/migrations/20260420000000_rls_all_tables.sql). No migration required by C1.
- **C2 Draft 2 NEW-B2 fallout** — Phase 3 of this Gate 0 pass; C2 shifts `'pending'` → `'sent'` in state comparisons.
- **D Draft 2 NEW-B2 fallout** — Phase 4 of this Gate 0 pass; D shifts `'pending'` → `'sent'` in SQL bodies and scope narrative.
- **GDPR runbook P6 (forward, not blocking)** — owns the `public.users.tombstoned_at` column migration and any `account_state` enum addition when erasure goes live. C1 does not block on P6; P6 does not block on C1.
- **Tombstone-aware rendering** — deferred to a follow-up concern after GDPR runbook P6 lands the `account_state` enum addition (`'tombstoned'`) and the `public.users.tombstoned_at` column. C1 ships without tombstone branching; the endpoint returns whatever `account_state` and identity values exist on `public.users` at request time.

---

## §OPEN-Q

Empty. The six prior open questions from Draft 2 are resolved by the five ratified founder decisions (translation-allowed chips; §8.7.1 erasure clause; no schema work in C1; endpoint name `/api/offers/party-profiles`; SECURITY INVOKER inline EXISTS) and the §8.7.1 insert.

---

## §EXIT CRITERIA (Gate 0 → Gate 1)

- AC1–AC5 all green.
- AC6 (perf) instrumented; baseline number captured at Prompt 1 and locked at Gate 1 (status header updated on Prompt 1 close).
- Founder sign-off block at foot of this directive populated.

---

## §SIGN-OFF

Architect: ___________________ Date: ___________

Founder:   ___________________ Date: ___________

---

**End of directive.**
