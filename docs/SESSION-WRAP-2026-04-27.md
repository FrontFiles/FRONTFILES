# Session Wrap — 2026-04-27 (Morning)

> ⚠ **AI-TRACK RESUME OPTIONS SUPERSEDED.** A subsequent evening session
> on 2026-04-27 ratified four AI-track architecture artifacts (E1 v2 +
> E1.5 + E2 + E3 directives). For AI-track resume, read
> `docs/SESSION-WRAP-2026-04-27-AI-TRACK.md` first. Specifically:
> the §6 RESUME PROMPT and §7 one-shot prompts in this morning wrap
> are stale on the AI track — the evening wrap supersedes them.
>
> The rest of this morning wrap (PR #15 merge, V4 redesign, founder
> locks L1-L6, watermark posture, F1/BP-D1/WM-D1/WM-D3 status, the 8
> pre-existing tsc errors) remains the canonical platform-state record.

**Status:** Active handoff for non-AI-track resume. Use the RESUME PROMPT in §6 ONLY for non-AI-track work.
**Supersedes:** `docs/SESSION-WRAP-2026-04-26.md` (the wrap from yesterday — its "ratify C1 + compose C2" default opener is now meaningless; C1+C2 shipped, then D2.1→D2.10 + follow-ups + dnd-fix all landed in two days).
**Superseded on AI track by:** `docs/SESSION-WRAP-2026-04-27-AI-TRACK.md` (the evening wrap; ratifies E1 v2 + E1.5 + E2 + E3 directives).
**Session scope:** D2.9 (layout polish + AI provenance + cover-in-sheet) shipped + D2.9 follow-up corrections + D2.10 (story metadata + per-field apply-to-all + select-all) shipped + D2.10 follow-up (embedded metadata inspector section) shipped + dnd-kit hydration warning silenced. Full V4 upload UI is officially complete and clean.

---

## 1. What this doc is

A cold-start handoff. Drop the RESUME PROMPT in §6 into a fresh Claude (chat or Code) and the new agent picks up where this session stopped. The agent reads the docs listed in §4 before responding, and ratifies / acts on the gates in §5.

If you want to do something specific, jump to §7 (one-shot prompts).

---

## 2. State of the world (what shipped this session)

### 7 commits on `feat/d-upload-v4`, branch now 22 commits ahead of `main`

```
6d4b4f8  fix(upload): suppress dnd-kit hydration warning on draggable card root
41e03e7  fix(upload): silence dnd-kit hydration warning via stable DndContext id
4090090  feat(upload): D2.10 follow-up — Embedded metadata inspector section
91dec35  feat(upload): D2.10 — story metadata + per-field apply-to-all + select-all
f44b0c4  fix(upload): D2.9 follow-up — creative_commons + social toggle + cover-as-first-cell + story membership
f5cae37  feat(upload): D2.9 — layout polish + AI provenance + cover-in-sheet
da4468a  docs(upload): D2.9-DIRECTIVE
```

### What's in each

| Commit | Headline change |
|---|---|
| **D2.9-DIRECTIVE** | Composed + ratified the directive (3 moves: visual reshape / AI provenance / cover-in-sheet). |
| **D2.9 main** | 9 layout moves landed (pane contrast / cards-as-images / inspector preview-first / left-rail visual story navigator at 320px / filter chip recede / spacing rhythm / selection hierarchy / AI provenance tagging via FieldProvenanceTag / cover slot in contact sheet). New components: `FieldProvenanceTag.tsx`, `CoverSlot.tsx`. Deleted: `InspectorAcceptRow.tsx`, `SetAsCoverButton.tsx`. |
| **D2.9 follow-up** | Four flaws surfaced during visual review: creative_commons missing from LicenceType (added to both upload + main type unions), social-licensing toggle (new boolean field on AssetEditableFields), cover slot integrated as first grid cell (was orphaned above), and story membership tracking — pre-existing bug from D2.2 fixed: `MOVE_ASSET_TO_CLUSTER`, `MOVE_ASSET_TO_UNGROUPED`, `CREATE_STORY_GROUP_AND_MOVE`, `SPLIT_CLUSTER`, `MERGE_CLUSTERS`, `REMOVE_FILE` now maintain `proposedAssetIds` + `sequence` correctly. Drop highlight bumped from `bg-blue-50/50` (invisible) to `bg-blue-100`. |
| **D2.10 main** | Story-level metadata (location + date) added to V2StoryGroup. New `UPDATE_STORY_FIELD` action. New `ContactSheetStoryHeader.tsx` component (story name + location + date + "Apply to all in story" button — composes via two BULK_UPDATE_FIELD dispatches). Per-field "→ all" button on inspector fields (title / caption / privacy / social-licensing / tags / geography / licences; **price excluded** per L6). Scope rule: all-in-story when filtered, all-in-batch otherwise. New select-all checkbox in filter-chip area with indeterminate state (visible scope = post-filter, post-search). |
| **D2.10 follow-up** | New `InspectorEmbeddedMetadataSection.tsx` — read-only EXIF / GPS / IPTC dump in the inspector between Exceptions and AI Proposal Detail. Renders nothing useful for synthetic fixtures (extractedMetadata=null) but works for real uploads. |
| **dnd-kit hydration silence (×2)** | First attempt: `useId()`-seeded DndContext id (correct per @dnd-kit/core@6 source but didn't reach rendered DOM in this Next.js 16 + Turbopack combo). Second: `suppressHydrationWarning` on the draggable card root — React's intended escape hatch. Warning silenced; drag behavior unaffected. |

### Numbers

| Metric | Pre-session | Post-session |
|---|---|---|
| `v3-state.test.ts` cases | 75 | **94** (+19) |
| Full vitest suite passing | 1886 | **1898** (+12; the +19 includes some merged-into-existing tests) |
| `v3-state.test.ts` membership-tracking coverage | 0 (manual flow uncovered) | 7 cases for the manual-creation + drag-reorder flow |
| Pre-existing tsc errors | 8 (8 tolerated) | 8 (8 tolerated, zero new) |
| Console warnings on `/vault/upload?scenario=archive_150_mixed` | 1 (dnd-kit hydration) | 0 |

### Founder locks (L1–L6) — all preserved across all 7 commits

L1 reducer authority, L2 V2Asset parity, L3 single-folder coexistence, L4 16:9 lock, L5 bulk-only-when-bulk, L6 price+title never auto-accepted (the only fields without `→ all` button).

---

## 3. The pending ratification gates (unchanged from yesterday's wrap; nothing closed)

| Gate | Brief | Blocks | Recommendation |
|---|---|---|---|
| **E1** | `src/lib/processing/AI-PIPELINE-BRIEF.md` (composed 2026-04-26; pending ratification) | E1.5 + E2-E6 implementation | Compose E1.5 detail brief (model pin + prompt text + confidence values) |
| **F1** | `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (composed 2026-04-26; pending ratification) | F1.5 calibration + F2 schema | Compose F1.5 calibration directive (founder-led 252+63 cell spreadsheet) |
| **PR 5 cutover** | Combined gate | Production go-live | Requires E2-E6 done + F2-F11 done + WM-D1 + WM-D3 |

**C1 / C2 / C3-C6 (UI shell)** — closed. The whole UI is shipped via D2.1→D2.10.

---

## 4. Documents to read on session start

Read in this order. Skim §1 + §3 of each unless full read needed for a specific task.

### Tier 1 — Always read on resume (~15 min total)

| Order | Path | Why | Read budget |
|---|---|---|---|
| 1 | `docs/SESSION-WRAP-2026-04-27.md` (this doc) | Session state + resume options | 5 min |
| 2 | `/Users/jnmartins/dev/frontfiles/CLAUDE.md` (root) | Standing posture (audit-first, propose-before-lock, etc.) | 2 min if not already loaded |
| 3 | `docs/upload/UX-BRIEF.md` v3 | Locked: 8 product decisions; 3 architectural pillars (still the source of truth) | 5 min |

### Tier 2 — Read for the relevant track

If working on **AI pipeline (Phase E)**:
- `src/lib/processing/AI-PIPELINE-BRIEF.md` — locked architecture (E1, awaits ratification)
- `docs/upload/UX-SPEC-V4.md` — proposal surfacing visual treatment (the V3 spec was retired by V4 mid-session-yesterday; D2.1→D2.10 implemented V4)
- `src/lib/processing/PR-4-PLAN.md` — worker infrastructure being reused

If working on **Price engine (Phase F)**:
- `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 — high-level architecture
- `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (F1) — detail brief (awaits ratification)
- `src/lib/offer/pricing.ts` — existing fee decomposition (preserved)

If working on **PR / merge to main**:
- Branch `feat/d-upload-v4` HEAD = `6d4b4f8`, 22 commits ahead of main
- All tests green, zero new tsc errors, zero console warnings
- Ready for PR open

If working on **Blue Protocol track**:
- `.claude/agents/frontfiles-blue-protocol.md` — agent definition
- `docs/audits/BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md` — 8 BP-D directives
- The 3 BP-D4 verification audits

If working on **Watermark retirement (D1.5)**:
- `docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md`
- `docs/upload/UX-BRIEF.md` v3 §6 D1.5 (the spec)

If working on the **8 pre-existing tsc errors** (cleanup):
- `src/lib/processing/reaper.ts:157` — FFF_PROCESSING_TIMEOUT_SECONDS env var
- `src/lib/processing/storage-bridge.ts:62` — DerivativeRole literal
- `src/lib/upload/__tests__/v3-state.test.ts:43-44` — Record cast
- `src/lib/upload/upload-selectors.ts:30` — AssetFormat re-export
- `src/lib/upload/v2-mock-scenarios.ts:982,990` — declaration / licence type literals
- `src/app/vault/upload/_components/lib/__tests__/computeAcceptAIDispatches.test.ts:79` — DuplicateStatus 'unique'

---

## 5. Founder action items NOT requiring Claude

| # | Action | Time | Blocks |
|---|---|---|---|
| 1 | **WM-D1** — `/dev/watermark-approval`, approve at least one watermark profile per (intrusion_level × template_family) pair | ~15 min | PR 5 cutover |
| 2 | **WM-D3** — pick `none → light` or `none → standard` for legacy `watermark_mode` mapping | ~1 min | PR 8 |
| 3 | **F1.5 calibration** — fill the 252-cell `format_defaults` spreadsheet + 63-cell platform floors | hours | F3 adapter |
| 4 | **BP-D1 commissioning** — decide whether to commission `CANONICAL_SPEC.md` drafting now or defer | n/a | independent track |
| 5 | **Ratify E1 + F1** — read both, approve in place or push corrections back | ~30 min | unblocks E2 schema + F2 schema |
| 6 | **Open PR** `feat/d-upload-v4` → `main` | ~5 min | unblocks parallel work |

---

## 6. RESUME PROMPT (paste into fresh session)

```
I'm resuming work on the Frontfiles platform after a substantial session ended on 2026-04-27.

The session wrap is at:
  docs/SESSION-WRAP-2026-04-27.md

Before responding, read these in order:
  1. docs/SESSION-WRAP-2026-04-27.md (the wrap; ~5 min)
  2. /Users/jnmartins/dev/frontfiles/CLAUDE.md (standing posture)
  3. docs/upload/UX-BRIEF.md v3 (locked architecture; 5 min — only if working on upload)

Standing posture per CLAUDE.md:
- Audit first; never jump to implementation
- Propose before locking; explicit IPs surfaced as HALT
- Architecture before implementation
- Tight per-directive commits with selective stage
- Founder ratifies before code

Current state (after the prior session, 2026-04-27):

UPLOAD UI (Phase B/C/D2.x) — COMPLETE
- All Phase B (PR 1.3, PR 3, PR 4) backend shipped, dormant behind FFF_REAL_UPLOAD=false
- All Phase C C2 + V4 redesign D2.1→D2.10 + follow-ups landed
- Branch feat/d-upload-v4 at 6d4b4f8, 22 commits ahead of main
- Tests: 1898 passing, 30 skipped
- TypeScript: 8 pre-existing errors tolerated, zero new
- Console: zero warnings (dnd-kit hydration silenced 2026-04-27)
- All 6 founder locks (L1-L6) preserved

PHASE E (AI suggestion pipeline) — E1 ratification pending
- src/lib/processing/AI-PIPELINE-BRIEF.md composed 2026-04-26
- E1.5 + E2-E6 blocked on E1 ratification

PHASE F (price engine) — F1 ratification pending
- docs/pricing/PRICE-ENGINE-ARCHITECTURE.md composed 2026-04-26
- F1.5 calibration + F2 schema blocked on F1 ratification

PHASE D (PR 5 cutover) — Blocked on E2-E6 + F2-F11 + WM-D1 + WM-D3.

Pending founder actions (no Claude composition needed first):
1. WM-D1 — approve watermark profiles at /dev/watermark-approval (~15 min)
2. WM-D3 — pick none → light or none → standard for legacy mapping (~1 min)
3. Ratify E1 + F1 (read + approve or push corrections)
4. Decide on BP-D1 (CANONICAL_SPEC.md) commissioning timing
5. F1.5 calibration spreadsheet (252 + 63 cell values)
6. Open PR feat/d-upload-v4 → main (~5 min)

Five reasonable next-session opener directives — pick one and we go:

(a) "Open PR feat/d-upload-v4 → main" — ship the 22-commit branch.
    Frees future work to target current main without rebases. Trivial.

(b) "Compose E1.5" — AI architecture detail brief: model pin, prompt text,
    confidence values, per-format treatment, image size strategy, pgvector
    verification. Founder ratifies before E2 schema migration. ~60 min.

(c) "Compose F1.5 calibration directive" — produces the spreadsheet template
    and the SQL seed migration shape; founder fills the 252+63 cells.
    Bounded; ~30-45 min Claude work + founder calibration time.

(d) "Cleanup the 8 pre-existing tsc errors" — quiet maintenance.
    reaper FFF env var, storage-bridge DerivativeRole, v2-mock-scenarios
    literals, v3-state.test casts, upload-selectors AssetFormat re-export,
    computeAcceptAIDispatches DuplicateStatus literal. ~20 min.

(e) "Open BP track in earnest" — compose BP-D1 (land CANONICAL_SPEC.md).
    Independent of the upload rebuild. Substantial; touches the Blue Protocol
    agent's first responsibility.

Default if I say "proceed": (a) — Open PR. The branch is shippable, fully
tested, visually smoke-verified. Sitting unmerged is technical debt.

Tell me which.
```

---

## 7. One-shot prompts (for specific actions)

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
3. Confidence floor values
4. Per-format treatment details
5. Image size strategy (send original vs reuse derivative)
6. pgvector availability verification (check Supabase config)
7. Tag taxonomy size (top 50 hint)
8. Cost ceiling + behavior on exceedance

E1.5 is the gate before E2 schema migration. Founder ratifies E1.5 explicitly.
```

### "Open PR feat/d-upload-v4 → main"

```
Branch feat/d-upload-v4 is at 6d4b4f8, 22 commits ahead of main, fully
tested (1898 passing, zero new tsc errors, zero console warnings). Open
the PR.

Run from /Users/jnmartins/dev/frontfiles:
  gh pr create \
    --base main \
    --head feat/d-upload-v4 \
    --title "feat(upload): V4 redesign — single-pane editorial workspace" \
    --body-file docs/SESSION-WRAP-2026-04-27.md

(or compose a tighter PR body from this wrap's §2)
```

### "Cleanup the 8 pre-existing tsc errors"

```
Eight tsc errors have been tolerated as known pre-existing tech debt across
multiple commits. Audit and fix them.

Targets:
1. src/lib/processing/reaper.ts:157 — FFF_PROCESSING_TIMEOUT_SECONDS missing
   from env type. Add to the env schema or use a different env access pattern.
2. src/lib/processing/storage-bridge.ts:62 — string assigned to DerivativeRole.
   Narrow the type at the assignment site.
3. src/lib/upload/__tests__/v3-state.test.ts:43-44 — Record<string, unknown>
   cast. Convert the source via 'as unknown as Record<...>' OR redefine the
   test to not need the cast.
4. src/lib/upload/upload-selectors.ts:30 — AssetFormat not exported from
   v2-types. Add the export.
5. src/lib/upload/v2-mock-scenarios.ts:982 — 'provenance_pending' /
   'provenance_intermediate' not in ValidationDeclarationState. Either add
   to the type or fix the literals.
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
# Confirm current branch + clean working tree
git status
git log --oneline -10

# Confirm latest D2.10 + dnd-fix commits landed
git log --oneline | grep -E "D2\.|dnd"
# Should show: 6d4b4f8, 41e03e7, 4090090, 91dec35, f44b0c4, f5cae37, da4468a

# Confirm tests still green
npx vitest run --reporter=basic 2>&1 | tail -5
# Should show "Tests 1898 passed | 30 skipped"

# Confirm tsc baseline
npx tsc --noEmit 2>&1 | grep -cE "error TS"
# Should print: 8

# Confirm dev server runs cleanly
# (visit localhost:3000/vault/upload?scenario=archive_150_mixed; no red 1-Issue pill)
```

If any return surprising results, the session state has drifted — re-read this wrap doc + spot-check via direct file reads.

---

## 9. Don't-do list (carryover + new for 2026-04-27)

To save the next session from common mistakes:

1. **Don't re-litigate the 6 V4 directives that shipped today.** D2.9 + D2.9-followup + D2.10 + D2.10-followup + dnd-kit-fix all landed. The UI is complete. New work amends, not rebuilds.
2. **Don't bulk-accept prices.** Per L6 + spec §9.2 + PRICE-ENGINE-BRIEF v3 §11.16. Single rule asserted across multiple directives. The per-field `→ all` button is deliberately absent for price.
3. **Don't auto-fill story metadata to assets.** Per D2.10 founder pick (option b — explicit creator action). The "Apply to all in story" button overwrites; there is no auto-fill on first set.
4. **Don't use authoritative AI / certification language.** Per BP-D7 audit. Allowed: "AI suggestion," "AI-flagged," "comparable to," "based on." Forbidden: "AI-verified," "certified," "validated," "true value."
5. **Don't make Story groups a primary visual concept.** Optional overlay per UX-BRIEF v3 §4.3.
6. **Don't suppress or rename the dnd-kit hydration warning silence.** It's `suppressHydrationWarning` on `ContactSheetCard.tsx`'s drag root + `useId()`-seeded DndContext id (defensive). If touched, the warning returns.
7. **Don't reintroduce a 4-stage wizard for `/vault/upload`.** UX-BRIEF v3 + UX-SPEC-V4 are both single-screen / 3-region. Any directive proposing stages is wrong.
8. **Don't break the V2 parity contract.** v3-state-parity.test.ts (76 fixture-driven cases) must stay green. Reducer changes that mutate selector outputs need a parity audit.
9. **Don't expose engine recommendations to buyers.** Per PRICE-ENGINE-BRIEF v3 F5: out of scope for v1. Re-evaluate after trust track record.
10. **Don't activate any worker process beyond `scripts/process-derivatives.ts`.** PR 4 = Path B = single-server in-process orchestration. Multi-worker / horizontal is a future evolution, not v1.
11. **Don't load multiple currencies into format_defaults in v1.** EUR only per F1 §5.2.
12. **Don't skip the audit-first step on any new PR plan.** Multiple bugs in this session were caught by audit-first. The phase21 (D2.9 follow-up) work surfaced a pre-existing D2.2 bug because of the audit; without it, the user's flow would have stayed broken.

---

## 10. Header for the actual code repo state

Material that shipped this session is concentrated in:

- **`src/app/vault/upload/_components/`** — V4 UI (post D2.8 cutover lives here; pre-D2.9 was the C2 shape):
  - NEW (D2.9+): `CoverSlot.tsx`, `inspector/FieldProvenanceTag.tsx`
  - NEW (D2.10): `ContactSheetStoryHeader.tsx`, `inspector/InspectorEmbeddedMetadataSection.tsx`
  - DELETED (D2.9): `inspector/InspectorAcceptRow.tsx`, `inspector/SetAsCoverButton.tsx`
- **`src/lib/upload/`** — state + types:
  - `v2-types.ts`: `AssetEditableFields.socialLicensable`, `V2StoryGroup.location`, `V2StoryGroup.date`
  - `v3-state.ts`: 5+1 reducer cases gained `metadataSource` side effects + 6 cases gained story-membership maintenance + new `UPDATE_STORY_FIELD` case
  - `v3-types.ts`: new `UPDATE_STORY_FIELD` action variant
  - `types.ts`: `LicenceType` gains `creative_commons`
  - `__tests__/v3-state.test.ts`: 75 → 94 cases
- **`src/lib/types.ts`** — checkout-side `LicenceType` parity gains `creative_commons`
- **`src/lib/upload/price-engine.ts`** — `LICENCE_PREMIUM` map gains `creative_commons: 0`
- **`docs/upload/D2.9-DIRECTIVE.md`** — composed + ratified + B-scope amended

---

## 11. Footer

This wrap is the entry point. The 2026-04-26 wrap is now stale; the "ratify C1 + compose C2" default opener it carried is meaningless (C1+C2 + D2.1→D2.8 + D2.9 + D2.9-followup + D2.10 + D2.10-followup + dnd-fix all shipped between then and now).

The architecture is fully specified across all four pillars (B + C/D + E + F). UI is complete. Backend (Phase B) is dormant-tested. AI pipeline (E) and price engine (F) await ratification of their detail briefs (E1, F1) before schema migrations.

The hardest decisions are all made. The remaining work is execution + founder calibration + ratification + the eventual PR 5 cutover that wires the new UI to the real backend.

---

End of session wrap (2026-04-27).
