# Frontfiles Remediation Plan — 2026-04-18

**Source audit:** `docs/audits/CODEBASE_AUDIT_20260418.md` (216 lines, overall verdict = **revise**).
**Scope of this plan:** the 7 systemic themes identified in the audit, sequenced by dependency.
**Owner:** João Nuno Martins.
**Format:** 11 tiers. Each tier lists files, exact edits, a one-line acceptance test, and its dependency on prior tiers.

---

## Grounding counts (verified 2026-04-19)

Counts produced during the plan-writing pass against working tree at `097b5a3`. Pasted verbatim from grep output; not re-derived. Use these as the concrete scope of work whenever a tier body says "the 19 routes" / "the 14 routes" / etc.

### A. Header-trust sites — `x-frontfiles-user-id` (11 files, 13 match lines including comments/JSDoc)

Real identity reads (10 sites):
- `/Users/jnmartins/dev/frontfiles/src/app/api/media/[id]/route.ts:88`
- `/Users/jnmartins/dev/frontfiles/src/app/api/posts/[id]/route.ts:50`
- `/Users/jnmartins/dev/frontfiles/src/app/api/providers/connections/[id]/route.ts:28`
- `/Users/jnmartins/dev/frontfiles/src/app/api/entitlements/[assetId]/route.ts:25`
- `/Users/jnmartins/dev/frontfiles/src/app/api/providers/connections/route.ts:54`
- `/Users/jnmartins/dev/frontfiles/src/app/api/posts/route.ts:107`
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/[packageId]/route.ts:30`
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/route.ts:22`
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/[packageId]/download/route.ts:40`
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/[packageId]/artifacts/[artifactId]/route.ts:60`

Client-side header setter (outgoing, 1 site; migrates in T2 once `requireActor` is real):
- `/Users/jnmartins/dev/frontfiles/src/lib/post/client.ts:216`

Comment-only hits (not sites, do not edit): `src/lib/post/client.ts:201` (JSDoc), `src/app/api/providers/connections/route.ts:24` (comment).

**Plan-body references that use this list:** T1 "the 19 files" (11 header-trust + 8 body-extracted).

### B. Body-extracted actor-id sites — `body.(buyerId|actorId|requesterId|responderId|authorId)` (8 files, 25 match lines)

- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/route.ts:64,72,81,86`
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/accept/route.ts:23,31`
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/counter/route.ts:23,31`
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/decline/route.ts:23,30`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/route.ts:16,26,30`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/cancel/route.ts:22,26`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/ccr/route.ts:33,38,47,53,61,67`
- `/Users/jnmartins/dev/frontfiles/src/app/api/posts/route.ts:137,154`

Excluded: `src/lib/identity/guards.ts:89` — JSDoc example (`*   const denial = await requireGrant(body.buyerId, 'buyer')`), not a real site.

**Plan-body references that use this list:** T1 (8 body-identity files).

### C. Role-scoped mutation routes that LACK `requireGrant` (14 routes)

Derived by subtraction: 16 role-scoped mutation routes minus the 2 that currently call `requireGrant` (`src/app/api/special-offer/route.ts:72`, `src/app/api/assignment/route.ts:26`).

- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/accept/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/counter/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/decline/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/accept/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/cancel/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/ccr/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/dispute/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/fulfil/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/review/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/review-open/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/providers/connections/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/providers/connections/[id]/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/posts/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/posts/[id]/route.ts`

**Plan-body references that use this list:** T2 ("14 routes requiring `requireGrant` coverage").

### D. Routes that fetch user-supplied URLs — T5 SSRF scope

**Count: 0** in `src/app/api/**`.

`rg "fetch\(" src/app/api` returns zero matches. `rg "fetch\([^'\"\`]" src/app/api` (variable-expression fetch) also zero. `src/lib` has exactly two `fetch` calls, both in `src/lib/post/client.ts` (:64 and :212) — both hit first-party API routes with relative/constructed URLs, not user-supplied external URLs.

Implication for T5: the SSRF remediation is **pre-emptive**, not reactive. The `safeFetch` helper proposal stands as a guard-rail to prevent future SSRF once (e.g.) OAuth callbacks, provider-imported URLs, or webhook-delivered payload URLs land. The inventory step of T5 is therefore already complete; the memo can proceed directly to the guard-rail proposal.

### E. LOC delta estimate per tier

Blank where not yet determinable. Update during execution.

| Tier | Net LOC delta | Notes |
|---|---|---|
| T0 | **~ -80** | route delete (~85 LOC) + ~3 line × 3 sanitizer edits |
| T0b | **~ +3 / -1** | `package.json` only |
| T0.5 | 0 in `src/` | memo is `docs/`, not counted against source |
| T1 | **~ +50 net** | new `requireActor.ts` (~30 LOC) + ~19 × (-3 header/body read, +1 actor call) |
| T1b | 0 in `src/` | memo only |
| T2 | — | depends on `@supabase/ssr` presence + session plumbing shape |
| T2b | 0 in `src/` | memo only |
| T3 | — | `userClient.ts` ~40 LOC + 15 call-site migrations |
| T4 / Path A | — | full Supabase branches on two stores + mappers + integration tests |
| T4 / Path B | **~ -50** | flag-gate + delete mock wiring |
| T5 | 0 in `src/` | memo only |
| P1 | — | `AssetFormat` normalisation touches 18 files |
| P2 | — | `parseBody` in 29 routes, ~2 lines saved, ~4 lines added per route |
| P3 | — | helper consolidation across 4 domains |
| P4 | **~ +15 / -8** | env schema additions + removed `process.env` reads |
| P5 | **~ -3** | env schema deletion |

### F. Known test-env drift

Added during T0 execution (2026-04-20). Not a tier; parallel KD-9-family track.

- **Pre-T0 baseline.** 885 tests total: **875 passed / 1 failed / 9 skipped**, plus **17 test files failing to load** before any tests in them execute.
- **Error fingerprint 1.** `Error: Environment validation failed — see errors above. This is a fail-fast by design.` — originates from `src/lib/env.ts` Zod fail-fast block. **Affects 16 of 17 failing files.**
- **Error fingerprint 2.** `Error: Cannot find module '@/lib/assignment/store'` — raised by a dynamic `require()` call inside `src/lib/assignment/__tests__/api-helpers.test.ts`. **Affects 1 of 17 failing files.**
- **Gap vs audit snapshot.** The audit (2026-04-18) cited a 1080 passed / 1 skipped baseline in `CODEBASE_AUDIT_20260418.md §Current-state inventory`. Actual today is 875 / 1 failed / 9 skipped + 17 file-load errors — **~205 tests not executing** vs the audit figure.
- **Category.** KD-9 follow-up family (test-env loading, mock-mode sentinels). **Not a tier** in this plan. Runs on a parallel track.
- **T0 stance.** Via `git stash --include-untracked` + rerun, the baseline before and after T0 edits is **identical** (875/1/9 + 17 file-load errors). T0 introduces zero regression. Accepted on that basis; see T0 §Acceptance test.

---

## What this plan is *not*

- **Not P5.** The `direct_offer → special_offer` schema rename is a separate, paused programme. Residue findings (J-1 through J-5 in the audit) are deliberately left alone here. Do not use this plan to bypass the P5 queue.
- **Not feature work.** No new product surface, no new routes, no new UI screens, no new migrations that introduce domain entities. Only remediations of existing code, dependencies, and architecture.
- **Not a styling or routing pass.** Tailwind class hygiene, component decomposition, design tokens, route-group renames, and typed-route drift are explicitly out of scope.
- **Not an infrastructure change.** Vercel envs, Supabase project selection, Sentry DSNs, domain DNS, CI providers are untouched. This plan changes code only.
- **Not a time estimate.** Tiers are ordered by dependency, not by calendar. Size estimates were in the audit's execution plan; this document intentionally omits them.

---

## Tier map

```
T0  ──►  T0b  (parallel-safe with T0)
   │
   ▼
T0.5 (product decision — blocks T4)
   │
T1  ──►  T1b  (depends on T1 actor)
   │
   ▼
T2  ──►  T2b  (depends on T2 session)
   │
   ▼
T3
   │
   ▼
T4  (depends on T0.5 decision)
   │
   ▼
T5

Parallel  (no tier dependency — can start any time)
```

---

## T0 — Zero-risk deletions

**Goal.** Remove the live cash-out vector and stop leaking internal error messages in response bodies. Both edits are small, reversible, and do not depend on any infrastructure change.

**Files to touch (full paths):**
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/webhook/stripe/route.ts` — **delete entire file**
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/webhook/` — remove the empty directory after the route file is deleted
- `/Users/jnmartins/dev/frontfiles/src/lib/assignment/api-helpers.ts` — edit at line 60 (`withInternalError` / `toErrorResponse`, whichever currently composes the 500 body)
- `/Users/jnmartins/dev/frontfiles/src/lib/special-offer/api-helpers.ts` — edit at line 39
- `/Users/jnmartins/dev/frontfiles/src/lib/post/api-helpers.ts` — edit at line 40

**Exact edits:**
1. Delete `src/app/api/assignment/webhook/stripe/route.ts`. Run `rg "assignment/webhook/stripe" --type ts --type tsx` across the repo and confirm zero matches outside of tests, docs, and the audit file. If any production import remains, stop and reopen investigation — do not ship a delete that leaves dangling references.
2. In each of the three `api-helpers.ts` files, wrap the outgoing error body with a sanitizer that reads:
   ```ts
   const clientMessage =
     process.env.NODE_ENV !== 'production' ? err.message : 'Internal server error'
   return NextResponse.json(
     { error: { code: 'INTERNAL_ERROR', message: clientMessage } },
     { status: 500 },
   )
   ```
   Keep the existing `console.error(...)` / Sentry capture on the server side unchanged — only the wire payload changes.
3. The `providers/api-helpers.ts` variant (audit E-1) already gets this right. Do not edit it. Consolidation into one shared helper is Parallel, not T0.

**Acceptance test.** `rg "assignment/webhook/stripe" -t ts -t tsx` returns zero hits, and a forced 500 on any assignment/special-offer/posts mutation returns `{ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }` under `NODE_ENV=production`. Vitest suite returns no regression vs current baseline: 875 passed / 1 failed / 9 skipped, plus 17 file-load errors. Baseline drifted pre-T0 — see §Known test-env drift.

**Depends on.** Nothing. T0 is the first safe landing.

---

## T0b — Package hygiene

**Goal.** Stop shipping a CLI scaffolder (`shadcn`) into production, and declare `sharp` as a first-class runtime dependency instead of relying on Next's transitive hoisting.

**Files to touch:**
- `/Users/jnmartins/dev/frontfiles/package.json`
- `/Users/jnmartins/dev/frontfiles/bun.lock` — regenerated by the package manager, not hand-edited

**Exact edits:**
1. In `package.json`, move the `"shadcn": "^4.1.2"` entry from `dependencies` (currently line 28) to `devDependencies`.
2. In `package.json`, add `"sharp"` to `dependencies` at the version currently resolved in `bun.lock`. Run `bun pm ls sharp` (or `rg '"sharp"' bun.lock` and inspect) to identify the resolved semver, then pin to that major.minor range. Do not re-pin `next@16.2.2`'s peer.
3. Run `bun install` to regenerate the lockfile. Commit `package.json` and `bun.lock` together.

**Acceptance test.** `bun run build` exits 0 after the edit, and `grep '"shadcn"' package.json` shows the entry only under `devDependencies`. `grep '"sharp"' package.json` shows an entry under `dependencies`.

**Depends on.** Parallel-safe with T0. Can ship on the same branch or the next one.

---

## T0.5 — Product-decision memo (NOT an implementation task)

**Goal.** Force an explicit product call on persistence for special-offer and assignment before T4 can execute. This tier produces **a decision memo and nothing else**. No code changes.

**Files to touch:**
- `/Users/jnmartins/dev/frontfiles/docs/audits/T0_5_SPECIAL_OFFER_DECISION_MEMO.md` — **existing file** (authored 2026-04-20, commit `2708cac`). T0.5 execution is appending João's answers to the memo's §Product questions section; no new memo file is created.

**Artefact to produce (memo structure).** One markdown file with:
1. The subject systems at hand:
   - `src/lib/special-offer/store.ts` — three module-level `Map`s, zero Supabase branch (audit B-1)
   - `src/lib/assignment/store.ts` — `new Map(mockAssignments.map(...))` at module load, no Supabase branch (audit B-2)
   - `src/app/api/special-offer/route.ts` — reads assets from `mockVaultAssets` fixture rather than `vault_assets` (audit B-3)
2. The three answer options, named and not ranked:
   - **Path A — Live persistence** — special-offer + assignment state moves to Supabase behind the dual-mode pattern.
   - **Path B — Scaffolding-only** — the current in-memory stores are a scaffolding artefact; the prod-route wiring to them is deleted and the Map stores are hard-gated to dev.
   - **Path C — Hybrid** — special-offer persists live; assignment stays scaffolding-only until the editorial contract product brief is scoped.
3. The product questions (below) — each with an explicit answer, or a dated deferral reason.

**Product questions João must answer (no implementation proposal attached):**
1. **Retention.** Are active special-offer threads and assignments intended to survive a Vercel deploy / a Supabase failover / a server restart? If "no" — state the reason and the expected demo horizon. If "yes" — proceed to Q2.
2. **Audit obligations.** Does the editorial product commitment include an audit trail of negotiation events (offer-sent, counter-sent, accepted, declined) that a journalist or buyer could later request? If yes, persistence is non-optional and `direct_offer_events` / `special_offer_events` must be wired.
3. **Asset source.** When the special-offer route resolves an asset, should it consult `vault_assets` (DB) exclusively, or should it continue to resolve through a seed fixture in dev? If dual-mode, is the flag `isSupabaseEnvPresent` (global) or a dedicated `FFF_REAL_OFFERS` gate (scoped)?
4. **Assignment shape.** Does "assignment" in the v1 spec mean a single-shot brief (commission one story for one fee) or an ongoing editorial contract (retainer, multi-delivery)? Persistence model, indexes, and lifecycle events differ. Answer before T4 begins.
5. **Cutover semantics.** If persistence is live and an in-memory offer already exists on a running instance at the moment of cutover, is restart-loss acceptable? If not, state the migration plan (replay from events, re-drive from `direct_offer_events`, or accept hard-cut).

**Exact edits.** Create the memo. Do not edit code. Do not edit `store.ts`. Do not touch routes.

**Acceptance test.** `docs/audits/T0_5_SPECIAL_OFFER_DECISION_MEMO.md` §Product questions has an explicit answer or a dated deferral for every one of the five questions.

**Depends on.** Nothing technical. T4 is blocked until this memo is signed off by João.

---

## T1 — Strip header-trust auth

**Goal.** Make the identity-trust model obviously broken at runtime by routing every caller-supplied identity through a single `requireActor` helper that **fails closed** until T2 lands. The entire value of T1 is *forcing* T2 — not deploying a working auth layer.

**Files to touch:**
- `/Users/jnmartins/dev/frontfiles/src/lib/auth/requireActor.ts` — **new file**
- `/Users/jnmartins/dev/frontfiles/src/lib/env.ts` — add `AUTH_WIRED` to the server-side Zod schema, defaulting to `false`
- `/Users/jnmartins/dev/frontfiles/src/app/api/posts/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/posts/[id]/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/entitlements/[assetId]/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/[packageId]/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/[packageId]/download/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/[packageId]/artifacts/[artifactId]/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/media/[id]/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/providers/connections/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/providers/connections/[id]/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/lib/post/client.ts` — **write site**: sets outgoing `'x-frontfiles-user-id': input.authorId` header at [src/lib/post/client.ts:216](../../src/lib/post/client.ts#L216) on `POST /api/posts`. See §Scope decisions below for T1 disposition (write is **removed in T1**, not deferred to T2).
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/route.ts` (body-identity site)
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/accept/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/counter/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/decline/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/cancel/route.ts`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/ccr/route.ts`

(19 files. The header-trust list = 11 files from `rg "x-frontfiles-user-id"`. The body-identity list = 8 files from `rg "body\.(buyerId|actorId|requesterId|responderId|authorId)"`. Overlap is zero — they are disjoint surfaces.)

**Exact edits:**

1. Create `src/lib/auth/requireActor.ts` with this contract:
   ```ts
   import { env } from '@/lib/env'

   export class AuthNotWiredError extends Error {
     status = 501 as const
     constructor() {
       super('auth not wired')
     }
   }

   export interface Actor {
     userId: string
     jwt?: string // populated once T2 lands
   }

   /**
    * Resolve the authenticated actor for the current request.
    *
    * Until T2 wires Supabase session resolution, this helper
    * throws AuthNotWiredError (HTTP 501) regardless of any header
    * or body field the client sent. The wrapping route handler
    * translates the error into a 501 response.
    */
   export async function requireActor(_request: Request): Promise<Actor> {
     if (!env.AUTH_WIRED) {
       throw new AuthNotWiredError()
     }
     // T2 implementation lands here.
     throw new AuthNotWiredError()
   }
   ```
2. In `src/lib/env.ts`, add to the server schema:
   ```ts
   AUTH_WIRED: z.coerce.boolean().default(false),
   ```
3. In every listed route file, replace the identity read site with `await requireActor(request)`. Remove the `x-frontfiles-user-id` header read and the `body.buyerId`/`body.actorId`/`body.requesterId`/`body.responderId`/`body.authorId` read. Catch `AuthNotWiredError` at the route boundary (or let it bubble to the existing `withInternalError` wrapper, then teach that wrapper to return 501 for `AuthNotWiredError`).
4. Do **not** change `src/lib/identity/guards.ts` in T1. `requireGrant` continues to read from the actor object; it will get its real actor once T2 lands. The guard's signature should move from `requireGrant(userId, 'buyer')` to `requireGrant(actor, 'buyer')` where the call site is already touched.

**Scope decisions:**

*`src/lib/post/client.ts` resolution.* The file is a **write site** — it sets the outgoing `'x-frontfiles-user-id': input.authorId` header at [line 216](../../src/lib/post/client.ts#L216) inside `submitPost()`. Server never reads an inbound header from this file. **T1 disposition: remove the write in T1. Do NOT treat `post/client.ts` as a T2-only change.**

Rationale:

1. **Honest-failure principle.** T1's point is to make every identity-trust surface fail loudly at the same moment. Leaving a write-site that the server ignores (`requireActor` discards the header in T1's stub) contradicts that principle and creates a stale signal for future readers ("why is this still here?").
2. **Scope consistency.** `post/client.ts` is already on T1's 19-file list; excluding its edit leaves it on the list with nothing to do — phantom work.
3. **Caller compatibility.** `submitPost()`'s callers already branch on typed `PostsClientError` codes via `err.code` (post composer components). When T1 lands, they receive `PostsClientError('AUTH_NOT_WIRED', 'auth not wired')` and render the existing error state — no composer change is needed.

Concrete edit: delete the `'x-frontfiles-user-id': input.authorId` entry from the `headers` object at [post/client.ts:213–217](../../src/lib/post/client.ts#L213). Leave `authorId` inside the JSON body — the server route will read it and pass it to `requireActor`, which ignores it in T1 (returns 501) and validates it in T2.

**Test migration:**

(i) **Mock rewrite.** Every test currently setting `'x-frontfiles-user-id'` on a request or setting a body identity field (`buyerId`/`actorId`/`requesterId`/`responderId`/`authorId`) must mock `requireActor` via:

```ts
import { vi } from 'vitest'

vi.mock('@/lib/auth/requireActor', () => ({
  requireActor: vi.fn(async () => ({ userId: 'test-user-id', jwt: undefined })),
  AuthNotWiredError: class extends Error {
    status = 501 as const
  },
}))
```

Tests that need a specific actor identity override the default with `vi.mocked(requireActor).mockResolvedValueOnce({ userId: '<specific-id>' })` before the call.

(ii) **Acceptance criterion.** After T1 lands, `bun run test` returns **1080 passed / 1 skipped** (the pre-T1 baseline per `CODEBASE_AUDIT_20260418.md` §Current-state inventory). Any deviation is a failed T1 landing — fix the test mocks, do not adjust the baseline.

**Ship-gate policy (pick one explicitly — this is the one we pick):**

> **Ship T1 to `main` behind `AUTH_WIRED=false` by default.** Production behaviour becomes: every affected route returns **HTTP 501 "auth not wired"** until T2 is merged and the flag is flipped. Dev / test environments that want to exercise route logic set `AUTH_WIRED=true` locally and stub `requireActor` in tests via `scopeEnvVars`.
>
> Rationale: the alternative ("do not ship T1 until T2") leaves the header-trust surface alive on `main` for the duration of T2, and creates a long-lived T1 branch that rots. A hard 501 is visible, testable, and non-bypassable. The editorial product has no live users yet; a temporary 501 on mutation routes is strictly better than continuing to trust body-supplied ids.

**Acceptance test (two parts).** (1) With `AUTH_WIRED=false`, calling any of the 19 listed routes with a valid-shaped payload returns `501` with body `{ error: { code: 'AUTH_NOT_WIRED', message: 'auth not wired' } }`. With `AUTH_WIRED=true` and no session implementation yet, same 501 is returned (T1 does not claim to work — it claims to be honest). (2) `bun run test` returns **1080 passed / 1 skipped** — pre-T1 baseline unchanged.

**Depends on.** T0 (delete unsigned Stripe webhook first so T1's sweep doesn't trip over it).

---

## T1b — Media delivery trust model

**Goal.** Audit how `'original'` vs `'thumbnail'` vs `'preview'` delivery currently works, and propose the minimal change to make original delivery tamper-evident once actors exist. This tier is **scoping + proposal**, not implementation — the proposal lands as a decision memo that feeds a follow-up ticket.

**Files to touch:**
- `/Users/jnmartins/dev/frontfiles/src/app/api/media/[id]/route.ts` — read only, document current behaviour
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/[packageId]/download/route.ts` — read only
- `/Users/jnmartins/dev/frontfiles/src/app/api/packages/[packageId]/artifacts/[artifactId]/route.ts` — read only
- `/Users/jnmartins/dev/frontfiles/src/lib/media/asset-media-repo.ts` — read only
- `/Users/jnmartins/dev/frontfiles/docs/audits/MEDIA_DELIVERY_TRUST_MEMO_20260418.md` — **new file**

**Exact edits:**

1. Write the memo documenting, per delivery mode (`original`, `thumbnail`, `preview`):
   - How the route resolves the file today (`readFile` off `public/`, Supabase Storage signed URL, etc. — cross-check against the TODO at `src/app/api/media/[id]/route.ts:290`).
   - Whether the response carries cache headers / range support / content-disposition.
   - What trust is currently performed before handing back bytes (entitlement check? watermarking? rate-limit?).
2. Propose the minimal T2+T3-era change for **originals only** (thumbnails / previews are lower-risk):
   - Short-TTL signed URL (e.g. 60 s) issued to an authenticated actor resolved by `requireActor`.
   - A new `asset_delivery_audit_log` row per signed-URL issuance, keyed by `(actor_id, asset_id, delivery_mode, issued_at, expires_at, ip_hash)`. This is **not** a new entity in T1b — it is a proposal for a follow-up migration that depends on T2 landing first.
   - No new migration ships in this tier. The memo defines the shape, not the SQL.
3. The memo must explicitly state the tamper-evidence property being claimed: *given a complaint "someone downloaded my original without buying the licence", Frontfiles can produce the actor id, timestamp, and IP-hash of every delivery in the last N days.*

**Acceptance test.** The memo documents all three delivery modes with exact file:line references, and concludes with a signed-URL + audit-log proposal for originals that a reader unfamiliar with the codebase could turn into a single follow-up ticket.

**Depends on.** T1 — the proposal relies on `requireActor` returning a real actor, so the memo must reference the T1 helper by name.

---

## T2 — Real session resolution

**Goal.** Make `requireActor` return a real actor by reading a Supabase Auth server-side session. Flip `AUTH_WIRED` to `true`. Extend `requireGrant` to every role-scoped mutation route currently missing it.

**Files to touch:**
- `/Users/jnmartins/dev/frontfiles/src/lib/auth/requireActor.ts` — replace the stub with a real implementation
- `/Users/jnmartins/dev/frontfiles/src/lib/db/client.ts` — add a server-side `createServerClient` factory that honours the caller's JWT (preparation for T3, but T2 uses it immediately to resolve the session)
- `/Users/jnmartins/dev/frontfiles/src/lib/env.ts` — flip the default of `AUTH_WIRED` to `true` once session resolution is ready, **OR** leave the default at `false` and flip per environment (preferred — `.env.local` / Vercel env wiring). Recommend the latter.
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/counter/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/accept/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/[id]/decline/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/cancel/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/accept/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/fulfil/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/review/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/review-open/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/dispute/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/assignment/[id]/ccr/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/providers/connections/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/providers/connections/[id]/route.ts` — add `requireGrant`
- `/Users/jnmartins/dev/frontfiles/src/app/api/posts/route.ts` — add `requireGrant` (creator grant for POST)
- `/Users/jnmartins/dev/frontfiles/src/app/api/posts/[id]/route.ts` — add `requireGrant` (author-or-staff for DELETE)

(14 routes requiring `requireGrant` coverage. The 2 already covered per audit A-5 are `src/app/api/special-offer/route.ts` and `src/app/api/assignment/route.ts`. Total coverage after T2 = 16.)

**Exact edits:**

1. Replace the stub in `src/lib/auth/requireActor.ts` with:
   ```ts
   import { cookies } from 'next/headers'
   import { env } from '@/lib/env'
   import { createServerClient } from '@/lib/db/client'

   export async function requireActor(request: Request): Promise<Actor> {
     if (!env.AUTH_WIRED) throw new AuthNotWiredError()
     const cookieStore = await cookies()
     const client = createServerClient({ cookies: cookieStore, request })
     const { data: { user }, error } = await client.auth.getUser()
     if (error || !user) throw new AuthNotWiredError()  // or AuthRequiredError — decide at implementation
     return { userId: user.id, jwt: /* extract from cookie */ }
   }
   ```
2. Add `createServerClient({ cookies, request })` to `src/lib/db/client.ts`. It calls `@supabase/ssr`'s `createServerClient` (confirm the package is present; add it if not). This is preparation for T3.
3. In each of the 14 routes, after `const actor = await requireActor(request)`, add `requireGrant(actor, 'buyer' | 'creator' | 'staff')` per the existing grant taxonomy in `src/lib/identity/permissions.ts`. Grant choice per route:
   - `/api/special-offer/[id]/{accept,counter,decline}` → `'buyer' | 'creator'` (either participant)
   - `/api/assignment/[id]/{cancel,accept,fulfil,review,review-open,dispute}` → participant grants (per current guards in `src/lib/assignment/guards.ts`)
   - `/api/assignment/[id]/ccr` → either participant, differs by method
   - `/api/providers/connections` + `[id]` → actor owns the connection (compare to `connections.user_id`)
   - `/api/posts` POST → `'creator'`
   - `/api/posts/[id]` DELETE → author-or-staff
4. Remove the `AUTH_WIRED` default-false fallback in local/dev `.env.local` once the flow works end-to-end. Leave the Zod default at `false` for safety.

**Acceptance test.** With a real Supabase session cookie on the request, all 19 T1 routes return the domain-expected status (200/201/204/4xx-domain). Without a session, same 19 routes return 401. `requireGrant` coverage is `rg "requireGrant\(" src/app/api` = 16 files.

**Depends on.** T1 (the `requireActor` helper must exist). T0.5 can be pending — T2 does not require persistence answers, only session answers.

---

## T2b — Rate limits on sensitive endpoints

**Goal.** Inventory the sensitive-endpoint surface and pick one canonical rate-limit middleware location. This tier is **inventory + decision**, not a full rollout — the actual per-route tuning is a follow-up.

**Observation first.** There is no `/api/auth/*` directory in the current codebase. The "auth routes" surface T2b was asked to cover does not exist yet (Supabase Auth wires via the client + server helpers without dedicated route handlers). Once T2 lands, any Frontfiles-hosted auth glue (e.g. `/api/auth/callback`, `/api/auth/signout`) will live there. The present plan covers the three surfaces that exist today.

**Files to touch:**
- `/Users/jnmartins/dev/frontfiles/docs/audits/RATE_LIMIT_INVENTORY_20260418.md` — **new file**
- `/Users/jnmartins/dev/frontfiles/src/lib/rate-limit/write-actions.ts` — read only
- `/Users/jnmartins/dev/frontfiles/src/lib/rate-limit/original-downloads.ts` — read only

**Inventory the memo must contain (grounded in grep):**

1. **Webhook receivers (post-T0):** `/api/providers/webhooks/[provider]`. (The second webhook at `/api/assignment/webhook/stripe` is deleted in T0 — confirm before writing.)
2. **Offer-creation endpoints:**
   - `POST /api/special-offer/route.ts` — thread creation
   - `POST /api/special-offer/[id]/counter/route.ts` — counter-offer
   - `POST /api/special-offer/[id]/accept/route.ts` — state change, still abuse-susceptible
   - `POST /api/special-offer/[id]/decline/route.ts` — same
   - `POST /api/assignment/route.ts` — assignment creation (adjacent to offers; editorial buyers issuing briefs)
3. **Future auth endpoints:** document the shape (not the implementation) so T2-era `/api/auth/callback` lands with rate-limiting already specified.

**Decision to record:** one rate-limit location. Two options:
- **(a)** In `middleware.ts` — runs before the route handler, token bucket keyed by actor (from T1/T2) + action. Pros: one place, catches every route. Cons: `middleware.ts` runs on every request (static assets too) and is currently empty — will need to early-return for non-API paths.
- **(b)** In a shared `withRateLimit(schema, key)` wrapper applied to each sensitive route (the same shape as `parseBody`). Pros: explicit per-route, auditable. Cons: adoption drift (see theme 2 in audit — patterns-by-declaration).

**Recommendation to record (not execute):** **option (a) — middleware.ts**, because theme 2 already demonstrates that wrapper-based patterns get uneven adoption. Middleware makes the rate-limit decision unbypassable.

**Acceptance test.** The memo lists every sensitive endpoint (post-T0) with exact path + HTTP method, picks (a) or (b) explicitly, and cites the existing `src/lib/rate-limit/*.ts` primitives that the chosen location will call.

**Depends on.** T2 (actor must exist to key rate limits by user, not IP). T0 (so the memo doesn't include a route that was just deleted).

---

## T3 — Client split

**Goal.** Separate service-role from user-JWT DB access so RLS becomes load-bearing at runtime. Audit finding A-1.

**Files to touch:**
- `/Users/jnmartins/dev/frontfiles/src/lib/db/userClient.ts` — **new file**
- `/Users/jnmartins/dev/frontfiles/src/lib/db/client.ts` — extend; keep `getSupabaseClient` (service-role) but add a justification-required linting pattern
- All 15 callers of `getSupabaseClient()` identified in the audit's A-1 finding — to be listed by `rg "getSupabaseClient\(\)" src/lib src/app`. Each caller must either (a) migrate to `userClient(actor.jwt)` or (b) retain `getSupabaseClient()` with a one-line justification comment immediately above the call.

**Exact edits:**

1. Create `src/lib/db/userClient.ts`:
   ```ts
   import { createServerClient as supabaseCreateServerClient } from '@supabase/ssr'
   import { env } from '@/lib/env'

   export function userClient(jwt: string) {
     return supabaseCreateServerClient(
       env.NEXT_PUBLIC_SUPABASE_URL,
       env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
       {
         global: { headers: { Authorization: `Bearer ${jwt}` } },
         cookies: { getAll: () => [], setAll: () => {} },  // JWT-only
       },
     )
   }
   ```
2. In `src/lib/db/client.ts`, rename `getSupabaseClient()` to `getServiceClient()` in a single pass. Add a JSDoc block that reads: `"Service-role client. Bypasses RLS. Every caller must justify in a one-line comment why anon+JWT is insufficient. Prefer userClient(actor.jwt)."`. Optionally add a `// eslint-disable-next-line @frontfiles/no-service-client` ESLint rule scaffolding — the lint rule itself is Parallel.
3. Migrate every UI-driven read site to `userClient`. Expected migrations (confirm against the 15-caller list):
   - `src/lib/post/store.ts` read paths → `userClient`
   - `src/lib/entitlement/store.ts` → `userClient`
   - `src/lib/media/asset-media-repo.ts` read paths → `userClient`
   - `src/lib/providers/store.ts` connection-read paths → `userClient`
   - `src/lib/fulfilment/store.ts` package-read paths → `userClient`
4. Retain `getServiceClient()` for:
   - Webhook ingest (`/api/providers/webhooks/[provider]`) — the caller is not a user
   - Admin / staff paths that operate across users
   - State-machine writes that must bypass participant RLS (with justification comment)
5. After migration, confirm `rg "getServiceClient\(\)" src/lib src/app | wc -l` is materially lower than the pre-migration `getSupabaseClient()` count, and every retained call has a justification comment on the preceding line.

**Acceptance test.** An integration test that posts to a mutation route as an authenticated user reads back only data the RLS policies permit for that user's role. A second test as a different user on the same row returns 403 / empty. Previously this test would have passed regardless of actor because service-role bypasses RLS.

**Depends on.** T2 (actor and session cookie must exist; `userClient` takes a JWT that T1's stub cannot produce).

---

## T4 — Execute persistence decision from T0.5

**Goal.** Act on the memo. Two branches.

### Path A — "Live persistence" decision from T0.5

**Files to touch (if Path A):**
- `/Users/jnmartins/dev/frontfiles/src/lib/special-offer/store.ts` — add Supabase branch following the dual-mode pattern used in `src/lib/post/store.ts`
- `/Users/jnmartins/dev/frontfiles/src/lib/assignment/store.ts` — same
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/route.ts` — replace `mockVaultAssets.find(...)` with a real `vault_assets` query through `userClient` (now available post-T3)
- `/Users/jnmartins/dev/frontfiles/src/lib/special-offer/__tests__/store.real.test.ts` — **new file**, Supabase-backed round-trip
- `/Users/jnmartins/dev/frontfiles/src/lib/assignment/__tests__/store.real.test.ts` — **new file**

**Exact edits (Path A):**
1. Mirror the mode-selector pattern from `src/lib/post/store.ts:37-49` (`getMode()`, `logModeOnce()`). Gate every function on `getMode() === 'mock'`.
2. Define `SpecialOfferThreadRow`, `SpecialOfferEventRow`, `OfferCheckoutIntentRow` in `src/lib/db/schema.ts` matching the P5 migration (`special_offer_threads`, `special_offer_events`, `offer_checkout_intents`). **If P5 has not yet landed, use the `direct_offer_*` names exactly as on disk and open a ticket reminder to rename them when P5 flips.** Do not pre-rename in this plan.
3. Write row→domain mappers (snake_case → camelCase).
4. Wire a `loadThread`, `saveThread`, `appendEvent` via `userClient(actor.jwt)` in the real branch.
5. Replace the `mockVaultAssets.find(...)` call in `src/app/api/special-offer/route.ts:76` with a real query.
6. Round-trip integration test: create thread → counter → accept → assert event sequence in DB.

### Path B — "Scaffolding-only" decision from T0.5

**Files to touch (if Path B):**
- `/Users/jnmartins/dev/frontfiles/src/lib/special-offer/store.ts` — wrap the module-level `new Map()` behind an explicit guard
- `/Users/jnmartins/dev/frontfiles/src/lib/assignment/store.ts` — same
- `/Users/jnmartins/dev/frontfiles/src/app/api/special-offer/route.ts` — delete or gate behind `env.FFF_DEV_OFFERS_ENABLED`
- (Optionally) delete the `direct_offer_*` / `special_offer_*` route prefixes entirely, returning 501 for the surface

**Exact edits (Path B):**
1. Add an `FFF_DEV_STORES_ENABLED` server env flag in `src/lib/env.ts`, defaulting to `false`.
2. Wrap the `new Map<...>()` initialiser in each of the two stores:
   ```ts
   if (!env.FFF_DEV_STORES_ENABLED) {
     throw new Error('special-offer store is dev-only; set FFF_DEV_STORES_ENABLED=true')
   }
   ```
3. In `/api/special-offer/route.ts`, gate the whole handler on the same flag, returning `501 NOT_IMPLEMENTED` otherwise.
4. Remove or rename the `mockVaultAssets` import from the route (the fixture stays in `src/data/` but the route no longer imports it in prod).

**Acceptance test.**
- If Path A: `bun test` shows the new `store.real.test.ts` round-trip passes against a live Supabase dev project.
- If Path B: hitting `/api/special-offer` in a non-dev environment returns 501; `bun run build` still exits 0.

**Depends on.** T0.5 (answer required). T3 (Path A needs `userClient`). T2 (Path A needs actor).

---

## T5 — Provenance + SSRF

**Goal.** Make asset provenance tamper-evident and kill server-side-request-forgery exposure on any route that fetches a user-supplied URL. Scoping only — implementation is a follow-up.

**Files to touch:**
- `/Users/jnmartins/dev/frontfiles/docs/audits/PROVENANCE_AND_SSRF_MEMO_20260418.md` — **new file**

**Scope the memo must cover:**

1. **Provenance stamp on upload.**
   - Where SHA-256 would be computed: `src/lib/upload/commit-service.ts` (after bytes are persisted, before the `asset_original_hashes` row lands). Cross-reference: current upload commit path.
   - Where the stamp is surfaced: `/api/media/[id]` response body (add `contentHash` field). `/api/packages/[packageId]/artifacts/[artifactId]` similarly.
   - Storage: either a new `asset_provenance` column on `vault_assets` or a dedicated `asset_provenance` table keyed by asset_id.
   - Threat model: the claim is "given a delivered file, Frontfiles can prove the bytes match the originally-committed upload". This matters to editorial buyers receiving a raw file later contested.

2. **SSRF audit.** List every route that fetches a user-supplied URL. Seed candidates (to be confirmed by grep):
   - `/api/upload/*` — if any metadata enrichment follows a URL
   - `/api/providers/*` — OAuth / webhook back-channels
   - Any `fetch(userProvidedUrl)` in processing
   
   For each hit, specify:
   - Is the URL validated against an allow-list of hosts?
   - Is there a `http://169.254.169.254` (metadata service) / `10.*` / `localhost` / `0.0.0.0` block?
   - Is the fetch size-capped?
   - Is it time-capped?

3. **SSRF guard location.** Propose one of:
   - **(a)** A `safeFetch(url, opts)` helper in `src/lib/net/safeFetch.ts` that every outbound fetch must use.
   - **(b)** A middleware-level outbound proxy.
   Recommend (a) for Node/edge consistency.

**Acceptance test.** The memo lists every `fetch(user-supplied)` site with file:line, picks one guard location, and proposes a single follow-up ticket that would land `safeFetch`.

**Depends on.** T2 (actor needed to key delivery-audit rows for provenance surface), T3 (userClient needed to write provenance rows under RLS).

---

## Parallel — independent improvements (no tier dependency)

These can land on dedicated branches at any time. They do not depend on any T-tier and do not block any T-tier.

### P1. Normalize `AssetFormat` casing across the three mock-data systems

**Files to touch:**
- `/Users/jnmartins/dev/frontfiles/src/lib/types.ts` (canonical — lowercase `'photo' | 'video' | …`)
- `/Users/jnmartins/dev/frontfiles/src/data/assets.ts` (currently title case)
- `/Users/jnmartins/dev/frontfiles/src/lib/upload/types.ts` (third variant)
- Plus the 18 files containing `AssetFormat` (per grep): `src/app/search/page.tsx`, `src/lib/bolt/scope.ts`, `src/lib/post/hydrate.ts`, `src/lib/preview/canonical.ts`, `src/lib/preview/holders.ts`, `src/lib/preview/resolve-canonical.ts`, `src/data/creator-content.ts`, `src/data/index.ts`, `src/lib/upload/batch-types.ts`, `src/lib/upload/v2-state.ts`, `src/lib/upload/v2-types.ts`, `src/lib/composer/types.ts`, `src/lib/upload/v2-mock-scenarios.ts`, `src/lib/upload/price-engine.ts`.

**Exact edits:**
1. Pick `src/lib/types.ts`'s lowercase `'photo' | 'video' | 'audio' | 'document' | 'data'` as canonical.
2. Delete the declarations in `src/data/assets.ts` and `src/lib/upload/types.ts`. Re-export from `@/lib/types`.
3. Migrate every `'Photo'` / `'Video'` literal in seed data to lowercase.
4. Grep `rg "AssetFormat" -t ts -t tsx` to confirm a single declaration.

**Acceptance test.** `rg "type AssetFormat\s*=" src` returns exactly one hit, and `bun run build` + `bun test` both exit 0.

### P2. Adopt `parseBody` in the remaining 30 routes

**Files to touch.** Every `route.ts` under `src/app/api/**` not currently using `parseBody`. Per grep, 14 routes use raw `await request.json()` and 16 more have `searchParams.get(...)` reads that should use `parseQuery`. Full list:
- `/api/special-offer/[id]/decline/route.ts`
- `/api/special-offer/[id]/counter/route.ts`
- `/api/special-offer/[id]/accept/route.ts`
- `/api/bolt/session/route.ts`
- `/api/providers/connections/route.ts`
- `/api/assignment/route.ts`
- `/api/assignment/[id]/fulfil/route.ts`
- `/api/assignment/[id]/review-open/route.ts`
- `/api/assignment/webhook/stripe/route.ts` — deleted in T0 (skip)
- `/api/assignment/[id]/cancel/route.ts`
- `/api/assignment/[id]/dispute/route.ts`
- `/api/assignment/[id]/ccr/route.ts`
- `/api/assignment/[id]/review/route.ts`
- `/api/assignment/[id]/accept/route.ts`
- Plus `searchParams.get(...)` sites across entitlements / media / packages / v2 batch.

**Exact edits:**
1. For each route, define a `Zod` schema in a co-located file (`src/app/api/assignment/[id]/cancel/schema.ts` etc.) or inline at the top of `route.ts`.
2. Replace `const body = await request.json()` with `const body = await parseBody(request, CancelSchema)`.
3. Delete the hand-rolled `if (!body.x || !body.y) return 400` checks — `parseBody` handles this.
4. For `src/app/api/bolt/session/route.ts:39`, replace the `as BoltSessionRequest` cast with a Zod validator.

**Acceptance test.** `rg "await request\.json\(\)" src/app/api` returns zero matches, and `rg "parseBody\(" src/app/api | wc -l` ≥ 29. CI guard: add a script that fails the build if raw `request.json()` appears outside `src/lib/api/validation.ts`.

### P3. Consolidate the four `api-helpers.ts` files into one shared module

Follow-up enabled by T0's sanitizer landing across the three leaky helpers. Extract `src/lib/providers/api-helpers.ts` (the canonical variant) to `src/lib/api/error-helpers.ts`. Update the four domains to import from the shared module. Delete the duplicates. Acceptance: `rg "api-helpers\.ts" src/lib` returns one file.

### P4. Add rate-limit + Sentry env keys to the Zod schema

Per audit I-3 / I-4. Add `RATE_LIMIT_WRITE_BURST`, `RATE_LIMIT_ORIGINAL_DOWNLOADS_BURST` (and their windows), `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` to `src/lib/env.ts`. Remove the four `process.env[name]` reads in `src/lib/rate-limit/*` and `sentry.*.config.ts`. Acceptance: `rg "process\.env\." src/lib src/*.ts` ≤ 2 documented exceptions.

### P5. Delete dead `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`

Per audit K-1. Remove from `src/lib/env.ts` (3 lines). Acceptance: `rg "GOOGLE_PLACES" src` returns zero hits.

---

## Exit criteria for the plan as a whole

Tier T0 through T5 + Parallel items landed, plus:
- `getServiceClient()` usage in the app tree reduced to a grep-auditable set with written justifications.
- Every mutation route resolves its actor from a server-side session, not a header or a body field.
- The in-memory-only stores (`special-offer`, `assignment`) are either wired to Supabase (T4 / Path A) or hard-gated as dev-only (T4 / Path B).
- The unsigned Stripe webhook is gone.
- The test suite includes route-level integration coverage for authenticated vs unauthenticated vs wrong-actor for every mutation route.

When all of those hold, the audit's overall verdict can be upgraded from **revise** to **approve with corrections** without a new round of red-team work.
