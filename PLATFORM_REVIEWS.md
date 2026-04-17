# Frontfiles — Platform Area Reviews & Improvements

**Status:** v2 — decisions locked · **Date:** 2026-04-17 · **Owner:** João Nuno Martins
**Companion to:** [`INTEGRATION_READINESS.md`](./INTEGRATION_READINESS.md)

## Decision Locks (2026-04-17)

All 12 product-area decisions resolved. Body of document retains reasoning; the table below is authoritative for execution.

| # | Decision | LOCKED |
|---|---|---|
| D-U1 | `v2-state.ts` split | **4 files**: `state.ts` / `selectors.ts` / `simulation.ts` / `verification.ts` |
| D-U2 | Story clustering in v1 | **Ship real AI clustering in v1** — promotes pgvector (1.7) and Vertex AI wrapper (4.B) to hard launch gates |
| D-U6 | Upload/Composer boundary | **Composer starts AFTER asset commit** (no mid-upload drafts) |
| D-A1 | Signature collection | **In-platform electronic attestation** (no external e-sig vendor for v1) |
| D-A2 | Dispute SLA + staffing | **5-business-day initial review, 14-day resolution target, founder-reviewed**; escalate to external mediator if volume exceeds |
| D-A3 | Refund mechanism | **Per-dispute-type policy** — requires new deliverable: 5-type dispute taxonomy spec (fraud / quality / scope / delivery / rights-violation), each with its own outcome rule |
| D-S1 | Watermark profile scope | **Multiple profiles per creator, one active default**; per-asset override; versioned; backfill on version bump |
| D-S2 | Signed URL lifetime | **60s view / 5min download** (conservative) |
| D-F1 | FFF role | **Broadcast in v1, social in v2** — architectural boundaries must support both |
| D-F2 | Repost semantics | **Quote-repost only** (new post references original with commentary) |
| D-DO1 | Offer expiry authority | **Supabase `pg_cron` job** transitions expired offers |
| D-6.1 | Agent invocation | **Explicit summon only** (engineers @mention agent by name) |
| D-6.2 | Agent handoffs | **Forbidden without explicit orchestrator** (each agent stays in scope) |
| D-6.3 | Agent model assignment | **Context-agent + Blue-Protocol-agent = Opus**; **Onboarding + Upload + Discovery = Sonnet** |

### Scope implications triggered by these locks

- **D-U2 (real AI clustering in v1)** pushes the launch critical path. `pgvector`, `ai_analysis` cache, and the Vertex AI wrapper become HARD launch gates, not optional hardening.
- **D-A3 (per-dispute-type refund)** introduces a new deliverable: `ASSIGNMENT_DISPUTE_TAXONOMY.md` defining the 5 types with per-type policy. This must land before Phase 5.C goes live.
- **D-S1 (multiple watermark profiles per creator)** adds UX surface: profile manager page, default-selection UI, per-asset override in Upload. New items added to Area 3 work list.
- **D-F1 locked at "both"** means the architecture must support social v2 without rebuild. FFF schema choices made today must not prematurely optimise for broadcast-only.

---


## Purpose

Enumerate the product-area reviews and improvements that must land before the three integration switches (beta import, Google, Stripe) flip. This document focuses on *feature maturity and internal coherence* — in contrast to `INTEGRATION_READINESS.md`, which focuses on *plumbing* (auth, payments, observability, migration).

## Scope

**In scope (6 areas):**

1. Upload flow + UI
2. Assignment + UI
3. Storage, previews, watermark
4. FFF UI (Frontfiles Sharing)
5. Direct Offer (Special Offer)
6. Claude Code sub-agents for onboarding / upload / Blue Protocol / discovery / context

**Out of scope:** infrastructure, auth, payments, observability, legal pages, email (see `INTEGRATION_READINESS.md`).

## Cross-references

| Concern | Document |
|---|---|
| Vertex AI / Vision / Google Workspace integrations | `INTEGRATION_READINESS.md` Phase 4 |
| Stripe Connect, Checkout, Payouts | `INTEGRATION_READINESS.md` Phase 5 |
| Preview-system-specific import readiness | `src/lib/preview/BETA-MIGRATION-READINESS.md` (already exists) |
| Upload substrate commit program | `src/lib/upload/PR-1.1-PLAN.md`, `src/lib/processing/{ARCHITECTURE-BRIEF,IMPLEMENTATION-PLAN,PR-2-PLAN}.md` |
| Canonical state machines and economics | `PLATFORM_BUILD.md` |

## Key terminology note (repo-wide)

**Blue Protocol** is the visual + semantic apex of the asset validation ladder — the `fully_validated` tier rendered in Frontfiles blue (`#0000ff`). It is currently under-specified in the repo:

- Code enum (`src/data/assets.ts:10-15`): **5 states** — `fully_validated`, `provenance_pending`, `corroborated`, `under_review`, `disputed`.
- `PLATFORM_BUILD.md` line 72 (per canonical Spec S7.4-7.5): **7 states** — adds `manifest_invalid`, `invalidated`.
- `PLATFORM_BUILD.md` authority chain (line 5): Rebuild Charter > Strategy Master > Architecture Doc > Canonical Spec > Backlog > Mockup Brief > Design Canon — **Canonical Spec lives upstream, not in git**.

Action: Area 6.C below produces a Claude Code agent specifically for Blue Protocol; its first responsibility is to close this drift.

---

## Area 1 — Upload flow + UI

### Current-state read

- Page: `/vault/upload/page.tsx` (host shell)
- 16 components in `src/components/upload-v2/`: `AddFilesScreen`, `AnalysisScreen`, `AssetDetailPanel`, `AssetTable`, `CommitScreen`, `DevHarness`, `ExpressCard`, `PublishBar`, `ReviewAssignScreen`, `ReviewHeaderBar`, `StoryGroupsPanel`, `StoryProposalsBanner`, `UploadShellV2`, `UploadV2Context`
- State engine: `src/lib/upload/v2-state.ts` (3,000+ lines), `v2-hydration.ts`, `v2-simulation-engine.ts`, `v2-types.ts`, `v2-verification.ts`
- Commit path: `src/app/api/upload/route.ts` (dormant behind `FFF_REAL_UPLOAD`), `src/lib/upload/commit-service.ts`, `upload-store.ts`, `server-validation.ts`
- Price engine: `src/lib/upload/price-engine.ts`
- Active substrate program: PR 1.1 landed, PR 1.2 open (PR #4), PR 1.3 pending, PRs 2–6 roadmap defined in `src/lib/processing/IMPLEMENTATION-PLAN.md`

### Known debt

| # | Issue |
|---|---|
| 1 | `CommitScreen.tsx`, `StoryGroupsPanel.tsx`, `v2-state.ts` had 5 `PrivacyState \| null` TS errors (fixed 2026-04-17 via `visibility.ts` widen) |
| 2 | `v2-state.ts` is 2,000+ lines — a single monolith for state, derived selectors, simulation. Splitting pending |
| 3 | Mock-vs-real toggle lives in `FFF_REAL_UPLOAD` env flag only; no runtime feature-flag granularity |
| 4 | Client calls `/api/upload` via the old contract; PR 1.3 will switch to batch-aware header `X-Batch-Id` + widened `CommitUploadRequest` — not yet shipped |
| 5 | No end-to-end test for the Upload → Commit → Licence path; vitest coverage is unit-level only |
| 6 | Error recovery: UI doesn't distinguish idempotency-replay from real failure; user may get stuck on commit-retry |
| 7 | `StoryProposalsBanner` + `StoryGroupsPanel` mock story suggestions today — no real story-clustering logic wired |
| 8 | Composer <-> Upload handoff is not canonical (drafts created mid-upload vs. after commit) |

### Scope of review

- State-machine audit: every legal transition, every illegal-but-possible input, every terminal state's next-step wiring.
- UI audit: every screen against the Design Canon (`PLATFORM_BUILD.md`), accessibility, mobile breakpoints.
- Commit path audit: dual-mode coverage, idempotency correctness, failure classes, signed-URL handoff post-commit.
- Story clustering: decide if v1 wires Gemini (per `INTEGRATION_READINESS.md` Phase 4.B) or remains mock.

### Improvement items

| Item | Cat | Size | Notes |
|---|---|---|---|
| U.1 Split `v2-state.ts` into `state.ts` / `selectors.ts` / `simulation.ts` / `verification.ts` | FIX | M | Reduces cognitive load; aids Claude Code agent work |
| U.2 Error-taxonomy audit: every `throw` and `catch` in upload path labelled with a stable error code | HARDEN | S | Feeds the upload-agent guardrails |
| U.3 E2E test: upload 5 assets → review → commit → verify licence path can mint | ADD | M | Playwright or similar |
| U.4 Real story clustering via Vertex AI embeddings (depends on `INTEGRATION_READINESS.md` 1.7, 4.B) | ADD | M | Replaces `StoryProposalsBanner` mock |
| U.5 Idempotency UX: distinguish replay-success from retry-prompted-by-failure on `CommitScreen` | FIX | S | Prevents stuck-commit perception |
| U.6 Composer/Upload handoff canonicalisation — spec the boundary | DECIDE | S | Avoids future data-origin ambiguity |
| U.7 PR 1.3 landing (batch-aware `/api/upload`) | FIX | M | Already in-flight — close out |

### Decisions pending

- D-U1: Split strategy for `v2-state.ts` — 4 files vs. 7 vs. directory-of-small-files. I default to 4.
- D-U2: Story clustering — ship in v1 (AI-powered) or defer post-launch (keep mock until then)?

---

## Area 2 — Assignment + UI

### Current-state read

- Pages: `/assignment/` (list), `/assignment/[id]`, `/assignment/[id]/activate`, `/assignment/[id]/fund`, `/assignment/disputes`, `/assignment/new`
- 17 components in `src/components/assignment/`: `AssignmentOverview`, `AssignmentProvider`, `AssignmentShell`, `CCRComposer`, `CCRPanel`, `DisputePanel`, `DocumentsPanel`, `FulfilmentComposer`, `MilestoneList`, `NewAssignmentWizard`, `ProvisionalReleasePanel`, `ReviewConsole`, `RightsPanel`, `StaffDisputeConsole`, `StaffDisputeQueue`, `TimelinePanel`, `shared`
- Engine: `src/lib/assignment/` — `reducer`, `services`, `closing`, `guards`, `events`, `selectors`, `jobs`, `mock-data`, `closing-reducer`, `closing-types`, `context`, `errors`, `api-helpers`
- API: `/api/assignment/route.ts`, `/api/assignment/[id]/{accept,cancel,ccr,dispute,fulfil,review,review-open}`, `/api/assignment/webhook/stripe`
- Schema: migrations `20260408230001..04` (enums, tables, indexes, events)
- State machine (per `PLATFORM_BUILD.md`): 7 states — `brief_issued`, `escrow_captured`, `in_progress`, `delivered`, `confirmed`, `disputed`, `cancelled`
- `src/lib/assignment/closing.ts` has 3 production TODOs (document status, signature counts, authorisation derivation)

### Known debt

| # | Issue |
|---|---|
| 1 | Stripe webhook at `/api/assignment/webhook/stripe` likely handles escrow capture today in mock mode only — needs real live-key wiring |
| 2 | Closing pipeline (`closing.ts`) has 3 explicit production TODOs that block real dispute resolution |
| 3 | Rights panel + Documents panel consume mock data — no production derivation |
| 4 | Staff dispute console / queue exists but isn't connected to real staff-role gating |
| 5 | CCR (Change/Cancel Request) composer flow not validated against Spec S13 dispute states |
| 6 | Fulfilment composer + Provisional release panel have no real storage/signed-URL paths for delivered artifacts |
| 7 | No audit log of state transitions visible to creator/buyer/staff |
| 8 | No email notifications on state transitions (invite / fund / deliver / dispute / close) |

### Scope of review

- State-machine audit: 7 canonical states × every action × every role, illegal-transition guardrails.
- Dispute resolution flow (filed → under_review → upheld | not_upheld | escalated_external), including Spec S13 mapping.
- Creator-side vs buyer-side vs staff-side UX parity and differentiation.
- Escrow + release path vs Stripe Connect (depends on `INTEGRATION_READINESS.md` Phase 5).
- Document generation + signature collection pipeline (the 3 closing TODOs).

### Improvement items

| Item | Cat | Size | Notes |
|---|---|---|---|
| A.1 Close 3 production TODOs in `closing.ts` (documents, signatures, auth derivation) | FIX | M | Unblocks real dispute closure |
| A.2 Wire real Stripe Connect escrow on `/api/assignment/webhook/stripe` | FIX | M | Depends on Phase 5.B/5.C |
| A.3 Email notifications on all state transitions via Resend (Phase 3) | ADD | M | 7 states × 3 roles = 21 templates; dedupe where possible |
| A.4 Audit log table + UI for assignment state transitions (visible per-role) | ADD | M | Trust + compliance |
| A.5 Real document generation: brief PDF, deliverable manifest, licence + payout receipts | ADD | M | Blocks closing-TODO-1 |
| A.6 Signature collection via DocuSign/Dropbox Sign or similar (or Stripe-collected attestation) | DECIDE | — | Blocks closing-TODO-2 |
| A.7 Staff-role gating (RLS + server guard) on dispute console | HARDEN | S | Prevents leak of staff tools |
| A.8 CCR flow spec alignment + test matrix | FIX | S | Guard against divergence from Spec S13 |
| A.9 Fulfilment artifact delivery via signed URLs (depends on storage 3.X below) | FIX | M | Replaces mock paths |
| A.10 E2E test: full assignment lifecycle (invite → fund → deliver → confirm → payout) and (invite → fund → dispute → upheld → refund) | ADD | L | Playwright; critical for Stripe confidence |

### Decisions pending

- D-A1: Signature collection — external (DocuSign/Dropbox Sign) or Stripe-collected attestation or in-platform electronic sign?
- D-A2: Dispute resolution SLAs + staff capacity model — who reviews, under what policy, within what timeframe?
- D-A3: Refund mechanism on upheld disputes — full reverse, partial, platform-absorbed fee?

---

## Area 3 — Storage, Previews, Watermark

### Current-state read

- Storage: `src/lib/storage/` — `fs-adapter.ts`, `supabase-adapter.ts`, `paths.ts`, `index.ts`, `types.ts`
- Processing: `src/lib/processing/` — `pipeline.ts`, `dispatcher.ts`, `profiles.ts`, `resize.ts`, `watermark-compositor.ts`, `types.ts`, plus 3 governance docs (`ARCHITECTURE-BRIEF.md`, `IMPLEMENTATION-PLAN.md`, `PR-2-PLAN.md`)
- Preview layer: `src/lib/preview/` — already has `BETA-MIGRATION-READINESS.md`
- Dev harnesses: `/dev/watermark-approval`, `/dev/watermark-harness`
- Delivery: `/api/media/[id]/route.ts`
- Middleware: `src/middleware.ts` blocks direct `/assets/` access (avatars excepted) and forces delivery through the API
- Schema: watermark profile migrations `20260417100001..03`

### Known debt

| # | Issue |
|---|---|
| 1 | `pipeline.ts`'s `MediaRowAdapter.updateMediaRow` status union was missing `'pending'` (fixed 2026-04-17 to match ARCHITECTURE-BRIEF state machine) |
| 2 | `profiles.ts` line 149: "MOCK: returns seed profile (always draft — for dev/testing only)" — no real profile store |
| 3 | No signed-URL enforcement path end-to-end — middleware blocks but `/api/media/[id]` entitlement check is partial |
| 4 | Supabase storage adapter exists but isn't exercised in prod (FFF_STORAGE_DRIVER defaults to fs) |
| 5 | Watermark profiles are seed-only; no creator-level persistence |
| 6 | Preview system is structured (per `BETA-MIGRATION-READINESS.md`) but `previewSource` and `previewKind` resolvers might still have holder fallbacks for formats not yet covered (audio/text) |
| 7 | No backfill job for re-processing derivatives when watermark profile version changes |
| 8 | Dev harnesses (`/dev/watermark-*`) may leak into prod build unless gated |

### Scope of review

- Storage adapter selection policy (fs vs supabase) per-environment explicit documentation.
- Entitlement gating end-to-end: request → RLS → `/api/media/[id]` → signed URL → delivery.
- Watermark profile lifecycle: create, version, approve, retire, apply, backfill.
- Preview derivation for every entity × every format × every missing-data case.
- Processing pipeline backpressure + retry behaviour under failure.
- Dev-only routes audit (ensure `/dev/*` doesn't ship to prod).

### Improvement items

| Item | Cat | Size | Notes |
|---|---|---|---|
| S.1 Promote `profiles.ts` from mock to real (read/write Supabase `watermark_profiles`) | FIX | M | Blocks real watermarks |
| S.2 `/api/media/[id]` entitlement check end-to-end: licence → row → signed URL → time-limited delivery | HARDEN | M | Blocks paid-content protection |
| S.3 Prod flip of `FFF_STORAGE_DRIVER` to `supabase` + Storage bucket + RLS policies | FIX | M | Phase 1 dependency |
| S.4 Creator-level watermark profile management UI (`/vault/*/watermark-profiles`) | ADD | M | Self-service branding |
| S.5 Backfill job: re-process derivatives when watermark profile version changes | ADD | M | Keeps derivatives current |
| S.6 Preview resolver coverage matrix (5 entity types × 7 formats × data-present/absent) | HARDEN | S | Plug all holder-fallback gaps |
| S.7 Pipeline backpressure: bounded concurrency, retry-with-backoff, dead-letter to audit log | HARDEN | M | Resilience under load |
| S.8 Dev-route gating: `/dev/*` returns 404 unless `NODE_ENV !== 'production'` or staff-role | HARDEN | S | Closes production leakage |
| S.9 Asset integrity: hash-of-original stored at commit + verified on delivery | ADD | S | Tamper-evidence primitive |

### Decisions pending

- D-S1: Creator-level watermark profiles — one per creator? Multiple per creator? Per-collection?
- D-S2: Signed URL lifetime — 60s for view, 5min for download? Per-licence bespoke?

---

## Area 4 — FFF UI (Frontfiles Sharing)

### Current-state read

- Flag: `NEXT_PUBLIC_FFF_SHARING_ENABLED` (`.env.local` has it set to `true`)
- Pages: `/feed`, `/post/[id]`, `/creator/[handle]/posts`
- API: `/api/posts/{list,feed,[id],[id]/reposts}/route.ts`
- Composer: `src/components/composer-share/GlobalShareComposer.tsx`, `ShareComposer.tsx`
- Data layer: `src/lib/post/store.ts` (mock vs Supabase swap)
- Profile surface integration: `src/components/platform/{FrontfolioContent,ProfileContent}.tsx`
- Schema: post migrations `20260416000001..03`

### Known debt

| # | Issue |
|---|---|
| 1 | FFF is **on by default** in `.env.local` — risk of shipping half-finished feature to real users |
| 2 | `post/store.ts` has mock-mode fallback (line 409) — Supabase path exists but not fully exercised |
| 3 | Feed personalisation is naïve — no ranking, no vector search, no AI |
| 4 | Repost mechanics have a dedicated route but semantics not specified (quote vs share vs re-publish?) |
| 5 | `GlobalShareComposer` overlaps in purpose with upload commit — two ways to surface content publicly |
| 6 | Moderation story is absent — no report, no block, no staff review |
| 7 | No distinction in UI between Frontfiler-to-Frontfiler posts vs. public feed |

### Scope of review

- Feature-flag gating discipline (runtime vs build-time, per-user rollout).
- FFF vs Vault vs Frontfolio vs Article — entity-boundary clarity. Does a "post" ever leak into marketplace surfaces?
- Moderation + reporting pipeline.
- Feed ranking + discovery — mock or AI?
- Composer boundary — when is it used vs. Upload + Composer flow?

### Improvement items

| Item | Cat | Size | Notes |
|---|---|---|---|
| F.1 Runtime feature flag (PostHog) replacing env-only gate; enable per-creator-cohort | FIX | S | Safer rollout |
| F.2 Entity boundary doc: FFF post vs. Vault asset vs. Article — canonical relationships, allowed conversions | DECIDE | S | Prevents category drift |
| F.3 Repost semantics spec (quote / share / cross-post / republish) + UI affordances | DECIDE | S | Product decision |
| F.4 Moderation primitives: report, block, staff queue, auto-flag for spam/abuse | ADD | M | Pre-launch gate |
| F.5 Feed ranking v1: chronological + follow-graph, with Vertex AI embeddings as v2 | ADD | M | Depends on Phase 1.7 pgvector + 4.B AI |
| F.6 Public-vs-private feed distinction in UI (Frontfiler circle vs. public) | ADD | S | Product clarity |
| F.7 Flip FFF_SHARING to false by default in prod until F.4 ships | HARDEN | S | Safety |

### Decisions pending

- D-F1: FFF positioning — is it a social layer, a creator channel, or both?
- D-F2: Repost = quote-tweet equivalent OR full-republish OR both?

---

## Area 5 — Direct Offer (Special Offer)

### Current-state read

- Pages: `/vault/offers/page.tsx`
- API: `/api/direct-offer/route.ts`, `/api/direct-offer/[id]/{accept,counter,decline}/route.ts`
- Engine: `src/lib/direct-offer/` — `reducer`, `services`, `store`, `guards`, `types`, `api-helpers`
- Schema: migrations `20260408230005..07`
- Governance: `DIRECT_OFFER_SPEC.md` at repo root (27KB — substantial canonical spec)
- State machine: 6 states (per `PLATFORM_BUILD.md`) — `pending`, `countered`, `accepted`, `rejected`, `expired`, `cancelled`; 3-round max per spec

### Known debt

| # | Issue |
|---|---|
| 1 | `/vault/offers/page.tsx` line 22: "MOCK DATA — with negotiation messages" |
| 2 | Accept path needs to mint a licence grant + payment hand-off to Stripe (depends on Phase 5.B) |
| 3 | Counter-offer UX doesn't enforce the 3-round cap visibly |
| 4 | Expiry enforcement — is it DB-timed, cron-timed, or check-on-read? Not clear |
| 5 | No email notifications on offer events (made, countered, accepted, rejected, expired) |
| 6 | No audit log of offer rounds visible to both parties |
| 7 | `DIRECT_OFFER_SPEC.md` may itself need review against current code (haven't diffed) |

### Scope of review

- Diff `DIRECT_OFFER_SPEC.md` against current `src/lib/direct-offer/` and `/api/direct-offer/*` implementation. Identify drift.
- Accept path → Stripe payment → licence grant → delivery.
- 3-round cap enforcement (UI + API + DB guard).
- Offer expiry mechanism — pick one authoritative path.
- Notification cadence for each event.

### Improvement items

| Item | Cat | Size | Notes |
|---|---|---|---|
| DO.1 Diff `DIRECT_OFFER_SPEC.md` vs. implementation; produce drift report | FIX | S | Align truth |
| DO.2 Replace mock data in `/vault/offers/page.tsx` with real store reads | FIX | S | |
| DO.3 Accept → Payment Intent → licence grant flow (depends on Phase 5.B) | FIX | M | |
| DO.4 3-round cap enforcement at API + DB check constraint | HARDEN | S | Defensive |
| DO.5 Expiry job (cron or Supabase pg_cron) that transitions expired offers | ADD | S | Deterministic expiry |
| DO.6 Email templates: offer made / countered / accepted / rejected / expired | ADD | S | Part of Phase 3 template set |
| DO.7 Audit log per offer round visible in `/vault/offers/[id]` | ADD | S | Trust |

### Decisions pending

- D-DO1: Expiry authority — DB-level timestamp with read-time check, or cron job that actually transitions state? I default to cron for determinism.

---

## Area 6 — Claude Code Sub-Agents for 5 Domains

**Purpose:** Specialised Claude Code sub-agents (`.claude/agents/*.md`) that know the state machines, rules, and guardrails of one domain each, so future sessions produce consistent, spec-compliant work without you re-briefing every time.

**Format:** each agent is a single `.claude/agents/<name>.md` file with YAML frontmatter (name, description, model) and a body containing: domain ownership, authoritative specs, guardrails, tool-use restrictions, canonical terminology, red-team checklist.

### 6.A — `frontfiles-onboarding-agent`

**Scope:** 3-phase creator onboarding (Verify → Build → Launch), `/onboarding/page.tsx`, `src/components/onboarding/**`, `src/lib/onboarding/**`, `useOnboardingCompletion.ts`.

**Must know:**

- The 3 phases and what "activated" means (not just field-completeness)
- Reserved username rules, username pattern
- Identity tables + FK backfill from migrations `20260408230008..11`
- Trust Badge states (verified / trusted) per Spec S7.9-7.11
- Mock-mode defaults for the `confirmed` flag per `types.ts`

**Guardrails:**

- Never mark a user "activated" based on field-completeness alone
- Preserve the creator-vs-buyer classification boundary
- Never skip phase validation
- Defer to `INTEGRATION_READINESS.md` Phase 4.A for Google auth wiring

**Size to ship:** S (agent spec file, ~150 lines)

### 6.B — `frontfiles-upload-agent`

**Scope:** Upload v2 flow end-to-end — screens, state machine, commit path, storage, processing dispatch.

**Must know:**

- `src/lib/upload/v2-state.ts` state machine (every transition)
- The PR 1.1 → 1.2 → 1.3 → 2 → 3 → 4 → 5 → 6 sequence in `IMPLEMENTATION-PLAN.md`
- The state machine `pending → processing → ready | failed` in `ARCHITECTURE-BRIEF.md`
- `FFF_REAL_UPLOAD`, `FFF_STORAGE_DRIVER` flags and their semantics
- Idempotency contract of `/api/upload`
- `CanonicalPreview` derivation rules from `preview/BETA-MIGRATION-READINESS.md`

**Guardrails:**

- Never touch `v2-*` files or upload-v2 components outside the scope of the current PR
- Never modify `/api/v2/batch` routes unless the PR explicitly covers batch routes
- Never "improve" beyond spec
- `jsonb` wire keys are snake_case (hard rule from PR 1.1 plan)

**Size to ship:** S–M (agent spec file with scope-locking guardrails)

### 6.C — `frontfiles-blue-protocol-agent`

**Scope:** Validation ladder, `ValidationDeclaration` enum, ValidationBadge, CEL (Certification Event Log), Trust Badge, FCS (Frontfiles Certification System), Assembly Verification, provenance integrity.

**Must know:**

- The drift between code (5 states) and canonical spec (7 states, per `PLATFORM_BUILD.md`)
- `fully_validated` = Blue Protocol — the apex tier
- Trust Badge (verified/trusted) is distinct from ValidationDeclaration
- Terminology policy from `CLAUDE.md`: avoid "certified" as a casual claim; prefer `verifiable`, `tamper-evident`, `independently reviewable`, `provenance-aware`
- CEL lives in asset detail and vault drawer
- Middleware + `/api/media/[id]` enforce delivery boundary

**Guardrails:**

- **First responsibility:** close the 5-vs-7 state drift (align code with canonical spec or vice versa, with product decision)
- Never inflate validation language to be legally risky
- Never couple `fully_validated` to legal or commercial guarantees beyond what the canonical spec states
- Every validation transition must be logged to CEL

**Size to ship:** M (includes drift-resolution spec as first-deliverable)

### 6.D — `frontfiles-discovery-agent`

**Scope:** `/search`, `/feed`, Assistant input, query understanding, recommendations, Bolt cross-ref, cross-story discovery.

**Must know:**

- `src/hooks/useDiscoveryAgent.ts` (already scaffolded)
- `src/lib/bolt/` — cross-reference engine; `cross-ref.ts` now uses `geo.locationLabel` (fixed 2026-04-17)
- Vertex AI embeddings + pgvector as the future backbone (`INTEGRATION_READINESS.md` 1.7, 4.B)
- `ENTITY_FILTERS`, `FORMAT_FILTERS` from `AssistantInput.tsx`
- The /search `useSearchParams` prerender constraint (must stay inside Suspense or `force-dynamic`)

**Guardrails:**

- Query-understanding calls always go through the `ai_analysis` cache (no re-hits on identical queries)
- Never return assets the viewer lacks visibility for — enforce `isListablePrivacy` and RLS
- Never call Google AI from client-side — always server-side with service account
- Prefer deterministic filters (format, geography, date) before AI ranking

**Size to ship:** S (agent spec; actual implementation is its own phase)

### 6.E — `frontfiles-context-agent`

**Scope:** Platform-wide context, cross-cutting conventions, terminology enforcement, design-canon adherence, state-machine discipline.

**Must know:**

- Full authority chain: Rebuild Charter > Strategy Master > Architecture Doc > Canonical Spec > Backlog > Mockup Brief > Design Canon
- All 12 canonical state machines (per `PLATFORM_BUILD.md` lines 68-82)
- Transaction economics: Direct 80/20, Plugin 90/10, Commissioned 10% markup, Bulk 0%
- Exclusive licence multipliers: 30-day 3×, 1-year 5×, perpetual 10×
- Design Canon: 3 colors (black, Frontfiles blue, white); 0 radius; NHG font; 10px bold uppercase tracking-widest slate-400 labels
- Terminology rules from `CLAUDE.md`

**Guardrails:**

- Any PR touching state machines must cite the Spec section it conforms to
- Any new enum or state added must be reflected in `PLATFORM_BUILD.md` AND `types.ts` AND the migration, never just one
- Terminology drift is blocked — `certified` / `certification` / `verified-without-basis` trigger red flag

**Size to ship:** S (agent is a meta-agent, used by the other 4)

### Agent sequence of ship

The sequence matters — context-agent first, then the 4 domain agents can parallelise.

```
6.E context-agent  ──┬──► 6.A onboarding-agent
                     ├──► 6.B upload-agent
                     ├──► 6.C blue-protocol-agent  (closes drift as first task)
                     └──► 6.D discovery-agent
```

### Decisions pending

- D-6.1: Agent invocation model — always-loaded vs. explicit-summon (`@frontfiles-blue-protocol-agent`)?
- D-6.2: Agent-to-agent handoffs — allowed or forbidden? (I default to: forbidden without explicit orchestrator.)
- D-6.3: Claude Code agent model per agent (Opus for architecture-heavy, Sonnet for code, Haiku for mechanical) — pick per agent.

---

## Execution sequence across the 6 areas

Priority depends on which integration switch you flip first. Default sequence:

```
[Area 6 — context + domain agents]  (enables everything below)
       │
       ▼
[Area 1 Upload] ── [Area 3 Storage/Preview/Watermark] ── gate for beta import + buyer checkout
       │                    │
       ▼                    ▼
[Area 2 Assignment] ──── [Area 5 Direct Offer] ────────── gate for Stripe confidence
       │
       ▼
[Area 4 FFF]   (optional — flip-able flag, can defer past launch)
```

**Rules:**

- Area 6 (agents) ships first because it governs quality of all other work.
- Areas 1 + 3 are the path-dependent pair — upload writes, storage delivers. Review them together.
- Areas 2 + 5 are Stripe-dependent — can't fully close until `INTEGRATION_READINESS.md` Phase 5 lands.
- Area 4 (FFF) is flag-gated and can defer if needed for launch.

## Sign-off gates

| Gate | Before this ships | Requires |
|---|---|---|
| G-R1 | Any Area 1–5 refactor | Area 6 context-agent + domain-agent written + approved |
| G-R2 | Blue Protocol-affecting code change | 6.C agent has resolved 5-vs-7 state drift with product approval |
| G-R3 | Real watermark profiles | S.1 + Area 6.B + storage Phase 1.3 done |
| G-R4 | Real assignment escrow | A.2 + `INTEGRATION_READINESS.md` Phase 5.B green |
| G-R5 | FFF enabled in prod | F.4 (moderation) + F.7 (default-off) shipped |
| G-R6 | Beta data touches these areas | All area decisions signed off |

## Assumptions flagged

- Canonical Spec (upstream, not in git) defines the 7-state validation ladder. Action item to bring it into the repo as `CANONICAL_SPEC.md` or similar, so Claude Code agents and future engineers have the single source of truth inside version control.
- Design Canon is fixed at 3 colors / 0 radius / NHG font; no deviation permitted without founder approval.
- FFF remains flag-gated until moderation primitives ship.
- Vertex AI Gemini + Vision are the AI backbone (locked in `INTEGRATION_READINESS.md` D6, D7, D9).

## What's NOT in this document (by design)

- Integration plumbing (Stripe, Google, Supabase env, RLS, email) — see `INTEGRATION_READINESS.md`.
- Mobile app strategy.
- Marketing / landing-page work.
- Product roadmap beyond the 6 areas.
- Commercial decisions (pricing tiers, creator agreements, revenue share) unless they already feature in the canonical spec.

## Next step (for author)

1. Confirm or revise the scope of each of the 6 areas (prune, expand, split).
2. Resolve the 12 decisions pending across the doc (`D-U*`, `D-A*`, `D-S*`, `D-F*`, `D-DO*`, `D-6.*`).
3. Approve Area 6 agent specs in principle so I can begin drafting the individual `.claude/agents/*.md` files.
4. Decide ordering priority across Areas 1–5 if the default sequence doesn't match your preference.

Once approved, convert both documents (`INTEGRATION_READINESS.md` + `PLATFORM_REVIEWS.md`) into tracked tasks via the Cowork task system, with owners and dates.

---

*End of document — v1 draft. All items sized roughly; real estimates require per-area kickoff.*
