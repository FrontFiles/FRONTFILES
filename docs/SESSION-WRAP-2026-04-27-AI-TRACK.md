# Session Wrap — 2026-04-27 (AI Track, Evening)

**Status:** Active handoff for AI-track resume. Use the RESUME PROMPT in §6 for a fresh Claude session.
**Date:** 2026-04-27 (evening)
**Companion to:** `docs/SESSION-WRAP-2026-04-27.md` — the morning wrap (PR #15 merge, V4 redesign, watermark posture). Tonight's wrap **supersedes only the AI-track resume options** in the morning wrap; the morning wrap's record of PR #15 + V4 + founder locks (L1-L6) + the rest of the platform state remains current.
**Session scope:** Audit-first reversal of E1 v1 (vendor switch alignment to D6/D7/D8/D9/D-U2 platform locks); E1 v2 composed in place; E1.5 architecture detail brief composed; E2 directive (schema + service skeleton) composed; E3 directive (real Vertex calls + cache + embedding + image-prep + circuit breaker) composed; E4 directive (worker integration: dispatcher + reaper + commit-service hook + script extension) composed; **all five architecture artifacts ratified**; E2 implementation (migration + 10 source files + 5 test files) written and static-verified (tsc green; vitest sandbox-gap noted; on-machine gates pending).

---

> ## UPDATE — 2026-04-27 (late evening, post-PR#16 + PR#17)
>
> Since this wrap was first written, the on-machine verification +
> PR open work landed:
>
> - **PR #16 merged** (`chore/tsc-baseline-cleanup`) — cleaned the
>   pre-existing tsc baseline. The wrap's "8 pre-existing tolerated"
>   was actually 9 (the 8 in option (e) + 1 Stripe SDK API-version
>   drift that surfaced with the 2026-04-27 SDK refresh). Baseline
>   is now **0 errors**.
> - **PR #17 open** (`feat/ai-e2-schema-skeleton`) — 3 commits, 24
>   files, +6454/-204. All 8 E2 verification gates green this session:
>   tsc 0; vitest 48/48 ai-suggestions + 1946/1976 full; `supabase db
>   reset` clean; RLS = `t` on all 4 new tables; singleton seeded with
>   E1.5 defaults; rollback drops 4 tables to 0 rows + clean re-apply;
>   `bun run build` exit 0; no new routes.
> - **`settings.ts` patch inside the E2 implementation** — uses
>   `process.env.NODE_ENV` (live read) not `env.NODE_ENV` (frozen
>   Zod-parsed snapshot). Required for `vi.stubEnv`-based tests to
>   pass. Aligns with the codebase's `flags` getter pattern (CCP
>   Pattern-a Option 2b — see `src/lib/env.ts`). E2 directive §5.6
>   needs a post-merge corrigendum.
>
> ### What this means for the NEXT session
>
> - **§3 ratification gates table:** E2 implementation row is now
>   "PR #17 open" (was "on-machine verification pending"). E3 / E4
>   directives still ratified, awaiting implementation slots.
>   E5 / E6 directives still not composed.
> - **§5 founder action items 1, 2:** DONE (verify E2 + open PR).
>   Items 3-7 (E3 + E4 implementation slots, GCP service account +
>   Vertex AI User role, Vertex pricing + SDK verification at E3
>   ship) remain. Items 8-12 (WM-D1, WM-D3, F1 ratification, F1.5
>   compose, BP-D1) remain.
> - **§6 RESUME PROMPT default opener:** options (a) and (e) are
>   DONE. **New default after PR #17 merges: option (b) — implement
>   E3**. While PR #17 sits in review, options (c) compose-E5 and
>   (d) ratify-F1 remain valid parallel work; option (e) is moot.
> - **§7 one-shot prompts:** "Verify E2 + open PR" and "Cleanup the
>   8 pre-existing tsc errors" are DONE; preserved as historical
>   record.
> - **§8 state-to-verify commands:** still useful, with two
>   adjustments: the `tsc baseline 8` expectation is now `0`; main
>   HEAD will be PR #17's merge commit (currently `e2bd02e` =
>   PR #16's merge if PR #17 hasn't merged yet).
>
> Rest of this wrap below remains current as historical record.

---

## 1. What this doc is

A cold-start handoff for the AI track specifically. Drop the RESUME PROMPT in §6 into a fresh Claude session and the new agent picks up where this session stopped on the AI pipeline.

If you want platform context outside the AI track (PR #15, V4 redesign, watermark, B/C/D phases, Phase F price engine, etc.), read `docs/SESSION-WRAP-2026-04-27.md` first — that wrap is still the canonical platform-state document. This wrap layers on top.

If you want a specific action, jump to §7 (one-shot prompts).

---

## 2. State of the world (what shipped this session)

### Five ratified architecture artifacts + E2 implementation

| Order | Artifact | Status | Location |
|---|---|---|---|
| 1 | **E1 v2** — AI suggestion pipeline brief, revised | ✅ ratified 2026-04-27 | `src/lib/processing/AI-PIPELINE-BRIEF.md` |
| 2 | **E1.5** — AI suggestion pipeline architecture detail brief | ✅ ratified 2026-04-27 | `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` |
| 3 | **E2 directive** — schema migration + service skeleton | ✅ ratified 2026-04-27 | `src/lib/processing/E2-DIRECTIVE.md` |
| 4 | **E3 directive** — real Vertex Gemini Vision job (Class A implementation) | ✅ ratified 2026-04-27 | `src/lib/processing/E3-DIRECTIVE.md` |
| 5 | **E4 directive** — worker integration (dispatcher + reaper + commit-service hook + script) | ✅ ratified 2026-04-27 | `src/lib/processing/E4-DIRECTIVE.md` |
| — | **E2 implementation** — migration + 10 source files + 5 test files | ⚠ written + static-verified; on-machine gates pending | `supabase/migrations/20260427000004_*` + `src/lib/ai-suggestions/**` |

### The audit-first reversal (the load-bearing pivot)

The session was supposed to compose E1.5 (~60 min). Audit-first read of `INTEGRATION_READINESS.md` v2 + `PLATFORM_REVIEWS.md` v2 + migration `20260419110000_phase1_vector_cache_audit.sql` + `CLAUDE_CODE_PROMPT_SEQUENCE.md` caught a load-bearing conflict E1 v1 (composed 2026-04-26) silently introduced:

| Source | Date | Vendor | Embedding | Vector dim | v1 clustering? |
|---|---|---|---|---|---|
| `INTEGRATION_READINESS.md` D6/D7/D9 | 2026-04-17 (LOCKED) | **Vertex AI Gemini** ("Google for everything") | `text-embedding-004` | 768 | n/a |
| `PLATFORM_REVIEWS.md` D-U2 | 2026-04-17 (LOCKED) | Vertex AI wrapper as HARD launch gate | n/a | n/a | **YES — hard launch gate** |
| Migration `20260419110000` | 2026-04-19 (shipped) | Vertex/Gemini per header | `text-embedding-004` | 768 | n/a |
| **E1 v1 (`AI-PIPELINE-BRIEF.md`)** | 2026-04-26 | **Anthropic Claude Vision** | open-source CLIP | 512 | **NO — deferred to v2** |

E1 v1 silently overrode four locked architectural decisions (D6/D7/D9 + D-U2) plus the operationalized migration. The "Single vendor reduces operational complexity" rationale in v1 §5.1 was the inverse of D6's documented rationale ("Google for everything"). D8 (per-creator EU/US residency) made the Anthropic stack architecturally fragile — Anthropic's API is US-only; EU residency would have required Anthropic-on-Bedrock or Anthropic-on-Vertex routing, contradicting the very "single vendor" rationale v1 invoked.

Founder picked **Path B** (honor the prior locks; revise E1) over Path A (retract the locks; honor v1) over Path C (hybrid). Path B was decisively right because:
- D8 residency is unsolvable on Anthropic-only stack without a routing layer
- The migration is shipped and is being verified by `scripts/verify-dual-mode.ts`
- D-U2 (v1 clustering as HARD launch gate) is a creator-trust commitment
- Reverting to Vertex reuses 100% of shipped infra (pgvector + asset_embeddings + ai_analysis + audit_log)

### What changed in E1 v2

Detailed in `AI-PIPELINE-BRIEF.md` §13 (Revision History). The load-bearing flips:

| Concern | v1 (2026-04-26) | v2 (2026-04-27) |
|---|---|---|
| Vendor (E2) | Anthropic Claude Vision | Vertex AI Gemini Vision (per D6 + D8 + D9) |
| Embedding (E3) | open-source CLIP, 512-dim, local inference | `text-embedding-004`, 768-dim (matches shipped column per D7) |
| v1 scope (E1) | per-asset only; clustering→v2 | per-asset AND clustering both v1 (per D-U2) |
| Per-region routing | not addressed | binding D8 — no cross-region fall-through |
| Schema reuse | new `visual_embedding` column on `asset_proposals` | embeddings live in shipped `asset_embeddings`; cache hits in shipped `ai_analysis` |
| Don't-do list | item 5 = "Don't ship clustering in v1" | item 5 deleted; new items: no second embedding column, no cross-region fall-through, Vertex endpoint only, don't send watermarked_preview to Vision, don't switch vendor without retracting D6 |

### What's locked in E1.5 (the detail layer)

| Decision | Locked answer |
|---|---|
| Vision model | `gemini-2.5-flash` (per-asset) + `gemini-2.5-pro` (cluster naming); pin to current Vertex stable string at E2/E3 ship; quarterly bump cadence with regression sample |
| Embedding model | `text-embedding-004` (768-dim, per D7) |
| Per-format prompt text | Full text per format (photo/illustration/infographic/vector) in §4; structured-output JSON Schema |
| Confidence floors | 0.30 surface threshold; 0.75 new-tag threshold; 0.30 silhouette cluster threshold |
| Image size strategy | Source = `original` (NOT `watermarked_preview` — has watermark baked in); long-edge 1568px; JPEG q85; base64 inline ≤ 4 MiB else signed URL |
| Cost ceiling | Daily + monthly platform cap; on exceedance → `not_applicable` + audit + auto-recovery at next-period |
| Tag taxonomy | Top-50 by usage, alphabetical tie-break |
| Cluster naming prompt | gemini-2.5-pro prompt locked; 2-4 word output; date-range fallback |
| Embedding shape | `caption + " \| " + tags + " \| " + format` |
| Region failover | 5 consecutive failures → 60s cool-down → half-open probe; D8-binding (no cross-region fall-through) |
| Caption length | 200 chars cap (prompt + server-side defensive truncation) |

### What E2 directive covers

Schema migration (4 new tables: `asset_proposals`, `asset_proposal_clusters`, `asset_proposal_audit_log`, `ai_pipeline_settings`) + service skeleton (`src/lib/ai-suggestions/` module with engine, schema, types, audit, settings, models, adapters). Mock adapter wired; production stub throws `NotImplementedError`. Dormant at merge — no Vertex SDK installed, no UI, no worker dispatch. ~250 SQL + ~500 TS + ~400 TS tests = ~1150 lines.

Full directive at `src/lib/processing/E2-DIRECTIVE.md`.

### What E3 directive covers

Vertex AI SDK install + `users.ai_region` migration (= Phase 4.B.5a absorbed) + `src/lib/ai/google.ts` Vertex wrapper (focused on AI-suggestions needs) + real `vertex-vision.ts` adapter + `cache.ts` (ai_analysis read-through) + `image-prep.ts` (Sharp resize from `original`) + `embedding.ts` (text-embedding-004 + `asset_embeddings` upsert) + `cost.ts` (verified Vertex pricing) + `circuit-breaker.ts` (per-region) + `quota.ts` (pre-call spend cap) + `prompt-builder.ts` (per-format prompts + JSON Schema) + `caption-guard.ts` (defensive truncation) + engine orchestration update + `FFF_AI_REAL_PIPELINE` env flag (default false). 22 sections; ~15 new source files + 2 migrations + 8 new tests + 1 manual-QA script.

E3 explicitly absorbs three concerns: (1) Phase 4.B.5a `users.ai_region` migration, (2) the focused subset of CCP 7's `google.ts` wrapper covering AI-suggestions needs, (3) Vertex pricing verification (replacing E1.5's null placeholders).

Full directive at `src/lib/processing/E3-DIRECTIVE.md`.

### Numbers

| Metric | Value |
|---|---|
| Architecture artifacts ratified this session | 5 (E1 v2 + E1.5 + E2 + E3 + E4) |
| Lines of new spec content (E1 v2 + E1.5 + E2 + E3 + E4) | ~5,200 |
| Decisions silently overridden by E1 v1 | 4 (D6, D7, D9, D-U2) + framing decision ("Google for everything") |
| Decisions explicitly re-aligned by E1 v2 | All four + D8 residency mechanism |
| Open §9 decisions resolved by E1.5 | 11 |
| New tables created by E2 implementation (written this session) | 4 (asset_proposals, asset_proposal_clusters, asset_proposal_audit_log, ai_pipeline_settings) |
| New source files created by E2 implementation (written this session) | 10 (in `src/lib/ai-suggestions/`: types, schema, models, audit, settings, engine + 4 in adapters/) |
| New test files created by E2 implementation (written this session) | 5 (schema, models, audit, settings, engine.mock-flow) |
| New source files to be created by E3 implementation | ~15 (including google.ts wrapper) |
| New source files to be created by E4 implementation | 3 (enqueue-proposal, taxonomy, proposal-dispatcher) + 3 touched files |
| tsc baseline preserved through E2 implementation | ✅ 8 errors (pre-existing baseline; no new errors) |
| vitest run on E2 tests | ⚠ sandbox blocked (linux-arm64 binding gap; npm optional-deps bug); must run on macOS via `bun run test` |
| Migration applied + RLS verified + rollback verified | ⚠ on-machine gate pending — sandbox lacks `supabase` CLI / DATABASE_URL |
| Production code shipped this session | E2 implementation files exist on disk; **NOT yet merged**; founder reviews PR after on-machine verification |

---

## 3. The pending ratification gates

After tonight's work:

| Gate | Brief / Directive | Status | Blocks |
|---|---|---|---|
| **E1 v2** | `src/lib/processing/AI-PIPELINE-BRIEF.md` | ✅ ratified 2026-04-27 | — |
| **E1.5** | `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` | ✅ ratified 2026-04-27 | — |
| **E2 directive** | `src/lib/processing/E2-DIRECTIVE.md` | ✅ ratified 2026-04-27 | — |
| **E3 directive** | `src/lib/processing/E3-DIRECTIVE.md` | ✅ ratified 2026-04-27 | E3 implementation can begin (after E2 ships) |
| **E4 directive** | `src/lib/processing/E4-DIRECTIVE.md` | ✅ ratified 2026-04-27 | E4 implementation can begin (after E2 + E3 ship) |
| **E2 implementation** | files written 2026-04-27 evening; static-verified | ⚠ on-machine verification pending (vitest, migration apply, RLS, rollback) | E3 implementation; PR open + merge |
| **E3 implementation** | n/a (engineer-executed) | not started | E4 implementation; production AI calls |
| **E4 implementation** | n/a (engineer-executed) | not started | Production worker activation |
| **E5 directive** (clustering) | n/a (not composed) | not composed | E5 implementation; v1 launch per D-U2 |
| **E6 directive** (UI integration) | n/a (not composed) | not composed | UI surfacing; PR 5 cutover |
| **F1** | `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` | composed 2026-04-26, **awaits ratification** | F1.5 calibration + F2 schema |
| **F1.5 calibration** | n/a (not composed) | not composed | F2 schema migration |
| **PR 5 cutover** | combined gate | not started | Production go-live; needs E2-E6 done + F2-F11 done + WM-D1 + WM-D3 |

---

## 4. Documents to read on session start

Read in this order. Skim §1 + §3 of each unless full read needed.

### Tier 1 — Always read on AI-track resume (~20 min total)

| Order | Path | Why | Read budget |
|---|---|---|---|
| 1 | `docs/SESSION-WRAP-2026-04-27-AI-TRACK.md` (this doc) | Session state + AI-track resume options | 5 min |
| 2 | `/Users/jnmartins/dev/frontfiles/CLAUDE.md` (root) | Standing posture (audit-first, propose-before-lock, etc.) | 2 min if not already loaded |
| 3 | `src/lib/processing/AI-PIPELINE-BRIEF.md` v2 (§3 locks + §13 revision history) | Vendor + scope + trust posture | 5 min |
| 4 | `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` (§3.1 model pins + §4 prompts + §5 floors) | Detail layer | 5 min |
| 5 | `INTEGRATION_READINESS.md` v2 (Decision Locks table) | Confirms D6/D7/D8/D9 binding | 2 min |
| 6 | `PLATFORM_REVIEWS.md` v2 (Decision Locks table) | Confirms D-U2 v1 clustering | 1 min |

### Tier 2 — Read for the relevant track action

If composing **E4 directive** (worker integration):
- `src/lib/processing/E2-DIRECTIVE.md` + `src/lib/processing/E3-DIRECTIVE.md` (full read; the directives this builds on)
- `src/lib/processing/PR-4-PLAN.md` (worker pattern precedent — Path B)
- `src/lib/processing/dispatcher.ts` + `src/lib/processing/reaper.ts` + `src/lib/upload/commit-service.ts` (the files E4 touches)

If composing **E5 directive** (clustering):
- E1 v2 §4.3 (Class B pipeline)
- E1.5 §9 (cluster naming prompt)
- HDBSCAN: confirm a Node-compatible package (the implementation directive will pick the lib)

If composing **E6 directive** (UI integration):
- `docs/upload/UX-SPEC-V4.md` (proposal surfacing visual treatment)
- E2 directive §5 (the schemas E6 reads via service-role)
- The V4 components shipped via PR #15 (`src/app/vault/upload/_components/`)

If pivoting to **F1 ratification**:
- `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 (sister architecture; ratified)
- `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (F1; composed 2026-04-26, awaits ratification)
- `src/lib/offer/pricing.ts` (existing fee decomposition; preserved)

If working on **E2 implementation** (engineer-side, not Claude):
- `src/lib/processing/E2-DIRECTIVE.md` is the implementation prompt
- See §17 for the Cowork plugin / Claude Code prompt pattern

If working on **E3 implementation** (engineer-side):
- `src/lib/processing/E3-DIRECTIVE.md`
- Verify Vertex pricing at `cloud.google.com/vertex-ai/generative-ai/pricing` BEFORE merge (per E3 §18 verification gate #5)

---

## 5. Founder action items NOT requiring Claude

| # | Action | Time | Blocks |
|---|---|---|---|
| 1 | **Verify E2 on your machine** — run `npx tsc --noEmit` (expect 8 baseline) + `bun run test src/lib/ai-suggestions/__tests__/` (expect all pass) + `supabase db push` + RLS verification + rollback test (E2 directive §7 verification gates 1, 2, 3, 4, 5, 6, 7, 8). Sandbox couldn't run vitest (linux-arm64 binding gap) or apply migrations. | ~10-15 min | E2 PR open |
| 2 | **Open E2 PR** — once verification gates green, open PR; founder review per E2 directive §8 approval gate; merge | ~10 min | E3 implementation |
| 3 | **Schedule E3 implementation slot** — execute E3-DIRECTIVE.md after E2 merges. ~3-4 hrs Claude work. Substantial: Vertex SDK install + google.ts + 8 source files + 8 tests + migration + manual smoke test. | n/a | E4 implementation |
| 4 | **Verify Vertex pricing as of E3 ship date** — before E3 merges, fill `cost.ts` with current Vertex pricing values (replaces E1.5 placeholder nulls) | ~10 min web visit | E3 merge |
| 5 | **Verify Vertex SDK package selection** — confirm `@google-cloud/vertexai` covers Gemini 2.5 Vision content + embeddings against current Vertex docs at E3 ship | ~5 min web visit | E3 install step |
| 6 | **GCP service account + Vertex AI User role** (per H2 in `CLAUDE_CODE_PROMPT_SEQUENCE.md`) — create + download JSON key + store in 1Password | ~30 min | E3 manual smoke test |
| 7 | **Schedule E4 implementation slot** — execute E4-DIRECTIVE.md after E3 merges. ~1-2 hrs Claude work. Lighter than E3: 3 new source files + 3 touched + tests. | n/a | Production worker activation |
| 8 | **WM-D1** — `/dev/watermark-approval`, approve at least one watermark profile per (intrusion_level × template_family) pair (still pending from morning wrap) | ~15 min | PR 5 cutover |
| 9 | **WM-D3** — pick `none → light` or `none → standard` for legacy `watermark_mode` mapping (still pending from morning wrap) | ~1 min | PR 8 |
| 10 | **F1 ratification** — read `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md`; approve in place or push corrections back | ~30 min | F1.5 + F2 schema |
| 11 | **F1.5 calibration spreadsheet** — fill 252-cell `format_defaults` + 63-cell platform floors (only after F1.5 directive composes) | hours | F2 + F3 |
| 12 | **BP-D1 commissioning** — decide whether to commission `CANONICAL_SPEC.md` drafting now or defer (still pending from morning wrap) | n/a | independent track |

---

## 6. RESUME PROMPT (paste into fresh session)

```
I'm resuming work on the Frontfiles platform after a substantial session
ended on 2026-04-27 (evening).

The AI-track session wrap is at:
  docs/SESSION-WRAP-2026-04-27-AI-TRACK.md

Before responding, read these in order:
  1. docs/SESSION-WRAP-2026-04-27-AI-TRACK.md (the AI-track wrap; ~5 min)
  2. /Users/jnmartins/dev/frontfiles/CLAUDE.md (standing posture)
  3. src/lib/processing/AI-PIPELINE-BRIEF.md v2 §3 + §13 (5 min)
  4. src/lib/processing/AI-PIPELINE-ARCHITECTURE.md §3.1 + §4 + §5 (5 min)

Standing posture per CLAUDE.md:
- Audit first; never jump to implementation
- Propose before locking; explicit IPs surfaced as HALT
- Architecture before implementation
- Tight per-directive commits with selective stage
- Founder ratifies before code

Current state (after the prior session, 2026-04-27 evening):

AI PIPELINE — ARCHITECTURE PHASE COMPLETE THROUGH E4 (5 ratified artifacts)
- E1 v2 (revised brief): src/lib/processing/AI-PIPELINE-BRIEF.md
- E1.5 (architecture detail): src/lib/processing/AI-PIPELINE-ARCHITECTURE.md
- E2 directive (schema + skeleton): src/lib/processing/E2-DIRECTIVE.md
- E3 directive (real Vertex calls): src/lib/processing/E3-DIRECTIVE.md
- E4 directive (worker integration): src/lib/processing/E4-DIRECTIVE.md
- All five ratified 2026-04-27.
- E5 directive (clustering) and E6 directive (UI integration) not composed.
- E2 IMPLEMENTATION written + sandbox-static-verified (tsc baseline preserved).
  Vitest sandbox-blocked by linux-arm64 binding gap. On-machine gates pending:
  vitest run, supabase db push, RLS verify, rollback test.
- E3 / E4 implementation not yet started; E3 gated on E2 merge; E4 gated on E2 + E3.
- Vendor stack: Vertex AI Gemini (per D6) + text-embedding-004 768-dim (per D7) +
  per-region routing (per D8) + Vertex AI endpoint not Gemini Developer API (per D9).
- v1 clustering ships with v1 per D-U2 (HARD launch gate).
- Architecture re-aligned to D6/D7/D8/D9/D-U2 locks after audit-first reversal
  of E1 v1's silent vendor switch (Path B chosen over Path A or C).

PHASES THAT WERE OPEN PER MORNING WRAP REMAIN OPEN
- F1 (price engine architecture): composed 2026-04-26, awaits ratification
- F1.5 calibration: not composed
- WM-D1 (watermark profile approval): pending founder action
- WM-D3 (legacy mapping): pending founder action
- BP-D1 (CANONICAL_SPEC commissioning): pending founder decision

UPLOAD UI / V4 / PR #15 — STILL CURRENT FROM MORNING WRAP
- All Phase B (PR 1.3 + PR 3 + PR 4) shipped, dormant behind FFF_REAL_UPLOAD=false
- All Phase C V4 redesign shipped via PR #15 on 2026-04-27 morning
- Branch feat/d-upload-v4 deleted; main at 14c598d
- Tests: 1898 passing; tsc baseline 8 pre-existing tolerated
- All 6 founder locks (L1-L6) preserved

Pending founder actions (no Claude composition needed first):
1. Verify E2 implementation on your machine (vitest, migration apply, RLS, rollback) — ~15 min
2. Open E2 PR (after verification gates green) — ~10 min
3. Schedule E3 implementation slot after E2 merges — ~3-4 hrs Claude work
4. Verify Vertex pricing as of E3 ship for cost.ts (~10 min)
5. Verify Vertex SDK package selection at E3 install (~5 min)
6. GCP service account + Vertex AI User role (~30 min, per H2)
7. Schedule E4 implementation slot after E3 merges — ~1-2 hrs Claude work
8. WM-D1 + WM-D3 (still pending from morning wrap)
9. Ratify F1; compose F1.5 calibration directive
10. Decide on BP-D1 commissioning timing

Five reasonable next-session opener directives — pick one and we go:

(a) "Verify E2 + open PR" — run the on-machine gates (tsc, vitest,
    supabase db push, RLS verify, rollback test) per E2 directive §7.
    If green, open the PR. Bounded; ~15-20 min.

(b) "Implement E3" — execute E3-DIRECTIVE.md. Vertex SDK + google.ts
    wrapper + real adapter + cache + image-prep + embedding + cost +
    circuit breaker + quota + prompt-builder + caption-guard + engine
    orchestration. PREREQUISITE: E2 must be merged. ~3-4 hrs Claude work.
    Founder reviews PR before merge.

(c) "Compose E5 directive" — clustering: HDBSCAN over asset_embeddings
    + cluster naming via gemini-2.5-pro + UI banner trigger. Mechanical
    wrapping; composes against the four ratified artifacts. ~30-40 min.
    Last AI-track architecture artifact except E6 (UI).

(d) "Ratify F1" — read docs/pricing/PRICE-ENGINE-ARCHITECTURE.md;
    approve, push corrections, or revise. After ratification, compose
    F1.5 calibration directive. Different track from AI pipeline; runs
    in parallel. ~30-60 min.

(e) "Cleanup the 8 pre-existing tsc errors" — quiet maintenance.
    reaper FFF env var, storage-bridge DerivativeRole, v2-mock-scenarios
    literals, v3-state.test casts, upload-selectors AssetFormat re-export,
    computeAcceptAIDispatches DuplicateStatus literal. ~20 min.

Default if I say "proceed": (a) — Verify E2 + open PR. The implementation
files exist on disk and pass tsc; on-machine verification (vitest, migration
apply, rollback) is the last gate before merge. Once E2 is on main, E3
implementation (b) is unblocked. (c) E5 composition can run any time —
either while E2/E3 implementation cycles run, or in a separate session.

Tell me which.
```

---

## 7. One-shot prompts (for specific actions)

### "Compose E4 directive"

```
Per src/lib/processing/AI-PIPELINE-BRIEF.md v2 §8 + E3 §21 Out of scope §1-3,
E4 wires the AI pipeline into the worker infrastructure that PR 4 already shipped.

Compose src/lib/processing/E4-DIRECTIVE.md specifying:

1. dispatcher.ts extension — add dispatchAssetProposalForProcessing(assetId, storage)
   mirroring dispatchAssetForProcessing pattern; reuses
   makeMediaRowAdapter / storage-bridge but operates on asset_proposals
2. commit-service.ts hook — fire-and-forget
   dispatchAssetProposalForProcessing alongside the existing derivative
   dispatch
3. reaper.ts extension — sweep stuck asset_proposals rows past
   FFF_PROCESSING_TIMEOUT_SECONDS; same logic as the asset_media reaper
4. scripts/process-derivatives.ts extension — claim asset_proposals
   pending rows alongside asset_media pending rows; share the FOR UPDATE
   SKIP LOCKED pattern
5. Worker-level retry-once behavior (per E1 v2 §4.2 step 12) — increment
   retry_count; if retry_count < 1, set status back to pending; else
   set status='failed'
6. Tests: end-to-end pending → ready transition with mock vertex adapter;
   reaper test for stuck asset_proposals

Compose more cleanly AFTER E2/E3 implementation ships — but the directive
itself can compose either way.

Bounded ~30-45 min Claude work.
```

### "Verify E2 + open PR"

```
E2 implementation files were written 2026-04-27 evening but the on-machine
verification gates were sandbox-blocked (linux-arm64 binding gap; no
supabase CLI in sandbox). Run the gates locally and open the PR if green.

Files written this session (all already on disk):
- supabase/migrations/20260427000004_ai_pipeline_e2_schema.sql
- supabase/migrations/_rollbacks/20260427000004_ai_pipeline_e2_schema.DOWN.sql
- src/lib/ai-suggestions/{types,schema,models,audit,settings,engine}.ts
- src/lib/ai-suggestions/adapters/{types,index,mock-vision,vertex-vision}.ts
- src/lib/ai-suggestions/__tests__/{schema,models,audit,settings,engine.mock-flow}.test.ts

Verification gates (per E2 §7):
  npx tsc --noEmit 2>&1 | grep -cE "error TS"
  # Expected: 8 (pre-existing baseline; already-confirmed via sandbox)

  bun run test src/lib/ai-suggestions/__tests__/
  # Expected: all 5 test files pass; ~49 cases

  supabase db reset
  supabase db push
  psql "$DATABASE_URL" -c "\dt asset_proposal* ai_pipeline_settings"
  psql "$DATABASE_URL" -c "
    SELECT relname, relrowsecurity FROM pg_class
    WHERE relname IN ('asset_proposals','asset_proposal_clusters',
                      'asset_proposal_audit_log','ai_pipeline_settings');
  "
  psql "$DATABASE_URL" -c "
    SELECT singleton_key, daily_cap_cents, monthly_cap_cents
    FROM ai_pipeline_settings;
  "

  # Rollback test:
  psql "$DATABASE_URL" -f \
    supabase/migrations/_rollbacks/20260427000004_ai_pipeline_e2_schema.DOWN.sql
  psql "$DATABASE_URL" -c "\dt asset_proposal*"  # expect: no rows
  supabase db push  # re-apply forward

  bun run build 2>&1 | tail -5
  # Expected: build exits 0; route count unchanged (no new routes)

If all green, open PR per E2 §8 approval gate.
```

### "Implement E2" (skip — E2 implementation already written this session)

E2 files are on disk; use "Verify E2 + open PR" instead.

### "Implement E3"

```
Execute src/lib/processing/E3-DIRECTIVE.md.

PREREQUISITE: E2 must be merged (E3 reads asset_proposals + ai_pipeline_settings tables E2 creates).

Scope (~15 new TS files + 2 migrations + 8 new tests + 1 manual-QA script):
- @google-cloud/vertexai SDK install (verify package selection at install time)
- users.ai_region migration (= Phase 4.B.5a absorbed)
- src/lib/ai/google.ts Vertex client wrapper (focused subset)
- src/lib/ai-suggestions/{cache,image-prep,embedding,cost,circuit-breaker,quota,prompt-builder,caption-guard}.ts
- src/lib/ai-suggestions/adapters/vertex-vision.ts real implementation
- engine.ts orchestration update
- FFF_AI_REAL_PIPELINE env flag wiring (default false)

Verification gates per E3 §18:
1. tsc clean (8 baseline; no new errors)
2. vitest green (all new tests pass)
3. Both new migrations apply + roll back cleanly
4. Build green; Vertex SDK NOT in client bundle
5. cost.ts has zero null pricing values
6. Engineer-local Vertex smoke test passes (manual; not CI)
7. Rollback works
8. tsc baseline preserved

Approval gate per E3 §19: founder reviews PR before merge.

NO worker dispatch. NO UI. NO production env activation.

~3-4 hrs Claude work; bounded; founder reviews PR.
```

### "Ratify F1"

```
Read docs/pricing/PRICE-ENGINE-ARCHITECTURE.md (composed 2026-04-26).
Per CLAUDE.md item 11 + 14, evaluate:
- Coherence with PRICE-ENGINE-BRIEF v3
- No drift from L6 (price never bulk-accepted; no per-field → all)
- Open decisions clearly bracketed
- Founder calibration items (252+63 cells) clearly scoped

Verdict: approve / approve-with-corrections / revise / reject.

If approved: compose F1.5 calibration directive (CSV template for the cells
+ SQL seed migration shape + validation rules).

~30 min read + 30-45 min compose F1.5 if approved.
```

### "Compose E5 directive"

```
Per AI-PIPELINE-BRIEF v2 §4.3 + §8 + E1.5 §9, E5 is the Class B
clustering job. Mechanical wrapping; composes against E1 v2 + E1.5 +
E2 + E3 + E4 (all ratified).

Compose src/lib/processing/E5-DIRECTIVE.md specifying:

1. Trigger semantics (upload_batches state transition to 'committing'
   OR explicit creator "Re-analyze session" action)
2. HDBSCAN clustering library selection — Node-compatible package
3. Query pattern — read embeddings from asset_embeddings WHERE
   asset_id IN (batch assets); join captured_at + caption from
   vault_assets + asset_proposals
4. Cluster naming via gemini-2.5-pro per E1.5 §9 (prompt + fallback
   to date range)
5. asset_proposal_clusters write + asset_proposals.cluster_id update
6. Silhouette floor enforcement (< 0.30 → not surfaced)
7. ai_analysis cache for cluster naming (E1.5 §9.5)
8. Worker integration — new dispatchBatchClusteringForProcessing
   in dispatcher; commit-service hook on batch state change
9. Tests — fixture batch with known clusters; reproducibility;
   silhouette floor; cache hit/miss for cluster naming

PREREQUISITE: E2 + E3 + E4 implementations shipped (E5 reads
asset_embeddings populated by E3, asset_proposals.cluster_id field
from E2, worker pattern from E4).

~30-40 min Claude work. Founder ratifies before E5 implementation
begins.
```

### "Cleanup the 8 pre-existing tsc errors"

```
Eight tsc errors have been tolerated as known pre-existing tech debt across
multiple commits. Audit and fix them.

Targets:
1. src/lib/processing/reaper.ts:157 — FFF_PROCESSING_TIMEOUT_SECONDS missing
   from env type. Add to env schema.
2. src/lib/processing/storage-bridge.ts:62 — string assigned to DerivativeRole.
   Narrow at the assignment site.
3. src/lib/upload/__tests__/v3-state.test.ts:43-44 — Record<string, unknown>
   cast. Convert via 'as unknown as Record<...>' OR redefine the test.
4. src/lib/upload/upload-selectors.ts:30 — AssetFormat not exported from
   v2-types. Add the export.
5. src/lib/upload/v2-mock-scenarios.ts:982 — 'provenance_pending' /
   'provenance_intermediate' not in ValidationDeclarationState. Either
   add to the type or fix the literals.
6. src/lib/upload/v2-mock-scenarios.ts:990 — 'EDITORIAL' (uppercase) not
   in LicenceType ('editorial' lowercase). Lowercase the literal.
7. src/app/vault/upload/_components/lib/__tests__/computeAcceptAIDispatches
   .test.ts:79 — 'unique' not in DuplicateStatus. Either add to the type
   (probably 'likely_duplicate') or fix the literal.

Run vitest after each batch to confirm tests still pass.
~20 min total.
```

---

## 8. State to verify on session start

Run these to ground the new agent in current repo state:

```bash
# Confirm AI-track artifacts are on disk + at expected revisions
ls -la src/lib/processing/AI-PIPELINE-BRIEF.md \
       src/lib/processing/AI-PIPELINE-ARCHITECTURE.md \
       src/lib/processing/E2-DIRECTIVE.md \
       src/lib/processing/E3-DIRECTIVE.md
# Expected: all four exist

# Confirm E1 v2 status header
head -3 src/lib/processing/AI-PIPELINE-BRIEF.md
# Expected: Status line says "REVISED 2026-04-27 (v2)"

# Confirm tests still green (carry-over from morning wrap)
npx vitest run --reporter=basic 2>&1 | tail -5
# Expected: "Tests 1898 passed | 30 skipped" (no AI-track tests yet — those land in E2 implementation)

# Confirm tsc baseline
npx tsc --noEmit 2>&1 | grep -cE "error TS"
# Expected: 8

# Confirm no AI-track schema yet (E2 not implemented)
psql "$DATABASE_URL" -c "\dt asset_proposals" 2>&1 | grep -c "Did not find"
# Expected: 1 (table doesn't exist; E2 implementation creates it)

# Confirm shipped pgvector infra still in place (load-bearing for E3)
psql "$DATABASE_URL" -c "\dt asset_embeddings ai_analysis audit_log"
# Expected: 3 rows

# Confirm git state
git status
# Expected: working tree clean; main + any feature branch state

git log --oneline -10
# Expected: recent commits visible; no AI-track implementation commits yet
```

If any return surprising results, the session state has drifted — re-read this wrap doc + spot-check via direct file reads.

---

## 9. Don't-do list (carryover + new for AI track)

To save the next session from common mistakes:

### Carryover from morning wrap (all still binding):

1. **Don't re-litigate the 6 V4 directives that shipped morning of 2026-04-27.** D2.9 + D2.9-followup + D2.10 + D2.10-followup + dnd-kit-fix all landed via PR #15. The UI is complete. New work amends, not rebuilds.
2. **Don't bulk-accept prices.** Per L6 + UX-SPEC-V4 §9.2 + PRICE-ENGINE-BRIEF v3 §11.16. Single rule asserted across multiple directives. The per-field `→ all` button is deliberately absent for price.
3. **Don't auto-fill story metadata to assets.** Per D2.10 founder pick (option b — explicit creator action).
4. **Don't use authoritative AI / certification language.** Per BP-D7 audit. Allowed: "AI suggestion," "AI-flagged," "comparable to," "based on." Forbidden: "AI-verified," "certified," "validated," "true value."
5. **Don't make Story groups a primary visual concept.** Optional overlay per UX-BRIEF v3 §4.3.
6. **Don't suppress or rename the dnd-kit hydration warning silence.** It's `suppressHydrationWarning` on `ContactSheetCard.tsx`'s drag root + `useId()`-seeded DndContext id.
7. **Don't reintroduce a 4-stage wizard for `/vault/upload`.** UX-BRIEF v3 + UX-SPEC-V4 are both single-screen / 3-region.
8. **Don't break the V2 parity contract.** v3-state-parity.test.ts (76 fixture-driven cases) must stay green.
9. **Don't expose engine recommendations to buyers.** Per PRICE-ENGINE-BRIEF v3 F5: out of scope for v1.
10. **Don't activate any worker process beyond `scripts/process-derivatives.ts`.** PR 4 = Path B = single-server in-process orchestration.
11. **Don't load multiple currencies into format_defaults in v1.** EUR only per F1 §5.2.
12. **Don't skip the audit-first step on any new PR plan.** Multiple bugs caught by audit-first throughout the program — including tonight's E1 v2 reversal.

### New for the AI track:

13. **Don't switch the AI vendor without retracting D6 + D8 explicitly.** D6 is "Google for everything"; D8 is per-creator EU/US residency. Anthropic violates both (US-only API; "Google for everything" framing). Tonight's E1 v2 supersedes E1 v1's Anthropic choice; any future Anthropic-or-other-vendor proposal must include explicit retraction of D6 + D8 + (if applicable) D7 + D9 + D-U2 in `INTEGRATION_READINESS.md` and `PLATFORM_REVIEWS.md` before it can land in any AI brief.
14. **Don't introduce a second visual-embedding column or vector dimension.** Reuse `asset_embeddings(extensions.vector(768))` shipped 2026-04-19 per D7. If clustering quality demands `multimodalembedding@001` (1408-dim), that's a deliberate v2 migration, not a parallel column.
15. **Don't bypass per-region routing.** Every Vertex call goes through the regional client based on `users.ai_region` per D8. Cross-region fall-through is forbidden (residency is binding).
16. **Don't use the Gemini Developer API.** Vertex AI endpoint only per D9. Data-out-of-training is a creator-trust commitment.
17. **Don't send `watermarked_preview` to Vertex Vision.** That derivative has the Frontfiles watermark bar baked in — Gemini will see it and contaminate the caption. Always resize from `original` per E1.5 §6.
18. **Don't ship clustering as v2 work.** D-U2 says clustering is v1 HARD launch gate. E1 v1 violated this; E1 v2 corrects it. E5 directive (clustering) is part of v1 scope.
19. **Don't auto-accept any proposal into authoritative metadata.** Per E1 §3 E6, every acceptance is creator action. The AI never writes to `vault_assets.{title, description, tags}` directly.
20. **Don't expose AI cost to creators in v1.** Platform-paid; cost captured for future metering.
21. **Don't skip the audit log on any proposal event.** Generation, accept, override, dismiss, cluster_proposed/accepted/dismissed all logged from v1.
22. **Don't introduce a new worker process for AI.** Reuse the PR 4 worker via dispatcher extension (E4). One worker, three job types (derivatives + per-asset proposals + cluster proposals).
23. **Don't merge E3 with `null` Vertex pricing values in `cost.ts`.** Verification gate #5 in E3 §18 enforces this — pricing must be verified against the live Vertex pricing page at ship time.
24. **Don't merge E3 with `VERIFY_AT_E3_SHIP` strings in `models.ts`.** Verified version pins required before merge per E3 §19 approval gate.
25. **Don't activate `FFF_AI_REAL_PIPELINE` in any deployed env until E4-E6 land.** PR ships dormant; production cutover is a separate flag flip.
26. **Don't compose E5 directive (clustering) before E3 implementation ships.** The clustering directive depends on `asset_embeddings` being actively populated by E3's per-asset job; designing the clustering against an empty table risks design errors that E3-shipped data would expose.

---

## 10. Material that shipped this session (file-level)

### Architecture artifacts (in `src/lib/processing/`):

- **`AI-PIPELINE-BRIEF.md` v2** — full re-write in place; revision history in §13 documents the Path B reversal
- **`AI-PIPELINE-ARCHITECTURE.md`** — new file (E1.5 detail brief)
- **`E2-DIRECTIVE.md`** — new file (E2 directive)
- **`E3-DIRECTIVE.md`** — new file (E3 directive)
- **`E4-DIRECTIVE.md`** — new file (E4 directive)

### E2 implementation (written but NOT yet merged):

In `supabase/migrations/`:
- `20260427000004_ai_pipeline_e2_schema.sql` — 4 tables (`asset_proposals`, `asset_proposal_clusters`, `asset_proposal_audit_log`, `ai_pipeline_settings`) with RLS service-role-only, CHECK constraints, indexes, comments, settings singleton seed
- `_rollbacks/20260427000004_ai_pipeline_e2_schema.DOWN.sql`

In `src/lib/ai-suggestions/`:
- `types.ts` — UserAiRegion + VertexRegion split; ProposalEventType; GenerationStatus; AuditSurface
- `schema.ts` — Zod schemas for VisionResponse, ProposalRecord, ClusterRecord, AuditEvent
- `models.ts` — MODELS constants (gemini-2.5-flash, gemini-2.5-pro, text-embedding-004)
- `audit.ts` — `writeAuditEvent` to asset_proposal_audit_log (Zod-validated insert)
- `settings.ts` — `getEffectiveSettings` reader with 60s in-process cache + 10% dev/preview multiplier
- `engine.ts` — `generateAssetProposal` (E2 thin pass-through; E3 expands)
- `adapters/types.ts` — VisionAdapter contract with token counts
- `adapters/index.ts` — `getAdapter` with FFF_AI_REAL_PIPELINE live-read gate
- `adapters/mock-vision.ts` — deterministic fixtures for all 7 AssetFormat values
- `adapters/vertex-vision.ts` — production stub throwing NotImplementedError

In `src/lib/ai-suggestions/__tests__/`:
- `schema.test.ts` — ~22 cases on Zod schemas
- `models.test.ts` — 5 cases on MODELS pin constants
- `audit.test.ts` — 5 cases on audit-log writer (vi.mock'd supabase)
- `settings.test.ts` — 11 cases — prod vs dev multiplier, caching, errors, NUMERIC coercion
- `engine.mock-flow.test.ts` — 6 cases — end-to-end mock-mode flow per format + production-stub throw

**E2 verification status:**
- ✅ tsc baseline preserved (8 errors; no new errors)
- ⚠ vitest sandbox-blocked (linux-arm64 binding gap; npm optional-deps bug); must run on macOS
- ⚠ migration apply + RLS verify + rollback test pending (sandbox lacks supabase CLI / DATABASE_URL)
- ⚠ no PR opened yet — gated on on-machine verification

---

## 11. Footer

This wrap is the AI-track entry point for the next session. The morning wrap (`docs/SESSION-WRAP-2026-04-27.md`) remains the canonical platform-state document for everything OUTSIDE the AI track.

The AI pipeline architecture is now fully specified through worker integration — vendor pin, prompts, image-prep, cache, embedding, region routing, circuit breaker, cost capture, schema, skeleton, real adapter, env flag, dispatcher hook, reaper extension, commit-service wiring, script extension. **E5 (clustering) and E6 (UI integration) are the only AI-track architecture artifacts not yet composed.** E5 is mechanical (~30-40 min) against the 5 ratified artifacts; E6 depends on UX-SPEC-V4 + V4 components shipped via PR #15.

E2 implementation files are on disk + sandbox-static-verified; the next concrete on-machine action is the verification gate run + PR open (~15 min).

The hardest decisions in the AI track are all made. The remaining work is on-machine verification of E2 + execution of E3/E4 implementation + composition of E5/E6 + (founder-side) GCP credentials provisioning + Vertex pricing verification at ship time.

---

End of AI-track session wrap (2026-04-27, evening — updated to absorb E4 directive + E2 implementation).
