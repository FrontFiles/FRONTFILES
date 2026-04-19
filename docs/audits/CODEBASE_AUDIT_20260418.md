# Frontfiles Codebase & Architecture Audit — 2026-04-18

**Auditor:** Claude (red-team)
**HEAD (working tree at audit time):** `097b5a3` (prompt nominated `8094e70`; audit follows live tree)
**Baseline:** 1080 tests passing / 1 skipped
**Scope:** Independent of P5. Does not re-litigate P0–P4 rename.

## What this really is

Frontfiles is a Next.js 16 App Router prototype of a professional editorial content platform — vault, assignments, special offers, certified packages, FFF Sharing feed, discovery. The code reads as an ambitious *domain sketch* in front of a *thin, stubbed transport layer*: the domain modules (assignment engine, special-offer engine, entitlement, processing pipeline, watermark, provider foundation) are expressive, strongly typed, and mostly pure — with extensive reducer/selector/guard patterns and real unit coverage. But everything upstream of them — authentication, session, HTTP boundary, DB access role, dual-mode mock-vs-Supabase plumbing, API input validation — is either explicitly deferred or "canonical pattern applied to 10 % of the surface and declared done". The result is that the **business logic is journal-quality**; the **platform around it will not hold a single real user session**. The audit consequently finds a small number of systemic root causes, not a long tail of cosmetic bugs.

## Current-state inventory

- **Application code:** 486 `.ts`/`.tsx` files in `src/` totalling ~115.4k LOC.
- **Data / mock fixtures:** 14.4k LOC in `src/data/*.ts` (20 files) + 1.5k LOC in `src/lib/mock-data.ts`.
- **Route surface:**
  - 47 pages (`page.tsx`), 44 marked `'use client'` at module-level, ~3 server pages.
  - 33 API route handlers under `src/app/api/*/route.ts`, across `assignment`, `special-offer`, `posts`, `packages`, `providers`, `entitlements`, `media`, `upload`, `v2/batch`, `bolt`, `health`.
- **Domain libraries (`src/lib/*`):** 30 modules. The heaviest: `assignment` (16 files, ~4.4k LOC + ~4.7k LOC of tests), `upload` (16 files, ~6k LOC), `processing` (10 files), `identity` (7 files, `store.ts` 1080 LOC), `special-offer` (8 files), `providers` (11 files).
- **Top 10 files by LOC:**
  - `src/data/assets.ts` 8300
  - `src/lib/mock-data.ts` 1523
  - `src/lib/upload/v2-state.ts` 1431
  - `src/lib/assignment/__tests__/services.test.ts` 1398
  - `src/lib/types.ts` 1249
  - `src/components/assignment/NewAssignmentWizard.tsx` 1113
  - `src/app/creator/[handle]/frontfolio/page.tsx` 1108
  - `src/components/account/IdentityDrawer.tsx` 1088
  - `src/lib/identity/store.ts` 1080
  - `src/lib/assignment/__tests__/qa-coverage.test.ts` 1059
- **Tests:** 46 `*.test.ts` files. 1080 pass / 1 skipped baseline. Route-handler integration tests exist only for **3 of 33** routes (`/api/upload`, `/api/v2/batch`, `/api/v2/batch/[id]/commit`).
- **Database migrations:** 41 `.sql` files under `supabase/migrations/` (36 forward + rollbacks + preflight). RLS policies landed in `20260419100000_rls_core_policies.sql` + `20260420000000_rls_all_tables.sql`. P5 rename migration `20260420010000_rename_direct_offer_to_special_offer.sql` is on disk but **not applied** (see `P5_PAUSED_HANDOFF_20260418.md`).
- **Dependencies:** 18 runtime, 9 dev. `next@16.2.2`, `react@19.2.4`, `@supabase/supabase-js@2.103.2`, `@sentry/nextjs@10.49.0`, `zod@3.23.8`, `@base-ui/react@1.3.0`, `pino@10.3.1`, `resend@6.12.0`, `sharp` (peer of next, used directly), `shadcn@4.1.2` (see Finding L-1), `lucide-react@1.7.0`.
- **Auth pattern:** There is no real session. `src/lib/user-context.tsx` resolves every page's "current user" from `SESSION_DEMO_USER_ID` in seed data. API routes authenticate via the **client-provided header** `x-frontfiles-user-id` (10 routes) or the **client-provided body field** `buyerId`/`actorId`/`requesterId`/`responderId` (12 routes).
- **RLS pattern:** Comprehensive — 22+ policies across 37 tables, anon column-grant restriction on `users.email`, `users_public` projection view, participant reads on every assignment nested table, deny-all on external credentials / watermark profiles. Runtime code does not consume it — see Finding A-1.
- **Data-fetching pattern:** Client-side. Of 47 pages, 44 are `'use client'`. Server components are limited to layout shells. Pages import seed-data maps from `@/data/*` and render from them synchronously (e.g. `/feed`, `/search`, `/vault`). No server-rendered data for SEO-relevant surfaces.
- **Mutation pattern:** Client invokes `fetch('/api/...')` with body carrying `authorId`/`buyerId`/`actorId`. Server uses `await req.json()` (14 routes) or `parseBody()` with Zod (3 routes), then dispatches to in-memory services (`assignment/store.ts`, `special-offer/store.ts` — both Map-backed, no DB path) or to a dual-mode store that degrades to service-role on the Supabase branch.

## Findings

### A. Auth is cosmetic: service-role everywhere, client-supplied identity

This is the root cause of most security findings. It is not a single bug; it is the platform's shipping posture.

- **[Critical] Every DB call uses `SUPABASE_SERVICE_ROLE_KEY`, bypassing RLS** — `src/lib/db/client.ts:50`. `createClient(url, key, …)` with the service-role key is the only client factory in the repo. The 15 callers of `getSupabaseClient()` in `src/lib/*` and the 22 RLS policies in `supabase/migrations/20260420000000_rls_all_tables.sql` are therefore on two separate enforcement planes. RLS currently protects against a threat model (anon / authenticated-role clients) that doesn't exist at runtime — there is no `createBrowserClient`, `createServerClient`, or JWT-bearing client in the codebase (grep: zero hits for `createServerClient|createBrowserClient`). This removes any meaningful defence-in-depth. For an editorial platform whose pitch is "journalists trust us with unpublished material", a service-role-only data path is not deferrable. Remediation: introduce an authenticated Supabase client factory that forwards the caller's JWT, and split `getSupabaseClient()` into `getServiceClient()` (admin-only paths: webhook ingest, server-side state-machine writes) and `getUserClient(jwt)` (everything else). Gate the service-role client behind a lint rule so callers must justify it.

- **[Critical] API routes trust client-supplied `x-frontfiles-user-id` header** — `src/app/api/media/[id]/route.ts:88`, `src/app/api/packages/[packageId]/download/route.ts:40`, `src/app/api/packages/[packageId]/route.ts:22`, `src/app/api/packages/[packageId]/artifacts/[artifactId]/route.ts:60`, `src/app/api/entitlements/[assetId]/route.ts:25`, `src/app/api/posts/route.ts:107`, `src/app/api/posts/[id]/route.ts:50`, `src/app/api/providers/connections/route.ts:54`, `src/app/api/providers/connections/[id]/route.ts:28`. The server reads the user id from an HTTP header the client set. Any caller can impersonate any user — including downloading any other user's licensed originals via `GET /api/media/{assetId}?delivery=original` with `x-frontfiles-user-id: <victim>`. The `rate-limit` and `entitlement` subsystems then faithfully operate on the wrong identity. Today this is gated only by the fact the app uses mock data; the moment a Supabase cutover lands (which the store dual-mode is shaped to enable at env-flip time) this becomes a live data leak. Remediation: resolve the user from a signed cookie or `Authorization: Bearer …` JWT only, validated server-side against `auth.users`. Until then, every such header path must 501 when `NEXT_PUBLIC_SUPABASE_URL` is set.

- **[Critical] API routes trust client-supplied identity fields in the body** — `src/app/api/special-offer/route.ts:72` (`body.buyerId`), `src/app/api/assignment/route.ts:26` (`body.buyerId`), `src/app/api/assignment/[id]/cancel/route.ts:26` (`body.actorId`), `src/app/api/assignment/[id]/accept|fulfil|review|review-open|dispute/route.ts` (all pass `body.actorId` into the service's `isThreadCreator` / `isThreadBuyer` guards), `src/app/api/assignment/[id]/ccr/route.ts:38,53,67` (`body.requesterId`, `body.responderId`), `src/app/api/special-offer/[id]/accept|counter|decline/route.ts:31` (`body.actorId`). `requireGrant(body.buyerId, 'buyer')` in `src/lib/identity/guards.ts:93` reads the *asserted* id — it is not identity, just role assertion against whatever id the caller chose to type. This turns every mutation route into a universal impersonation API. Business impact for editorial buyers: anyone can accept an offer on a creator's behalf, cancel an assignment as the opposing party, settle a commission change, or issue a brief in a buyer's name. Remediation: same as A-1 / A-2 — kill body-supplied identity; resolve actor from server-side session; make `requireGrant` require an authenticated actor id, not a claimed one.

- **[Critical] `/api/assignment/webhook/stripe` does not verify the Stripe signature and mutates escrow state** — `src/app/api/assignment/webhook/stripe/route.ts:38-82`. The TODO at line 40 is load-bearing — the route accepts `{ type: 'payment_intent.captured', assignmentId, capturedAmountCents }` from any caller and writes the assignment to captured. This is a second, older webhook endpoint running alongside the newer `/api/providers/webhooks/[provider]` (which does gate on `verifyWebhookSignature`, `src/lib/providers/adapters/stripe.ts:57`). An unsigned webhook that mutates payout state for editorial assignments is a cash-out vector. Remediation: delete this route immediately. If the domain handlers it calls (`syncEscrowCaptureFromStripe`, `syncStripeReleaseState`) are real, dispatch them from `verifyAndIngestWebhook` after signature validation.

- **[High] `requireGrant` is applied to exactly 2 of 16 role-scoped mutation routes** — `src/app/api/special-offer/route.ts:72`, `src/app/api/assignment/route.ts:26` are the full coverage. The remaining assignment / CCR / fulfilment / offer-counter / offer-decline / offer-accept / posts-repost / providers-connections / upload routes either use the header pattern (A-2) or nothing at all. `src/lib/identity/guards.ts:14` explicitly calls this out as "Phase B intentionally does NOT … retrofit every API route." The partial rollout is worse than none, because it implies system-wide coverage. Remediation: finish the rollout, or wrap all route handlers in a single `withAuthenticatedActor()` helper that *requires* a resolver and blocks the header path.

### B. Domain stores are in-memory only; the DB path is a façade on half the surface

The codebase advertises a "dual-mode" pattern (`isSupabaseEnvPresent` gates mock vs real). This is real in some places and a pure fiction in others. The inconsistency silently makes "shipping" a much bigger step than the module docstrings suggest.

- **[Critical] `special-offer` has no Supabase path at all** — `src/lib/special-offer/store.ts:15-17`. Three top-level `Map<string, …>` instances; no `getSupabaseClient` import; no `isSupabaseEnvPresent` gate. The DB migration `20260408230006_direct_offer_tables.sql` created `direct_offer_threads` + `direct_offer_events` + `offer_checkout_intents`, the P5 rename migration would turn them into `special_offer_*`, but there is no code that reads or writes either. Every offer a user negotiates evaporates on a deploy. The header of `services.ts:2` still reads "Direct Offer Engine" despite P2 rename (category J).

- **[Critical] `assignment` has no Supabase path** — `src/lib/assignment/store.ts:24-25`. Same pattern: `new Map(mockAssignments.map(a => [a.id, a]))` at module load, and every `getAssignment`, `putAssignment`, `listAssignments` touches only the map. Assignments are the highest-value editorial transaction in the product. The schema for `assignments`, `milestones`, `escrow_records`, `assignment_events` etc. is present; the code to move a row in or out of it is not.

- **[Critical] `/api/special-offer` reads assets from a hard-coded fixture** — `src/app/api/special-offer/route.ts:11,76`. `import { mockVaultAssets } from '@/lib/mock-data'` then `mockVaultAssets.find(a => a.id === body.assetId)`. If you offer on a real vault asset the route returns `ASSET_NOT_FOUND` (404); if you offer on a mock fixture id, the route succeeds, negotiation state lives in-memory, and the Supabase `vault_assets` table is never consulted. Journalists who upload real assets are functionally barred from the offer surface.

- **[High] Inconsistent dual-mode adoption across stores** — `src/lib/post/store.ts`, `src/lib/identity/store.ts`, `src/lib/entitlement/store.ts`, `src/lib/media/asset-media-repo.ts`, `src/lib/upload/upload-store.ts`, `src/lib/upload/batch-store.ts`, `src/lib/providers/store.ts`, `src/lib/processing/profiles.ts`, `src/lib/fulfilment/store.ts` each gate on `isSupabaseEnvPresent()` (or the now-deprecated `isSupabaseConfigured()`) and have an implemented DB branch. `src/lib/special-offer/store.ts`, `src/lib/assignment/store.ts`, `src/lib/upload/v2-state.ts`, `src/lib/post/draft-store.tsx`, `src/lib/transaction/context.tsx` do not. Half of the stores silently become read-only-of-seed at flip time. The mode-log line `[ff:mode] post=real` offers false reassurance because only 30 % of the surface participates. Remediation: lint rule rejecting `new Map()` at module level in any file under `src/lib/**/store.ts`. Every store must route through a single `createStore({ mock, real })` factory.

- **[High] Seed data is read directly from domain modules** — `src/lib/post/hydrate.ts:14-19` (`assetMap`, `storyMap`, `articleMap`, `collectionMap`, `creatorMap`, `postMap`), `src/lib/post/validation.ts:11-15`, `src/lib/media/asset-media-repo.ts:28`, `src/lib/share/metadata.ts:9-12`, `src/lib/search-data.ts:7-10`, `src/lib/bolt/cross-ref.ts:13-14`, `src/lib/composer/*`. Hydration is JOIN logic written against seed fixtures; there is no SQL-backed hydrate. Once the DB branch of `post/store.ts` returns rows, `hydrate.ts` will still enrich them from `@/data/assets.assetMap`, silently pointing every asset preview URL at seed data. Remediation: move all hydration to a `PostHydrator` that takes a looker-upper instead of top-level imports, and wire seed imports only in mock mode.

### C. Input validation is a documented pattern with 10 % adoption

- **[High] Only 3 of 33 API routes use `parseBody()`** — uses: `src/app/api/special-offer/route.ts:53`, `src/app/api/v2/batch/route.ts:82`, `src/app/api/posts/route.ts:126`. Every other mutation route (`src/app/api/bolt/session/route.ts:39`, `src/app/api/assignment/*/route.ts`, `src/app/api/special-offer/[id]/*/route.ts`, `src/app/api/providers/connections/route.ts:162`, `src/app/api/assignment/webhook/stripe/route.ts:38`, etc.) uses `await request.json()` with hand-rolled `if (!body.x || !body.y)` checks. Most do not reject `body.x` being an object, an array, or a million-byte string. `src/app/api/bolt/session/route.ts:39` is the sharpest: `body = (await request.json()) as BoltSessionRequest` casts raw input to the domain type and proceeds. `src/lib/api/validation.ts:1-30`'s header says "Every route should parse its inputs through these helpers — NEVER consume `await req.json()` or `searchParams.get(...)` directly"; the codebase contradicts that statement by 10× the compliance ratio.

- **[Medium] `POST /api/posts` body schema has `repostOf: z.any()`** — `src/app/api/posts/route.ts:51`. The critical inlined-snapshot field is unvalidated. The TODO at line 49 acknowledges it. Combined with hydration-on-seed (B-5), a malformed `repostOf` can inject arbitrary attachment metadata through the feed. Remediation: extract a shared `PostRowSchema` Zod extractor — the schema already lives in `src/lib/db/schema.ts` as a TS type; generate the Zod mirror once and reuse.

### D. Three parallel mock-data systems leaked into production modules

- **[High] `src/data/*.ts` (14.4k LOC) and `src/lib/mock-data.ts` (1523 LOC) are parallel sources of truth with different shapes** — `src/data/assets.ts:8` declares `AssetFormat = 'Photo' | 'Video' | …` (title case) while `src/lib/types.ts:15` declares `AssetFormat = 'photo' | 'video' | …` (lower case). `src/lib/upload/types.ts:12` has a third version. An asset read through `data/assets.ts` is therefore not assignable to a `VaultAsset` from `types.ts` without a case-fixup that no code performs. This is the kind of silent drift that ships broken filters and unchecked enum fall-through. Remediation: one canonical `AssetFormat`. Migrate `data/assets.ts` onto `lib/types.ts` types and remove the local re-declaration.

- **[High] Production code imports from `@/lib/mock-data`** — `src/app/api/special-offer/route.ts:11`, `src/app/checkout/[assetId]/page.tsx:10`, `src/app/vault/page.tsx:12`, `src/app/vault/offers/page.tsx:19`, `src/app/vault/pricing/page.tsx:8`, `src/app/vault/settlements/page.tsx:8`, `src/app/account/page.tsx:18`, `src/app/staff/page.tsx`, `src/lib/media/asset-media-repo.ts:29`. `mock-data.ts` is not gated behind a flag, not gated behind a `mock/` subfolder, not conditionally imported. It is a first-class module with first-class callers. Remediation: move `mock-data.ts` under `src/data/_seed/` and forbid imports from `src/app/**` and `src/lib/**/store.ts` (lint rule). Leave one supported seed tree (`src/data/*`).

- **[Medium] `SESSION_DEMO_USER_ID` is the production session** — `src/lib/user-context.tsx:26`, `src/lib/transaction/context.tsx:11`, `src/data/users.ts`. The demo user id is the live `sessionUser` for every page. When the team is ready to cut over to real auth, they will be rewriting every page that calls `useUser()`. That's a scope gate masked as a TODO. Remediation: introduce a `SessionProvider` that reads from a cookie or (in dev) from a pluggable dev-session shim, and drain `SESSION_DEMO_USER_ID` to the dev shim only.

### E. Error-shape inconsistency and PII leakage in error bodies

- **[High] Three of four `api-helpers.ts` leak `err.message` to clients** — `src/lib/assignment/api-helpers.ts:60`, `src/lib/special-offer/api-helpers.ts:39`, `src/lib/post/api-helpers.ts:40`. Only `src/lib/providers/api-helpers.ts:28-40` gets this right (and its header at line 5-14 documents the reasoning). A Supabase-side error containing table names, constraint names, row-count hints, or partial stored values returns to the client verbatim. Plus: duplicated logic across four files (category C). Remediation: one shared `@/lib/api/error-helpers.ts` used by all four surfaces; the providers variant becomes the canonical.

- **[Medium] Four parallel `api-helpers.ts` files with ~20 lines of duplicated success/errorResponse/withDomainError** — `src/lib/assignment/api-helpers.ts`, `src/lib/special-offer/api-helpers.ts`, `src/lib/post/api-helpers.ts`, `src/lib/providers/api-helpers.ts`. One-caller abstractions replicated four ways.

- **[Medium] `/api/posts` 422 mapping is idiosyncratic** — `src/app/api/posts/route.ts:166-178`. 422 with custom `{ error: { code, message, details } }` is a different shape than `parseBody`'s 400 (`{ error: { code: 'VALIDATION_ERROR', fields } }`) for validation failures. Clients must branch on status + decode two shapes.

### F. RLS migration is comprehensive-but-decorative; one real hole, one latent drift

- **[High] RLS policies reference table names that the runtime no longer uses** — `supabase/migrations/20260420000000_rls_all_tables.sql:466-481`. Policies `direct_offer_events_participant_read` and `offer_checkout_intents_participant_read`. P5 rename migration (same-day) renames the underlying tables to `special_offer_*` but keeps this RLS migration shipped. When P5 lands, the RLS migration's `DROP POLICY IF EXISTS direct_offer_events_participant_read ON direct_offer_events` fails because the table name changed. Not critical at runtime today (service-role bypasses RLS anyway — A-1), but it will become a migration-rollout hazard the moment P5 is revived.

- **[Medium] `watermark_profiles` deny-all contradicts the product decision** — `supabase/migrations/20260420000000_rls_all_tables.sql:542-547`. The header text says "TODO: decide whether clients ever need to READ approved profiles". The watermark compositor runs server-side (`src/lib/processing/watermark-compositor.ts`), so deny-all is fine for now — but the comment admits the design isn't locked. Downgrade to a real decision (read for `authenticated`, write service-role) or the first production feature that needs client-side profile preview will ship its own service-role query.

- **[Medium] Column-level grants on `users` only cover SELECT** — `supabase/migrations/20260420000000_rls_all_tables.sql:149-164`. `users.email` is correctly protected from anon SELECT, but `email` is still writeable by authenticated via RLS policy `users_self_update`. For editorial identity where email change is a trust event, consider moving email updates behind a server-side audited flow that requires re-verification.

### G. Client-first architecture means SSR/SEO surface is zero for editorial pages

- **[High] 44 of 47 pages are `'use client'`** — including `/feed`, `/search`, `/article/[id]`, `/story/[id]`, `/creator/[handle]`, `/collection/[id]`, `/post/[id]`. For an editorial platform, those are exactly the pages that need server rendering for link previews, OG images, and crawler indexation. The current architecture renders these in-browser from seed maps. Remediation: split each detail page into a server `page.tsx` that reads from the domain store + a client `*Client.tsx` for interactivity. This is 2-3 days of work per page tree.

- **[Medium] `next.config.ts` is a one-line empty config** — `next.config.ts:3`. No image domains, no MDX, no rewrites, no `experimental.logging`. This is not wrong (defaults work) but is striking for a Next.js 16 app that already uses Turbopack, Sentry, external image sources via `leaflet`, and file-system-served media. Expect this file to need curation as soon as the signed-URL delivery work (TODOs in `/api/media/[id]/route.ts:290`, `/api/packages/[packageId]/download/route.ts:134`, `/api/packages/[packageId]/artifacts/[artifactId]/route.ts:281`) lands.

### H. Test coverage has structural blind spots

- **[High] 3 of 33 route handlers have integration tests** — `src/app/api/upload/__tests__/route.test.ts`, `src/app/api/v2/batch/__tests__/route.test.ts`, `src/app/api/v2/batch/[id]/commit/__tests__/route.test.ts`. The other 30 — including every assignment-state-machine transition, every special-offer negotiation endpoint, the webhook ingest, the media delivery endpoint, the package download endpoint — have no HTTP-level tests. The `services.test.ts` files under `assignment/__tests__/` and `special-offer/__tests__/` are excellent at exercising pure reducers but cannot catch a trust-the-body-buyerId bug.

- **[High] RLS is only tested against anon** — `src/lib/db/__tests__/rls.test.ts:43` ("RLS — anon vs service_role"). The header at lines 12-15 admits this: "We don't currently exercise the `authenticated` role here". Every participant-read policy added in `20260420000000_rls_all_tables.sql` is UNTESTED against a real authenticated JWT. Given A-1, this is moot in practice; but it means the RLS hardening cannot be relied on to backstop a future auth wiring.

- **[Medium] No integration test for mode = 'real'** — `src/lib/db/__tests__/rls.test.ts` is the only test suite that connects to a real Supabase. Every other store test runs in mock mode by design (see the `scopeEnvVars` helper at `src/lib/test/env-scope.ts:1`). The entire real branch of `post/store.ts`, `identity/store.ts`, `entitlement/store.ts`, `fulfilment/store.ts`, `upload/upload-store.ts` lacks round-trip coverage.

- **[Medium] `src/lib/fulfilment/store.ts`, `src/lib/providers/store.ts`, `src/lib/media/asset-media-repo.ts`, `src/lib/processing/profiles.ts` — no `__tests__` directory at all**. These files each ship a Supabase path directly behind a store interface and an in-memory path, with zero unit tests for either branch.

### I. Miscellaneous type safety and boundary drift

- **[Medium] `src/lib/auth/provider.ts:233,268,325` — `as any` on the Supabase client**. The comment admits the cast is because `@supabase/supabase-js`'s `admin.*` types aren't surfaced. Tolerable as a narrow workaround but leaks into the business logic of "create or adopt an auth user" — any future typo against `admin.auth.*` will not be caught by TSC.

- **[Medium] `src/lib/fulfilment/store.ts:98` — `data.map((row: any) => ({ … }))`**. The raw PostgREST response is typed as `any` and manually mapped. Every other store file does this via a typed `maybeSingle()` / `select('*')`. Remediation: define `CertifiedPackageRow` in `@/lib/db/schema.ts` once and use it at the type boundary.

- **[Medium] `src/lib/rate-limit/write-actions.ts:65` and `src/lib/rate-limit/original-downloads.ts:62` read `process.env[name]` directly** — explicitly forbidden by the docstring in `src/lib/env.ts:21`. Rate-limit thresholds (`RATE_LIMIT_WRITE_BURST`, etc.) are not in the Zod schema. Misconfigured envs silently fall back to defaults; the "fail-fast on import" promise is partial. Remediation: add these keys to `envSchema` and route through `env`.

- **[Medium] `sentry.{client,server,edge}.config.ts` read `process.env.NEXT_PUBLIC_SENTRY_DSN` and `NODE_ENV` directly** — same violation as I-3. Sentry sample rate is an operational lever; belongs in the schema.

- **[Low] `src/app/api/upload/route.ts:92` — `metadata = JSON.parse(metadataRaw)` then used as `unknown`**. The JSON parse is not wrapped by a Zod schema, so the shape reaching `commitUpload` is typed `unknown` and narrowed downstream. The `commitUpload` service accepts `metadata: unknown` deliberately; still, the edge handler is the right place to enforce the shape of client-supplied metadata rather than passing it through.

- **[Low] Three `@ts-expect-error` in test files** — `src/lib/providers/__tests__/registry.test.ts:101`, `src/lib/providers/__tests__/access.test.ts:231`, `src/lib/processing/__tests__/profiles.test.ts:46`. All three are labelled "intentionally invalid". Hygiene only.

### J. Direct-offer residue beyond P5 scope

Logged for cross-reference; P5 owns schema + value rename but these string/identifier residues are separate.

- **[Medium] Rate-limit key still uses `direct-offer.create`** — `src/app/api/special-offer/route.ts:65`. `actionType: 'direct-offer.create'` is baked into the telemetry / sliding-window key. Flipping the rename through code without flipping this key means post-rename rate-limit counters begin from zero. Intentional or not, worth deciding.
- **[Medium] File-level docstrings still say "Direct Offer Engine"** — `src/lib/special-offer/services.ts:2`, `src/lib/special-offer/store.ts:2`, `src/lib/special-offer/guards.ts:2`, `src/lib/special-offer/reducer.ts:2`, `src/lib/special-offer/types.ts:2`, `src/lib/special-offer/api-helpers.ts:2`, `src/lib/special-offer/__tests__/helpers.ts:2`. Header terminology lock incomplete.
- **[Low] `src/lib/identity/guards.ts:14` — comment "proof-of-concept wirings for the new `requireGrant` helper … (direct-offer create, assignment create)"**. P4 didn't reach this comment.
- **[Low] UI copy still references Direct Offer** — `src/app/checkout/[assetId]/page.tsx:30,84,119,166`. Surfaced in customer-facing strings.
- **[Low] `src/lib/entitlement/__tests__/services.test.ts:6` mentions "direct-offer tests"**. Test docstring.

### K. Dead / speculative surface

- **[Medium] `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is declared in `envSchema` but not used anywhere in `src/`** — `src/lib/env.ts:100,156,194`. Zero `process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` or `env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` reads outside `env.ts` itself. Dead config surface — remove until needed.
- **[Medium] `src/data/assets.ts` (8300 LOC) and `src/data/social.ts` (988 LOC) and `src/data/users.ts` (821 LOC)** are seed fixtures shipped via import to domain code (see B-5 / D-2). Not dead, but not separate from the runtime code path.
- **[Medium] `src/app/api/upload/route.ts` is gated on `FFF_REAL_UPLOAD=false` by default** — the 503 branch at line 41. The route file is 214 LOC + tests. Dormant code paths are fine for a staged cutover; the concern is that the same "dormant-behind-flag" pattern is used for `/api/v2/batch/*` (also gated on `FFF_REAL_UPLOAD`) — so the flag quietly controls *three* routes and the `v2-state.ts` client simulation diverges from it. Remediation: single `uploadPipeline` flag namespace with a declared cutover plan.
- **[Low] `src/lib/upload/v2-mock-scenarios.ts` (947 LOC) and `v2-simulation-engine.ts` (485 LOC)** are client-side simulation scaffolding. Real in-test, but also shipped to the `DevHarness.tsx` at `src/components/upload-v2/DevHarness.tsx` (777 LOC). If this isn't production UX, exclude from the prod bundle via dynamic-import + dev-only flag.

### L. Dependency hygiene

- **[High] `shadcn ^4.1.2` is a runtime `dependency`** — `package.json:28`. The `shadcn` npm package is a **CLI scaffolding tool** (it pulls in `@babel/core`, `@babel/parser`, `@modelcontextprotocol/sdk`, `msw`, `ts-morph`, `execa`, `ora`, `fast-glob`, `open`, `prompts`, `recast`, `cosmiconfig`, `deepmerge`, `diff`, `stringify-object`, `validate-npm-package-name` — see resolved transitive set in `bun.lock`). It belongs in `devDependencies`, or better, nowhere (invoke via `bunx shadcn`). As a runtime dep it roughly doubles the production `node_modules` surface, pulls in an MSW server for HTTP mocking, and could ship Babel into the edge runtime. Remediation: move to `devDependencies` or delete entirely and use `bunx shadcn@latest`.

- **[Medium] `sharp` is imported in three source files but not listed in `dependencies`** — `src/lib/processing/resize.ts:13`, `src/lib/processing/watermark-compositor.ts`, `src/lib/upload/commit-service.ts`. It resolves through `next@16.2.2`'s `optionalDependencies` (see `bun.lock`). Relying on transitive resolution for a critical image-processing library that the app imports directly is a footgun: `next`'s range could drop sharp, or a different bundler could fail to hoist it. Remediation: add `sharp` to `dependencies` explicitly, matching the version next declares.

- **[Medium] `lucide-react ^1.7.0` — non-mainstream version line** — `package.json:20`. The mainstream lucide-react ships at ~0.400.x+. `lucide-react@1.7.0` does exist and does resolve, but the maintainer lineage / release cadence between the 0.x line and the 1.x line is worth confirming. Remediation: verify with the DRI that 1.7.0 is the intended install, not a typo for `^0.470.0`.

- **[Low] `@base-ui/react ^1.3.0` is a new-ish primitive library** — unusually large surface (shared with `shadcn`'s drift). Fine; just flag that Base UI and shadcn-generated components may pull conflicting ARIA patterns for composite widgets.

## Synthesis

Seven systemic themes cover the findings.

1. **Auth is aspirational.** Cluster A + B + F share one cause: the team specified RLS + authenticated roles + audit logging as the endgame, but shipped the prototype on service-role everywhere with client-supplied identity. Every other finding in categories A/B/F is downstream of this single decision. For an editorial platform whose value prop is trust, this cannot remain a deferred item. **Blast radius: total. Once Supabase env is set in any non-throwaway environment, this is a multi-user data leak.**

2. **Pattern-by-declaration, not pattern-by-enforcement.** `api/validation.ts` says "every route should use parseBody" — 3 of 33 do. `env.ts` says "do not read process.env elsewhere" — 4 modules do. `api-helpers.ts` says "we don't leak err.message" — three of four helpers do. Dual-mode says "flip a flag" — 3 of 8 stores are genuinely flippable. The team writes excellent canonical documents and then adopts them in the module that introduced the pattern, leaving the remainder as TODO. **Blast radius: cross-cutting. Systematic pattern adoption is the biggest quality-leverage point.**

3. **Two-mock-systems drift.** `src/data/*` (14.4k LOC) and `src/lib/mock-data.ts` (1523 LOC) duplicate the same shapes with different enum casing and partial overlap. `AssetFormat` has three declarations. Production routes import from both systems. The accidental consequence is that dev/test flows a different asset-shape through the code than prod will. **Blast radius: type drift → runtime filters that break silently in prod.**

4. **Editorial surface is client-rendered.** 44 of 47 pages are `'use client'`, including all article/story/creator/collection detail pages. Journalists and buyers land on a client-side React tree that fetches from seed imports. OG previews, link sharing, crawler behaviour, trust signals — all degraded. **Blast radius: SEO, social shares, time-to-first-content. Directly hurts editorial reach.**

5. **In-memory domain stores shipped as "ready".** Assignments, offers, post-drafts, client-side upload state all live in module-level `Map`s. Assignment is the highest-value transaction in the spec; it has no persistence at all. The business-logic tests pass because they run against the in-memory layer — which is also what production will run. **Blast radius: first restart / first scale-out wipes every transaction in flight.**

6. **Webhook ingest bifurcation.** Two Stripe webhook endpoints exist: the guarded canonical one under `/api/providers/webhooks/[provider]` with signature verification, and the older `/api/assignment/webhook/stripe` without. The latter mutates escrow. The canonical provider route was built to replace it but the old route was not removed. **Blast radius: cash path exposed to unauthenticated POST.**

7. **Test suite is reducer-biased.** 1080 passing tests concentrate in `assignment/__tests__` (~4.7k LOC of reducer/service/guards tests) and `special-offer/__tests__`. The HTTP boundary, the auth gate, the RLS integration, the dual-mode flip, the real-Supabase round-trip are all undertested. The confidence signal from the green test count is specifically weakest on the layers where bugs become incidents. **Blast radius: test-suite cost does not translate into deployment confidence.**

## Verdict

### Per subsystem

- `src/lib/auth` — **revise** — Dual-mode auth provider is shaped cleanly, but it is a provider seam, not an actual auth system. No session resolution exists in the request pipeline.
- `src/lib/post` — **approve with corrections** — Reducer, validation, hydrate, styles are solid; `draft-store.tsx` and `hydrate.ts` hard-couple to seed imports; store has real dual-mode but hydrate does not. Fix category B-5 and J.
- `src/lib/special-offer` (and residual direct-offer) — **revise** — Domain logic is first-rate (`services.ts`, `guards.ts`, `reducer.ts` all well-covered). Store has no DB path (B-1), route reads from mock-data not DB (B-3), file docstrings still say "Direct Offer Engine" (J-2). Half the subsystem needs rebuilding to be production-shaped.
- `src/lib/media` / `asset-media-repo` — **approve with corrections** — Delivery-policy is clean; asset-media-repo has real dual-mode; the media route properly separates preview/original; but the route trusts `x-frontfiles-user-id` (A-2) and does `readFile` off `public/` directly (TODO at route:290).
- `src/lib/processing` (watermark pipeline) — **approve** — Pure, typed, composable, sharp-based. Tests cover profiles, pipeline, geometry, policy. Missing: storage-adapter tests against Supabase Storage path. Solid for its phase.
- `src/lib/env` + config layer — **approve with corrections** — Schema-based fail-fast with server/client split is a best-in-class pattern. Enforcement has holes (I-3 / I-4); rate-limit and Sentry env reads bypass the schema. Dead `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` (K-1). One lint rule + 10 lines fixes most of it.
- `src/app/api/*` (route handlers as a group) — **rebuild** — Auth pattern is unsound (A), validation pattern is ~10 % adopted (C), error-shape is inconsistent (E), 3/33 have integration tests (H-1), the Stripe webhook is unsigned (A-4). The shape of the route layer is a prototype that cannot be incrementally hardened — it needs a uniform `withAuthenticatedRoute(schema, handler)` wrapper.
- `src/app/*` (page routes as a group) — **revise** — 44/47 client-only is an editorial anti-pattern (G-1). Per-page split into server+client shells is mechanical but large in surface.
- `src/components/*` — **approve with corrections** — Large, mostly presentational. Several 600-1000 LOC components (`NewAssignmentWizard`, `IdentityDrawer`, `DiscoveryMap`, `BoltPanel`, `DocumentsPanel`) should be decomposed but are not structurally broken.
- `supabase/migrations` (DB layer) — **approve with corrections** — 41 migrations, thorough RLS pass in `20260420000000_rls_all_tables.sql`, clean identity model, column-level grants on PII, deny-all-with-comment on undecided tables. The runtime does not exercise it (A-1), P5 is paused, and the RLS policies name tables about to be renamed (F-1). DB craft itself is strong.
- Test suite — **revise** — Unit coverage of reducers is excellent. HTTP / integration / authenticated-role RLS coverage is near zero. Green bar overstates confidence.

### Overall

**Revise.** The domain-logic work is publishable-quality; the platform it sits on is a prototype that looks production-shaped. Everything that matters for a journalist trusting the platform — "who is the caller", "can they read my draft", "will my offer persist past a deploy", "did that webhook really come from Stripe" — fails a red-team pass. The fix for each theme is well-scoped and mechanical; the risk is accepting the current state as "ready to promote" because the test suite is green and the module docstrings speak in the present tense.

## Execution plan

Ordered by leverage. Size estimates are rough (S = 1-2 days, M = 3-7 days, L = 2-4 weeks).

1. **[M] Delete `/api/assignment/webhook/stripe`** (A-4). Route everything through `/api/providers/webhooks/[provider]` which already verifies signatures. Immediate — before any auth work — because this one endpoint is a cash-out vector that an attacker can reach today.

2. **[L] Introduce real session resolution**. One `getSessionUser(request)` helper that reads a signed Supabase Auth JWT cookie. Replace every `body.buyerId`/`body.actorId`/`body.requesterId`/`x-frontfiles-user-id` read with it. Ban the body/header pattern with a lint rule. Closes A-1 / A-2 / A-3 / A-5 and makes RLS actually enforceable. (Themes 1, 6.)

3. **[M] Split `getSupabaseClient` into `getServiceClient()` and `getUserClient(jwt)`**. Migrate the 15 service-role callers — most are operator/webhook paths that stay on service-role; the UI-driven reads (post feed, entitlement probe, package list, media delivery, providers connections) move to the authenticated client. Audit that RLS now matters at runtime. (Theme 1.)

4. **[M] Adopt `parseBody` / `parseQuery` / `parseParams` across every mutation route**. Write one shared `withMutationRoute({ schema, requireActor })` helper; migrate the 14 routes currently using raw `await req.json()`. Ship a CI guard that fails on `await request.json()` outside `src/lib/api/validation.ts`. (Theme 2.)

5. **[M] Wire `special-offer/store.ts` and `assignment/store.ts` to Supabase with the dual-mode pattern**. Ship the mock/real branches, integration-test the real branch, back the offer route with `vault_assets` reads. P5 can resume in parallel. (Theme 5, plus unblocks B-1 / B-2 / B-3.)

6. **[S] Consolidate `src/lib/mock-data.ts` into `src/data/_seed/`**. Canonicalise one `AssetFormat`, delete the other two. Forbid production-module imports from the seed tree via lint. (Theme 3.)

7. **[M] Split client-rendered editorial pages into server + client shells**. Start with `/article/[id]`, `/story/[id]`, `/creator/[handle]`, `/post/[id]` — the ones search engines will index. `'use client'` only the interactive sub-trees. (Theme 4.)

8. **[S] Consolidate `api-helpers.ts` into one module and stop leaking `err.message`**. Use the providers variant as canonical. Add integration tests for the 500 branch to confirm bodies carry `{ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }` and nothing else. (Theme 2, Finding E-1.)

9. **[M] Cover the HTTP boundary with integration tests**. A Vitest `describe.each` over the route registry asserting (a) unauthenticated 401, (b) wrong-actor 403, (c) malformed body 400, (d) happy path 2xx for each route. This is the single highest-leverage test investment. (Theme 7.)

10. **[S] Dependency hygiene**: move `shadcn` out of `dependencies` (L-1); declare `sharp` in `dependencies` (L-2); add `RATE_LIMIT_*` + Sentry DSN to `envSchema` (I-3 / I-4); delete `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` until used (K-1). (Themes 2, L.)
