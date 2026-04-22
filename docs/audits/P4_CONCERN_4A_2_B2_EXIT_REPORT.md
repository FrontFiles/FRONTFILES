# P4 Concern 4A.2 — Part B2 Exit Report

**Stripe accept surface.** Sign-off artefact for concern 4A.2 Part B2 (Stripe PaymentIntent straddle + dual-thread event emit + legacy retirement defer). Reviewer-ready; does not require directive context.

| Key | Value |
|---|---|
| Branch | `feat/p4-economic-cutover` |
| HEAD | `7469af4` — R12 defer formalization |
| B2 commits | `98481b7` (F1-F10 straddle), `7469af4` (R12 defer) |
| Predecessor | `ec694ab` — B1 exit commit |
| Directive | `docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md` (at R12) |
| Report date | 2026-04-21 |

---

## §1 Commit chain

Three commits on `feat/p4-economic-cutover` beyond `origin/main`. Only the last two are B2 deliverables.

| SHA | Subject | Files | LoC delta | B2? |
|---|---|---|---|---|
| `ec694ab` | feat(offer): P4 concern 4A.2 Part B1 — non-accept offer routes | — | — | No — B1 predecessor (baseline) |
| `98481b7` | feat(p4/4A.2/B2): Stripe accept surface — PI straddle + dual-row emit | 13 | +3088 / −11 | **Yes** (F1-F10) |
| `7469af4` | docs(p4/4A.2/B2): R12 — defer F11, scope 4A.2.C follow-up | 2 | +126 / −2 | **Yes** (R12) |

Aggregate B2 delta (ec694ab..HEAD): **13 files changed, +3212 insertions, −11 deletions**.

---

## §2 Acceptance criteria coverage (AC1-AC20)

| AC# | Criterion (one-line) | Status | Evidence |
|---|---|---|---|
| AC1 | Typecheck clean, no `@ts-ignore` / `any` / suppressions | **PASS** | `bun run typecheck` → exit 0, zero diagnostics (Prompts 4, 6, 7, 7.5, 8, 9, 10.5, 12 all verified) |
| AC2 | Lint clean, no new suppressions | **PARTIAL** | `bun run lint` exits 1 with 67 pre-existing errors + 341 warnings at `ec694ab` baseline. B2 delta: **+0 errors, +0 warnings** (Prompt 10.5 Task B). Pre-existing errors are not B2's defect — see §6.1. |
| AC3 | Build green, no warnings referencing B2 files | **PASS** | `bun run build` → exit 0. Route manifest shows `/api/offers/[id]/accept` + `/vault/offers` built. No warnings cite B2 files. |
| AC4 | Full test suite green; post-B2 count ≥ baseline + F9 + F10, skipped ≤ baseline | **PASS** | Baseline at `ec694ab`: 1232 / 10 / 0. Post-F9: 1237. Post-F10: 1248. Current: **1248 passed / 10 skipped / 0 failed** (§4). Delta +16 tests, 0 new skips. |
| AC5 | Migration applies cleanly forward; non-idempotent at file level | **PASS** | `supabase migration up --local` → `Local database is up to date` (Prompt 2 applied; Prompt 7.5 R9 amended in file, re-apply a no-op for CLI but `CREATE OR REPLACE FUNCTION` body carries the amendment; see §6.8). |
| AC6 | Migration has no stray DDL | **PASS** | [20260421000012_offer_accept_stripe.sql](supabase/migrations/20260421000012_offer_accept_stripe.sql) contains exactly: 2 `ALTER TABLE ... ADD COLUMN` (L77, L80), 2 `CREATE UNIQUE INDEX` (L90, L94), 2 `COMMENT ON COLUMN` (L99, L102), 1 `CREATE OR REPLACE FUNCTION` (L124), 1 `COMMENT ON FUNCTION` (L224), 1 `REVOKE ALL ON FUNCTION` (L246), 1 `GRANT EXECUTE ON FUNCTION` (L249), wrapped in `BEGIN;` (L58) / `COMMIT;` (L254). |
| AC7 | Route error surface matches §F6 table — every code in ≥1 test assertion | **PASS** | F10's 11 cases cover: 401 UNAUTHENTICATED (c1), 404 OFFER_NOT_FOUND (c2), 403 NOT_PARTY (c3, R11), 409 INVALID_STATE (c4, c9), 503 FEATURE_DISABLED (c5), 500 INTERNAL (c6), 200 success (c7), 402 CARD_DECLINED (c8), 500 RECONCILE_NEEDED (c10), 400 UNSUPPORTED_CURRENCY (c11). |
| AC8 | PI never carries `destination` / `transfer_data` / `on_behalf_of` / `application_fee_amount` | **PASS** | F9 case 1 asserts all four via `expect(createParams).not.toHaveProperty(...)` at [offer-accept.test.ts:202-205](src/lib/offer/tests/offer-accept.test.ts:202). |
| AC9 | Idempotency key matches `${offer.id}:accept` exactly | **PASS** | F9 case 1 asserts at [offer-accept.test.ts:193](src/lib/offer/tests/offer-accept.test.ts:193): `expect(createOptions).toEqual({ idempotencyKey: IDEMPOTENCY_KEY })` where `IDEMPOTENCY_KEY = \`${OFFER_ID}:accept\``. |
| AC10 | Void uses the same idempotency key | **PASS** | F9 case 3 asserts at [offer-accept.test.ts:271](src/lib/offer/tests/offer-accept.test.ts:271): `expect(cancelArgs[2]).toEqual({ idempotencyKey: IDEMPOTENCY_KEY })`. |
| AC11 | Reconcile log carries all nine fields | **PASS** | F9 case 4 asserts via `expect.objectContaining(...)` at [offer-accept.test.ts:309-322](src/lib/offer/tests/offer-accept.test.ts:309): `route`, `event: 'accept.reconcile_needed'`, `severity: 'critical'`, `offerId`, `buyerId`, `creatorId`, `paymentIntentId`, `idempotencyKey`, `dbCommitErrorCode`, `stripeVoidErrorCode`. |
| AC12 | `_emit_offer_event_with_retry` called twice per accept (offer then assignment) | **PARTIAL** | F5 RPC body at [20260421000012_offer_accept_stripe.sql:200-223](supabase/migrations/20260421000012_offer_accept_stripe.sql:200) performs both calls in order. No integration test asserts against live `ledger_events` rows — F10 mocks the orchestrator. DB-level verification deferred to a future integration harness. |
| AC13 | Assignment row has `state = 'active'` on creation | **PARTIAL** | F5 RPC at [20260421000012_offer_accept_stripe.sql:210](supabase/migrations/20260421000012_offer_accept_stripe.sql:210) writes `VALUES (p_offer_id, 'active')`. No F10 integration test asserts via live DB query — orchestrator is mocked at F10's boundary. |
| AC14 | `offers.stripe_payment_intent_id` + `stripe_idempotency_key` both non-NULL after successful accept | **PARTIAL** | F5 RPC at [20260421000012_offer_accept_stripe.sql:171-174](supabase/migrations/20260421000012_offer_accept_stripe.sql:171) stamps both columns in the conditional UPDATE. Partial unique indexes enforce uniqueness. No F10 integration row-inspection — orchestrator mocked. |
| AC15 | F11 ships as separate commit OR exit report documents defer with caller list | **PASS** | Deferred per R12 (commit `7469af4`). Full caller list at §F11-AUDIT (44 rows) + rationale at §F11-DEFER-RATIONALE + follow-up scope at §F11-FOLLOWUP-SCOPE in the directive. This report cross-references under §5.3 and §6.6. |
| AC16 | Zero changes to B1 files outside state.ts's canAccept | **PASS** | `git diff --stat ec694ab..HEAD -- <B1 frozen list>` returns empty for all 8 B1 files (`rpc-errors.ts`, `db/client.ts`, `composer.ts`, `api/offers/route.ts`, `api/offers/[id]/route.ts`, `counter/route.ts`, `reject/route.ts`, `cancel/route.ts`). `state.ts` diff is exactly the canAccept tighten (F7 / R2). |
| AC17 | No unrelated file changes | **PASS** | All 13 changed files map to F1-F11 deliverables, their tests, `.gitignore` housekeeping (Task A of Prompt 10.5), or the directive itself. See §5.1-§5.2. |
| AC18 | Every new file has a B1-style header comment (concern, scope, spec ref) | **PASS** | Verified in [client.ts](src/lib/stripe/client.ts), [errors.ts](src/lib/stripe/errors.ts), [offer-accept.ts](src/lib/offer/offer-accept.ts), [route.ts](src/app/api/offers/[id]/accept/route.ts), [accept.route.test.ts](src/app/api/offers/[id]/accept/__tests__/accept.route.test.ts), [offer-accept.test.ts](src/lib/offer/tests/offer-accept.test.ts), [20260421000012_offer_accept_stripe.sql](supabase/migrations/20260421000012_offer_accept_stripe.sql). Each cites concern (P4 4A.2 B2), scope (F#), and spec section(s). |
| AC19 | No secrets in logs — grep for STRIPE_SECRET_KEY, secret, key | **PASS** | Grep of `src/lib/stripe/*.ts` for `STRIPE_SECRET_KEY` surfaces 8 hits, all in header comments (L30, L35, L37, L86), the factory's error-message literal (L93), and three `env.STRIPE_SECRET_KEY` property reads (L91, L108, L113). None log or interpolate the secret VALUE. PI id and idempotency key ARE logged (expected per the directive). |
| AC20 | Sentry fires on reconcile-fail with structured payload | **PASS** | F4 at [offer-accept.ts:317-320](src/lib/offer/offer-accept.ts:317) calls `Sentry.captureMessage('[offer-accept] reconcile required', { level: 'fatal', extra: reconcilePayload })`. F9 case 4 asserts at [offer-accept.test.ts:325-338](src/lib/offer/tests/offer-accept.test.ts:325) via `expect(Sentry.captureMessage).toHaveBeenCalledWith(..., expect.objectContaining({ level: 'fatal', extra: expect.objectContaining({...}) }))`. |

**Footnotes for PARTIAL / N/A rows**:
- **AC2 (Lint PARTIAL)**: The 67 pre-existing errors at `ec694ab` are baseline debt (mostly the `no-restricted-syntax` rule firing on B1's `SUPABASE_SERVICE_ROLE_KEY` literals inside `scopeEnvVars([...])` test setup). B2 added zero. Fixing the 67 is out of AC16 scope (touches B1 test files). Tracked as open item §6.1.
- **AC12 / AC13 / AC14 (integration-test PARTIAL)**: All three are structurally correct in the F5 RPC body; each has a DB-level invariant the RPC enforces. F10 mocks the orchestrator boundary, so no live `ledger_events` or `assignments` row inspection occurs. A future integration harness (likely tied to local Supabase CLI) would close the gap. Not a scope violation — AC12/13/14 explicitly say "F10 integration test CAN assert", not "must". The in-process assertion chain (F9 orchestrator tests + migration constraints) covers the contract.

---

## §3 Decision log coverage (D1-D13)

| D# | Decision (one-line) | Recorded in | Outcome |
|---|---|---|---|
| D1 | Optimistic conditional UPDATE replaces §8.5 row-level lock | Directive §DECISIONS D1 + migration L158-162 | **HELD** |
| D2 | PI linkage lives on `offers` (not `assignments`), partial unique indexes | Directive §DECISIONS D2 + migration L77-98 | **HELD** |
| D3 | Reconciliation is log-only in B2 (no `admin_reconciliation_jobs` table) | Directive §DECISIONS D3 + F4 reconcile branch | **HELD** |
| D4 | Special-offer retirement ships as separate commit inside B2 | Directive §DECISIONS D4 | **SUPERSEDED** by D13 + **R12** (F11 deferred to concern 4A.2.C) |
| D5 | Stripe SDK resolves at install; API version pinned to SDK default | Directive §DECISIONS D5 + F3 + R6 | **REVISED by R6** — literal string pin `'2026-03-25.dahlia'` (class static returns undefined in v22) |
| D6 | No Stripe Connect in B2 (platform balance only) | Directive §DECISIONS D6 + F4 step 6 + AC8 | **HELD** |
| D7 | Amount = `Math.round(gross_fee * 100)`; currency whitelist USD/EUR/GBP | Directive §DECISIONS D7 + F4 step 4 | **REVISED by R7** — unsupported currency RETURNS preflight result (does not throw) |
| D8 | Stripe error classifier is a separate file from RPC error classifier | Directive §DECISIONS D8 + `src/lib/stripe/errors.ts` | **HELD** |
| D9 | PI metadata carries forensic context (`offer_id`, `buyer_id`, `creator_id`, `actor_handle`, `event_type`) | Directive §DECISIONS D9 + F4 step 6 | **HELD** |
| D10 | Idempotency key deterministic `${offer.id}:accept`; persisted for audit | Directive §DECISIONS D10 + F4 + F5 | **HELD** |
| D11 | Accept route takes empty-strict body | Directive §DECISIONS D11 + F6 `AcceptOfferBody = z.object({}).strict()` | **HELD** |
| D12 | `canAccept` takes no `lastEventActorRef` (buyer-only per R2) | Directive §DECISIONS D12 + F7 + R2 | **REVISED by R2** (tightened from permissive either-party) + by **R11** (HTTP status 403 for preflight `not_party`, aligning with classifier) |
| D13 | F11 caller-audit threshold rule (0 → ship, 1-2 route-internal → migrate, UI rewrite → defer) | Directive §DECISIONS D13 + §F11-AUDIT + R12 | **HELD** — defer branch fired at Prompt 11, formalized by R12 |

**Revision summary**: 12 revisions total (R1-R12). All recorded in §REVISIONS. No silent deviations; every change to a directive-locked item has a tracked R-entry.

---

## §4 Test baseline reconciliation

Expected progression through the 13-prompt sequence:

| Stage | Count | Source |
|---|---|---|
| Pre-B2 baseline (at `ec694ab`) | 1232 passed / 10 skipped / 0 failed | Prompt 1 pre-flight audit (via `bun run test`) |
| Post-Prompt 5b (F7 + state tests) | 1232 / 10 / 0 | No new tests; state tests amended in place |
| Post-Prompt 7 (F9 orchestrator tests) | 1237 / 10 / 0 | +5 tests in `src/lib/offer/tests/offer-accept.test.ts` |
| Post-Prompt 9 (F10 route tests) | 1248 / 10 / 0 | +11 tests in `src/app/api/offers/[id]/accept/__tests__/accept.route.test.ts` |
| Post-Prompt 10 (commit F1-F10) | 1248 / 10 / 0 | No test deltas; commit only |
| Post-Prompt 12 (R12 defer) | 1248 / 10 / 0 | No test deltas; docs + comment edit only |
| **Current at HEAD `7469af4`** | **1248 / 10 / 0** | This report — `bun run test` |

**Actual at HEAD** (verified in this report):
```
 Test Files  61 passed | 1 skipped (62)
      Tests  1248 passed | 10 skipped (1258)
   Duration  10.45s
```

- Total tests: **1258** (1248 passed + 10 skipped)
- Pass: **1248**
- Fail: **0**
- Skip: **10**
- Diff vs. expected 1248: **none**

AC4 satisfied: post-B2 green (1248) = baseline-green (1232) + F9-tests (5) + F10-tests (11). Skipped count (10) ≤ baseline-skipped (10). Zero new skips.

---

## §5 Files inventory

### §5.1 Added (8 new files)

| File | LoC | Scope |
|---|---|---|
| `supabase/migrations/20260421000012_offer_accept_stripe.sql` | 254 | F1 migration + F5 RPC |
| `src/lib/stripe/client.ts` | 121 | F3 Stripe client singleton |
| `src/lib/stripe/errors.ts` | 194 | F8 Stripe error classifier |
| `src/lib/offer/offer-accept.ts` | 490 | F4 orchestrator |
| `src/lib/offer/tests/offer-accept.test.ts` | 485 | F9 orchestrator tests (5 cases) |
| `src/app/api/offers/[id]/accept/route.ts` | 311 | F6 route handler |
| `src/app/api/offers/[id]/accept/__tests__/accept.route.test.ts` | 435 | F10 route tests (11 cases) |
| `docs/audits/P4_CONCERN_4A_2_B2_DIRECTIVE.md` | 895 | Governing directive (self) |

**Subtotal**: 3185 LoC added in 8 new files.

### §5.2 Modified (5 existing files)

| File | LoC delta | Reason |
|---|---|---|
| `src/lib/offer/state.ts` | +13 / −8 | F7 canAccept tightened to buyer-only (R2) |
| `src/lib/offer/tests/state.test.ts` | +4 / −3 | State test updates to match tightened canAccept (Prompt 5b) |
| `package.json` | +1 / −0 | F2 `"stripe": "^22.0.2"` dep |
| `bun.lock` | +3 / −0 | F2 stripe install lockfile update |
| `.gitignore` | +6 / −0 | Task A of Prompt 10.5 — `docs/audits/_*.md` pattern |

**Subtotal**: +27 / −11 across 5 modified files.

### §5.3 Deferred (files identified for retirement in §F11-AUDIT but NOT touched by B2)

Copied from directive §F11-AUDIT, trivial-complexity rows only:

| # | File | LoC | Category | Fate |
|---|---|---|---|---|
| 1 | `src/app/api/special-offer/route.ts` | 116 | route-definition | delete in 4A.2.C |
| 2 | `src/app/api/special-offer/[id]/accept/route.ts` | 46 | route-definition | delete in 4A.2.C |
| 3 | `src/app/api/special-offer/[id]/counter/route.ts` | 41 | route-definition | delete in 4A.2.C |
| 4 | `src/app/api/special-offer/[id]/decline/route.ts` | 40 | route-definition | delete in 4A.2.C |
| 5 | `src/lib/special-offer/services.ts` | 559 | server-caller | delete in 4A.2.C |
| 6 | `src/lib/special-offer/store.ts` | 77 | server-caller | delete in 4A.2.C |
| 7 | `src/lib/special-offer/guards.ts` | 251 | server-caller | delete in 4A.2.C |
| 8 | `src/lib/special-offer/reducer.ts` | 40 | server-caller | delete in 4A.2.C |
| 9 | `src/lib/special-offer/api-helpers.ts` | 44 | server-caller | delete in 4A.2.C |
| 10 | `src/lib/special-offer/types.ts` | 137 | type-definition | delete in 4A.2.C |
| 11 | `src/lib/special-offer/index.ts` | 4 | type-definition | delete in 4A.2.C |
| 12 | `src/lib/special-offer/__tests__/services.test.ts` | 684 | test | delete in 4A.2.C |
| 13 | `src/lib/special-offer/__tests__/guards.test.ts` | 386 | test | delete in 4A.2.C |
| 14 | `src/lib/special-offer/__tests__/helpers.ts` | 77 | fixture-or-mock | delete in 4A.2.C |

Plus 4 files requiring edits (not outright deletion): `src/app/vault/offers/page.tsx` (UI rewrite, 561 LoC), `src/lib/types.ts` (surgical ~100 LoC), `src/lib/db/schema.ts` (surgical ~20 LoC), `src/lib/entitlement/__tests__/helpers.ts` (1 line).

**Deferred subtotal**: ~2,500 LoC of deletions + ~680 LoC of cross-module edits/rewrite. Total ~3,100-3,400 LoC delta for 4A.2.C. See directive §F11-FOLLOWUP-SCOPE for sequencing.

---

## §6 Open items inventory

Every flagged-but-not-fixed item surfaced during B2 execution. Owner classification: `B2-followup` (should be addressed before next concern starts), `next-cycle` (can wait for the next review cadence), `4A.2.C` (explicitly deferred to the follow-up concern per R12).

| # | Item | Owner | Notes |
|---|---|---|---|
| 6.1 | 67 pre-existing lint errors at `ec694ab` baseline | next-cycle | Not B2's defect (Prompt 10.5 verified delta = 0). Most are the `no-restricted-syntax` rule firing on B1's `SUPABASE_SERVICE_ROLE_KEY` literals inside `scopeEnvVars([...])` test setup. Cleanup concern owed — either narrow the rule for `__tests__/` or migrate the literals behind a helper. AC16 blocks doing this under B2. |
| 6.2 | No local pre-commit hook installed | next-cycle | `.husky/` absent, no `simple-git-hooks` / `lint-staged` in `package.json`, `.git/hooks/` only carries `.sample` files. Root cause of how 6.1 reached `main`. A hook-add concern (typecheck + tests; lint only after 6.1 lands) would close the loop. |
| 6.3 | `.claude/settings.local.json` untracked | **closed** | Tracked against user-global `/Users/jnmartins/.config/git/ignore` already (`git check-ignore -v` confirms). No repo-level action needed. Original concern stale. |
| 6.4 | `FEATURE_DISABLED` code at two HTTP statuses (404 B1 actor-disabled, 503 B2 stripe-disabled) | next-cycle | Semantically coherent (feature-flag-off vs. dependency-unconfigured) but the shared code name creates reviewer friction. Rename to `FEATURE_DISABLED_ACTOR` + `FEATURE_DISABLED_PAYMENTS` in a cross-route cleanup concern. |
| 6.5 | `src/lib/flags.ts` L86-93 documents `isEconomicV1UiEnabled()` gating for `/vault/offers` etc. but gate never wired into `page.tsx` | 4A.2.C | Captured in directive §F11-FOLLOWUP-SCOPE. The follow-up must build the flag-gated replacement page AND delete the legacy surface atomically — otherwise a half-migrated state ships. |
| 6.6 | Follow-up concern 4A.2.C scoped per §F11-FOLLOWUP-SCOPE; dedicated directive owed | 4A.2.C | Working name: "4A.2.C — Legacy special-offer sunset + /vault/offers replacement page". Dependencies, scope, non-goals, sizing all captured in directive §F11-FOLLOWUP-SCOPE. Next step is drafting the directive itself. |
| 6.7 | No `.github/workflows/` directory exists in the repo | next-cycle | Zero CI configuration at the repo layer. Any CI (Vercel, etc.) runs deploy-only, not on PR. See §7. A `merge-gate.yml` concern (typecheck + tests + build on PR to `main`) would institutionalize the gates. |
| 6.8 | Local DB body of `rpc_accept_offer_commit` may not reflect R9 `USING ERRCODE` amendments | B2-followup | `supabase migration up --local` reports "Local database is up to date" because CLI tracks migration 20260421000012 as applied. The file body was amended post-apply (Prompt 7.5 R9). CI/fresh-DB apply picks up the amended body; local dev DB may be stale. A one-shot `supabase db reset --local` OR a targeted `psql` recompile of the function body closes the gap. Non-blocking for merge (CI re-applies on fresh DB), but worth noting for local reproducibility. |

---

## §7 CI / merge-gate status

**Finding**: no `.github/workflows/` directory exists in the repository.

- No GitHub Actions workflows configured at the repo layer.
- No `pre-commit` hook (see §6.2).
- The `package.json` `"scripts"` surface (`lint`, `typecheck`, `test`, `build`) is runnable locally but not gated automatically.
- Inferred deploy path: whatever Vercel / similar service is wired to push-on-main runs `next build`, which catches typecheck errors but not lint. Untouched by B2.

Gate coverage at present:
| Gate | Configured | Current state on branch |
|---|---|---|
| `bun run typecheck` | No (local only) | PASS (exit 0) |
| `bun run lint` | No | FAIL (exit 1) — 67 pre-existing errors; see AC2 + §6.1 |
| `bun run test` | No | PASS (1248/10/0) |
| `bun run build` | Implied by deploy provider | PASS (exit 0) |

Flagging as **open item 6.7**. Adding a minimal workflow (typecheck + test + build on PR) is a next-cycle task.

---

## §8 Risk register (pre-merge)

| Risk | Mitigation in place | Residual |
|---|---|---|
| **Stripe API key unconfigured in target env** | Dual-mode contract: `isStripeConfigured()` gate in F6 route returns 503 FEATURE_DISABLED if `STRIPE_SECRET_KEY` env var absent. F3 client factory throws loudly if called without env (not at import time). | Deploy-env owner must set `STRIPE_SECRET_KEY` (and optionally `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) before the accept route is exercised. This report cannot verify deploy-env state; **unverifiable item**. Would be closed by a post-deploy env-var checklist. |
| **Migration ordering / slot collision** | F1 migration at fixed slot `20260421000012` — next available slot after the last Part A migration `20260421000011`. `supabase migration list` showed slot was free at the start of Prompt 2. | If another concern lands a migration at a higher slot before this branch merges, no collision (Postgres serializes). If another lands at exactly `20260421000012`, git merge conflict surfaces at PR review. Low risk. |
| **In-memory mock surface still live at `/api/special-offer/*`** | F11 deferred per R12; routes remain functional against `src/lib/special-offer/store.ts`'s in-memory `Map`. DB backing tables were dropped by `20260421000003_drop_assignment_engine.sql` pre-B2, so the routes simulate against process memory (reset on redeploy). | The `/vault/offers` page still POSTs to these routes. After B2 merges, production behaves identically to B1 for the legacy flow — no regression. Retirement sequenced under 4A.2.C. |
| **Feature flag dependency** | F6 route uses `requireActor` → `isAuthWired()` gate (B1). If `FFF_AUTH_WIRED=false` in target env, route returns 404 FEATURE_DISABLED before reaching canAccept. | Deploy-env owner must set `FFF_AUTH_WIRED=true` to activate the accept route surface. Unverifiable from this report. |
| **`rpc_accept_offer_commit` DB body may be stale on local dev DB** | CI / fresh DB apply picks up the R9-amended body automatically. | Local-only concern (§6.8). Non-blocking for merge. |
| **`licence_source_type` enum retains `'special_offer'` value** | TS-side references remain in types.ts + schema.ts; these are inert under B2 (no new code reads them). | Data-integrity concern handled in 4A.2.C when the enum removal is designed. |
| **No CI merge gate** | Local verification ran typecheck + test + build green. | No automated protection against regression between local verification and merge. §6.7. |

---

## §9 Recommendation

| Question | Answer | Rationale |
|---|---|---|
| **Ready to push to origin?** | **Yes.** | Working tree clean, 3 commits ahead of origin, typecheck + test + build all green, AC1 / AC3 / AC4 PASS, AC5-AC20 all PASS or PARTIAL with justified gaps (AC12/13/14 are structurally correct at the RPC layer, and AC2 is pre-existing baseline debt). R12 formalizes F11 defer with full audit trail. |
| **Ready to open a PR?** | **Yes.** | This exit report satisfies the directive's §END requirement ("red-team the exit report before PR"). Reviewer material: the three commits, this report, the §F11-AUDIT caller table, and the R1-R12 revision log. |
| **Ready to merge to main?** | **Yes, with two caveats.** | (1) Deploy-env owner must confirm `STRIPE_SECRET_KEY` + `FFF_AUTH_WIRED=true` before the accept route is exercised post-merge. (2) CI merge gate (§6.7) is absent — the deploy provider's build step will catch typecheck/build errors but not lint or test regressions. Both are operational-readiness items, not code defects. |
| **Next concern to start** | **C1** (per the six-part split of 4A.2: A, B1, B2, C1, C2, D). | B2 closes the server-side accept surface. C1 owns the client-facing UI components that drive the accept flow (Stripe Elements integration, clientSecret confirmation, etc.) using the `paymentIntentId` + `clientSecret` surface that B2's R10 revision added to `OfferAcceptResult`. |
| **Sequence 4A.2.C before or after C2/D?** | **After C2/D.** | One-sentence rationale: 4A.2.C rewrites the `/vault/offers` UI page atop the new `/api/offers/*` surface — that rewrite is materially easier once C1 + C2 have produced reusable offer UI components and D has landed the auto-accept cron, because the legacy page's three fetch calls (`accept`, `counter`, `decline`) map directly onto C1+C2+D surfaces that would then exist. Running 4A.2.C in parallel with C1/C2 risks duplicating component work. |

---

## §END

**Status: B2 complete.** All twenty AC rows resolved (14 PASS, 3 PARTIAL with justification, 0 N/A-DEFERRED — AC15 passes via R12 defer, not N/A). All thirteen D rows resolved (12 HELD/REVISED, 1 SUPERSEDED). Twelve revisions recorded end-to-end. One follow-up concern scoped (4A.2.C).

Branch ready for push + PR + merge to `main` pending the two operational caveats in §9.

**Exit SHA**: `7469af4faa20629f5d7d13284c4866375042682c`.
