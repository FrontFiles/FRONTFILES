# Frontfiles — Pre-Integration Roadmap

**View:** Now / Next / Later · **Source of truth for detail:** `INTEGRATION_READINESS.md` v2 (2026-04-17) + `CLAUDE_CODE_PROMPT_SEQUENCE.md`
**Owner:** João Nuno Martins · **Last updated:** 2026-04-17 (post-CCP 3 closeout)

> This document is the communication-altitude view of the pre-integration work. It is deliberately thin. For phase-item granularity, size, and rationale, read `INTEGRATION_READINESS.md`. Do not duplicate detail here.

---

## Status overview (post-lock)

| Signal | State |
|---|---|
| G1 — Architectural decisions D1–D12 | **Passed** (2026-04-17) |
| Phase 0 pre-flight (CCP 1) | **Closed** (2026-04-17) — P0.2 resolved via KD-1 micro-fix (commit `4681e92`); `bun run build` exit 0 across 47 routes. |
| CCP 2 — Supabase foundation + RLS | **GREEN on dev** — commit `c05928f` · migration `20260420000000` applied on Remote dev Supabase · Vercel preview/prod env wiring deferred as a parallel human task. Historical RLS 8/9 pass count needs re-measurement once KD-8 (bun test env loading) lands. |
| CCP 3 — pgvector + ai_analysis + audit_log + env-schema | **GREEN** (2026-04-17) — items 1.7–1.9 pre-landed in migration `20260419110000`; item 1.10 landed in `src/lib/env.ts` + consolidation pass across 9 source files. `tsc --noEmit` clean, `bun run build` exit 0 (47 routes), grep drops 19 → 5 documented-exception files. |
| G2 — Phase 1 (Foundation) completion | In flight — CCP 1/2/3 + KD-1 done; CCP 4 (flip mocks → real dual-mode) is next, plus 1.1 (Vercel preview/prod env wiring) remains a parallel human task. |
| G3 — Legal pages + Google verification | Not started |
| G4 — Stripe Connect application approval | Not started |
| G5 — Waterdog audit + schema mapping signed | **Blocked** on Q1–Q7 |
| G6 — Full dry-run rehearsal on staging | Not started |

**One-line:** Architectural layer locked + Phase 0 truly closed + CCP 2/3 green + env-consolidation pass in. Build stays provably clean (`bun run build` exit 0 across 47 routes). Phase 1 foundation continues; CCP 4 (flip mocks → real dual-mode) is the next prompt. Nothing else real-world turns on until G2 passes. Commit `5e652df` shows Phase 3.1 (Resend) already partially done — ahead-of-sequence, acceptable.

---

## Critical path

```
Phase 0 (pre-flight, including PAT rotation)
   │
   ▼
Phase 1 (Foundation)  ── G2
   │
   ├─► Phase 2 (Observability)  ─┐
   ├─► Phase 3 (Email)            │
   ├─► Phase 4 (Google)  ── G3    ├─► Phase 6 (Beta migration) ── G6
   ├─► Phase 5 (Stripe) ── G4     │
   └─► Phase 7 (Hardening)       ─┘
```

The single longest dependency chain is: Phase 0 → Phase 1 → (Phase 4 ∥ Phase 5) → Phase 6. Phases 2/3/7 parallelise once Phase 1 clears.

---

## Now (active this window)

Commit-grade work, high-confidence scope and sequence.

| Item | Why it's Now | Ref |
|---|---|---|
| **CCP 4 — Flip mocked modules to real dual-mode** | Closes Phase 1 by retiring the "mocks silently swallow writes" risk. Primary active item now that CCP 3 is green. | `CLAUDE_CODE_PROMPT_SEQUENCE.md` §CCP 4 / INTEGRATION_READINESS §Phase 1 item 1.3 |
| Waterdog repo audit — answer Q1–Q7 (H6) | Blocks Phase 6 from concretising. Can run in parallel to CCP 4. Cheap to start. | INTEGRATION_READINESS §Open questions |
| Vercel env wiring (preview + prod scopes) | Full Phase 1 closeout requires env parity across dev/preview/prod. Not a CCP 4 blocker, but required before Phase 4/5 integration. Do in parallel via Vercel dashboard or install `vercel` CLI. | INTEGRATION_READINESS §Phase 1 item 1.1 |
| KD-8 micro-CCP — `bun test` env loading | Medium severity. Without it, RLS + v2/batch tests skip or error on env-validation. Test signal is unreliable until fixed. Higher priority now that CCP 4 relies on dual-mode test coverage. Quick win (`bunfig.toml` preload). | INTEGRATION_READINESS §Known debt KD-8 |
| KD-7 micro-CCP — `force-dynamic` → `connection()` on `/search` + `/checkout/[assetId]` | Low severity. Build is green with the Suspense fix; the `force-dynamic` directive is only soft-deprecated. Not blocking anything. Queue between CCPs when appetite exists. | INTEGRATION_READINESS §Known debt KD-7 |

**Concrete next action:** Commit CCP 3 closeout (code + governance) on top of `4681e92`, push `main` to origin, tag a new checkpoint (`checkpoint/ccp3-green-<timestamp>`). Then paste CCP 4 — no blocking micro-CCPs in the way. KD-7 and KD-8 remain parallel side-fixes that can slot between CCPs.

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
| **CCP 3 closed** (2026-04-17) | Items 1.7–1.9 verified pre-landed in migration `20260419110000_phase1_vector_cache_audit.sql` (pgvector + `asset_embeddings` + HNSW; `ai_analysis` cache with COALESCE-aware unique key; `audit_log` with event/actor/target/trace indexes; all RLS service-role-only). Item 1.10 = `src/lib/env.ts` (Zod fail-fast) plus a 9-file consolidation pass migrating direct `process.env.*` reads to `env.*` / `flags.*` imports. Grep dropped 19 → 5 documented-exception files. Build green (47 routes). |

No timeline moves, no reprioritisation of later phases. Phase 0 is now demonstrably closed; CCP 3 closes; Phase 1 continues toward CCP 4.

---

## Capacity note

This roadmap is sized by scope category only (S/M/L from INTEGRATION_READINESS). Real calendar commitments require:

1. Head-count and % of planned-feature time (70/20/10 default).
2. A call on whether Phase 0 + Phase 1 runs as a focused sprint or bleeds into Phase 2/3.
3. Explicit buffer around RLS (1.2), Stripe Connect KYC surfacing (5.C.1), and Waterdog migration dry-run (6.11).

Do not commit external dates (to creators, investors, or partners) off this document until capacity is plugged in.

---

## Exact next step

1. **Commit CCP 3 closeout** — one code commit for the 9-file `process.env → @/lib/env` consolidation, one governance commit for `INTEGRATION_READINESS.md` + `ROADMAP.md` reconciliation. Push `main` to origin, tag a new checkpoint (`checkpoint/ccp3-green-<timestamp>`).
2. **Paste CCP 4** in a fresh session — flip mocked modules (`auth/provider.ts`, `post/store.ts`, `providers/store.ts`, `media/asset-media-repo.ts`, `processing/profiles.ts`) to real dual-mode. Closes item 1.3.
3. **In parallel (medium priority, blocks reliable test signal)** — KD-8 micro-CCP to fix `bun test` env loading. Has become more important now that CCP 4 will lean on test coverage to prove dual-mode correctness.
4. **In parallel (low priority, discretionary)** — KD-7 micro-CCP (`force-dynamic` → `connection()`).
5. **In parallel (long tail)** — execute H6 (Waterdog clone + mount) so CCP 16 is unblocked when the main chain reaches it.
6. **In parallel (human task)** — wire Vercel preview + prod env vars (install `vercel` CLI or use dashboard). Not a CCP 4 blocker but required before Phase 4/5.

Expect CCP 4 to surface real-mode fallout the same way CCP 2/3 surfaced KDs — dual-mode parity tests, missing entitlement checks in the previously-mocked paths, and a few test-fixture reshapes. Governance captures them as KD items and moves on.

---

*This document is the communication view. The execution detail lives in `INTEGRATION_READINESS.md`. When those two diverge, INTEGRATION_READINESS wins — update this file to match.*
