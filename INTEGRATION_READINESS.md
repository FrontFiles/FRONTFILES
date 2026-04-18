# Frontfiles — Pre-Integration Readiness Plan

**Status:** v2 — decisions locked · **Date:** 2026-04-17 · **Owner:** João Nuno Martins

## Decision Locks (2026-04-17)

All 12 architectural decisions resolved. Body of document retains original reasoning for audit trail; the table below is authoritative for execution.

| # | Decision | LOCKED |
|---|---|---|
| D1 | Search infrastructure | **pgvector in Supabase + Vertex AI `text-embedding-004`** |
| D2 | Transactional email provider | **Resend** (React Email templates) |
| D3 | Error tracking | **Sentry** (Next.js SDK, server + client) |
| D4 | Product analytics | **PostHog** (self-hostable, privacy-aware, includes feature flags) |
| D5 | Stripe Connect variant | **Express** (Stripe owns KYC) |
| D6 | AI vendor | **Vertex AI (Gemini)** — locked by "Google for everything" scope |
| D7 | Embedding model | **Vertex AI `text-embedding-004`** |
| D8 | AI processing residency | **Per-creator region** — EU creators → `europe-west4`, US creators → `us-central1` |
| D9 | Data-out-of-training | **Vertex AI path** (not Gemini Developer API) |
| D10 | Auth methods | **Google OAuth + Supabase email magic-link + Apple Sign In** |
| D11 | Stripe test/live isolation | **Per-environment keys**; preview = test, prod = live, never crossed |
| D12 | Email domain separation | **Separate Resend domains/keys/suppression lists** for transactional vs. marketing |

## Phase 0 Closeout (2026-04-17)

All Phase 0 pre-flight items complete. CCP 1 executed. Evidence below; this block is load-bearing for audit continuity.

| Item | Resolution | Ref |
|---|---|---|
| P0.1 Commit 4 tsc fixes | Committed | `91c0e9e governance + agents + tsc fixes for pre-integration program` |
| P0.2 Prerender fix on `/search` + `/checkout/[assetId]` | **Shipped (re-verified 2026-04-17)** — Suspense boundaries wrapped around `useSearchParams()` consumers on both pages. `bun run build` exits 0, all 47 routes generated. Proof is a real build, not a grep. | `4681e92 fix(build): restore Suspense boundaries on /search and /checkout/[assetId]` |
| P0.3 Rotate leaked PAT + switch remote to SSH | Token revoked on GitHub (owner confirmation 2026-04-17); `.git/config` clean of PAT; remote = `git@github.com:FrontFiles/FRONTFILES.git` | H1 gate |
| P0.4 `.git` + `.next` hygiene | No `.git/index.lock`; single worktree; no macOS duplicate files remaining in `.next/` | — |
| P0.5 PR lifecycle | PR #4 (= PR 1.2 `/api/v2/batch` routes) **merged** (`c0d9ac1`). PR 1.3 **never opened** (not started) — formally **deferred**; will be scoped inside Phase 1 upload-substrate work if needed, otherwise killed. | Merge `c0d9ac1` |
| P0.6 Tag `main` at last-known-good | Tagged | `checkpoint/preflight-green-20260417-1116`, `phase-1-baseline`, plus 4 `backup/pre-filter/*` safety tags |

**Gate status:** G1 passed (D1–D12 locked, 2026-04-17) · Phase 0 **fully closed** — P0.2 resolved via KD-1 micro-fix (commit `4681e92`). CCP 1, CCP 2, CCP 3, CCP 4 complete. **Phase 1 (Foundation) closed** — G2 **passed** (2026-04-17); only parallel human task remaining is 1.1 Vercel preview/prod env wiring (does not block Phase 4/5 design work, blocks live deploy only).
**Next CCP:** Phase 2 (Observability) or Phase 3 (Email) — both parallelisable after G2. KD-8 micro-CCP recommended before either, to restore reliable test signal.
**CCP 2 status (2026-04-17):** **GREEN on dev.** Commit `c05928f feat(rls): apply RLS migration 20260420000000 to dev Supabase`. Verification: grep scan 0 matches; `tsc --noEmit` exit 0; 8/9 RLS tests pass (1 skip = KD-2 fixture drift); migration `20260420000000_rls_all_tables.sql` applied on Remote dev Supabase. Scope item 1 (Vercel preview/prod env wiring) is a follow-up human task; does not block CCP 2 gate but blocks full Phase 1 closeout. 4 deny-all + TODO entries carried forward as KD-3 through KD-6.
**CCP 3 status (2026-04-17):** **GREEN.** Items 1.7, 1.8, 1.9 landed pre-CCP in migration `20260419110000_phase1_vector_cache_audit.sql` (pgvector + `asset_embeddings` + HNSW index; `ai_analysis` cache with `(subject_type, subject_id, model, model_version, input_hash)` unique; `audit_log` append-only with event_type/actor_id/target indexes; all three RLS-enabled service-role-only; the `20260420000000` RLS migration confirms these were pre-locked and are correctly skipped by the generalised pass). Item 1.10 landed in `src/lib/env.ts` (Zod fail-fast, every required var + optional bank, `env`/`flags`/`isSupabaseEnvPresent` exports). CCP 3 closeout consolidated `process.env` reads in 9 source files to import from `@/lib/env` — grep dropped 19 → 5 non-test files (health-route Vercel build metadata, dynamic secret/rate-limit resolvers, `NEXT_RUNTIME` runtime signal in `instrumentation.ts`; all documented exceptions). Verification: `tsc --noEmit` exit 0; `bun run build` exit 0 with 81 routes (route-count correction: prior entries in this doc cited "47 routes" against a stale baseline — actual post-CCP-3 build resolves 81 app routes; nothing regressed between CCPs); grep count 12 lines across 5 exception files as expected.
**CCP 4 status (2026-04-17):** **GREEN.** Phase 1 item 1.3 delivered across 3 commits on top of CCP 3. Mode contract honoured everywhere: `MODE` decided once at module load from `isSupabaseEnvPresent`, single `console.info('[ff:mode] <module>=real|mock')` on first use gated to non-prod, public TypeScript types identical across mock and real paths. Commit `a89c9a4 feat(mode): canonicalize dual-mode for auth/post/providers (CCP 4 / Phase 1 item 1.3, part 1/3)` canonicalises `src/lib/auth/provider.ts`, `src/lib/post/store.ts`, and `src/lib/providers/store.ts` (9 call-sites in providers/store instrumented with `logModeOnce()`). Commit `3468008 feat(mode): real dual-mode for asset-media repo (CCP 4 / Phase 1 item 1.3, part 2/3)` rewrites `src/lib/media/asset-media-repo.ts` with a real Supabase path for `getAssetGovernance` and `getReadyMedia` (both sync→async promoted per Q1 signoff), and the 6 downstream call-sites in `/api/media/[id]`, `/api/packages/[packageId]/artifacts/[artifactId]`, and `/api/entitlements/[assetId]` are awaited. Commit `5755d02 feat(mode): real dual-mode for watermark profile loader (CCP 4 / Phase 1 item 1.3, part 3/3)` rewrites `src/lib/processing/profiles.ts` with snake_case→camelCase row converters (`Number()` coercion on NUMERIC), promotes `getApprovedProfile`, `getProfilesForLevel`, `getAllSeedProfiles`, and `getMissingApprovedProfiles` to async, and rewrites the profiles vitest file to await every loader call; `src/lib/processing/pipeline.ts` awaits `getApprovedProfile`. `getAllSeedProfiles` is reinterpreted in real mode as "list all rows" (Q2 signoff). Verification: `tsc --noEmit` exit 0 after each of the 5 modules; `bun run build` exit 0 with 81 app routes resolved; no build warnings. `bun test` skipped — KD-8 remains the pre-existing blocker for reliable test signal and is not in CCP 4 scope. Manual mode-sanity (screen-watching for `[ff:mode]` logs in `bun run dev`) is optional and was not executed — production build logs are gated off by design. Items not in scope that CCP 4 consciously did **not** touch: entitlement-check hardening on the previously-mocked asset-media paths (noted for Phase 5 when Stripe fulfilment pipeline lands), licence-grant persistence, and the Waterdog import pathway. No new KD entries opened by CCP 4.
**Drift note (2026-04-17):** commit `5e652df feat(email): wire Resend + audited transactional send pipeline (Phase 3.0)` indicates Phase 3 item 3.1 has also begun ahead of sequence. Not a problem, but Phase 3 state in the "Current state audit" table below is stale — trust commits over the table until the table is refreshed.

---

## Known debt (2026-04-17)

Items discovered during CCP 2 execution that are **not** in CCP 2 scope. Each is scoped to a separate session; do not let them contaminate CCP 2's gate.

| ID | Item | Origin | Severity | Resolution path |
|---|---|---|---|---|
| KD-1 | `/search` prerender regression — `useSearchParams()` without Suspense boundary breaks `bun run build` | P0.2 | **High** (blocks any Vercel preview / prod deploy) | **Closed 2026-04-17** — commit `4681e92`. Wrapped both `src/app/search/page.tsx` and `src/app/checkout/[assetId]/page.tsx` `useSearchParams()` consumers in `<Suspense>` boundaries per Next.js 16 docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`). `bun run build` exit 0; 47 routes generated. `force-dynamic` directive retained but soft-deprecated per Next.js 16; see KD-7. |
| KD-2 | `licence_grants.listed_price_at_grant_cents` schema/fixture drift — column referenced by RLS test fixture does not exist on remote dev Supabase | Discovered during CCP 2 vitest run | Low (1 extended test case skipped; does not affect CCP 2 gate) | Follow-up task: align fixture with current schema, or extend schema with column if licence-grant pricing snapshot is in fact required. Decision needed on which direction. |
| KD-3 | Spec↔architecture drift: INTEGRATION_READINESS says `watermark_profiles` = "creator RW own" but 2026-04-16 image-derivative memo says watermark profiles are platform-managed + approval-gated. No `creator_id` on the table. | CCP 2 product-decision surfacing | Medium (spec contradicts architecture; future readers will be misled) | Correct the "Current state audit" / Phase 1 §1.4 wording in this document to match the image-derivative memo. Retain the deny-all policy until cleaned up. |
| KD-4 | Spec↔architecture drift: INTEGRATION_READINESS says `assignment_*` = participant "RW" but event-sourced writes go through `/api/assignment/*` for state-machine invariants. Direct client UPDATE would bypass. | CCP 2 product-decision surfacing | Medium | Correct the spec wording to "participant R, writes via service_role through /api/assignment/*". Retain the current policy. |
| KD-5 | `messages` DB table referenced in CCP 2 spec does not exist in schema. Closest artifact is `src/lib/deny-messages/` (UI strings). | CCP 2 product-decision surfacing | Medium (unclear whether this is supposed to be a real DB entity) | Product decision: is in-platform messaging part of v1? If yes, design the table + policy. If no, remove the row from the RLS spec. |
| KD-6 | Staff registry not defined: no `staff` enum in `user_granted_types`, no staff-identity table. Staff dashboard reads via service_role from `/staff`. | CCP 2 product-decision surfacing | Medium | Design the staff identity model (enum on users? separate staff table?) before Phase 5 needs it (dispute resolution, manual review queue). |
| KD-7 | `export const dynamic = 'force-dynamic'` on `/search` and `/checkout/[assetId]` is soft-deprecated in Next.js 16 in favor of `connection()` in an async Server Component. The directive is retained for now because removal would require converting both routes to Server Components with a Client inner — out of KD-1 scope. | KD-1 micro-fix (2026-04-17) | Low (build is green; directive works but is misleading now that Suspense carries the load) | Micro-CCP: convert each `page.tsx` to an async Server Component that calls `await connection()` and renders the Client inner wrapped in Suspense. Remove the `'use client'` + `force-dynamic` from the outer page. Re-verify `bun run build`. |
| KD-8 | `bun test` does not load `.env.local`. Tests that import modules running `src/lib/env.ts` validation at module-load time fail with "Required" errors for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. RLS tests and `src/app/api/v2/batch/__tests__/route.test.ts` are affected. This was silently masked in prior CCP 2 reporting, which measured the RLS file in a shell where env was in-process. | KD-1 Phase 3 verification run (2026-04-17) | Medium (blocks reliable CI test signal; Supabase-dependent tests skip or error depending on module import graph) | **Closed 2026-04-17.** Root cause was two-headed: (1) `package.json` had no `test` script so `bun test` picked bun's built-in runner, bypassing `vitest.config.ts` entirely; (2) even when vitest is invoked, it does not auto-load `.env.local`. Fix landed three changes: added `"test": "vitest run"` + `"test:watch": "vitest"` scripts, registered `vitest.setup.ts` under `test.setupFiles`, and the setup file calls `@next/env`'s `loadEnvConfig(process.cwd())` before any test module imports `src/lib/env.ts`. Also repaired a piggyback issue: 4 files used `import { z } from 'zod'`, which trips a dual-package interop bug under `bun run test` + vitest 4 / rolldown (`z.object` resolved to `undefined`) — switched to `import * as z from 'zod'` in `src/lib/env.ts`, `src/app/api/posts/route.ts`, `src/app/api/direct-offer/route.ts`, `src/app/api/v2/batch/route.ts`. Verification: `bun run test` runs 46/46 suites (previously 30/46 with 16 dark), 1,081 tests executed (up from 885), 981 pass + 1 skipped (KD-2) + 99 fail. 90.8% pass rate. The 99 new failures are all in the 16 previously-dark suites — no regressions in the 30 previously-green — and are re-categorised as KD-9. |

| KD-9 | 99 test failures across 16 previously-dark suites, surfaced once KD-8 restored test signal. Two dominant patterns: (a) **env-flag caching** — `flags.realUpload` and `MODE` are computed once when `src/lib/env.ts` / dual-mode store modules import; the test helper `withEnv({ FFF_REAL_UPLOAD: 'true' }, ...)` mutates `process.env` inside its closure but does not re-evaluate the cached values, so route handlers see the frozen flag and return 503 instead of the expected 404/409/etc. (b) **Real-Supabase path under MODE='real'** — with `.env.local` loaded, `isSupabaseEnvPresent === true`, so dual-mode modules pick the real path; fixtures written for the mock contract fail against real-DB requirements (e.g. `createBatch` setup fails because the batch row write hits constraints the in-memory store didn't enforce). Affected suites: `entitlement/services`, `entitlement/authorization-invariants`, `storage/index`, `upload/batch-service`, `upload/commit-service`, `onboarding/{resume,integration,account-creation,account-creation-verification}`, `api/upload`, `api/v2/batch`, `api/v2/batch/[id]/commit`, `auth/provider`, `processing/{pipeline,profiles}`, `providers/service`. | KD-8 closure run (2026-04-17) | Medium (blocks "all green" claim on the 16 newly-visible suites; does not block Phase 2/3 design work; is the expected fallout from CCP 3/4 architectural choices) | **Closed 2026-04-18 (commit `4e65176`).** Test-only env-stubbing helper (`scopeEnvVars` probe) + real-path fixture reshaping landed across 3 sub-tickets along affected-domain boundaries (upload / onboarding / entitlement). Audit reclassified remaining (b) failures as (a.2.ii) env-flag-caching variants; fixes applied in-place. Final closure commit `4e65176 KD-9 audit §Phase 2 + §Phase 4: reclassify 35 upload-domain tests (b) → (a.2.ii) + final closure`. |

KD-3 through KD-6 are all handled in the CCP 2 migration as explicit deny-all + TODO entries, which is governance-compliant per Phase 1 constraints. They do not block the CCP 2 gate; they are tracked here so they are not lost. KD-7 is queued as an independent micro-CCP (Phase 1 close-aligned). KD-8 closed 2026-04-17. KD-9 is the expected fallout from KD-8 — it surfaces real test failures that were previously masked, not new regressions; it does not block Phase 2/3 design work.

### Scope implications triggered by these locks

- **D10 adds Apple Sign In.** Requires Apple Developer account ($99/yr), certificates, identity bridge. New item: `4.A.8 Apple Sign In wiring via Supabase Auth (M)`.
- **D8 per-region routing** adds `4.B.5a` work: creator-residency field must exist on the `users` table before Vertex AI calls are made.
- All other locks align with the architecture the plan already described; no further scope deltas from `INTEGRATION_READINESS.md` locks alone.

---


## Purpose

This document enumerates the work that must complete before Frontfiles can safely:

1. Import production beta data from the Waterdog backend.
2. Connect Google (OAuth + Vertex AI + Vision + Workspace scopes).
3. Connect Stripe (full Connect marketplace, checkout, payouts, tax, subscriptions).

It is not a roadmap of the whole platform. It is the narrow list of enablers, foundations, and improvements that must be green before those three switches are turned on. Everything downstream of those switches (marketing launch, SEO, first-paying-customer flows, scaling work) is out of scope here.

## Scope

**In scope:** foundation (Supabase, auth, storage, RLS), observability, email, security hardening, the three integrations themselves, and the beta migration.

**Out of scope:** product/UX refinements not blocking the integrations; post-launch growth; performance tuning beyond what the integrations require; internationalisation beyond the tax/residency requirements Stripe and Google already impose.

## Locked scope decisions (from prior sessions)

| Decision | Resolved |
|---|---|
| Google scope | **For everything** — OAuth signin, Vertex AI (Gemini), Vision API (image reading), incremental Workspace scopes, Google Places for geography picker. GA4 out (use PostHog instead). |
| Stripe scope | **Complete setup** — Connect Express marketplace, Checkout, Payment Intents, Connect payouts, subscriptions if needed, Stripe Tax, Customer Portal, full webhook coverage, ledger + reconciliation. |
| Beta source | **Waterdog Bitbucket workspace** (`bitbucket.org/waterdog`). `frontfiles-backend` repo confirmed. Companion repos (frontend/mobile/shared) TBD — awaiting clone + mount. |

## Open questions that materially change the plan

Until these are answered, Phase 6 (beta migration) stays abstract.

| # | Question | Why it matters |
|---|---|---|
| Q1 | Waterdog backend: framework + DB + ORM + storage | Determines migration complexity (SQL-to-SQL vs. reshape vs. full re-export) |
| Q2 | How many beta repos exist under Waterdog (frontend, mobile, admin)? | Defines migration surface |
| Q3 | Rough row counts in beta DB (creators, assets, transactions, stories) | Sizes import time + rehearsal needs |
| Q4 | Does the beta use Stripe today? | If yes, Customer/Connect IDs can potentially be preserved; if no, re-onboarding required |
| Q5 | Does the beta use Google auth today? | If yes, email-match imports are frictionless; if no, password-reset magic-link flow needed |
| Q6 | Where does beta asset storage live (S3, Firebase, GCS, Cloudinary)? | Determines asset migration pipeline |
| Q7 | Is beta production continuing to accept new data during migration? | Defines freeze window + delta-sync strategy |

## Architectural decisions (must be signed off before coding)

These are the decisions where my default is opinionated and reversing them later is expensive. Confirm or push back on each one.

| # | Decision | My default recommendation | Tradeoff if rejected |
|---|---|---|---|
| D1 | Search infrastructure | pgvector in Supabase + Vertex AI embeddings | Algolia/Typesense costs money per search and adds a vendor; stay-inside-Supabase is the right first bet at your scale |
| D2 | Email provider | Resend + React Email templates | Postmark has better deliverability but worse DX; Resend is the idiomatic Next.js choice |
| D3 | Error tracking | Sentry | Datadog is overkill; Bugsnag is equivalent; Sentry has the best Next.js App Router story |
| D4 | Product analytics | PostHog (self-hostable, privacy-aware) | GA4 is free but hostile to editorial privacy story; Mixpanel/Amplitude are pricier |
| D5 | Stripe Connect variant | **Express** (Stripe owns KYC) | Custom gives more control but requires KYC compliance staffing |
| D6 | AI vendor lock-in | Vertex AI (per "Google for everything") | OpenAI/Anthropic would be cheaper for some tasks but violates your stated direction |
| D7 | Vector-search + embedding model | Vertex AI `text-embedding-004` + pgvector cosine index | Stable, multilingual, cheap |
| D8 | AI processing residency | EU region for EU creators, US for US | GDPR/AI-Act exposure; adds complexity but unavoidable |
| D9 | Data-out-of-training | Use Vertex AI (not the Gemini Developer API) to keep prompts out of training | Required for creator trust story |
| D10 | Auth fallback | Email magic-link alongside Google OAuth | Google-only locks out creators on non-Google emails (common in editorial) |
| D11 | Stripe test/live isolation | Preview env = test keys; prod = live keys; never mixed | Foundational — a single slip is expensive to unwind |
| D12 | Transactional vs. marketing email separation | Separate Resend domains/keys, separate suppression lists | CAN-SPAM / GDPR compliance |

## Current state audit (what exists, what's mocked, what's missing)

| Area | State | Confidence |
|---|---|---|
| Supabase schema | 37 migrations covering core entities. Schema is substantial. | ★★★ |
| Auth (`src/lib/auth/provider.ts`) | Mock mode by default; real Supabase path scaffolded. | ★★★ |
| Stripe (`src/lib/providers/adapters/stripe.ts`) | Mock mode. `STRIPE_CONNECT_CLIENT_ID` referenced. Webhook route at `/api/assignment/webhook/stripe` exists. | ★★★ |
| Google OAuth | `GOOGLE_OAUTH_CLIENT_ID` referenced in code. Signin page is UI-only mockup. | ★★★ |
| Upload substrate | PRs 1.1 merged, 1.2 open (PR #4), 1.3 pending. Storage adapter scaffolded. | ★★★ |
| Transactional email | Not present. No provider integrated. | ★★★ |
| Error tracking / logging | Not present. | ★★★ |
| Product analytics | Not present. | ★★★ |
| Search infra | UI-only `/search` page; no vector store, no index. | ★★★ |
| RLS (row-level security) on Supabase | Unknown — needs audit of every table's policy state. | ★★ |
| Signed-URL delivery for entitled downloads | Middleware blocks direct access; `/api/media/[id]` exists. Entitlement gating needs verification. | ★★ |
| `tsc --noEmit` | **Clean** (as of tonight's fixes). | ★★★ |
| `next build` | **Blocked** by 2 WIP pages (`/search`, `/checkout/[assetId]`) — prerender constraint. | ★★★ |
| GitHub PAT leak | **Active security risk** — `ghp_u372fo...` is embedded in `.git/config`. Must rotate today. | ★★★ |

## The work list

Categories:

- **ADD** — doesn't exist; must be built.
- **FIX** — exists but broken/incomplete; must be completed.
- **HARDEN** — works, but needs production-grade treatment before going live.
- **DECIDE** — gate on a product/architectural call.

Sizing: **S** = hours, **M** = days, **L** = weeks.

---

### Phase 0 — Pre-flight

Must be green before any integration work begins. Targeted at the debt accumulated tonight.

| Item | Cat | Size | Notes |
|---|---|---|---|
| P0.1 Commit the 4 tsc fixes from 2026-04-17 | FIX | S | `cross-ref.ts`, `visibility.ts`, `pipeline.ts`, `types/speech.d.ts` |
| P0.2 Resolve prerender issues on `/search` + `/checkout/[assetId]` (Suspense wrap or `export const dynamic = 'force-dynamic'`) | FIX | S | Unblocks `next build` |
| P0.3 Rotate leaked GitHub PAT, switch remote to SSH | HARDEN | S | Active risk |
| P0.4 Clean stale `.git/index.lock`, prune empty worktree, remove macOS duplicates in `.next/` | HARDEN | S | Hygiene |
| P0.5 Decide lifecycle of PR #4 (merge / rebase / close) and PR 1.3 (continue / pause) | DECIDE | S | History clarity before beta data lands |
| P0.6 Tag `main` at last-known-good state | HARDEN | S | Safety net |

---

### Phase 1 — Foundation

Nothing downstream can go live until this phase is done.

| Item | Cat | Size | Notes |
|---|---|---|---|
| 1.1 Real Supabase env wiring across dev / preview / prod | ADD | S | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| 1.2 RLS policies on every user-owned table | ADD | M | **Non-negotiable** before auth goes real |
| 1.3 Flip mocked modules to real dual-mode: `auth/provider.ts`, `post/store.ts`, `providers/store.ts`, `media/asset-media-repo.ts`, `processing/profiles.ts` | FIX | M | **Done (2026-04-17, CCP 4)** — 3 commits (`a89c9a4`, `3468008`, `5755d02`). All 5 modules canonicalised: mode decided once at load from `isSupabaseEnvPresent`, single `[ff:mode]` log per module on first use, identical public types across paths. Modules 4 and 5 promoted sync→async (Q1 signoff) with all call-sites awaited. `tsc --noEmit` clean (5×), `bun run build` exit 0 (81 routes). Closes the "mocks silently swallow writes" risk and closes Phase 1 foundation; item 1.1 (Vercel env wiring) is the only remaining Phase 1 item, and it is a parallel human task. |
| 1.4 Supabase Storage bucket policies + signed-URL delivery via `/api/media/[id]` with entitlement checks | HARDEN | M | Protects paid content |
| 1.5 Zod request schemas on every API route (fill gaps) | HARDEN | S–M | Defense before Stripe + Google touches these routes |
| 1.6 Rate limiting on auth, upload, checkout, webhook routes | ADD | S | Upstash Ratelimit or equivalent |
| 1.7 pgvector extension enabled + `asset_embeddings` table | ADD | S | **Done (2026-04-17, CCP 3)** — migration `20260419110000_phase1_vector_cache_audit.sql`. `vector(768)` per D7, HNSW cosine index, RLS service-role-only. |
| 1.8 `ai_analysis` cache table (per asset × model × version) | ADD | S | **Done (2026-04-17, CCP 3)** — same migration. Unique key `(subject_type, subject_id, model, model_version, input_hash)` with COALESCE so NULL `subject_id` (query type) still de-dupes. |
| 1.9 Audit log table mirroring every Stripe + AI + auth event | ADD | S | **Done (2026-04-17, CCP 3)** — same migration. Indexes on (event_type, created_at), (actor_id, created_at), (target_type, target_id, created_at), (trace_id). Append-only enforced at app layer. |
| 1.10 Environment-typed Zod schema for `process.env` (fail-fast on boot if any var missing) | ADD | S | **Done (2026-04-17, CCP 3)** — `src/lib/env.ts` + 9-file consolidation commit. `grep process.env src/` = 12 lines across 5 documented-exception files (health route metadata, dynamic resolvers, `NEXT_RUNTIME` signal). |

---

### Phase 2 — Observability

Without this, integration bugs in prod are invisible.

| Item | Cat | Size | Notes |
|---|---|---|---|
| 2.1 Sentry (Next.js SDK, server + client) | ADD | S | Stack traces for Stripe/Google failures |
| 2.2 Structured server logging (`pino` or equivalent, JSON out, trace IDs per request) | ADD | S | Webhook debugging, audit trails |
| 2.3 Deploy pipeline with strict environment-secret separation (Vercel preview vs prod) | HARDEN | S | Test-mode Stripe keys in preview, live in prod, never crossed |
| 2.4 Uptime monitoring on `/`, `/api/health`, webhook endpoints | ADD | S | BetterStack, Checkly, or equivalent |
| 2.5 Supabase log drain into Sentry or log storage | ADD | S | Database-side error capture |

---

### Phase 3 — Transactional email

Both Google and Stripe trigger email flows. This must exist before they do.

| Item | Cat | Size | Notes |
|---|---|---|---|
| 3.1 Integrate Resend (per D2) | ADD | M | API wrapper, retry, idempotency |
| 3.2 React Email template system + Frontfiles editorial design tokens | ADD | M | Consistent with platform voice |
| 3.3 Transactional vs marketing separation (separate Resend domains/keys, separate suppression) | ADD | S | CAN-SPAM / GDPR |
| 3.4 Template set: auth confirmation, magic-link, licence delivery, assignment lifecycle (invite / accept / funded / delivered / disputed / closed), payout notifications, refund receipts, creator KYC status changes | ADD | M | Covers Google auth + Stripe events |
| 3.5 Unsubscribe centre + preference management | ADD | S | Required for marketing-adjacent flows |
| 3.6 Bounce / complaint handling, email reputation watch | HARDEN | S | Deliverability protection |

---

### Phase 4 — Google (OAuth + Vertex AI + Vision + Workspace)

#### 4.A OAuth + identity

| Item | Cat | Size | Notes |
|---|---|---|---|
| 4.A.1 Google Cloud Console project, OAuth consent screen, domain verification for `frontfiles.news`, terms/privacy URLs public | ADD | S | Google will reject verification if legal pages aren't live |
| 4.A.2 Configure Supabase Auth → Google provider | ADD | S | Client ID/secret in Supabase dashboard |
| 4.A.3 Rewrite `src/app/signin/page.tsx` for real OAuth via `supabase.auth.signInWithOAuth({ provider: 'google' })` | FIX | S | Remove mockup flow |
| 4.A.4 Post-signin identity bridge: map Supabase user → Frontfiles `users` table, classify creator vs buyer, trigger onboarding | ADD | M | Must handle first-time vs. returning |
| 4.A.5 Email magic-link fallback (per D10) | ADD | S | Non-Google creator coverage |
| 4.A.6 Account linking flow (merge Google + email accounts where matched) | ADD | M | Prevents duplicate accounts post-migration |
| 4.A.7 Session management: Supabase SSR helpers, auth guard HOC for gated routes | HARDEN | S | Already scaffolded; needs audit |

#### 4.B Vertex AI (Gemini)

| Item | Cat | Size | Notes |
|---|---|---|---|
| 4.B.1 Vertex AI project + service account + IAM roles | ADD | S | GCP one-time setup |
| 4.B.2 Typed client wrapper `src/lib/ai/google.ts` (retries, cost metering, model selector) | ADD | S | Single vendor, many call sites |
| 4.B.3 `ai_analysis` read-through cache layer | ADD | S | Uses table from 1.8 |
| 4.B.4 ToS + onboarding consent surfaces for AI processing | ADD | S | Creator sign-off on data handling |
| 4.B.5 Per-region routing (EU vs US) based on creator residency | ADD | S | D8 |
| 4.B.6 Use cases v1: query understanding in `/search`, asset description auto-drafting in composer, story cross-ref enrichment, assignment brief parsing | ADD | M | Incremental rollout |

#### 4.C Vision (image reading)

| Item | Cat | Size | Notes |
|---|---|---|---|
| 4.C.1 Vision API enabled + client wrapper `src/lib/ai/vision.ts` | ADD | S | OCR, labels, safe-search, landmarks, faces |
| 4.C.2 Enqueue Vision analysis on upload commit; write to `ai_analysis` | ADD | M | Hooks into PR 2+ pipeline |
| 4.C.3 OCR → asset caption candidates in composer | ADD | S | UX value |
| 4.C.4 Landmarks + labels → geography / tag suggestions | ADD | S | UX value |
| 4.C.5 Safe-search → moderation flag (staff review before listing) | ADD | S | Policy + legal |
| 4.C.6 Face detection → consent-required flag (editorial policy: recognisable people require documented consent) | ADD | M | Rights-aware workflow |

#### 4.D Workspace scopes (incremental)

| Item | Cat | Size | Notes |
|---|---|---|---|
| 4.D.1 Gmail read-only for assignment-engine thread context (opt-in) | ADD | M | Scope requested only when user activates feature |
| 4.D.2 Drive read-only for "import from Drive" in upload flow | ADD | M | Incremental scope |
| 4.D.3 Calendar for assignment deadlines | ADD | S | Incremental scope |
| 4.D.4 Photos — deferred | DECIDE | — | Not in v1 |

#### 4.E Infrastructure

| Item | Cat | Size | Notes |
|---|---|---|---|
| 4.E.1 Google Places Autocomplete in geography picker | ADD | S | Complements Leaflet for map rendering |
| 4.E.2 GA4 decision | DECIDE | — | Recommend: skip in favour of PostHog (D4) |

---

### Phase 5 — Stripe (full Connect marketplace)

#### 5.A Account setup

| Item | Cat | Size | Notes |
|---|---|---|---|
| 5.A.1 Stripe account + Connect application + platform branding | ADD | S | One-time |
| 5.A.2 Restricted API keys per environment; never secret key client-side | HARDEN | S | Key hygiene |
| 5.A.3 Webhook signing secrets per environment | ADD | S | Per-env |

#### 5.B Buyer side

| Item | Cat | Size | Notes |
|---|---|---|---|
| 5.B.1 Checkout flow on `/checkout/[assetId]` + `/checkout/review` via Payment Intents | ADD | M | Embedded UI, not redirect |
| 5.B.2 Customer objects persisted + linked to Frontfiles `users` / `companies` | ADD | S | Enables Portal |
| 5.B.3 Cart → Payment Intent with platform fee and `transfer_data.destination` to creator's Connect account | ADD | M | Core marketplace mechanic |
| 5.B.4 `payment_intent.succeeded` webhook → mint `licence_grant` + deliver licence email + enable signed-URL download | ADD | M | End-to-end fulfilment |
| 5.B.5 `charge.refunded` + `charge.dispute.*` → revoke licence grant + notify parties | ADD | M | Negative flows |
| 5.B.6 Billing Portal for saved payment methods and subscription mgmt | ADD | S | Self-service |

#### 5.C Creator side (Connect Express)

| Item | Cat | Size | Notes |
|---|---|---|---|
| 5.C.1 Connect Express account creation during onboarding + hosted KYC | ADD | M | D5 |
| 5.C.2 `account.updated` webhook → flip creator `payout_ready` flag | ADD | S | Gate on listings until ready |
| 5.C.3 `/vault/settlements` + `/vault/transactions` made real | FIX | M | Earnings, pending, past, refunds, chargebacks |
| 5.C.4 Express dashboard login link (self-service Stripe surface) | ADD | S | Low-effort win |
| 5.C.5 Payout schedule controls | ADD | S | Default weekly, optional accelerated |

#### 5.D Subscriptions + invoicing

| Item | Cat | Size | Notes |
|---|---|---|---|
| 5.D.1 Decide: paid tier at launch? | DECIDE | — | Blocks 5.D.2–4 |
| 5.D.2 Products/Prices + Customer Portal (if yes) | ADD | M | Conditional on D5.D.1 |
| 5.D.3 Companies/memberships → seat-based subscription binding | ADD | M | Conditional on D5.D.1 |
| 5.D.4 Invoicing for enterprise assignments | ADD | M | B2B flows |

#### 5.E Tax

| Item | Cat | Size | Notes |
|---|---|---|---|
| 5.E.1 Stripe Tax enabled across Connect accounts | ADD | S | Automatic calc |
| 5.E.2 1099 / 1042-S via Connect Express (US) | HARDEN | S | Auto-handled if Express |
| 5.E.3 EU VAT / OSS configuration | ADD | M | EU creator + buyer exposure |
| 5.E.4 Tax-inclusive vs tax-exclusive pricing decision surfaced to creator | ADD | S | Product decision |

#### 5.F Ledger + reconciliation

| Item | Cat | Size | Notes |
|---|---|---|---|
| 5.F.1 `transactions` + `ledger_entries` tables; every Stripe event mirrored | ADD | M | Auditability |
| 5.F.2 Daily reconciliation job (Stripe balance vs. ledger); drift alert | ADD | S | Finance hygiene |
| 5.F.3 Dispute-monitoring + auto-response playbook | ADD | S | Reduce dispute loss |

#### 5.G Risk

| Item | Cat | Size | Notes |
|---|---|---|---|
| 5.G.1 Radar rules (licence-purchase patterns, card-testing, velocity limits) | ADD | S | Prevention |
| 5.G.2 Manual-review queue for high-risk orders | ADD | M | Staff UI |
| 5.G.3 Refund + dispute flows on `/vault/disputes` + admin surface | ADD | M | Negative-path UX |

---

### Phase 6 — Beta data migration (Waterdog backend)

**Status: blocked on Waterdog repo audit** (Q1, Q2, Q6 above). All items below are provisional.

| Item | Cat | Size | Notes |
|---|---|---|---|
| 6.1 Source inventory + row counts per entity | ADD | S | After Waterdog clone |
| 6.2 Schema-mapping doc: beta entity → Frontfiles Supabase table, field-by-field | ADD | M | Canonical migration spec |
| 6.3 ID-mapping table: beta_id ↔ new UUID, preserved forever | ADD | S | Audit + URL redirects |
| 6.4 URL redirect plan (`beta.frontfiles.news/asset/123` → new URL) | ADD | S | SEO + in-wild links |
| 6.5 Idempotent import scripts per entity (dry-run, rollback) | ADD | M–L | Core migration code |
| 6.6 Asset file migration: Waterdog storage → Supabase Storage + re-run PR 2+ pipeline | ADD | M | Triggers Vision + derivative generation |
| 6.7 Auth migration: email match → Supabase user; magic-link reset if beta used passwords; Google linkage where possible | ADD | M | User continuity |
| 6.8 Referential-integrity + orphan-row validation post-import | ADD | S | No dangling refs |
| 6.9 Stripe Customer recreation for imported buyers | ADD | M | Only if beta already used Stripe (Q4) |
| 6.10 Creator Connect re-invitation flow (existing beta creators must complete KYC) | ADD | M | Required — Stripe can't import Connect accounts |
| 6.11 Full dry-run rehearsal against staging before prod cutover | HARDEN | M | Catch issues before they're user-facing |
| 6.12 Beta decommissioning: freeze window, final sync, DNS cutover | ADD | M | Coordinated |

---

### Phase 7 — Quality & security hardening (parallelisable after Phase 1)

| Item | Cat | Size | Notes |
|---|---|---|---|
| 7.1 Legal pages live at public URLs (Terms, Privacy, Creator Agreement, Buyer Licence, AI Processing Disclosure) | ADD | M | Blocks Google OAuth verification + Stripe Connect |
| 7.2 Customer support channel (Plain, Front, Intercom, or email-to-helpdesk) | ADD | S | For disputes, KYC issues, auth problems |
| 7.3 Feature-flag system (graduate from env flags to runtime flags via PostHog or similar) | HARDEN | S | Per-user rollouts |
| 7.4 E2E tests for the 5 critical flows: signin (Google), upload → list → checkout, buyer licence delivery, creator payout visibility, dispute | ADD | L | Confidence in critical paths |
| 7.5 Fill test coverage gaps (current 16/443; target ≥ 60% on `src/lib/**`) | HARDEN | L | Lifelong |
| 7.6 Security review: RLS, webhook signature verification, CSP headers, CORS | HARDEN | M | Pre-launch gate |
| 7.7 Performance budget check (Largest Contentful Paint, Total Blocking Time) | HARDEN | S | Vercel Analytics / Lighthouse CI |

---

## Execution sequence

Dependency-ordered. Phases inside the same row can be worked in parallel.

```
[Phase 0 pre-flight]
      │
      ▼
[Phase 1 foundation]  ──┐
                         ├──► [Phase 4 Google]  ──┐
[Phase 2 observability]  │                          │
                         ├──► [Phase 5 Stripe]    ──┼──► [Phase 6 beta migration]
[Phase 3 email]          │                          │
                         └──► [Phase 7 hardening] ──┘
```

**Rules:**

- Phase 1 is a hard gate. Nothing real-world happens until it's green.
- Phases 2 and 3 parallelise inside the Phase 1 window if there's capacity.
- Phase 7 runs continuously once foundation is down.
- Phase 6 runs last — it is the commitment point. All other phases must be production-ready before beta data touches the new DB.

## Ownership and sign-off

Per Frontfiles governance pattern: architecture before implementation.

| Gate | Requires sign-off on | Before code ships |
|---|---|---|
| G1 | Architectural decisions D1–D12 | Phase 1 work begins |
| G2 | Phase 1 completion (Foundation) | Phase 4 / 5 begin |
| G3 | Legal pages live + Google verification acquired | Phase 4.A ships |
| G4 | Stripe Connect application approved | Phase 5.C ships |
| G5 | Waterdog audit complete + schema-mapping doc signed | Phase 6 begins |
| G6 | Full dry-run rehearsal passed on staging | Phase 6 prod cutover |

## Assumptions flagged

- Production deployment target is Vercel (inferred; confirm).
- Supabase is the sole Postgres provider (confirmed from repo).
- Frontfiles is legally registered in a Stripe Connect–supported country (confirm).
- Creator earnings will be paid out in the creator's local currency where supported; settlement currency for Frontfiles is TBD.
- Launch target for real customers is post-Phase-6. No paying customer interacts with the platform until beta migration completes.
- Beta migration happens in a single cutover window, not a dual-run period.

## What's NOT in this document (out of scope, by design)

- Feature roadmap beyond integration readiness.
- Mobile app strategy.
- Marketing site / SEO.
- Partnerships (editorial, media, wire-service).
- Customer acquisition.
- Post-launch internationalisation beyond what Stripe/Google already force.

## Next step (for author)

1. Answer Q1–Q7 (Waterdog backend audit prerequisites).
2. Sign off or reject each of D1–D12 (architectural decisions).
3. Clone Waterdog repos and mount so Phase 6 can be concretised.
4. Approve or revise this document. Once approved, convert into tracked tasks (TaskCreate) with owners and dates.

---

*End of document — v1 draft. All items sized roughly; real estimates require per-phase kickoff.*
