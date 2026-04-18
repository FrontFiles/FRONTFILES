# Frontfiles — Pre-Integration Roadmap

**View:** Now / Next / Later · **Source of truth for detail:** `INTEGRATION_READINESS.md` v2 (2026-04-17) + `CLAUDE_CODE_PROMPT_SEQUENCE.md`
**Owner:** João Nuno Martins · **Last updated:** 2026-04-17 (post-CCP 4 closeout — Phase 1 Foundation complete, G2 passed)

> This document is the communication-altitude view of the pre-integration work. It is deliberately thin. For phase-item granularity, size, and rationale, read `INTEGRATION_READINESS.md`. Do not duplicate detail here.

---

## Status overview (post-lock)

| Signal | State |
|---|---|
| G1 — Architectural decisions D1–D12 | **Passed** (2026-04-17) |
| Phase 0 pre-flight (CCP 1) | **Closed** (2026-04-17) — P0.2 resolved via KD-1 micro-fix (commit `4681e92`); `bun run build` exit 0 across 81 routes. |
| CCP 2 — Supabase foundation + RLS | **GREEN on dev** — commit `c05928f` · migration `20260420000000` applied on Remote dev Supabase · Vercel preview/prod env wiring deferred as a parallel human task. Historical RLS 8/9 pass count needs re-measurement once KD-8 (bun test env loading) lands. |
| CCP 3 — pgvector + ai_analysis + audit_log + env-schema | **GREEN** (2026-04-17) — items 1.7–1.9 pre-landed in migration `20260419110000`; item 1.10 landed in `src/lib/env.ts` + consolidation pass across 9 source files. `tsc --noEmit` clean, `bun run build` exit 0 (81 routes — route-count correction from the stale 47 baseline), grep drops 19 → 5 documented-exception files. |
| CCP 4 — Flip mocks → real dual-mode (item 1.3) | **GREEN** (2026-04-17) — 3 commits (`a89c9a4`, `3468008`, `5755d02`). All 5 modules canonicalised (auth, post, providers, asset-media, watermark profiles). Modules 4–5 promoted sync→async with every call-site awaited. `tsc --noEmit` clean per module, `bun run build` exit 0 (81 routes). Closes the "mocks silently swallow writes" risk. |
| G2 — Phase 1 (Foundation) completion | **Passed** (2026-04-17) — CCP 1/2/3/4 + KD-1 done. Only parallel human task remaining is 1.1 (Vercel preview/prod env wiring), which blocks live deploy but not Phase 4/5 design work. |
| G3 — Legal pages + Google verification | Not started |
| G4 — Stripe Connect application approval | Not started |
| G5 — Waterdog audit + schema mapping signed | **Blocked** on Q1–Q7 |
| G6 — Full dry-run rehearsal on staging | Not started |

**One-line:** Architectural layer locked + Phase 0 truly closed + CCP 2/3/4 green + Phase 1 foundation **closed** (G2 passed). Build stays provably clean (`bun run build` exit 0 across 81 routes; the earlier "47 routes" figure was a stale baseline). Real-world switches (Phase 4 Google, Phase 5 Stripe) are now unblocked at the architecture gate; they still wait on G3 (legal + Google verification) and G4 (Stripe Connect approval). KD-8 is the recommended next micro-CCP to restore reliable test signal before Phase 2/3 lands. Commit `5e652df` shows Phase 3.1 (Resend) already partially done — ahead-of-sequence, acceptable.

---

## Critical path

```
Phase 0 (pre-flight, including PAT rotation)  ✓ closed
   │
   ▼
Phase 1 (Foundation)  ── G2  ✓ passed (2026-04-17)
   │
   ├─► Phase 2 (Observability)  ─┐
   ├─► Phase 3 (Email)            │
   ├─► Phase 4 (Google)  ── G3    ├─► Phase 6 (Beta migration) ── G6
   ├─► Phase 5 (Stripe) ── G4     │
   └─► Phase 7 (Hardening)       ─┘
```

The single longest dependency chain is: Phase 0 → Phase 1 → (Phase 4 ∥ Phase 5) → Phase 6. Phases 2/3/7 parallelise once Phase 1 clears — which it has.

---

## Now (active this window)

Commit-grade work, high-confidence scope and sequence.

| Item | Why it's Now | Ref |
|---|---|---|
| **KD-8 micro-CCP — `bun test` env loading** | Promoted to top of Now. CCP 4 landed without reliable test signal because `bun test` does not load `.env.local`; the `tsc --noEmit` + `bun run build` pair carried verification. Phase 2/3 work will be safer with tests restored first. Quick win (`bunfig.toml` preload). | INTEGRATION_READINESS §Known debt KD-8 |
| Waterdog repo audit — answer Q1–Q7 (H6) | Blocks Phase 6 from concretising. Cheap to start; parallel-safe. | INTEGRATION_READINESS §Open questions |
| Vercel env wiring (preview + prod scopes) | Parallel human task. Required before Phase 4/5 integration goes live, not before Phase 2/3 design work. Install `vercel` CLI or use dashboard. | INTEGRATION_READINESS §Phase 1 item 1.1 |
| KD-7 micro-CCP — `force-dynamic` → `connection()` on `/search` + `/checkout/[assetId]` | Low severity. Build is green with the Suspense fix; the `force-dynamic` directive is only soft-deprecated. Queue between CCPs when appetite exists. | INTEGRATION_READINESS §Known debt KD-7 |

**Concrete next action:** Paste KD-8 prompt to restore `bun test` env loading, then move into Phase 2 (Sentry + structured logging) or Phase 3 (Resend hardening, given `5e652df` already started it). G2 has passed; the order between Phase 2 and Phase 3 is a capacity call, not an architectural one.

---

## Next (1–3 months, planned, not yet started)

Committed once Phase 1 is green (G2). Good confidence on scope; less confidence on exact dates.

| Track | Scope | Gate |
|---|---|---|
| **Phase 2 — Observability** | Sentry, structured logging, env secret separation, uptime, Supabase log drain | None (parallel after Phase 1) |
| **Phase 3 — Email** | Resend integration, React Email templates, transactional/marketing separation, template set for auth + Stripe + assignment lifecycle, unsubscribe centre | None (parallel after Phase 1) |
| **Phase 4 — Google** | OAuth + Supabase Auth bridge; Vertex AI client + per-region routing; Vision API on upload commit; Workspace incremental scopes (Gmail/Drive/Calendar); Places autocomplete | G3 (legal pages + verification) |
| **Phase 5 — Stripe Connect** | Buyer checkout + licence grant flow, Connect Express onboarding, settlements, tax, ledger + reconciliation, risk | G4 (Connect application approved) |
| **Phase 7 — Hardening (continuous)** | Legal pages live, support channel, feature flags via PostHog, E2E tests for 5 critical flows, security review, performance budget | Starts once foundation is down, runs in parallel |

New scope items from today's decision locks (already listed in INTEGRATION_READINESS v2):

- `4.A.8` — Apple Sign In wiring via Supabase Auth (from D10)
- `4.B.5a` — Creator-residency field on `users` table before any Vertex AI call (from D8)

---

## Later (3–6+ months, directional)

| Track | Why it's Later |
|---|---|
| **Phase 6 — Beta migration (Waterdog → Frontfiles)** | Commitment point. All other phases must be production-ready first. Blocked on Q1–Q7 until repos are cloned and audited. |
| Paid tier decision (`5.D.1`) | Blocks subscriptions sub-phase. Not required for launch path. |
| GA4 decision (`4.E.2`) | Recommended skip in favour of PostHog (D4); keep deferred unless counter-evidence emerges. |
| Workspace Photos scope (`4.D.4`) | Explicitly deferred. Not in v1. |
| Full product roadmap (post-launch features, mobile, partnerships, marketing site, acquisition) | Out of scope for this document by design. Lives in a separate roadmap once G6 passes. |

---

## Risks and dependencies

| Risk | Severity | Mitigation |
|---|---|---|
| Leaked GitHub PAT still active | **High — today** | Rotate + SSH remote (P0.3). Single, immediate action. |
| Q1–Q7 unanswered → Phase 6 stays abstract | High | Clone Waterdog repos and complete the audit in parallel to Phase 1. Cheap to start. |
| Legal pages not live | Medium | Blocks both G3 (Google verification) and G4 (Stripe Connect approval). Schedule Legal page drafting in the Phase 1 window so it is ready when Phases 4/5 want to ship. |
| Apple Sign-In adds Apple Developer account + certs ($99/yr, identity bridge work) | Medium | Budget and account creation now so 4.A.8 isn't blocked by procurement later. |
| Phase 1 item 1.2 (RLS on every user-owned table) is policy-dense and easily underestimated | Medium | Treat as a sub-workstream with its own audit; do not size as a single ticket. |
| Per-region routing (D8) requires residency field before any Vertex call | Medium | Sequence 4.B.5a before any of 4.B.6's call sites. |

---

## Changes this update (vs. prior session)

| Change | Effect |
|---|---|
| D1–D12 moved from "recommended" to **LOCKED** | G1 gate passes. Phase 1 becomes executable. |
| D10 added Apple Sign In | New item `4.A.8` enters Phase 4 scope. |
| D8 per-region routing confirmed | New item `4.B.5a` enters Phase 4.B; it gates 4.B.6 call sites. |
| GA4 recommendation (skip, use PostHog) | `4.E.2` effectively "Later / unlikely". |
| Document version | INTEGRATION_READINESS v1 → v2 |
| **Phase 0 reopened**: P0.2 regressed | `/search` prerender fails `bun run build`. Earlier closeout was wrong — grep-match was insufficient proof. Logged as KD-1 in INTEGRATION_READINESS. Separate micro-CCP will fix after CCP 2 commits. |
| **Drift acknowledged**: Phase 3.1 (Resend) partially done ahead-of-sequence (commit `5e652df`) | Not disruptive. Table in INTEGRATION_READINESS §"Current state audit" is stale for the email row; trust commits until the table is refreshed. |
| **Known debt tracker opened** (KD-1 to KD-6 in INTEGRATION_READINESS) | Surfaced during CCP 2 execution. Includes 2 spec↔architecture drifts (watermark_profiles, assignment_* writes) and 2 open product decisions (messages table, staff registry). None block CCP 2 gate. |
| **KD-1 closed** (2026-04-17, commit `4681e92`) | Suspense boundaries wrapped around `useSearchParams()` on `/search` and `/checkout/[assetId]`. `bun run build` exit 0 across 47 routes. Phase 0 is now fully closed. |
| **KD-7 opened** (follow-up from KD-1 fix) | `force-dynamic` retained on both fixed pages; soft-deprecated in Next.js 16 in favor of `connection()`. Low severity; queued as independent micro-CCP. |
| **KD-8 opened** (discovered during KD-1 verification) | `bun test` does not load `.env.local` — RLS and v2/batch tests skip or error on env validation. Medium severity; blocks reliable test signal until a `bunfig.toml` preload is configured. Historical RLS "8/9 pass" claim needs re-measurement once KD-8 lands. |
| **CCP 3 closed** (2026-04-17) | Items 1.7–1.9 verified pre-landed in migration `20260419110000_phase1_vector_cache_audit.sql` (pgvector + `asset_embeddings` + HNSW; `ai_analysis` cache with COALESCE-aware unique key; `audit_log` with event/actor/target/trace indexes; all RLS service-role-only). Item 1.10 = `src/lib/env.ts` (Zod fail-fast) plus a 9-file consolidation pass migrating direct `process.env.*` reads to `env.*` / `flags.*` imports. Grep dropped 19 → 5 documented-exception files. Build green. |
| **Route-count baseline corrected** (2026-04-17) | Prior closeouts cited "47 routes" as the `bun run build` output. Actual post-CCP-3 baseline is **81 routes**. Nothing regressed between CCPs; the earlier figure was stale. All historical "47 routes" references in `INTEGRATION_READINESS.md` and this file are annotated as superseded. |
| **CCP 4 closed** (2026-04-17) | Phase 1 item 1.3 delivered across 3 commits: `a89c9a4` (auth/post/providers), `3468008` (asset-media), `5755d02` (watermark profiles). Mode contract honoured: `MODE` decided once at load from `isSupabaseEnvPresent`, single `[ff:mode]` log per module on first use gated to non-prod, public TS types identical across paths. Modules 4 and 5 promoted sync→async (Q1 signoff) with all downstream call-sites awaited (`/api/media/[id]`, `/api/packages/[packageId]/artifacts/[artifactId]`, `/api/entitlements/[assetId]`, `src/lib/processing/pipeline.ts`, vitest suite). `getAllSeedProfiles` reinterpreted in real mode as "list all rows" (Q2 signoff). `tsc --noEmit` clean per module (5×), `bun run build` exit 0 (81 routes). `bun test` skipped — KD-8 is the pre-existing blocker. No new KD entries opened. |
| **G2 passed** (2026-04-17) | Phase 1 (Foundation) closed. Only parallel human task remaining is 1.1 Vercel preview/prod env wiring; it does not block Phase 2/3/4/5 design work, only live deploys. |

No timeline moves, no reprioritisation of later phases. Phase 0 closed; CCP 2/3/4 closed; Phase 1 closed; G2 passed. KD-8 now sits at the top of Now because CCP 4 landed without a live test suite — Phase 2/3 work should restore that signal first.

---

## Capacity note

This roadmap is sized by scope category only (S/M/L from INTEGRATION_READINESS). Real calendar commitments require:

1. Head-count and % of planned-feature time (70/20/10 default).
2. A call on whether Phase 0 + Phase 1 runs as a focused sprint or bleeds into Phase 2/3.
3. Explicit buffer around RLS (1.2), Stripe Connect KYC surfacing (5.C.1), and Waterdog migration dry-run (6.11).

Do not commit external dates (to creators, investors, or partners) off this document until capacity is plugged in.

---

## Exact next step

1. **Governance commit landed** (2026-04-17) — `INTEGRATION_READINESS.md` + `ROADMAP.md` reconciled to reflect CCP 4 closure and G2 passage. Push `main` to origin, tag `checkpoint/ccp4-green-20260417-<hhmm>`.
2. **Paste KD-8 prompt** — fix `bun test` env loading (`bunfig.toml` preload of `.env.local`, or equivalent). Promoted to top of Now because CCP 4 landed without live test signal; Phase 2/3 work is safer once tests are restored.
3. **Then choose Phase 2 or Phase 3** — both unblocked by G2. Phase 3 is partially started (`5e652df`); finishing it first reduces ahead-of-sequence drift. Phase 2 (Sentry + structured logging) is the more conservative pre-Stripe move. Capacity call.
4. **In parallel (low priority, discretionary)** — KD-7 micro-CCP (`force-dynamic` → `connection()`).
5. **In parallel (long tail)** — execute H6 (Waterdog clone + mount) so CCP 16 is unblocked when the main chain reaches it.
6. **In parallel (human task)** — wire Vercel preview + prod env vars (install `vercel` CLI or use dashboard). Required before Phase 4/5 ships to a live URL, not before they're built.

Note for the next session: CCP 4 deliberately did not touch entitlement-check hardening on the previously-mocked asset-media paths. That work belongs in Phase 5 (Stripe fulfilment) and should not be re-scoped into Phase 2/3.

---

*This document is the communication view. The execution detail lives in `INTEGRATION_READINESS.md`. When those two diverge, INTEGRATION_READINESS wins — update this file to match.*
