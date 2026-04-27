# Session Wrap — 2026-04-26

> ⚠ **STALE — superseded by `docs/SESSION-WRAP-2026-04-27.md`.**
> The "ratify C1 + compose C2" default opener in this doc is no longer
> meaningful: C1 ratified + C2 shipped + D2.1→D2.10 + follow-ups + dnd-fix
> all landed between 2026-04-26 and 2026-04-27. Use the newer wrap for
> resume; this one is kept as a historical record only.

**Status:** Active handoff. Use the RESUME PROMPT in §6 for a fresh Claude session.
**Supersedes:** `docs/upload/NEXT-SESSION.md` (from 2026-04-25; that doc covered upload Phase A only and is now stale)
**Session scope:** Vault upload Phase A briefs ratified, Phase B backend shipped (PRs 1.3 + 3 + 4), BP/Watermark trust-language defensive pass shipped, Phase C C1 UX spec composed, Phase E1 AI architecture brief composed, Phase F1 price engine architecture brief composed.

---

## 1. What this doc is

A cold-start handoff. Drop the RESUME PROMPT in §6 into a fresh Claude (chat or Code) and the new agent picks up where this session stopped. The agent reads the docs listed in §4 before responding, and ratifies / acts on the gates in §5.

If you want to do something specific, jump to §7 (one-shot prompts).

---

## 2. State of the world (what shipped this session)

### Architecture (4 governing briefs composed; awaiting ratification or already ratified)

| Pillar | Brief(s) | Status |
|---|---|---|
| **Vault upload UI direction** | `docs/upload/UX-BRIEF.md` v3 | ✅ Ratified |
| **Vault upload UI shell + components** | `docs/upload/UX-SPEC-V3.md` (C1) | Composed; **awaits ratification** |
| **Price engine** | `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 + `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (F1) | v3 ratified; F1 **awaits ratification** |
| **AI suggestion pipeline** | `src/lib/processing/AI-PIPELINE-BRIEF.md` (E1) | Composed; **awaits ratification** |
| **Derivative pipeline** | `src/lib/processing/IMPLEMENTATION-PLAN.md` + `PR-1.3-PLAN.md` + `PR-3-PLAN.md` + `PR-4-PLAN.md` | All ratified; PRs 1.3 + 3 + 4 shipped |

### Backend (Phase B — fully shipped this session, dormant behind `FFF_REAL_UPLOAD=false`)

| PR | Scope | Files touched | Tests |
|---|---|---|---|
| **PR 1.3** | `/api/upload` batch-aware (X-Batch-Id required); 21-arg upload_commit; 15-arg dropped; 5 new fields threaded | 7 files (1 migration + 4 source + 2 tests) | +8 new + 5 fix-ups |
| **PR 3** | Derivative row enqueue on commit; 3 roles (thumbnail / watermarked_preview / og_image); stay-pending policy correction | 7 files (1 migration + 1 module + 1 test + 1 plan + 3 modifications) | +11 new |
| **PR 4** | Path B worker activation; storage bridge + media-row-adapter + reaper + script; pipeline policy fix; commit-service dispatch hook | 11 files (1 migration + 4 modules + 3 modifications + 2 new tests + 1 updated test) | +12 new + 1 updated |

**Pre-merge gate verified:** zero remaining 15-arg `upload_commit` callers in application code.

### Trust-language defensive pass (BP / Watermark)

Shipped: BP-D7 audit + BP-D7-IMPL. 5 high-severity copy corrections applied across 9 files. Most consequential:
- Checkout buyer-acknowledgment language (FCS proper-noun removed)
- TrustBadge default labels neutralized ("Frontfiles Creator" / "Protected Source" instead of "Verified Creator" etc.) until BP-D5 ships earning logic
- Composer "FCS Layer 4 Assembly" softened to "assembly verified"
- Mock-data FCS layer references cleaned
- "FCS Spotlight" recommendations title → "Editor's Pick"

### Audits produced this session

- `docs/audits/UPLOAD-PR3-AUDIT-2026-04-26.md` (with correction note about migration scope)
- `docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md`
- `docs/audits/BLUE-PROTOCOL-CEL-VERIFICATION-2026-04-26.md`
- `docs/audits/BLUE-PROTOCOL-TRUST-BADGE-VERIFICATION-2026-04-26.md`
- `docs/audits/BLUE-PROTOCOL-FCS-VERIFICATION-2026-04-26.md`
- `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md`
- `docs/audits/BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md` (BP-D + WM-D directive list)

---

## 3. The four pending ratification gates

Before any new implementation directive composes, these are the gates:

| Gate | Brief | Blocks | Recommendation if you ratify |
|---|---|---|---|
| **C1** | `docs/upload/UX-SPEC-V3.md` | C2-C6 implementation (UI shell + state) | Compose C2 directive (~90 min focused) |
| **E1** | `src/lib/processing/AI-PIPELINE-BRIEF.md` | E1.5 + E2-E6 implementation | Compose E1.5 detail brief (model pin + prompt text + confidence values) |
| **F1** | `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` | F1.5 calibration + F2 schema | Compose F1.5 calibration directive (founder-led spreadsheet) |
| **PR 5 cutover** | Combined gate | Production go-live | Requires C2-C6 done + E2-E6 done + F2-F11 done + WM-D1 + WM-D3 |

The 4 don't have to ratify together; each can ratify independently and unblocks its own track.

---

## 4. Documents to read on session start

Read in this order. Skim §1 + §3 of each unless full read needed for a specific task.

### Tier 1 — Always read on resume (~15 min total)

| Order | Path | Why | Read budget |
|---|---|---|---|
| 1 | `docs/SESSION-WRAP-2026-04-26.md` (this doc) | Session state + resume options | 5 min |
| 2 | `docs/upload/UX-BRIEF.md` v3 | Locked: 8 product decisions; 3 architectural pillars | 5 min |
| 3 | `/Users/jnmartins/dev/frontfiles/CLAUDE.md` (root) | Standing posture (audit-first, propose-before-lock, etc.) | 2 min if not already loaded |

### Tier 2 — Read for the relevant track

If working on **UI (Phase C)**:
- `docs/upload/UX-SPEC-V3.md` — concrete component spec
- `src/components/upload-v2/README.md` — what's being replaced
- `src/lib/upload/v2-types.ts` — preserved data model

If working on **AI pipeline (Phase E)**:
- `src/lib/processing/AI-PIPELINE-BRIEF.md` — locked architecture
- `docs/upload/UX-SPEC-V3.md` §9 — proposal surfacing visual treatment
- `src/lib/processing/PR-4-PLAN.md` — worker infrastructure being reused

If working on **Price engine (Phase F)**:
- `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 — high-level architecture
- `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (F1) — detail brief
- `src/lib/offer/pricing.ts` — existing fee decomposition (preserved)

If working on **Backend continuation (PR 5+)**:
- `src/lib/processing/IMPLEMENTATION-PLAN.md` — 8-PR sequence
- `src/lib/processing/ARCHITECTURE-BRIEF.md` — invariants
- `src/lib/upload/PR-1.3-PLAN.md` + `src/lib/processing/PR-3-PLAN.md` + `PR-4-PLAN.md` — what shipped

If working on **Blue Protocol track**:
- `.claude/agents/frontfiles-blue-protocol.md` — agent definition
- `docs/audits/BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md` — 8 BP-D directives
- The 3 BP-D4 verification audits

If working on **Watermark retirement (D1.5)**:
- `docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md`
- `docs/upload/UX-BRIEF.md` v3 §6 D1.5 (the spec)

---

## 5. Founder action items NOT requiring Claude

These can happen between sessions or at the start of a new session, no Claude composition needed:

1. **WM-D1** — `/dev/watermark-approval`, approve at least one watermark profile per (intrusion_level × template_family) pair. ~15 min. **Blocks PR 5 cutover.**
2. **WM-D3** — pick `none → light` or `none → standard` for legacy `watermark_mode` mapping. ~1 min. **Blocks PR 8.**
3. **F1.5 calibration** — fill the 252-cell `format_defaults` spreadsheet + 63-cell platform floors. **Blocks F3 adapter.** Can use Claude to compose the spreadsheet template; the values themselves are founder-input.
4. **BP-D1 commissioning** — decide whether to commission `CANONICAL_SPEC.md` drafting now or defer. If now, point Claude at source material.
5. **Ratification of the 3 pending briefs** — read C1 + E1 + F1; either approve in place or push corrections back.

---

## 6. RESUME PROMPT (paste into fresh session)

```
I'm resuming work on the Frontfiles platform after a substantial session ended on 2026-04-26.

The session wrap is at:
  docs/SESSION-WRAP-2026-04-26.md

Before responding, read these in order:
  1. docs/SESSION-WRAP-2026-04-26.md (the wrap; ~10 min)
  2. docs/upload/UX-BRIEF.md v3 (locked architecture; 5 min)
  3. /Users/jnmartins/dev/frontfiles/CLAUDE.md (standing posture)

Standing posture per CLAUDE.md:
- Audit first; never jump to implementation
- Propose before locking; explicit IPs surfaced as HALT
- Architecture before implementation
- Tight per-directive commits with selective stage
- Founder ratifies before code

Current state (after the prior session):

PHASE A — All briefs ratified:
- UX-BRIEF.md v3 (Q1-Q8 locked; vault upload UI direction)
- PRICE-ENGINE-BRIEF.md v3 (price engine scope; trust posture)

PHASE B — Backend fully shipped (dormant behind FFF_REAL_UPLOAD=false):
- PR 1.3 shipped (batch-aware /api/upload; 21-arg upload_commit; 15-arg dropped)
- PR 3 shipped (derivative row enqueue on commit; 3 roles)
- PR 4 shipped (Path B worker; storage bridge + media-row-adapter + reaper + script;
  pipeline stay-pending policy fix; commit-service dispatch hook)

BP/WATERMARK — Trust-language defensive pass shipped:
- BP-D4 verification audits (CEL partial, Trust Badge implemented-with-drifts, FCS not-implemented)
- BP-D7 + BP-D7-IMPL: 5 high-severity copy corrections shipped across 9 files
- Other BP-D directives queued for separate workstream

PHASE C — C1 spec composed; awaits ratification:
- docs/upload/UX-SPEC-V3.md (single-screen / 3-region / 4 density modes / AI proposal surfacing /
  exception model / commit flow / accessibility)
- C2-C6 blocked on C1 ratification

PHASE E — E1 brief composed; awaits ratification:
- src/lib/processing/AI-PIPELINE-BRIEF.md (per-asset proposals v1; clustering v2;
  Anthropic Claude Vision; advisory trust posture; reuses PR 4 worker infrastructure)
- E1.5 + E2-E6 blocked on E1 ratification

PHASE F — F1 architecture composed; awaits ratification:
- docs/pricing/PRICE-ENGINE-ARCHITECTURE.md (composer algorithm; format_defaults
  structure 252 cells; platform floors 63 cells; 9 PRICE-ENGINE-BRIEF v3 IPs resolved;
  EUR-only v1; on-view refresh; quarterly recalibration)
- F1.5 (founder calibration) + F2 schema blocked on F1 ratification

PHASE D (PR 5 cutover) — Blocked on B + C + E + F all complete + WM-D1 + WM-D3.

Pending founder actions (no Claude composition needed first):
1. WM-D1 — approve watermark profiles at /dev/watermark-approval (~15 min)
2. WM-D3 — pick none → light or none → standard for legacy mapping (~1 min)
3. Ratify C1 + E1 + F1 (read + approve or push corrections)
4. Decide on BP-D1 (CANONICAL_SPEC.md) commissioning timing
5. F1.5 calibration spreadsheet (252 + 63 cell values; founder-input data)

Five reasonable next-session opener directives — pick one and we go:

(a) "Ratify C1 + compose C2" — turns the UX spec into the new shell + state
    implementation. Substantial; ~90+ min focused. Highest direct progress
    on the UI surface.

(b) "Compose E1.5" — AI architecture detail brief: model pin, prompt text,
    confidence values, per-format treatment, image size strategy, pgvector
    verification. Founder ratifies before E2 schema migration. ~60 min.

(c) "Compose F1.5 calibration directive" — produces the spreadsheet template
    and the SQL seed migration shape; founder fills the 252+63 cells.
    Bounded; ~30-45 min Claude work + founder calibration time.

(d) "Compose D1.5 plan (System B watermark retirement)" — once founder confirms
    WM-D1 is done and PR 5 is targeted, compose the System B retirement PR
    plan. Currently triple-gated (PR 5 live + non-zero real creator usage +
    profiles approved + visually verified). Probably defer until Phase D
    is closer to ready.

(e) "Open BP track in earnest" — compose BP-D1 (land CANONICAL_SPEC.md).
    Independent of the upload rebuild. Substantial; touches the Blue Protocol
    agent's first responsibility.

Default if you say "proceed": (a) — Ratify C1 + compose C2. The UI is now the
critical-path bottleneck for PR 5 cutover; all other tracks (E, F) can run in
parallel with C without blocking each other.

Tell me which.
```

---

## 7. One-shot prompts (for specific actions)

### "Just compose C2 — skip the ratification pause"

```
Per docs/upload/UX-SPEC-V3.md (composed 2026-04-26 in prior session), the spec is
the implementation target for Phase C C2. Treat the spec as ratified.

Compose the C2 implementation directive:
1. Audit-first read of src/components/upload-v2/* current state
2. Compose docs/upload/C2-PLAN.md specifying:
   - New page surface at /vault/upload (replacing UploadShellV2)
   - New reducer with action set derived from UX-SPEC-V3 §3-§9 interactions
   - Action set should preserve V2Asset shape (per UX-BRIEF v3 §4.7)
   - Mock simulation wired to new state shape (test fixture preserved)
   - Tests strategy
3. Surface IPs as HALT before implementation begins

Standing posture per CLAUDE.md: audit-first; founder ratifies plan before code.
```

### "Compose F1.5 calibration directive"

```
Per docs/pricing/PRICE-ENGINE-ARCHITECTURE.md (composed 2026-04-26) §3.3 + §4.3,
F1.5 is the founder calibration pass: fill format_defaults (252 cells) + platform
floors (63 cells) with values informed by offline reference sources.

Compose docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md specifying:
1. Spreadsheet template (CSV format) for the 252 + 63 cells
2. Calibration source recommendations (fotoQuote, Getty rate cards, etc.) with
   explicit "external sources inform initial values; never cited at runtime" note
3. SQL seed migration shape that converts the filled spreadsheet to seed inserts
4. Validation rules (e.g., "every cell must have a baseline_cents > 0")
5. Founder review checkpoint before F2 schema migration ships

This is bounded ~30-45 min Claude composition. Then founder fills the cells.
```

### "Compose E1.5 architecture detail brief"

```
Per src/lib/processing/AI-PIPELINE-BRIEF.md (composed 2026-04-26) §10, E1.5
is the architecture detail brief that resolves the 10 open decisions in §9.

Compose src/lib/processing/AI-PIPELINE-ARCHITECTURE.md specifying:
1. Exact Anthropic model pin (claude-sonnet-4-6 vs successor) + bump policy
2. Prompt text per format (photo / illustration / infographic / vector)
3. Confidence floor values (current proposals: 0.3 / 0.75 / 0.3 silhouette)
4. Per-format treatment details
5. Image size strategy (send original vs reuse derivative)
6. pgvector availability verification (check Supabase config)
7. Tag taxonomy size (top 50 hint)
8. Cost ceiling + behavior on exceedance

E1.5 is the gate before E2 schema migration. Founder ratifies E1.5 explicitly.
```

### "Skip to implementation — start C2"

```
Per docs/upload/UX-SPEC-V3.md (composed 2026-04-26), treat C1 as ratified
implicitly. Skip the C2-PLAN composition step. Compose the implementation
directive directly:

Phase 1: New page surface at /vault/upload
  - Replace UploadShellV2 (kept around as legacy)
  - Build new shell with the 3 regions per UX-SPEC-V3 §2

Phase 2: New reducer + state
  - Action set per the interactions in UX-SPEC-V3 §3-§9
  - Preserve V2Asset shape per UX-BRIEF v3 §4.7

Phase 3: Wire to mock simulation for testing
  - Reuse existing mock scenarios from src/lib/upload/v2-mock-scenarios.ts

Substantial; ~90+ min. Audit-first per CLAUDE.md.
```

---

## 8. State to verify on session start

Run these to ground the new agent in current repo state:

```bash
# Confirm current branch + clean working tree
git status
git log --oneline -10

# Confirm Phase B PRs landed
ls supabase/migrations/20260427*  # should show 3 migrations from this session:
  # 20260427000001_drop_upload_commit_15arg.sql (PR 1.3)
  # 20260427000002_asset_media_pending_nullable.sql (PR 3)
  # 20260427000003_asset_media_processing_started_at.sql (PR 4)

ls src/lib/processing/  # should include enqueue.ts, storage-bridge.ts,
                        # media-row-adapter.ts, reaper.ts (all new this session)

ls scripts/process-derivatives.ts  # PR 4

# Confirm flag still gates production
grep -r "FFF_REAL_UPLOAD" src/app/api/upload/route.ts
# Should still gate; PR 5 hasn't shipped

# Confirm no PR 5 work landed
grep -r "FFF_REAL_UPLOAD" src/lib/upload/v2-state.ts
# v2-state.ts should still be on simulation path

# Confirm BP-D7-IMPL copy fixes shipped
grep "Frontfiles Certification System" src/app/checkout/[assetId]/page.tsx
# Should return ZERO hits — copy was changed
```

If any of those return surprising results, the session state has drifted — re-read this wrap doc + spot-check via direct file reads.

---

## 9. Don't-do list (carryover from earlier wraps + this session)

To save the next session from common mistakes:

1. **Don't rebuild PR 1.3 / PR 3 / PR 4 work.** All three Phase B PRs shipped this session. The backend is functionally complete, dormant behind the flag.
2. **Don't conflate vault upload with newsroom upload.** Newsroom upload (NR-D7a) is separate and already shipped. They share the storage adapter; they do NOT share UX or commit-service.
3. **Don't reintroduce a 4-stage wizard for /vault/upload.** UX-BRIEF v3 + UX-SPEC-V3 are both single-screen / 3-region. Any directive proposing stages is wrong.
4. **Don't make Story groups a primary visual concept.** Optional overlay per UX-BRIEF v3 §4.3.
5. **Don't bulk-accept prices.** Per PRICE-ENGINE-BRIEF v3 §11.16 + AI-PIPELINE-BRIEF E6 + UX-SPEC-V3 §9.2. Single rule asserted three times for cross-brief consistency.
6. **Don't use authoritative AI / certification language.** Per BP-D7 audit. Allowed: "AI suggestion," "AI-flagged," "comparable to," "based on." Forbidden: "AI-verified," "certified," "validated," "true value."
7. **Don't re-litigate the 5-vs-7 ValidationDeclaration drift in upload code.** It's a separate BP track per BP-D directive list. Upload rebuild is compatible with either model.
8. **Don't skip the audit-first step on any new PR plan.** PR-3 audit caught a missing migration that the original IMPLEMENTATION-PLAN.md missed. Audit-first is load-bearing.
9. **Don't compose against `IMPLEMENTATION-PLAN.md` PR 4 prescription verbatim.** PR-4-PLAN.md (Path B) is the ratified path; the older `IMPLEMENTATION-PLAN.md` describes Path A which was not chosen.
10. **Don't load multiple currencies into format_defaults in v1.** EUR only per F1 §5.2.
11. **Don't activate any worker process beyond `scripts/process-derivatives.ts` invocation.** PR 4 = Path B = single-server in-process orchestration. Multi-worker / horizontal is a future evolution, not v1.
12. **Don't expose engine recommendations to buyers.** Per PRICE-ENGINE-BRIEF v3 F5: out of scope for v1. Re-evaluate after trust track record.

---

## 10. Header for the actual code repo state

For convenience, the actual material that shipped this session is concentrated in:

- `docs/upload/UX-BRIEF.md` (v3 — ratified)
- `docs/upload/UX-SPEC-V3.md` (C1 — pending ratification)
- `docs/upload/SESSION-WRAP-2026-04-26.md` (... this is misnamed; actual location is `docs/SESSION-WRAP-2026-04-26.md`)
- `docs/pricing/PRICE-ENGINE-BRIEF.md` (v3 — ratified)
- `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (F1 — pending)
- `src/lib/processing/AI-PIPELINE-BRIEF.md` (E1 — pending)
- `src/lib/processing/PR-3-PLAN.md`, `src/lib/processing/PR-4-PLAN.md`, `src/lib/upload/PR-1.3-PLAN.md`
- `src/lib/processing/{enqueue,storage-bridge,media-row-adapter,reaper}.ts` (PR 3 + PR 4 implementation modules)
- `scripts/process-derivatives.ts` (PR 4 CLI entry)
- `supabase/migrations/20260427000001-3_*.sql` (3 migrations)
- 7 audit docs under `docs/audits/`

---

## 11. Footer

This wrap is the entry point. The original `docs/upload/NEXT-SESSION.md` is now stale (Phase A was ratified mid-session); a small pointer note has been added to it directing future sessions here.

The architecture is fully specified across all three pillars + UI shell. Implementation can resume in any order from a clean spec base.

The hardest decisions are made. The remaining work is execution + founder calibration + ratification.

---

End of session wrap (2026-04-26).
