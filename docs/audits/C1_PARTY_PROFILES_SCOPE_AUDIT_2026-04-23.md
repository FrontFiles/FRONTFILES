# C1 Party-Profiles — Scope Audit

**Date:** 2026-04-23.
**Scope:** audit-only; no code changes, no PR.
**Target concern:** `P4 Concern 4A.2.C1` — offer counterparty-profile endpoint + offer-state translation map.
**Authority source:** [`docs/audits/P4_CONCERN_4A_2_C1_DIRECTIVE.md`](docs/audits/P4_CONCERN_4A_2_C1_DIRECTIVE.md) Draft 3.1 (2026-04-22, Gate 0 closed).
**Also consulted:** [`docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md`](docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md) Draft 3.2, [`docs/audits/P4_CONCERN_1_DIRECTIVE.md`](docs/audits/P4_CONCERN_1_DIRECTIVE.md) (different concern — see §0).

---

## §0 — Naming disambiguation (FLAG-26 prophylactic)

Two docs start with `P4_CONCERN_1` but are disjoint concerns:

| File | Scope | Relationship to this audit |
|---|---|---|
| [`P4_CONCERN_1_DIRECTIVE.md`](docs/audits/P4_CONCERN_1_DIRECTIVE.md) | P4 concern 1 — schema migration set (M1–M5: buyer_company_role relocate, certified_packages rename, Assignment Engine drop, economic-layer DDL, seeding) | **Not this audit.** Separate P4 infrastructure concern. Cited only for naming clarity. |
| [`P4_CONCERN_4A_2_C1_DIRECTIVE.md`](docs/audits/P4_CONCERN_4A_2_C1_DIRECTIVE.md) | P4 concern 4A.2.C1 — offer counterparty-profile endpoint + offer-state translation map | **This audit's target.** The C1 cited by C2 §D10 / V12. |
| [`P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md`](docs/audits/P4_CONCERN_1_TRIGGER_RACE_DIRECTIVE.md) | Postgres trigger race-condition fix within concern 1's DDL | **Not this audit.** Adjacent to P4 concern 1, not to 4A.2.C1. |

Throughout this audit, `C1` means **`P4 Concern 4A.2.C1`** only.

---

## §1 — What is C1 party-profiles, conceptually

C1 is a **tightly-scoped two-surface UI concern** that ships: (a) a new `GET /api/offers/party-profiles?ids=...` endpoint returning the authoritative display identity (`{id, username, display_name, account_state}`) for counterparty users the authenticated caller has offers with, sourcing from `public.users` rather than the ledger-pseudonym `actor_handles` table; and (b) a single-source-of-truth translation map at `src/lib/offer/state-copy.ts` that maps the 6 `OfferState` enum values to user-facing chip copy (`sent → 'Offer pending'`, `countered → 'Counter pending'`, `accepted → 'Accepted'`, `rejected → 'Rejected'`, `expired → 'Expired'`, `cancelled → 'Cancelled'`). **No migrations, no RPC, no `SECURITY DEFINER`, no schema changes.** The endpoint uses `SECURITY INVOKER` with an inline `EXISTS` semi-join to enforce party-scope (only users you share an offer with are returned). The translation map is a `satisfies Record<OfferState, string>` compile-time-exhaustive constant.

---

## §2 — What resolving C1 actually requires

**Code only. No founder ruling needed. No spec writing needed. No schema work needed.**

### §2.1 What IS needed

| # | Input | Status |
|---|---|---|
| 1 | Founder decisions baked into C1 directive | ✅ **5/5 ratified** at Gate 0 (2026-04-22): translation-allowed chip copy; §8.7.1 erasure clause; no schema work in C1; endpoint name `/api/offers/party-profiles`; SECURITY INVOKER inline EXISTS. §OPEN-Q empty per directive L177-180. |
| 2 | Spec anchors for chip copy | ✅ `ECONOMIC_FLOW_v1.md` §12.1 L427 licenses translated chip copy ("Offer pending" / "Rights grant complete" / "Pack delivered"). |
| 3 | DDL index support for endpoint query | ✅ `offers_buyer_id_idx` + `offers_creator_id_idx` exist per `20260421000004_economic_flow_v1_ddl.sql` L116-117. Endpoint SQL resolves as two index-scan-union + PK lookup on `users.id`. |
| 4 | RLS policies for `public.users` reads | ✅ `users_auth_read` at `20260419100000_rls_core_policies.sql` L48-51 + column grants at `20260420000000_rls_all_tables.sql` L149-164. `SECURITY INVOKER` is sufficient. |
| 5 | `FFF_AUTH_WIRED` flag for graceful-empty short-circuit | ✅ exists at `src/lib/env.ts` + `src/lib/flags.ts`. Directive §F3 mirrors SCAFFOLD `GET /api/offers` short-circuit verbatim. |
| 6 | `OfferState` type at `src/lib/offer/types.ts` | ✅ verified present per C2 directive Prompt 1 V10 (2026-04-23). |
| 7 | `ECONOMIC_FLOW_v1.md §8.7.1` (erasure clause) | ✅ landed 2026-04-22 per C1 §DEPENDENCIES L167. |

### §2.2 What IS NOT needed

- **Founder ruling on `pending` vs `sent`.** C1 §F4 ratified `sent` as the enum key and `'Offer pending'` as the user-facing chip copy. This is the CHIP-COPY side of the A.3 drift audit §1.4 contradiction. **But note: the `PLATFORM_BUILD.md:74` STATE-NAME drift persists** (that doc calls the state itself `pending`, not just the chip copy). See §4.3.
- **Schema work.** `public.users.tombstoned_at` column + `account_state='tombstoned'` enum addition are explicitly **forward-compat**, owned by GDPR runbook P6, not C1. C1 reads whatever `public.users` has at HEAD.
- **SSR auth / `@supabase/ssr` / `next/headers`.** C1 matches C2's §D1 inherited constraint — Bearer-token only, `requireActor()` for auth.

### §2.3 File delivery list (from directive)

| File | Purpose | LoC estimate |
|---|---|---|
| `src/app/api/offers/party-profiles/route.ts` (new) | GET handler with §F2 inline SQL | ~100 LoC |
| `src/lib/offer/state-copy.ts` (new) | `OFFER_STATE_COPY` record + `offerStateChip(state)` helper | ~15 LoC |
| `src/app/api/offers/party-profiles/__tests__/get.route.test.ts` (new) | 3 integration tests (>100 ids / cross-party probe / flag-off short-circuit) | ~100 LoC |
| `src/lib/offer/__tests__/state-copy.test.ts` (new) | Exhaustiveness + per-enum chip-copy tests | ~40 LoC |

Note on test path convention: C1 directive §F4 writes `src/lib/offer/__tests__/state-copy.test.ts` but the live convention in `src/lib/offer/` is `tests/` (6 existing test files). Same mismatch surfaced in the A.3 drift audit §P1 for C2 Prompts 2+3 — resolve at C1 implementation time (either directive micropatch or adjust path per convention).

---

## §3 — Estimated effort

**Cheap.** Full code delivery estimated at **~250–300 LoC** total including tests. Under a 2–4 hour single-session execution for a focused Claude-Code dispatch. Lower risk than any prompt in the C2 ladder: no interactive UI, no state-machine logic, no ref-forwarding, no `<dialog>` plumbing.

**Risk factors (low):**

- AC6 perf baseline is `TBD` — directive §F6 defers capture to Prompt 1 instrumentation pass. Non-blocking (can lock at Gate 1). Needs a simple load-test harness run.
- The `actor_handles` NOT-read rule (AC1) requires a clean separation — `actor_handles` exists elsewhere in the offer surface, so the grep gate is not trivial to pass if any refactor touches adjacent files. Directive scope limits touch to the 4 files above, so this is self-enforcing.
- Test-path convention mismatch (§2.3 above) needs either a directive micropatch or convention-respecting placement. Not a blocker, just a directive-reality drift to flag.

**Compare:** C2 directive is 2,890 LoC across 11 prompts. C1 is roughly one-tenth of that as a single contained dispatch.

---

## §4 — Blockers / founder-decision points INSIDE the C1 gate

### §4.1 Open questions on C1 directive: **none**

Directive §OPEN-Q L177-180 explicitly reads "Empty. The six prior open questions from Draft 2 are resolved by the five ratified founder decisions…" Gate 0 closed. Directive is execution-ready.

### §4.2 Soft-trigger items (non-blocking)

| # | Item | Where | Action |
|---|---|---|---|
| 1 | AC6 perf baseline capture | §F6 row 6 | Instrument at Prompt 1 endpoint entry; capture p95; lock at Gate 1. Budget number is `TBD` in directive. |
| 2 | Test-path convention (`__tests__/` vs `tests/`) | §F4 L139 vs live module convention | Mirrors A.3 drift audit §P1 — decide per dispatch. Not a governance issue; can be resolved in-session. |

### §4.3 Adjacent / out-of-scope drift to surface (FLAG-39)

C1 §F4 ratifies `sent` as the first `OfferState` enum key with `'Offer pending'` as the chip copy. **This is the answer to the A.3 drift audit §1.4 `pending` vs `sent` question — but only the chip-copy side.** The PLATFORM_BUILD.md:74 drift persists at the state-name layer:

- `PLATFORM_BUILD.md:74` says: `| Offer | 6: pending, countered, accepted, rejected, expired, cancelled | Spec S10.4 |` — treats `pending` as the state *name*.
- `ECONOMIC_FLOW_v1.md §4` + `src/lib/offer/types.ts:49` + C1 §F4: state *name* is `sent`; chip *copy* is `'Offer pending'`.

**The drift is not resolved by C1's ratification** — it's a separate line in a different doc that claims the state name is `pending`. Still needs the one-line typo-fix to `PLATFORM_BUILD.md:74` that the A.3 drift audit §5.2 recommended. Cheap, but not part of C1's scope and not a C1 blocker.

**Per FLAG-39 — not silently resolving.** Flagging explicitly so the founder sees that C1 execution doesn't close the A.3 drift audit's Blocker 2; that's a separate docs fix.

### §4.4 CRITICAL: C1 vs C2 Prompt 2+3 test-path precedent

C2 Prompts 2 and 3 landed test files at `src/lib/offer/tests/*.test.ts` (module live convention) despite the C2 directive citing `__tests__/*.test.ts`. Noted in commit messages as "directive micropatch queued." C1's §F5 uses the same `__tests__/` path specification — so the same micropatch question applies. If C1 ships tests at `__tests__/`, it creates a split within `src/lib/offer/` (6 old + existing Prompt 2/3 tests at `tests/`; new state-copy test at `__tests__/`). If C1 ships at `tests/`, it matches module convention and the directive needs amendment. This mirrors **P1 flag in the A.3 drift audit — not a new decision, just a consistency call across all C2 + C1 tests.** Recommend a directive micropatch before C1 dispatches to land both at `tests/` uniformly.

---

## §5 — Unlock surface — does C1 only unblock Prompt 6?

### §5.1 Direct unblock — Prompt 6 only

C2 directive §F1 L151 says `OfferDetailClient` rewrite pure helper takes `profiles: PartyProfileMap` and imports `offerStateChip` from `@/lib/offer/state-copy`. Both are C1 outputs. Prompt 6 is the ONE prompt that touches either. So the *direct* unblock surface = Prompt 6 only.

### §5.2 Transitive unblock — Prompts 9, 10, 11

- **Prompt 9** extends `OfferDetailClient.test.tsx` with 4 mutation-flow test cases. Dependency is on Prompt 6, not on C1 directly.
- **Prompt 10** is a full verification pass (AC13–AC23 mechanical greps). Depends on all prior prompts including Prompt 6.
- **Prompt 11** is the exit report; depends on Prompt 10.

So in terms of "can a prompt start," C1 only unlocks Prompt 6. But the full C2 directive's exit (AC18 baseline + 33 new test cases + AC19 build green) can't close without C1 because Prompt 6 can't close.

### §5.3 Structural informing of Prompts 9 / 10 / 11

- **Prompt 9 structure** — unchanged by C1. Mutation handler tests assert against the mutation-state reducer in Prompt 6's shell. The presence of `profiles` in the `OfferDetailView` shape adds a fixture input to each test (seed a `PartyProfileMap`), but the test-body structure isn't C1-informed.
- **Prompt 10 structure** — unchanged by C1 conceptually. The AC13 / AC14 / AC15 / AC16 / AC17 / AC21 / AC22 / AC23 mechanical greps are C2-internal. AC4 (counterparty handle renders real not ID-prefix) needs C1's `PartyProfileMap` fixture to pass. Otherwise unchanged.
- **Prompt 11 structure** — unchanged. Exit report format is locked in C2 §PROMPTS row 11.

### §5.4 Net

C1 is the **minimum shippable unblock** for Prompt 6. Prompts 9/10/11 don't need C1 *structurally* beyond what Prompt 6 already consumes — they just can't close until Prompt 6 closes.

**Also — an independent structural benefit of C1 that goes beyond C2:** `src/lib/offer/state-copy.ts` is the canonical chip-copy SSOT. Any future surface that renders an offer-state badge (vault/offers list, future dashboards, assignment detail pages where offer history shows, etc.) will import from this one file. C1 is therefore not "just for C2" — it's a platform-level SSOT that happens to unblock C2 as its first consumer.

---

## §6 — Recommended next move

### §6.1 Direct recommendation: **dispatch C1 Prompt 1 immediately**

No founder ratification needed. Directive is Gate 0 closed, §OPEN-Q empty, all 7 upstream inputs green (§2.1 above). The two soft-trigger items (§4.2) are in-session concerns, not pre-dispatch blockers.

The sequence:

1. Cut `feat/p4-offers-c1-party-profiles` off `origin/main` (per directive L7). `origin/main` now has the directive file itself (via the directive-commit push you authorized earlier this session), so the branch inherits it.
2. Run the single Prompt 1 prerequisite — V8 (OfferState type source) + the state-copy co-location check. Already ~95% verified from C2 directive Prompt 1 V10 on 2026-04-23.
3. Author the 4 files per §F1 / §F2 / §F4 / §F5. Budget ~250–300 LoC.
4. Capture AC6 perf baseline.
5. Run grep gates AC1 / AC2 / AC5.
6. Request Gate 1 sign-off.

Estimated single-session wall-clock: **2–4 hours**. About the same as Prompts 2+3+4 combined (which ran ~1-2 hours in-session this morning).

### §6.2 Secondary recommendation: **bundle a directive micropatch**

Before C1 dispatches, author a ~15-minute directive micropatch that either:

- (a) **Amends C1 §F5 + C2 §F2/§F3/§PROMPTS to use `tests/` instead of `__tests__/`** — matches live module convention, avoids split.
- OR (b) **Amends the test-path for all new C2 + C1 tests to `__tests__/`** — requires moving C2 Prompts 2/3 tests that already shipped at `tests/`.

(a) is cheaper and doesn't touch shipped code. Recommend (a). Can be rolled into a C1 Draft 3.2 release (or equivalent single-commit doc edit) before C1 Prompt 1 entry.

### §6.3 Tertiary: **close A.3 drift audit Blocker 2 in parallel**

Separately, the `PLATFORM_BUILD.md:74` state-name drift remains open. The A.3 drift audit recommended a one-line typo-fix (`pending` → `sent`). Can ship as a dedicated docs dispatch at any time — not a C1 prerequisite, not a C1 output, but cleanly resolves the last governance drift in the offer state vocabulary. Cheap.

### §6.4 Execution order

Recommend:

```
(1) Directive micropatch for test-path convention          — 15 min, doc-only
(2) A.3 drift audit Blocker 2 fix (PLATFORM_BUILD.md:74)   — 5 min, doc-only
(3) C1 Prompt 1 — preflight + full implementation          — 2-4 hrs, code+tests
(4) Gate 1 review + sign-off                                — founder
(5) Unblocks C2 Prompt 6 — resume C2 from Prompt 6 onward   — ~1 day
```

Steps (1) and (2) are both doc-only and independently cheap. Step (3) is the real work.

---

## §7 — Verification / discipline traces

- **FLAG-26 honoured** — the `pending` vs `sent` naming is surfaced explicitly (§4.3). C1's ratification resolves it for chip copy but NOT for `PLATFORM_BUILD.md:74` state-name. Not silently merged.
- **FLAG-33 honoured** — audit-only. No git ops. No code changes.
- **FLAG-39 honoured** — C1 vs C2-Prompts-2/3 test-path precedent (§4.4) surfaced, not silently resolved.

### §7.1 Citations used

All `file:line` or `file § section` references in this audit are grep-anchored against current `origin/main` (which now contains the directive files after the R1 push earlier this session). No claim from training-data memory.

### §7.2 What this audit did NOT do

- Did not run the AC6 perf instrumentation — belongs to the C1 dispatch itself, not this scope audit.
- Did not read `supabase/migrations/20260419100000_rls_core_policies.sql` or the other RLS / grants migrations referenced by C1 §DEPENDENCIES — existence of the right RLS is cited from the directive, not independently verified by this audit. A Prompt 1 preflight in the C1 dispatch would verify those.
- Did not inventory all offer-state-badge render sites repo-wide — C1 §F4 AC5 grep gate will catch them at implementation time.

---

*End of C1 party-profiles scope audit. Zero code changes. Directive is execution-ready; recommendation is to dispatch after a 15-min test-path micropatch and optionally fold in the A.3 Blocker 2 fix.*
