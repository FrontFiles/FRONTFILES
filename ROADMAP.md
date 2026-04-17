# Frontfiles — Pre-Integration Roadmap

**View:** Now / Next / Later · **Source of truth for detail:** `INTEGRATION_READINESS.md` v2 (2026-04-17) + `CLAUDE_CODE_PROMPT_SEQUENCE.md`
**Owner:** João Nuno Martins · **Last updated:** 2026-04-17 (post-Phase 0 closeout)

> This document is the communication-altitude view of the pre-integration work. It is deliberately thin. For phase-item granularity, size, and rationale, read `INTEGRATION_READINESS.md`. Do not duplicate detail here.

---

## Status overview (post-lock)

| Signal | State |
|---|---|
| G1 — Architectural decisions D1–D12 | **Passed** (2026-04-17) |
| Phase 0 pre-flight (CCP 1) | **Partially closed** — 5/6 green; P0.2 regressed (`/search` prerender). See INTEGRATION_READINESS §Known debt KD-1. |
| CCP 2 — Supabase foundation + RLS | **GREEN on dev** — commit `c05928f` · 8/9 RLS tests pass · migration `20260420000000` applied on Remote dev Supabase · Vercel preview/prod env wiring deferred as a parallel human task |
| G2 — Phase 1 (Foundation) completion | In flight — CCP 2 done; CCP 3 next (after KD-1) |
| G3 — Legal pages + Google verification | Not started |
| G4 — Stripe Connect application approval | Not started |
| G5 — Waterdog audit + schema mapping signed | **Blocked** on Q1–Q7 |
| G6 — Full dry-run rehearsal on staging | Not started |

**One-line:** Architectural layer locked + Phase 0 closed. Phase 1 foundation is the active work; CCP 2 is the next prompt. Nothing else real-world turns on until G2 passes. Commit `5e652df` shows Phase 3.1 (Resend) already partially done — that is ahead-of-sequence, acceptable, but note the repo is slightly further than the doc suggests.

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
| **KD-1 micro-CCP — restore `/search` Suspense / `force-dynamic`** | Single highest-priority item. `bun run build` is broken → blocks any Vercel deploy (preview or prod). Small surgical fix. | INTEGRATION_READINESS §Known debt KD-1 |
| **CCP 3 — pgvector + ai_analysis + audit_log + env-schema** | Remaining Phase 1 infra primitives that every downstream CCP depends on. Runs after KD-1 + CCP 2 both landed. | `CLAUDE_CODE_PROMPT_SEQUENCE.md` §CCP 3 / INTEGRATION_READINESS §Phase 1 items 1.7–1.10 |
| **CCP 4 — Flip mocked modules to real dual-mode** | Closes Phase 1 by retiring the "mocks silently swallow writes" risk. | `CLAUDE_CODE_PROMPT_SEQUENCE.md` §CCP 4 / INTEGRATION_READINESS §Phase 1 item 1.3 |
| Waterdog repo audit — answer Q1–Q7 (H6) | Blocks Phase 6 from concretising. Can run in parallel to CCP 3/4. Cheap to start. | INTEGRATION_READINESS §Open questions |
| Vercel env wiring (preview + prod scopes) | Full Phase 1 closeout requires env parity across dev/preview/prod. Not a CCP 2 blocker, but required before Phase 4/5 integration. Do in parallel via Vercel dashboard or install `vercel` CLI. | INTEGRATION_READINESS §Phase 1 item 1.1 |

**Concrete next action:** Commit the governance doc updates, push `main` (2 commits) to origin, tag the checkpoint. Then fix KD-1 in a fresh Claude Code session (micro-CCP — do not bundle with CCP 3). Only then paste CCP 3.

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
| **Phase 0 reopened**: P0.2 regressed | `/search` prerender fails `bun run build`. My earlier closeout was wrong — grep-match was insufficient proof. Logged as KD-1 in INTEGRATION_READINESS. Separate micro-CCP will fix after CCP 2 commits. |
| **Drift acknowledged**: Phase 3.1 (Resend) partially done ahead-of-sequence (commit `5e652df`) | Not disruptive. Table in INTEGRATION_READINESS §"Current state audit" is stale for the email row; trust commits until the table is refreshed. |
| **Known debt tracker opened** (KD-1 to KD-6 in INTEGRATION_READINESS) | Surfaced during CCP 2 execution. Includes 2 spec↔architecture drifts (watermark_profiles, assignment_* writes) and 2 open product decisions (messages table, staff registry). None block CCP 2 gate. |

No timeline moves, no reprioritisation of later phases. The lock is additive, not disruptive. Phase 0 → Phase 1 transition is the only active shift.

---

## Capacity note

This roadmap is sized by scope category only (S/M/L from INTEGRATION_READINESS). Real calendar commitments require:

1. Head-count and % of planned-feature time (70/20/10 default).
2. A call on whether Phase 0 + Phase 1 runs as a focused sprint or bleeds into Phase 2/3.
3. Explicit buffer around RLS (1.2), Stripe Connect KYC surfacing (5.C.1), and Waterdog migration dry-run (6.11).

Do not commit external dates (to creators, investors, or partners) off this document until capacity is plugged in.

---

## Exact next step

1. **Commit governance doc updates** as a separate commit on top of `c05928f`, then push both commits to `origin/main` and tag the checkpoint. (Commands below.)
2. **Fix KD-1** — open a fresh Claude Code session; paste the KD-1 micro-CCP prompt; restore Suspense / `force-dynamic` on `/search`; re-run `bun run build` until green. Do not bundle with anything else.
3. **In parallel** — execute H6 (Waterdog clone + mount) so CCP 16 is unblocked when the main chain reaches it. Cheap to start, long tail if left.
4. **In parallel** — wire Vercel preview + prod env vars (install `vercel` CLI or use dashboard). Not a CCP 2 blocker but required before Phase 4/5.
5. **After KD-1 green** — paste CCP 3. Do not skip the gate. Expect CCP 3 to surface follow-up product decisions in the same way CCP 2 did (these are working as designed).

---

*This document is the communication view. The execution detail lives in `INTEGRATION_READINESS.md`. When those two diverge, INTEGRATION_READINESS wins — update this file to match.*
