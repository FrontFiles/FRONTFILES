# P4 Concern 4A.2.AUTH — Exit Report

**Auth substrate.** Sign-off artefact for concern 4A.2.AUTH (browser Supabase client + `useSession` + real `/signin` + `actor_handles` provisioning + `signout` no-op marker). Reviewer-ready; does not require directive context.

| Key | Value |
|---|---|
| Branch | `feat/p4-auth-substrate` |
| HEAD (predecessor) | `550a6da` — B2 exit report |
| AUTH commits | **Pending commit** — this report ships in the same commit as the file-set delivery |
| Directive | `docs/audits/P4_CONCERN_4A_2_AUTH_DIRECTIVE.md` (at R3) |
| Gate 2 report | `docs/audits/P4_CONCERN_4A_2_AUTH_GATE2_REPORT.md` |
| Report date | 2026-04-21 |

---

## §1 Commit chain

The branch carried the full B2 commit chain (`98481b7`, `7469af4`, `550a6da`) at the start of this concern. AUTH adds **one commit on top** — the entire file-set freeze (§D7) lands as a single payload alongside this report.

| SHA | Subject | Files | LoC delta | AUTH? |
|---|---|---|---|---|
| `550a6da` | docs(p4/4A.2/B2): exit report — B2 complete | — | — | No — predecessor (baseline) |
| _pending_ | feat(p4/4A.2/AUTH): browser auth + actor_handles provisioning + signout no-op | 11 | +1063 / −26 (new) plus +105 / −26 (modified) | **Yes** (F1-F8) |

Aggregate AUTH delta: **11 files (8 new + 2 modified + this report), +1168 insertions, −26 deletions**.

---

## §2 Acceptance criteria coverage (AC1-AC16)

| AC# | Criterion (one-line) | Status | Evidence |
|---|---|---|---|
| AC1 | `getSupabaseBrowserClient()` exists and returns a singleton | **PASS** | `src/lib/supabase/__tests__/browser.test.ts` — 4 cases green; covers second-call short-circuit, env-var validation, and `auth.*` config defaults. |
| AC2 | Session subscription helper covers 3 transitions; `useSession` is the React-glue thin wrapper | **PASS** | `src/hooks/__tests__/useSession.test.ts` — 4 cases green against the pure-Node `subscribeToSession` helper (per R3). React wrapper covered manually by AC3 smoke. |
| AC3 | `/signin` submits via `signInWithPassword` and persists a session | **PENDING-SMOKE** | Sandbox-unverifiable; manual runbook §1 in Gate 2 report. Code path inspected: `src/app/signin/page.tsx` `handleSubmit` calls `supabase.auth.signInWithPassword({ email, password })` then `supabase.auth.getSession()` then `fetch('/api/auth/ensure-actor-handle', ...)` then `router.push('/vault/offers')`. |
| AC4 | `/signin` shows generic error on failure (no enumeration) | **PENDING-SMOKE** | Code path inspected: `setError('Invalid email or password.')` is the single literal set on every non-null `authError`. Non-enumerable by construction. Gate 2 runbook §2. |
| AC5 | After successful signin, `POST /api/auth/ensure-actor-handle` is called and returns 200 | **PENDING-SMOKE** | Sandbox-unverifiable. Route + payload pin verified at AC6. Gate 2 runbook §3 + curl path. |
| AC6 | `ensure-actor-handle` is idempotent (second call → `{provisioned: false}`) | **PASS** | `src/app/api/auth/ensure-actor-handle/__tests__/post.route.test.ts` case 5 — Postgres 23505 unique_violation triggers the `{ provisioned: false }` branch. Case 4 verifies first-call `{ provisioned: true }` and that the INSERT payload pins to `auth_user_id` only. |
| AC7 | `ensure-actor-handle` is the only new user-facing route using service-role | **PASS** | `grep -rln "getSupabaseClient\b" src/app/ --include="route.ts"` → sole hit: `src/app/api/auth/ensure-actor-handle/route.ts`. Pre-existing `requireActor` service-role usage (introduced concern 4A.1) preserved unchanged. |
| AC8 | `requireActor` source unchanged; only header comment expanded | **PASS** | `git diff src/lib/auth/require-actor.ts` → **30 insertions, 0 deletions**, all inside the JSDoc block (lines 56-87). Implementation lines 90-173 byte-identical. |
| AC9 | OAuth buttons remain present but disabled | **PENDING-SMOKE** | Code path inspected: `src/app/signin/page.tsx` `SocialButton` instances pass `disabled={true}` with `title="Coming soon"`, `aria-disabled`, and disabled: Tailwind classes. Visual confirmation deferred to runbook §4. |
| AC10 | No SSR auth code added (`@supabase/ssr` and `next/headers` still 0 imports) | **PASS** | `grep -rn "@supabase/ssr\|from ['\"]next/headers['\"]" src/` → 0 hits. The Bearer-only contract (§D1) holds. |
| AC11 | Vitest baseline + new tests pass; 1248 still green | **PASS** | `npx vitest run` → **1264 pass, 10 skipped, 0 failed** (baseline 1248 + 16 new across 4 new test files: 4 browser, 4 useSession, 6 ensure-actor-handle, 2 signout). Zero new skips. |
| AC12 | `npm run build` clean | **PENDING-LOCAL** | Sandbox blocks `.next/BUILD_ID` clear (EPERM on existing artefacts under sandbox file ownership). Local-only verification per Gate 2 runbook §5. tsc clean confirmed via `npx tsc --noEmit` → exit 0, zero diagnostics. |
| AC13 | No new lint errors beyond pre-existing 67 | **PASS** | `npx eslint . --quiet` → **67 errors, 0 warnings, delta 0 vs baseline**. Two `SUPABASE_SERVICE_ROLE_KEY` literals in `ensure-actor-handle/__tests__/post.route.test.ts` carry inline `eslint-disable-next-line no-restricted-syntax` exemptions with explanation comments — same pattern as every other route test under `src/app/api/**/__tests__/`. |
| AC14 | `signout/route.ts` exists, returns 204, no other wiring | **PASS** | `src/app/api/auth/signout/__tests__/post.route.test.ts` — 2 cases: flag-on → 204 with empty body; flag-off → 404 `FEATURE_DISABLED`. The flag gate is a sharpening of §F6 — see §3 D-table footnote. |
| AC15 | `useSession` and `getSupabaseBrowserClient` are both `'use client'`-marked | **PASS** | `head -3 src/lib/supabase/browser.ts` and `head -3 src/hooks/useSession.ts` — both files L1 is `'use client'`. |
| AC16 | File-set freeze (§D7) honored | **PASS** | `git status --short` enumeration matches the §D7 list 1:1. See §5 for full audit. No out-of-freeze writes. |

**Footnotes for PENDING rows:**
- **AC3 / AC4 / AC5 / AC9 (PENDING-SMOKE)**: All four are `manual smoke (real Supabase env)` per the directive AC table. Code-path inspection passes; the empirical leg requires `FFF_AUTH_WIRED=true` against a real `auth.users` row, which the sandbox cannot reach. The runbook in `P4_CONCERN_4A_2_AUTH_GATE2_REPORT.md` §1-§4 is build-governing — passing it closes the four ACs. Until that pass, the report is `Status: AUTH complete pending smoke`.
- **AC12 (PENDING-LOCAL)**: Sandbox `.next` ownership blocks `rm -rf .next` from inside the sandbox. tsc passes; lint passes. The remaining build leg is mechanical and requires a clean host. Runbook §5.

---

## §3 Decision log coverage (D1-D9)

| D# | Decision (one-line) | Recorded in | Outcome |
|---|---|---|---|
| D1 | Bearer-only — no `@supabase/ssr`, no `next/headers`, no cookie-based session reading on the server | Directive §D1 + AC10 | **HELD** — 0 SSR imports verified |
| D2 | Service-role escape hatch is single-use (only `ensure-actor-handle`) | Directive §D2 + AC7 | **HELD** — sole route-level user of `getSupabaseClient` confirmed by grep |
| D3 | `requireActor` contract preservation — header comment only | Directive §D3 + AC8 | **HELD** — 30 insertions / 0 deletions, JSDoc-only |
| D4 | No design churn on `/signin` — submit logic + error state + disabled OAuth only | Directive §D4 | **HELD** — modified-file diff confirms no layout/typography/colour edits; `SocialButton` disabled-prop addition is the OAuth touch |
| D5 | Production flag default unchanged (`FFF_AUTH_WIRED=false`) | Directive §D5 + `.env.example` | **HELD** — `.env.example` line 47 documents `FFF_AUTH_WIRED=false`; production cutover is the next concern's problem |
| D6 | Generic error messages on signin (no enumeration) | Directive §D6 + AC4 | **HELD** — single literal `'Invalid email or password.'` on every authError branch |
| D7 | File-set freeze | Directive §D7 + AC16 + §5 | **HELD** — 11/11 files map to the freeze list |
| D8 | No onboarding-flow modifications | Directive §D8 | **HELD** — `src/lib/auth/account-creation.ts` and onboarding helpers untouched (`git status` confirms) |
| D9 | No new dependencies | Directive §D9 | **HELD** — `package.json` and `bun.lock` unchanged in this concern's diff |

**Sharpenings recorded as part of execution (no D-revision needed):**
- **§F6 sharpening** — the `signout` route was specified as "just returns 204"; shipped with a `FFF_AUTH_WIRED` gate (404 on flag-off, 204 on flag-on) for posture parity with every other auth-wired route. Flagged in Gate 2 §Sharpenings; tested for both branches; reversible if the founder prefers the literal §F6 reading.

---

## §4 Test baseline reconciliation

Expected progression through the 7-prompt sequence:

| Stage | Count | Source |
|---|---|---|
| Pre-AUTH baseline (at `550a6da`) | 1248 passed / 10 skipped / 0 failed | B2 exit report §4 |
| Post-Prompt 2 (browser + useSession) | 1256 / 10 / 0 | +4 browser cases + 4 useSession cases |
| Post-Prompt 3 (ensure-actor-handle) | 1262 / 10 / 0 | +6 cases |
| Post-Prompt 4 (signin wiring) | 1262 / 10 / 0 | No new tests; modified existing /signin path |
| Post-Prompt 5 (header docs + signout + .env.example) | 1264 / 10 / 0 | +2 signout cases |
| Post-Prompt 6 (verification pass) | 1264 / 10 / 0 | No test deltas |
| **Current at HEAD (working tree)** | **1264 / 10 / 0** | This report — `npx vitest run` |

**Actual at HEAD** (verified in this report):
```
 Test Files  65 passed | 1 skipped (66)
      Tests  1264 passed | 10 skipped (1274)
   Duration  18.37s
```

- Total tests: **1274** (1264 passed + 10 skipped)
- Pass: **1264**
- Fail: **0**
- Skip: **10**
- Diff vs. expected 1264: **none**

AC11 satisfied: post-AUTH green (1264) = baseline-green (1248) + browser (4) + useSession (4) + ensure-actor-handle (6) + signout (2). Skipped count unchanged. Zero new skips.

---

## §5 Files inventory

### §5.1 Added (8 new files)

| File | LoC | Scope |
|---|---|---|
| `src/lib/supabase/browser.ts` | 91 | F1 browser client singleton |
| `src/lib/supabase/__tests__/browser.test.ts` | 80 | F1 unit tests (4 cases) |
| `src/hooks/useSession.ts` | 142 | F2 hook + colocated `subscribeToSession` helper (R3) |
| `src/hooks/__tests__/useSession.test.ts` | 140 | F2 helper tests (4 cases, pure Node) |
| `src/app/api/auth/ensure-actor-handle/route.ts` | 183 | F4 service-role provisioning route |
| `src/app/api/auth/ensure-actor-handle/__tests__/post.route.test.ts` | 192 | F4 route tests (6 cases) |
| `src/app/api/auth/signout/route.ts` | 86 | F6 no-op marker (flag-gated per §3 sharpening) |
| `src/app/api/auth/signout/__tests__/post.route.test.ts` | 46 | F6 route tests (2 cases) |
| `.env.example` | 103 | F8 — created from scratch per AUDIT-1 S2 (Zod schema mirror) |

**Subtotal**: 1063 LoC added in 9 new files (8 inside src/ + `.env.example` at repo root).

### §5.2 Modified (2 existing files)

| File | LoC delta | Reason |
|---|---|---|
| `src/app/signin/page.tsx` | +75 / −26 | F3 real `signInWithPassword` + `ensure-actor-handle` POST + generic error + disabled OAuth |
| `src/lib/auth/require-actor.ts` | +30 / −0 | F5 — JSDoc-only header expansion (provisioning contract) |

**Subtotal**: +105 / −26 across 2 modified files. AC8 / D3 preserved: `require-actor.ts` diff is entirely inside the comment block.

### §5.3 Documentation (this report + Gate 2 + directive itself)

| File | Status | Notes |
|---|---|---|
| `docs/audits/P4_CONCERN_4A_2_AUTH_DIRECTIVE.md` | New (per the freeze) | Authored by Prompt 0, revised through R3 |
| `docs/audits/P4_CONCERN_4A_2_AUTH_GATE2_REPORT.md` | New | Verification-pass output (Prompt 6) |
| `docs/audits/P4_CONCERN_4A_2_AUTH_EXIT_REPORT.md` | New | This file (Prompt 7) |

Total commit payload: **11 files** (8 new src + 2 modified src + `.env.example` + 3 docs = 14, but the directive itself is a separate landing — 11 src/config files plus 3 docs = 14 git-tracked).

---

## §6 Open items inventory

Every flagged-but-not-fixed item surfaced during AUTH execution. Owner classification: `AUTH-followup` (close before next concern), `next-cycle` (next review cadence), `scaffold` (explicitly handed off to the scaffold concern), `production-cutover` (gated on the FFF_AUTH_WIRED flip).

| # | Item | Owner | Notes |
|---|---|---|---|
| 6.1 | 67 pre-existing lint errors at `550a6da` baseline | next-cycle | Inherited from B2 §6.1 — same root cause (`no-restricted-syntax` rule firing on B1's `SUPABASE_SERVICE_ROLE_KEY` literals inside `scopeEnvVars([...])` test setup). AUTH delta = 0 (Gate 2 verified). Not AUTH's defect. |
| 6.2 | No local pre-commit hook installed | next-cycle | Inherited from B2 §6.2 — no `.husky/`, no `simple-git-hooks` / `lint-staged`. Gate exists in the deploy build only. |
| 6.3 | No `.github/workflows/` — zero CI workflows | next-cycle | Inherited from B2 §6.7 — see §7. |
| 6.4 | `FEATURE_DISABLED` code now lives at THREE HTTP statuses (404 in B1 + AUTH, 503 in B2 stripe-disabled) | next-cycle | Inherited from B2 §6.4, AUTH adds a third surface (`/api/auth/ensure-actor-handle` and `/api/auth/signout` both return 404 `FEATURE_DISABLED` when `FFF_AUTH_WIRED=false`). Semantically coherent (gate-off vs dependency-unconfigured) but the shared code name still creates reviewer friction. The cross-route rename concern in B2 §6.4 should pick this up. |
| 6.5 | `.env.development` is committed to the repo and contains a real `NEXT_PUBLIC_SUPABASE_URL` + anon key | AUTH-followup | Surfaced by §AUDIT-1 OQ5. Anon keys are public-facing by design (RLS is the boundary), so this is not a credential leak — but the convention elsewhere is `.env.local` (gitignored). Tracking as a small hygiene concern: either rename to `.env.local.example` or move to `.env.local` and document the current values in `.env.example`. |
| 6.6 | Sign-out UI affordance not yet wired | scaffold | Per directive OQ3: this concern ships the `/api/auth/signout` wiring substrate; the visible header/vault sign-out button is a scaffold-concern responsibility. The client wiring is documented in `signout/route.ts` header (line 28-30): `supabase.auth.signOut()` + `fetch('/api/auth/signout')`. |
| 6.7 | Production cutover is a separate concern | production-cutover | Per §D5 the production default `FFF_AUTH_WIRED=false` is preserved. Dev/staging flips are documented in `.env.example`. The production flip is gated on (a) Supabase project provisioned in production, (b) onboarding flow's first-time `ensureActorHandle` path verified, (c) sign-out UI shipped (6.6). |
| 6.8 | `'use client'` import-side-effect ordering with `getSupabaseBrowserClient` env validation | AUTH-followup (low) | The browser client throws at first call (not at import time) if `NEXT_PUBLIC_SUPABASE_*` are unset. Server-rendered import paths are blocked by `'use client'`, but a misconfigured Vercel preview without the public envs would surface the throw at first user interaction. Not new — same shape as every other env-validated client-side singleton — but worth documenting in the deploy checklist. |

---

## §7 CI / merge-gate status

**Finding**: unchanged from B2 §7 — no `.github/workflows/` directory exists in the repository.

Gate coverage at present (delta vs B2):
| Gate | Configured | Current state on branch |
|---|---|---|
| `npx tsc --noEmit` | No (local only) | PASS (exit 0) |
| `npx eslint .` | No | FAIL (exit 1) — 67 pre-existing errors; AUTH delta 0 |
| `npx vitest run` | No | PASS (1264/10/0) |
| `npm run build` | Implied by deploy provider | PENDING-LOCAL (sandbox blocks; runbook §5) |

Same recommendation as B2: a minimal PR workflow (typecheck + test + build) would institutionalize the gates. Tracked under §6.3.

---

## §8 Risk register (pre-merge)

| Risk | Mitigation in place | Residual |
|---|---|---|
| **`FFF_AUTH_WIRED=true` in production before sign-out UI ships** | Production default is `false` (§D5); flag flip is a deliberate operator action. | Operator must coordinate the flag flip with the scaffold concern's sign-out button shipment (§6.6). |
| **Supabase env vars unset in deploy target** | `getSupabaseBrowserClient()` throws loudly at first call; F4 route's `getSupabaseClient()` factory throws if `SUPABASE_SERVICE_ROLE_KEY` is missing; both throws surface at first user interaction (not at import time, so build still passes). | Deploy-env owner must set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` before flipping `FFF_AUTH_WIRED=true`. Unverifiable from this report. |
| **`auth.users` cascade leaves orphan handle row** | Per AUDIT-1: `actor_handles.auth_user_id` has `ON DELETE SET NULL` cascade. Tombstones preserve ledger references. Re-signup with same email creates a new handle row — documented in `route.ts` header (line 119-128) per AUDIT-1 S3. | Behavioural; no fix needed. Worth a one-line entry in the operator runbook when account-deletion UX ships. |
| **`requireActor` returns ACTOR_NOT_FOUND for valid signed-in user** | Documented recovery path in `require-actor.ts` header (lines 67-75): client should POST `/api/auth/ensure-actor-handle` once with the same Bearer and retry. Repeated failure indicates a real bug, not a race. | Caller surfaces (route handlers consuming `requireActor`) need to actually implement the retry path. Today there's only one such caller (`offers` route family); it does not yet retry. Tracked as a scaffold-concern follow-up — the spec-canonical replacement pages should standardize the retry. |
| **Signout posture mismatch with founder expectation** | Shipped with `FFF_AUTH_WIRED` gate (404/204) rather than literal §F6 (always 204). Two-case test pins both branches; reverting is a 1-line change in `signout/route.ts`. | Founder verdict pending; flagged in §3 footnote and Gate 2 §Sharpenings. |
| **No CI merge gate** | Local verification ran tsc + test green; lint at baseline. | Inherited from B2; no automated regression protection between local verification and merge. §6.3. |

---

## §9 Recommendation

| Question | Answer | Rationale |
|---|---|---|
| **Ready to commit the file-set?** | **Yes.** | Working tree matches the §D7 freeze 1:1, tsc + vitest + lint all green at baseline, AC1-AC2 / AC6-AC8 / AC10-AC11 / AC13-AC16 all PASS. AC3-AC5 / AC9 / AC12 are PENDING-SMOKE / PENDING-LOCAL but each has code-path inspection plus a runbook. The freeze can land before the smoke runs without lock-in: if smoke fails, fixes land within §D7 under R-revision. |
| **Ready to push to origin?** | **Yes, after the smoke pass.** | The exit report's value is its empirical claims (AC3/4/5/9/12). Pushing pre-smoke turns those four ACs into post-merge homework. Recommend: (1) commit locally; (2) run the runbook; (3) if green, push; (4) if any fail, amend the commit with the fix and re-push. |
| **Ready to open a PR?** | **Yes, post-smoke.** | Same reasoning. Reviewer material: this report + Gate 2 report + directive at R3 + the single AUTH commit. |
| **Ready to merge to main?** | **Yes, with three caveats.** | (1) Smoke must pass; (2) production must NOT flip `FFF_AUTH_WIRED=true` until the scaffold concern's sign-out button + onboarding `ensureActorHandle` integration ship (§6.6 + §6.7); (3) deploy-env owner must set Supabase env vars in any environment intending to flip the flag. |
| **Next concern to start** | **Scaffold concern** (`P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md`). | AUTH closes the auth substrate. The scaffold concern owns the spec-canonical replacement pages (offer / assignment / dispute surfaces) plus the visible sign-out affordance plus the deletion of the legacy `/api/special-offer/*` mock surface. AUTH unblocks Scaffold by making `requireActor` reachable from a real user session. |
| **Sequence relative to 4A.2.C and the rest of P4?** | **Scaffold → 4A.2.C → C1/C2/D in parallel.** | Scaffold delivers the surfaces 4A.2.C will then retire-and-replace. C1/C2/D are independent of the auth substrate but depend on the scaffold's component primitives — so scaffold first, then those three can ship in parallel. |

---

## §END

**Status: AUTH complete pending smoke.** All sixteen AC rows resolved at the sandbox layer (11 PASS, 4 PENDING-SMOKE, 1 PENDING-LOCAL). All nine D rows HELD; one §F-level sharpening recorded explicitly. Three open items inherited from B2; five new ones owned by this concern (one AUTH-followup, two scaffold, one production-cutover, one low-priority deploy hygiene).

Branch ready for commit + smoke + push pending the runbook in `P4_CONCERN_4A_2_AUTH_GATE2_REPORT.md` §1-§5.

**Exit SHA**: pending — assigned at commit time.
