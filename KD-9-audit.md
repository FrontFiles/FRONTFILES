# KD-9 — Audit

**Status:** Phase 1 (audit) only · **Date:** 2026-04-18 · **Owner:** João Nuno Martins
**Upstream context:** `ROADMAP.md` (Now-table KD-9 row) · `INTEGRATION_READINESS.md` §Known debt KD-9 · CCP 3 and CCP 4 governing design in `CLAUDE_CODE_PROMPT_SEQUENCE.md` + `src/lib/env.ts` + the 5 dual-mode modules.

This document is produced under the KD-9 AUDIT brief. No code changes have been made and no fixes are proposed here — that is Phase 3's job. Phases 2, 3, 4 are deliberately left blank pending approval to proceed.

---

## Run provenance

| Field | Value |
|---|---|
| Command | `set -a && source .env.local && set +a && bun run test 2>&1 \| tee /tmp/kd9-run.log` |
| Env loaded | Yes — `.env.local` sourced so `isSupabaseEnvPresent === true`, exercising CCP 4 real-path branches. |
| Suites executing | 46 / 46 (was 30 / 46 pre-KD-8) |
| Tests | 1,081 total · 975 pass · 1 skipped (KD-2 licence_grants fixture) · **105 fail** |
| Pass rate | 90.29 % (vs. 90.8 % reported at KD-8 closeout — see *count drift* note below) |
| Duration | 23.10 s |
| Raw log | `/tmp/kd9-run.log` (1,915 lines) — ephemeral; re-derive with the command above. |

### Count drift vs. KD-9 opening note

KD-9 was opened with **99** failures. This run records **105**. Delta is +6 since the KD-8 closure commit (`e853aa2`, 2026-04-17). Two named candidate explanations:

- **Candidate A — inter-run state leak in `auth.users`.** Several auth/provider and onboarding tests probe first-time-creation behaviour (`kind: 'created'`, `needsEmailVerification: true`). Real Supabase Auth persists its `auth.users` rows across test runs. On a fresh DB the assertion holds; on any subsequent run the same email produces `kind: 'adopted'` and flipped verification state. This is **order-dependence / inter-run flakiness**, not a logic defect in the code under test.
- **Candidate B — RLS tightened on remote dev.** Migration `20260420000000_rls_all_tables.sql` landed on remote dev Supabase 2026-04-17 evening, **after** the KD-8 closure run. §B revokes anon SELECT on `users` and column-grants only public fields; §F adds deny-all on six previously-uncovered tables. Anon-client callers in tests can now see fewer rows; service-role callers are unaffected. This is a consistent state change, not flakiness.

Per the founder amendment: **Candidate A is flakiness and is logged as a separate KD candidate below — NOT rolled into KD-9.** Candidate B is consistent-with-new-state; no separate KD.

### Separate KD candidate (flagged, not yet logged in INTEGRATION_READINESS)

This audit doc only surfaces the candidate; the owner (João) decides whether to open a real row in `INTEGRATION_READINESS.md`.

| Field | Proposed value |
|---|---|
| ID (if opened) | next free (currently KD-10) |
| Title | Inter-run state leak in `auth.users` causes order-dependent auth/provider tests |
| Origin | KD-9 audit, candidate A above |
| Severity (proposed) | Low–Medium. Affects ~6 tests in `auth/provider` (`signUpOrAdoptAuthUser — happy path`, `— password mismatch`, `— verification required` ×2) and plausibly 2 in `onboarding/account-creation` where "first-contact" assertions hinge on absence of prior `auth.users` rows. |
| Relationship to KD-9 | Orthogonal. KD-9 fails whether the flakiness exists or not; clearing the flakiness won't collapse any of the 105 KD-9 failures, only the 6-test delta between 99 and 105. |
| Resolution direction (not designed) | Either (i) per-suite `afterAll` that deletes seeded `auth.users` rows via service-role client with uniquified email prefixes, or (ii) route auth/provider tests through a per-test Supabase schema reset. |
| Why kept separate | KD-9's scope is the architectural response to CCP 3/4 design choices. Test-order flakiness is a test-hygiene concern, orthogonal to whether env-cache / fixture-drift should be redesigned. Keeping them separate prevents scope contamination. |

---

## Phase 1 — failure inventory

Root-cause buckets, per the KD-9 brief:

- **(a) env-cache** — a module-load-time cached value (a `flags.*` field or the `MODE` constant in a dual-mode store) that the test cannot invalidate. Symptoms: `withEnv({…})` has no effect; mock-only helpers (`_resetStore`, `putGrant`, `_markMockAuth*`) don't drive the store the production code uses; routes return `503` because the feature-flag gate was frozen at load.
- **(b) fixture-drift** — real-Supabase path executes as intended but test fixture input or setup violates the real-schema contract (UUID columns, enums, unique constraints, seed data that doesn't exist in the remote DB). Symptoms: `setup failed`, `create failed`, `invalid input syntax for type uuid`, `invalid input value for enum`, `duplicate key value violates`, length-0 lists where seed data was expected.
- **(c) other** — neither of the above.

Every row below maps to a real failing test in `/tmp/kd9-run.log`. Within each suite, where both buckets appear, they are reported as separate rows.

| # | Suite | Bucket | Domain | Count | Representative expected → actual | Representative error |
|---|---|---|---|---|---|---|
| 1 | `src/lib/storage/__tests__/index.test.ts` | (a) env-cache | upload | 4 | `resolveStorageDriver()` should return `'supabase'` given `FFF_STORAGE_DRIVER=supabase` via `withEnv` → returns `'fs'` | `AssertionError: expected 'fs' to be 'supabase'` |
| 2 | `src/lib/processing/__tests__/pipeline.test.ts` | (b) fixture-drift | upload | 3 | `processDerivative(…)` should return ok under a draft-profile allowance → returns false / real-error string | `AssertionError: expected 'No watermark profile found for level=…' to contain 'not approved'` |
| 3 | `src/lib/processing/__tests__/profiles.test.ts` | (b) fixture-drift | upload | 5 | `getApprovedProfile`, `getProfilesForLevel`, `getAllSeedProfiles` should return seeded mock data → remote DB has no profiles; enum-invalid input throws instead of returning null | `Error: profiles: getApprovedProfile failed (invalid input value for enum watermark_intrusion_level: "invalid")` · `AssertionError: expected [] to have a length of 6 but got +0` |
| 4 | `src/lib/providers/__tests__/service.test.ts` | (b) fixture-drift | other | 12 | `createConnection` / `revokeConnection` / `recordWebhookEvent` / `verifyAndIngestWebhook` should succeed against mock store → real-path INSERT fails or returns native Supabase error shape | `Error: create failed: INSERT_FAILED` · `Error: first create failed` · `Error: seed create failed` · `AssertionError: expected true to be false` |
| 5 | `src/lib/auth/__tests__/provider.test.ts` | (a) env-cache | onboarding | 2 | `_markMockAuthVerified` / `_markMockAuthUnverified` should flip confirmation for real-path `getAuthUserEmailConfirmed` → helpers target mock store only, real path unaffected | `AssertionError: expected false to be true` |
| 6 | `src/lib/auth/__tests__/provider.test.ts` | (b) fixture-drift | onboarding | 6 | `signUpOrAdoptAuthUser` on fresh email should return `kind:'created'` → real Supabase Auth keeps state across runs, returns `'adopted'`; `getAuthUserEmailConfirmed('unknown')` should return `null` → real auth.js rejects non-UUID | `AssertionError: expected 'adopted' to be 'created'` · `Error: @supabase/auth-js: Expected parameter to be UUID but is not` |
| 7 | `src/lib/upload/__tests__/commit-service.test.ts` | (b) fixture-drift | upload | 12 | `commitUpload(…)` should write bytes + insert rows → fixture passes `creator_id: 'creator-1'` to a UUID column, real Supabase rejects before any assertion | `Error: findExistingByToken failed: invalid input syntax for type uuid: "creator-1"` |
| 8 | `src/lib/upload/__tests__/batch-service.test.ts` | (b) fixture-drift | upload | 7 | `createBatch` / `commitBatch` should succeed → 3 direct assertions fail (`expected false to be true`), 4 downstream tests throw from their `createBatch`-backed setup helper | `Error: setup failed` · `AssertionError: expected false to be true` |
| 9 | `src/app/api/v2/batch/__tests__/route.test.ts` | (a) env-cache | upload | 7 | `POST /api/v2/batch` should return 201/400/401 per request → returns 503 because `flags.realUpload` was frozen at module load before `withEnv({FFF_REAL_UPLOAD:'true'})` took effect | `AssertionError: expected 503 to be 201` · `…to be 400` · `…to be 401` |
| 10 | `src/app/api/v2/batch/[id]/commit/__tests__/route.test.ts` | (a) env-cache | upload | 3 | `POST /api/v2/batch/[id]/commit` should return 400/401/404 per request → 503 from frozen `flags.realUpload` | `AssertionError: expected 503 to be 400` · `…to be 401` · `…to be 404` |
| 11 | `src/app/api/v2/batch/[id]/commit/__tests__/route.test.ts` | (b) fixture-drift | upload | 4 | Happy-path + 3 error-path tests depend on `createBatch` setup → setup helper itself fails against real DB before the 200/403/409 cases run | `Error: setup failed` |
| 12 | `src/app/api/upload/__tests__/route.test.ts` | (a) env-cache | upload | 6 | `POST /api/upload` should return 200/400/401/415 per request → 503 from frozen `flags.realUpload` | `AssertionError: expected 503 to be 401` · `…to be 400` · `…to be 415` · `expected [200, 415] to include 503` |
| 13 | `src/lib/entitlement/__tests__/services.test.ts` | (a) env-cache | entitlement | 16 | `resolveDownloadAuthorization` should see grants seeded via `putGrant` (mock-store helper) and return `GRANT_SUSPENDED` / `GRANT_EXPIRED` / `allowed=true` → `MODE` frozen at `'real'`, mock-seeded grants never reach the real-path store, so result is `NO_ACTIVE_GRANT` / `allowed=false` | `AssertionError: expected 'NO_ACTIVE_GRANT' to be 'GRANT_SUSPENDED'` · `…to be 'GRANT_EXPIRED'` · `…to be 'GRANT_REVOKED'` · `…to be 'GRANT_PENDING'` · `expected false to be true` |
| 14 | `src/lib/entitlement/__tests__/authorization-invariants.test.ts` | (a) env-cache | entitlement | 3 | Eligible-role invariants seeded via `putMembership` (mock-store helper) → invariants evaluated against empty real-path store, return `false` where `true` expected | `AssertionError: expected false to be true` |
| 15 | `src/lib/onboarding/__tests__/resume.test.ts` | (a) env-cache | onboarding | 3 | `reconcileOnboardingState` should advance past buyer-details and emit `clear-email-verification` when the mock auth provider reports confirmed → real auth path rejects non-UUID probe IDs, emits `noop` instead of `clear-email-verification` | `AssertionError: expected { action: 'noop' } to deeply equal { action: 'clear-email-verification' }` · `Error: @supabase/auth-js: Expected parameter to be UUID but is not` |
| 16 | `src/lib/onboarding/__tests__/account-creation.test.ts` | (a) env-cache | onboarding | 4 | `createOnboardingAccount` assertions tied to mock-path side effects (username canonicalisation, `reused` flag, grant assertion via `getUserWithFacets`) → real path doesn't exhibit the expected side effects because `_resetStore` on the mock store has no effect on the real store | `AssertionError: expected true to be false` · `AssertionError: expected 'test-user' to be 'mixedcase'` |
| 17 | `src/lib/onboarding/__tests__/account-creation.test.ts` | (b) fixture-drift | onboarding | 2 | Uniqueness + password-mismatch retries expect specific thrown error shapes → real Supabase returns native constraint error; real auth path does not throw on password mismatch in the same branch | `AssertionError: expected [Function] to throw error matching /already taken/i but got 'duplicate key value violates unique c…'` · `AssertionError: promise resolved "{ user: { … } }" instead of rejecting` |
| 18 | `src/lib/onboarding/__tests__/integration.test.ts` | (a) env-cache | onboarding | 4 | End-to-end mock-path assertions (idempotent retry, `users.id` sync, checkpoint clearing, partial-failure recovery) → real path diverges because test never flipped `MODE`; checkpoint branch emits `noop` | `AssertionError: expected false to be true` · `AssertionError: expected true to be false` · `AssertionError: expected { action: 'noop' } to deeply equal { action: 'clear-email-verification' }` |
| 19 | `src/lib/onboarding/__tests__/account-creation-verification.test.ts` | (a) env-cache | onboarding | 2 | `needsEmailVerification` branch assertions depend on mock auth provider defaults — real path's verification-required defaults differ | `AssertionError: expected true to be false` |

---

## Roll-up

### By root-cause bucket

| Bucket | Count | % of 105 |
|---|---:|---:|
| (a) env-cache | **54** | 51.4 % |
| (b) fixture-drift | **51** | 48.6 % |
| (c) other | 0 | 0 % |

Both patterns from the KD-9 brief account for every failing test. No residual bucket needed.

### By domain

| Domain | Count | % of 105 | Suites |
|---|---:|---:|---|
| upload | **51** | 48.6 % | storage/index · processing/pipeline · processing/profiles · upload/commit-service · upload/batch-service · api/v2/batch · api/v2/batch/[id]/commit · api/upload |
| onboarding | **23** | 21.9 % | auth/provider · onboarding/resume · onboarding/account-creation · onboarding/integration · onboarding/account-creation-verification |
| entitlement | **19** | 18.1 % | entitlement/services · entitlement/authorization-invariants |
| other (provider spine) | **12** | 11.4 % | providers/service |

### Cross-tab (bucket × domain)

| | upload | onboarding | entitlement | other | row total |
|---|---:|---:|---:|---:|---:|
| (a) env-cache | 20 | 15 | 19 | 0 | 54 |
| (b) fixture-drift | 31 | 8 | 0 | 12 | 51 |
| column total | 51 | 23 | 19 | 12 | **105** |

Observations (factual, not prescriptive):

- The four API-route suites (api/upload, api/v2/batch, api/v2/batch/[id]/commit) and the storage/index suite are **pure (a) env-cache** — every failure there is a frozen `flags.realUpload` (or `FFF_STORAGE_DRIVER`) not observing a `withEnv` mutation.
- `upload/commit-service` and `upload/batch-service` are **pure (b) fixture-drift** — every failure is a real-Supabase constraint error hit before any assertion.
- `entitlement/*` is **pure (a)** — tests use mock-store helpers (`putGrant`, `putMembership`) that do not drive the real store.
- `providers/service` is **pure (b)** — 12 real-path INSERT / unique-constraint / native-error-shape drifts.
- `auth/provider`, `onboarding/account-creation` are the only suites that **mix buckets** within the same file.

---

## Phase 2 — Categorisation

### Revised hypothesis (per Phase-1 approval amendment, 2026-04-18)

The original KD-9 brief assumed a 3-way sub-CCP split. The Phase 1 inventory surfaced a fourth cluster — the external-provider spine (`src/lib/providers/service.test.ts`, 12 failures, pure fixture-drift, "other" domain). The founder's amendment proposes a 4-way split with the provider spine first:

| Sub-CCP | Cluster | Failures | Buckets | Suites |
|---|---|---:|---|---|
| KD-9.0 | provider spine fixture reset | 12 | pure (b) | `src/lib/providers/service.test.ts` |
| KD-9.1 | upload | 51 | 20 (a) + 31 (b) | 8 (storage, processing×2, upload×2, api×3) |
| KD-9.2 | onboarding | 23 | 15 (a) + 8 (b) | 5 (auth/provider + onboarding×4) |
| KD-9.3 | entitlement | 19 | pure (a) | 2 (entitlement/services + authorization-invariants) |
| **Total** | | **105** | 54 (a) + 51 (b) | 16 |

### Fit check against the Phase 1 inventory

- **Every failure lands in exactly one sub-CCP.** 12 + 51 + 23 + 19 = 105, matches the vitest roll-up.
- **Every failing suite lands in exactly one sub-CCP.** 1 + 8 + 5 + 2 = 16, matches the 16-suite failure set.
- **No suite straddles two sub-CCPs.** The three mixed-bucket suites (auth/provider, onboarding/account-creation, api/v2/batch/[id]/commit) each stay in a single sub-CCP; the bucket split within them determines Phase-3 gating (see per-test tables below), not sub-CCP membership.
- **Cross-tab reconciles.** 20 (a) + 15 (a) + 19 (a) = 54 (a); 31 (b) + 8 (b) + 12 (b) = 51 (b).

**Verdict: the revised 4-way split fits the data.** No counter-proposal needed.

One framing clarification worth flagging: the founder's rationale for KD-9.0 reads "CCP-4 dual-mode stores depend on auth/provider." The 12-failure cluster is `providers/service` (the external-provider connection spine — Stripe/Google credential linkage via `providers/store.ts`), not `auth/provider` (8 failures, in KD-9.2). Both were canonicalised in the same CCP 4 commit (`a89c9a4 feat(mode): canonicalize dual-mode for auth/post/providers`), so the "same dual-mode contract shipped together, retest it first before relying on it downstream" argument holds for either reading. Proceeding with the mapping as written (KD-9.0 = `providers/service`); flagging in case the founder intended a different cluster.

### Sub-CCP allocations

#### KD-9.0 — provider spine fixture reset

- **Scope:** `src/lib/providers/service.test.ts` only (12 tests).
- **Bucket:** pure (b) fixture-drift · **Domain:** other (provider spine).
- **Representative symptoms:** `Error: create failed: INSERT_FAILED` · `Error: first create failed` · `Error: seed create failed` · `duplicate key value violates …` · `expected true to be false`.
- **Why first (founder rationale, expanded):** (i) CCP 4 canonicalised `providers/store.ts` alongside `auth/provider` and `post/store` under the same dual-mode contract; leaving the provider-spine tests red risks masking regressions in the upstream canonicalisation that subsequent sub-CCPs will assume is healthy. (ii) 12 failures in one suite is the smallest, most self-contained cluster — lowest blast radius, cheapest to land first, sets the fixture-reshape pattern that KD-9.1 will reuse at scale.
- **Phase 3 (pattern-a) gating:** **none.** KD-9.0 is 100 % (b); it can land before or independent of the env-cache architecture decision.

#### KD-9.1 — upload

- **Scope:** 8 suites — `storage/index`, `processing/pipeline`, `processing/profiles`, `upload/commit-service`, `upload/batch-service`, `api/upload`, `api/v2/batch`, `api/v2/batch/[id]/commit`.
- **Failures:** 51 · **Buckets:** 20 (a) + 31 (b).
- **Pure-bucket composition:**
  - Pure (a), 17 failures: `storage/index` (4) · `api/upload` (6) · `api/v2/batch` (7).
  - Pure (b), 27 failures: `processing/pipeline` (3) · `processing/profiles` (5) · `upload/commit-service` (12) · `upload/batch-service` (7).
  - Mixed, 7 failures: `api/v2/batch/[id]/commit` (3 a + 4 b).
- **Mixed-suite per-test mapping — `api/v2/batch/[id]/commit`:**

  | # | Test | Bucket | Phase 3 gated? |
  |---|---|---|:-:|
  | 1 | `validation > returns 400 when the batch id is not a UUID` | (a) env-cache | **yes** |
  | 2 | `validation > returns 401 when X-Creator-Id is missing` | (a) env-cache | **yes** |
  | 3 | `error paths > returns 404 when the batch does not exist` | (a) env-cache | **yes** |
  | 4 | `happy path > returns 200 with state=committed when the batch exists and is open` | (b) fixture-drift | no |
  | 5 | `error paths > returns 403 when the creator does not own the batch` | (b) fixture-drift | no |
  | 6 | `error paths > returns 409 when the batch is already committed` | (b) fixture-drift | no |
  | 7 | `error paths > returns 409 when the batch is cancelled` | (b) fixture-drift | no |

- **Phase 3 (pattern-a) gating:** 20 of 51 failures (39.2 %) are (a) and wait on the Phase 3 decision. The 31 (b) failures are not directly gated, but (a) and (b) co-inhabit several files (commit-service + batch-service + the mixed route suite), so in practice KD-9.1 cannot fully close until Phase 3 lands — any test-harness change from Phase 3 will touch the same files a (b) fixture reshape is touching.

#### KD-9.2 — onboarding

- **Scope:** 5 suites — `auth/provider`, `onboarding/resume`, `onboarding/account-creation`, `onboarding/integration`, `onboarding/account-creation-verification`.
- **Failures:** 23 · **Buckets:** 15 (a) + 8 (b).
- **Pure-bucket composition:**
  - Pure (a), 9 failures: `onboarding/resume` (3) · `onboarding/integration` (4) · `onboarding/account-creation-verification` (2).
  - Mixed, 14 failures: `auth/provider` (2 a + 6 b) · `onboarding/account-creation` (4 a + 2 b).
- **Mixed-suite per-test mapping — `auth/provider` (8 failures):**

  | # | Test | Bucket | Phase 3 gated? |
  |---|---|---|:-:|
  | 1 | `signUpOrAdoptAuthUser — happy path > creates a new auth user on first call with a fresh email` | (b) fixture-drift | no |
  | 2 | `signUpOrAdoptAuthUser — password mismatch > throws when the retry password does not match the existing row` | (b) fixture-drift | no |
  | 3 | `signUpOrAdoptAuthUser — verification required > writes new rows as unconfirmed when verification is required` | (b) fixture-drift | no |
  | 4 | `signUpOrAdoptAuthUser — verification required > does not re-apply the verification-required flag after a reset` | (b) fixture-drift | no |
  | 5 | `getAuthUserEmailConfirmed > returns true for a confirmed auth user` | (b) fixture-drift | no |
  | 6 | `getAuthUserEmailConfirmed > returns null for an unknown id` | (b) fixture-drift | no |
  | 7 | `getAuthUserEmailConfirmed > reflects a confirmation flip via _markMockAuthVerified` | (a) env-cache | **yes** |
  | 8 | `getAuthUserEmailConfirmed > reflects an unverification flip via _markMockAuthUnverified` | (a) env-cache | **yes** |

  Of the 6 (b) failures, tests #1–#4 overlap with the **KD-10 candidate** (inter-run state leak — see above); their "first-contact" assertions are also order-dependent on prior `auth.users` rows. Resolving the KD-10 candidate would likely green 4 of these 6; the other 2 would still fail on real-path semantics.

- **Mixed-suite per-test mapping — `onboarding/account-creation` (6 failures):**

  | # | Test | Bucket | Phase 3 gated? |
  |---|---|---|:-:|
  | 1 | `happy path > creates a users row and grants the selected role` | (a) env-cache | **yes** |
  | 2 | `happy path > adopts the auth user id as the users row id` | (a) env-cache | **yes** |
  | 3 | `happy path > lowercases the username on write` | (a) env-cache | **yes** |
  | 4 | `idempotency > adopts the existing row on same-email retry and returns reused=true` | (a) env-cache | **yes** |
  | 5 | `idempotency > throws "taken" when a different email claims the same username` | (b) fixture-drift | no |
  | 6 | `idempotency > throws when the retry password does not match the auth row` | (b) fixture-drift | no |

- **Phase 3 (pattern-a) gating:** 15 of 23 failures (65.2 %) are (a) and wait on the Phase 3 decision. Landing the 8 (b) failures (and the 4 KD-10-overlapping ones above) without first locking the (a) approach risks rework — a chosen (a) mechanism (module reload vs. getter vs. DI seam) changes how these test files set up state.

#### KD-9.3 — entitlement

- **Scope:** 2 suites — `entitlement/services` (16 failures), `entitlement/authorization-invariants` (3 failures).
- **Failures:** 19 · **Bucket:** **pure (a) env-cache** · **Domain:** entitlement.
- **Representative symptoms:** `expected 'NO_ACTIVE_GRANT' to be 'GRANT_SUSPENDED'` · `…'GRANT_EXPIRED'` · `…'GRANT_REVOKED'` · `…'GRANT_PENDING'` · `expected false to be true` · `expected null not to be null`. Tests seed via mock-only helpers (`putGrant`, `putMembership`, `_resetStore` from `../store`) that don't drive the real-path store — `MODE` is frozen at `'real'` because `.env.local` was present at module load, so mock writes have no effect.
- **Phase 3 (pattern-a) gating:** **100 %.** Every one of these 19 failures is blocked on the env-cache architecture decision. KD-9.3 cannot begin until Phase 3 is resolved.

### Phase 3 is a gate, not a parallel workstream

| Sub-CCP | Total failures | (a) env-cache waiting on Phase 3 | % blocked |
|---|---:|---:|---:|
| KD-9.0 | 12 | 0 | **0 %** |
| KD-9.1 | 51 | 20 (+ indirect rework risk on the other 31) | 39.2 % direct |
| KD-9.2 | 23 | 15 | 65.2 % |
| KD-9.3 | 19 | 19 | **100 %** |
| **Aggregate** | **105** | **54** | **51.4 %** |

- **54 of 105 failures (51.4 %) wait on the Phase 3 decision** about how tests should invalidate the module-load-time cached `flags.*` / `MODE`.
- **KD-9.3 cannot start** until Phase 3 is locked. All 19 failures there are (a).
- **KD-9.2 cannot close** without Phase 3 — two-thirds of its failures are (a), and the mixed suites blend (a) and (b) at the file level.
- **KD-9.1 has significant indirect exposure** even though only 39 % of its failures are pure (a): (a) and (b) failures share test files, so any test-harness change from Phase 3 will touch the same files a (b) fixture reshape is touching.
- **KD-9.0 is the only sub-CCP with zero Phase 3 dependency** — which is why the founder's amendment sequences it first.

Treating Phase 3 as parallel (e.g., "start KD-9.1 fixture work while the pattern-(a) debate is in flight") is an anti-pattern here. Sequence to observe: **KD-9.0 → Phase 3 decision locks → KD-9.1 / 9.2 / 9.3 in whatever order Phase 4 resolves.**

### Phase 2 close

Revised 4-way split confirmed against the Phase 1 data. All 105 failures accounted for. Three mixed-bucket suites mapped per-test with Phase-3-gating flags. Phase 3 gate reinforced with numbers. KD-10 flakiness candidate flagged separately.

## Phase 3 — Architecture decision for pattern (a) [GATE — blocks KD-9.1 / 9.2 / 9.3]

### Pattern (a) is two sub-patterns

Per the Phase-2 approval amendment, pattern (a) splits at the module boundary.

**(a.1) — `env.ts` cached `flags.*`.** Concrete shape (`src/lib/env.ts:169–173`):

```ts
export const flags = {
  fffSharing: env.NEXT_PUBLIC_FFF_SHARING_ENABLED === 'true',
  realUpload: env.FFF_REAL_UPLOAD === 'true',
  storageSupabase: env.FFF_STORAGE_DRIVER === 'supabase',
}
```

Booleans derived from a Zod-parsed `env` object. Parsed once in `envSchema.safeParse(process.env)` at module load, `flags` then built as a const object literal. Consumers doing `import { flags } from '@/lib/env'` hold a live reference to that object, but the fields inside are *values* — mutating `process.env` later has no effect. The route-layer 503s (`api/upload`, `api/v2/batch`, `api/v2/batch/[id]/commit` when validation/auth runs before the real-upload path, `storage/index`) all sit on this cache. Surface: 1 file (`env.ts`).

**(a.2) — per-store `MODE` constants.** Concrete shape (e.g. `src/lib/post/store.ts:37`):

```ts
const MODE: 'real' | 'mock' = isSupabaseEnvPresent ? 'real' : 'mock'
```

Computed at each store's module load from `isSupabaseEnvPresent` — itself a const in `env.ts`. The store stores the *string literal result*, not a live binding. Every `if (MODE === 'mock')` branch in each of the 5 stores thus reads a captured value. Entitlement/onboarding/auth tests that assume `MODE='mock'` and seed via mock-only helpers (`putGrant`, `_resetStore`, `_markMockAuth*`, `__testing.reset()`) fail because the real-path branch executes instead. Surface: 5 files (`post/store`, `providers/store`, `media/asset-media-repo`, `processing/profiles`, `auth/provider`).

Important: **fixing (a.1) alone does NOT fix (a.2).** Even if `isSupabaseEnvPresent` became a live getter in `env.ts`, each store's `const MODE = …` evaluates the getter once at import and caches the resulting string. Any option that promises "both" must act on both layers.

### Revision note (2026-04-18)

This Phase 3 was revised after founder review of a prior draft. The prior draft defaulted to Option 4 (module-level reset hooks) and evaluated Option 2 only in its cached-getter variant. Four structural critiques forced a rethink:

- **(i)** Option 4 formalises the KD-8 failure mode — it moves module-load caching to reset-hook-invalidated caching, preserving the discipline gap rather than closing it; a reactive switch condition lets incidents merge before the gap is diagnosed.
- **(ii)** The pure-lazy variant of Option 2 was not evaluated separately. In that variant there is no cache at all; drift becomes structurally impossible rather than policy-enforced.
- **(iii)** The perf objection to Option 2 was dismissed without quantification. Flag reads are on request-handling paths, not hot loops; `process.env.X` is a ~100ns property access. At 1000 req/s a pure-lazy flag read costs ~100µs/sec — 0.01% of a single core. Invisible in APM.
- **(iv)** Option 4's "extends the existing `__testing.reset()` convention" argument conflated two categorically different responsibilities: `__testing.reset()` clears the mock-data `Map` (a test fixture); re-deriving `MODE` re-evaluates an env-derived decision. One hook with two responsibilities = architectural drift, not convention reuse.

This revision: splits Option 2 into cached (2a) and pure-lazy (2b) variants as distinct rows; flips the default to 2b with a non-reactive defense; redefines Option 4 to separate its three reset-responsibility lineages; replaces the asymmetric switch condition with a symmetric chain.

### Options

Each option is scored against (a.1), (a.2), or both. Estimates for "files touched" count direct, intentional edits — not transitive ripple through import sites.

**Option 1 — Test-side only.** `vi.resetModules()` in `beforeEach` + dynamic `await import(...)` of the module under test. Zero production code edited. Every affected test file restructures its imports (top-level static imports become in-body dynamic imports). Mutating `process.env` before each dynamic import yields a fresh parse of `env.ts` and fresh `MODE` evaluation in each store.
- Addresses (a.1): yes · (a.2): yes · both: yes.

**Option 2a — Lazy getters with caching (prior draft's "Option 2").** Replace cached values with property getters that evaluate on first access and memoise the result. Solves "frozen at module load" by relocating it to "frozen at first access." Every consumer that reads before a test's env mutation captures the stale value; cache invalidation is a separate concern. **Strictly dominated by 2b below** and retained here only so the comparison is complete.
- Addresses (a.1): yes · (a.2): yes (only if extended to all 5 stores). Drift pattern preserved, scope smaller.

**Option 2b — Pure-lazy getters, no cache (new, per critique #ii).** Replace cached values with getters that re-read `process.env` on **every** access. No memoisation, no reset hook, no test-only exports.
- For (a.1): `env.ts`'s `flags` becomes `{ get realUpload() { return process.env.FFF_REAL_UPLOAD === 'true' }, … }`. `isSupabaseEnvPresent` becomes a function that re-evaluates on each call. The Zod `safeParse(process.env)` at module load is retained for its boot-time fail-fast side effect on required vars (URL, keys) — gate-flag reads are the only live reads.
- For (a.2): each store rewrites `const MODE = …` to `function getMode() { return isSupabaseEnvPresent() ? 'real' : 'mock' }` and replaces every `MODE ===` check with `getMode() ===`. Syntactic call-site churn (~30–60 references across 5 files); semantics preserved.
- Addresses (a.1): yes · (a.2): yes · both: yes. **Drift is structurally impossible** — no cache means nothing to invalidate, nothing to remember.

**Option 3 — Hybrid DI seam.** Thread `deps = { flags, mode }` through every exported handler / store function. Call-sites either pass explicit deps (in tests) or accept a `defaults()` factory (in prod).
- Addresses (a.1): yes · (a.2): yes · both: yes. Touches every exported function in every dual-mode store and every API route that reads flags. Largest blast radius.

**Option 4 — Module-level reset hooks with separated responsibility lineages (revised per critique #iv).** Convert the relevant module-top `const`s to `let`s; export **distinct** reset functions per responsibility lineage so env-derived resets are never conflated with mock-data resets:
- `env.ts` exports `__resetEnvDerivedState()` — resets `env`, `flags`, `isSupabaseEnvPresent`.
- Each of the 5 stores exports `__resetModeForTests()` — resets the `MODE` constant only.
- `__testing.reset()` in `post/store.ts` (and equivalent helpers wherever they exist) **stays as-is**, continuing to clear mock-data state alone. It is **not** extended to also re-derive mode.
- Three reset lineages across a suite's `beforeEach`: env-derived, mode-derived, mock-data. Named after what they reset, not where they live.
- Addresses (a.1): yes · (a.2): yes · both: yes. **Drift risk is not structural — it is policy-enforced.** Every future cached module-level constant must be added to the correct reset function; omission silently reintroduces the KD-8 failure mode. Mitigable only by convention + lint, never by construction.

### Comparison

Five rows. Perf quantified. Destructuring treated as lintable rather than disqualifying.

| | Option 1 — test-side only | Option 2a — cached getters | **Option 2b — pure-lazy getters** | Option 3 — hybrid DI seam | Option 4 — reset hooks (separated) |
|---|---|---|---|---|---|
| **Addresses a.1 / a.2 / both** | both | a.1 alone unless extended to 5 stores; cache relocated, not eliminated | **both, drift-free by construction** | both | both (via policy, not construction) |
| **Prod files touched** | 0 | 1 (env.ts) for a.1; 6 for both | 6 (env.ts + 5 stores). env.ts: getter/function conversion in ~10 LOC. Each store: ~30–60 call-site rewrites `MODE ===` → `getMode() ===` | ≥30 (env.ts + 5 stores + every route that reads `flags` + every internal caller) | 6 (env.ts + 5 stores), each: `let`-ification + ~8–12 LOC reset export. Two exports per relevant module (env-derived + mode-derived) to honour separation |
| **Test files touched** | ~16 (structural: `vi.resetModules()` + dynamic imports; module-identity hazards for shared helpers) | few (cache still holds across tests until invalidated; extra invalidation discipline) | **few; `withEnv({…}, fn)` just works because reads are live** | ~16 (tests pass explicit `deps`) | ~16 (each suite adds `beforeEach(() => { envReset(); modeReset(); mockReset(); })`; three distinct calls by design) |
| **Perf cost in prod** | none | none (cache hit after first read) | **~100 ns per flag read** (V8 property access on `process.env`). Flag reads are once per request at the 503 guard. At 1000 req/s → ~100–200 µs/sec of added CPU (0.01–0.02% of one core). Request latency is bound by DB round-trips at tens of ms. **Negligible; quantified.** | one extra argument lookup per function call; negligible | none (reset never runs in prod) |
| **Risk of stale / leaky state** | low when tests get it right; **module-identity hazards** real (`vi.resetModules` creates new module graphs; helpers holding singleton refs break) | **moderate — cache relocated, not eliminated.** Any path that writes to the cache without invalidating leaks stale state. Inherits the KD-8-shaped failure mode | **structurally impossible for drift** (no cache). **Destructuring footgun real** (`const { realUpload } = flags` captures at time of destructure) — **lintable**: ESLint `no-restricted-syntax` on `ObjectPattern` applied to the `flags` identifier, plus a one-line file header comment. Not a dealbreaker | very low | **moderate — same shape as KD-8's root cause.** Every future cached constant added without a matching reset entry silently reintroduces this exact failure pattern. Mitigable only by convention + lint, never by construction |
| **Maintenance cost (ongoing)** | high — dynamic-import discipline permanent for every (a)-touching test; refactors cascade | moderate — cache-invalidation policy lives in prod code forever | **low** — no future discipline needed; drift cannot occur | high — DI ceremony inherited by every future handler signature | moderate — "add a reset entry when you add a cached constant" is policy. Custom lint rule to enforce is possible but non-trivial to author |
| **Standing-preferences fit** (simplicity, no overengineering, architecture-first) | mixed — pristine prod, heavy test surface | poor — caching is the problem; adding more caching is the wrong direction | **good fit** — simplest option that eliminates the failure mode structurally; no test-only exports; no ongoing discipline burden; `env.*` stays frozen (string values), `flags.*` become live (gate flags) — a split legible on its own terms | poor — textbook overengineering for a test-harness concern without independent DI rationale | mixed — small prod diff, explicit pattern, but **the failure mode is policy-gated rather than structurally eliminated; this is the exact shape KD-8 surfaced** |

### Recommendation

**Default: Option 2b — pure-lazy getters in `env.ts` and `getMode()` conversion in all 5 dual-mode stores. No hedge.**

Non-reactive defense, addressing critique #i directly:

1. **Option 2b eliminates the KD-9-and-KD-8 failure mode by construction, not by policy.** Every other option — Option 4 most acutely — preserves some form of cache and therefore some form of "remember to invalidate it when you add new state." That is the exact discipline gap KD-8 surfaced. Trading one cache pattern (module-load `const`) for another (reset-hook-invalidated `let`) does not close the gap; it moves it. Option 2b removes the cache entirely. There is nothing to remember because there is nothing to invalidate.
2. **Perf is quantified and negligible.** `process.env.X` is a ~100 ns V8 property access. The 503 gate reads one or two flags per request. At 1000 req/s that is 100–200 µs/sec of added CPU — 0.01–0.02% of a single core. Request latency is bound by DB round-trips at tens of milliseconds; microsecond overhead is invisible in APM. The perf objection I raised in the prior revision does not survive the numbers.
3. **The destructuring footgun is lintable.** ESLint `no-restricted-syntax` on `ObjectPattern[name='flags']` (or an equivalent custom rule), plus a one-line file header comment in `env.ts` documenting the access pattern, closes it. A lintable hazard is not a dealbreaker.
4. **Tests need no structural change.** `withEnv({FFF_REAL_UPLOAD: 'true'}, fn)` just works because reads are live. Contrast with Option 1's 16 test files restructured around `vi.resetModules()` + dynamic imports, or Option 4's 16 suites with `beforeEach` calling three distinct reset functions.
5. **The `env`/`flags` split is architecturally legible.** Under Option 2b, `env.*` (Zod-parsed string values — URLs, keys) stays frozen at boot via the existing fail-fast; `flags.*` and `isSupabaseEnvPresent()` are live reads. Rule: **frozen config, live gates**. The split is motivated by use-case (gate flags are the only values tests need to toggle; long-lived configuration values never change at runtime) and requires no per-future-field judgment.
6. **KD-9.3 (19 pure-(a) failures in `entitlement/*`) greens with zero test-side structural change under 2b.** Contrast with Option 4, which requires each of those 2 test files to add `beforeEach` calls for three distinct reset lineages.

### Switch conditions (symmetric chain — replaces the prior asymmetric single-branch condition)

- **Default: Option 2b (pure-lazy getters).** Chosen because it eliminates the failure mode by construction. Failure trigger: a real-world scenario where live `process.env` reads produce an observable functional bug — e.g., a stateful consumer assumes flag stability for the duration of a request and misbehaves when the value shifts mid-flight. Named and falsifiable.
- **Primary fallback: Option 4 with separated hook lineages.** Switch if and only if 2b fails empirically per the trigger above. Option 4 trades the structural guarantee for explicit discipline; its own failure mode (reset-drift) is known, policy-enforced, and well-understood from KD-8. **Failure trigger:** ≥2 reset-drift incidents in 60 days (a new cached constant shipping without a matching reset entry and leaking stale state into a test run).
- **Secondary fallback: Option 1 (test-side only).** Use if **and only if** both Option 2b and Option 4 have failed empirically. Highest test churn of the chain; keeps prod pristine as consolation.
- **Ruled out — Option 2a (cached getter).** Strictly dominated by 2b: 2a touches the same 6 files but retains a cache, therefore retains drift, therefore offers no advantage over 2b while carrying 2b's cost.
- **Ruled out — Option 3 (DI seam).** Overengineering without an independent architectural need (multi-tenancy, per-request flag resolution). Reconsider only if that need lands on the roadmap.

### Phase 3 close

Revised per founder critique. One default with a non-reactive defense grounded in structural elimination of the failure mode. Option 4 retained as primary fallback only, with its three responsibility lineages explicitly separated so any future use does not conflate env-derived reset with mock-data reset. Symmetric fallback chain. Option 2a and Option 3 ruled out. No code, no vitest config, no test edits in this phase — decision only.

## Phase 4 — Sub-CCP sequencing

*Deferred.*

---

*Phase 3 revised 2026-04-18. Stop marker: no further sections drafted until founder responds approve / approve-with-corrections / revise / reject on the Option 2b default.*
