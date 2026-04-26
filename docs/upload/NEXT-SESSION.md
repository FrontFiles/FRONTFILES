# Upload Rebuild — Session Resume Script

> **STALE — superseded by `docs/SESSION-WRAP-2026-04-26.md`.**
>
> This doc was written 2026-04-25 covering only Phase A of the upload rebuild.
> The 2026-04-26 session ratified Phase A, shipped Phase B backend (PRs 1.3 + 3 + 4),
> shipped the BP/Watermark trust-language defensive pass, and composed Phase C C1 +
> Phase E1 + Phase F1 architecture briefs. None of that progress is captured below.
>
> **For a fresh session, use `docs/SESSION-WRAP-2026-04-26.md` §6 RESUME PROMPT.**
>
> The content below is preserved for historical reference (the Phase A audit findings
> remain accurate; just note that the "awaiting founder decision on UX direction" gate
> is closed and most subsequent gates have also resolved).

---

**Last updated:** 2026-04-25
**State:** Audit complete; awaiting founder decision on UX direction (NOTE: this gate is now closed; see SESSION-WRAP-2026-04-26.md)
**Audit location:** `docs/audits/UPLOAD-AUDIT-2026-04-25.md`
**Branch context:** `feat/newsroom-phase-nr-2` (HEAD: `378eb79`) — separate concern from upload work; Phase NR-2 distributor build closed but not yet PR'd to main

---

## How to use this doc

This is a cold-start handoff. Drop the **Resume Prompt** below into a fresh Claude session (chat or Code) and the agent will pick up where this one stopped. The agent reads the docs listed in §2 before responding.

If you want to explore something specific instead of resuming the full sequence, jump to §6 (one-shot prompts).

---

## 1. State of the world (read first)

**What was just done:**

- Comprehensive audit of the vault-side upload flow at `/vault/upload` — backend pipeline + UI both examined
- Findings written to `docs/audits/UPLOAD-AUDIT-2026-04-25.md` (~580 lines)
- Headline: upload is in PR 2 of an 8-PR plan; production users hit a simulation; no file bytes leave the browser today

**What's pending:**

- Founder decision on whether to continue the existing 8-PR plan or rebuild from scratch (audit recommends continue)
- Founder decision on UI rebuild scope: refactor 4-stage wizard vs. simpler model (audit recommends rebuild simpler, but flagged as needing user-research input first)
- Phase A — UX brief conversation that locks the above two decisions

**What's NOT pending (don't redo):**

- Phase NR-2 newsroom build is closed at `378eb79`. Newsroom upload (NR-D7a) shipped separately. Don't conflate with vault upload.
- Storage adapter (`src/lib/storage/`) is shared substrate — already in production via newsroom. Don't rebuild this.
- The implementation plan (`src/lib/processing/IMPLEMENTATION-PLAN.md`) and architecture brief (`src/lib/processing/ARCHITECTURE-BRIEF.md`) are governing documents. Read before proposing alternatives.

---

## 2. Documents to read on session start

In order, with rough budget:

| # | Path | Why | Read budget |
|---|---|---|---|
| 1 | `docs/audits/UPLOAD-AUDIT-2026-04-25.md` | The full audit findings + recommendations | 5 min full / 2 min skim §1+§9 |
| 2 | `src/lib/processing/ARCHITECTURE-BRIEF.md` | The 8-step canonical lifecycle (target state) + invariants | 5 min full |
| 3 | `src/lib/processing/IMPLEMENTATION-PLAN.md` | The 8-PR sequence + landing notes for PR 1, 1.1, 1.2, 2 | 10 min full |
| 4 | `src/components/upload-v2/README.md` | UI surface map: 4 stages + 15 components + reducer model | 3 min |
| 5 | `/Users/jnmartins/dev/frontfiles/CLAUDE.md` | Standing posture (audit-first, propose-before-lock, etc.) | 2 min if not already loaded |

After reading, the agent should be loaded with full context.

---

## 3. The gating decision

**Phase A: UX brief.** Three product questions need founder answers before any code work:

1. **Who's the primary creator?** — Journalist uploading from a shoot? Generalist uploading mixed content? Brand uploading polished assets?
2. **What's the typical session size?** — 1–5 files (most uploads), 5–15 (medium), 20+ (heavy)? The current UI is built for 20+; if 1–5 is typical, it's overengineered.
3. **Are Story groups essential or nice-to-have?** — The current UI makes Story groups a primary concept. If creators don't think in Story groups, the concept is friction. If they do, it's central.

Two follow-on decisions flow from those answers:

4. **Backend continuation**: Continue the 8-PR plan as architected (audit recommends), or modify based on UX changes?
5. **UI direction**: Refactor existing 4-stage wizard, or rebuild simpler model?

---

## 4. Sequencing (per audit §6)

```
Phase A — Decide
  A1 UX brief (this conversation)
  A2 Backend continuity decision
  A3 UI direction decision

Phase B — Backend complete (parallel-able with Phase C)
  B1 Resume PR 3 (derivative row enqueue on commit)
  B2 Resume PR 4 (worker activation + reaper + processing pipeline)

Phase C — UI rebuild or refactor (parallel-able with Phase B)
  C1+ depends on Phase A decision

Phase D — Runtime cutover
  D1 PR 5 (flag flip; UI wired to real backend)
  D2 PR 6 (backfill CLI)
  D3 PR 7 + PR 8 (drop mock fallback + legacy column)
```

Phase B and Phase C can parallelize after Phase A locks. Phase D requires both B and C done.

Total estimated: ~12 directives, comparable to Phase NR-2.

---

## 5. RESUME PROMPT (paste this into a fresh session)

```
I'm resuming work on the Frontfiles vault-side upload flow. The previous session 
completed a comprehensive audit; the findings are at:

  docs/audits/UPLOAD-AUDIT-2026-04-25.md

Before responding, read these in order:

1. docs/audits/UPLOAD-AUDIT-2026-04-25.md (the audit; ~580 lines)
2. src/lib/processing/ARCHITECTURE-BRIEF.md (target state + invariants)
3. src/lib/processing/IMPLEMENTATION-PLAN.md (the 8-PR sequence)
4. src/components/upload-v2/README.md (UI surface map)
5. docs/upload/NEXT-SESSION.md (this resume script — for context)

Standing posture per /Users/jnmartins/dev/frontfiles/CLAUDE.md:
- Audit first; never jump to implementation
- Propose before locking; explicit IPs surfaced as HALT
- PRD wins on drift
- Tight per-directive commits with selective stage
- Founder ratifies before code

Current state:
- Upload pipeline in PR 2 (dormant). Production runs simulation; FFF_REAL_UPLOAD=false 
  gates 3 API routes that all 503.
- 4 of 8 PRs landed (PR 1, 1.1, 1.2, 2). 4 remain (PR 3-8 minus possible PR 3 partial).
- UI is a 4-stage wizard at /vault/upload with 15 components in 
  src/components/upload-v2/. Founder finds it confusing.

Pending decision: Phase A UX brief — three product questions block all code work:
1. Who's the primary creator persona?
2. What's the typical session size (1-5 files / 5-15 / 20+)?
3. Are Story groups essential, nice-to-have, or removable?

Plus two follow-on decisions (backend continuation, UI direction).

Default sequencing recommendation from the audit:
- Phase A (decide UX) → Phase B (resume PR 3 + PR 4 backend, parallel-safe with Phase C) 
  → Phase C (UI rebuild or refactor) → Phase D (PR 5 cutover + PR 6/7/8 cleanup).

Three ways I can drive forward — pick one and we go:

(a) "Start the UX brief" — I dispatch a structured conversation pulling out the 5 
    decisions in §3 of NEXT-SESSION.md. Output: a docs/upload/UX-BRIEF.md doc 
    locking the answers. ~30-60 min of conversation.

(b) "Resume PR 3" — I draft NR-D-equivalent directive for the derivative row enqueue 
    work, audit-first the commit-service.ts current state, dispatch composition. 
    Risk: if Phase A's UX decision changes the data flow, PR 3-5 may need rework.

(c) "Finish the audit" — I read the items §8 of the audit lists as gaps 
    (commit-service.ts full body, v2-state.ts reducer, AnalysisScreen + 
    ReviewAssignScreen, processing dispatcher/pipeline, the per-PR plan docs). 
    Output: extended findings appended to the audit doc.

Default: (a). The UX outcome materially affects everything downstream.

Tell me which.
```

---

## 6. One-shot prompts (if you want to do something specific)

### "Just resume PR 3 — skip the UX conversation"

```
Per docs/audits/UPLOAD-AUDIT-2026-04-25.md, the upload pipeline is in PR 2 dormant. 
PR 3 is "derivative row enqueue on commit" per src/lib/processing/IMPLEMENTATION-PLAN.md.

Audit-first dispatch of UPLOAD-PR3 (derivative row enqueue):

1. Read the current src/lib/upload/commit-service.ts in full to confirm what's 
   there vs. what PR 3 still needs to add.
2. Read src/lib/upload/PR-1.1-PLAN.md and PR-1.2-PLAN.md to understand the batch 
   model that PR 3 must integrate with.
3. Read src/lib/processing/PR-2-PLAN.md (PR 2's planning doc) for context on what 
   commit-service was built to do.
4. Surface IPs as HALT before composing.

Standing posture: audit-first per CLAUDE.md; PRD wins on drift; selective commits; 
founder ratifies.

Begin with audit. Report findings table + IPs back here.
```

### "I want to read the dense UI screens before deciding"

```
Per docs/audits/UPLOAD-AUDIT-2026-04-25.md §8, the audit didn't read these UI files:
- src/components/upload-v2/AnalysisScreen.tsx
- src/components/upload-v2/ReviewAssignScreen.tsx (the "hero" 4-zone screen)
- src/components/upload-v2/AssetTable.tsx
- src/components/upload-v2/StoryGroupsPanel.tsx
- src/components/upload-v2/AssetDetailPanel.tsx
- src/lib/upload/v2-state.ts (the reducer + 10+ selectors)

Read all six. Synthesize into a UX critique focused on the founder's complaint 
("too confusing and hard to understand"):
- Specific friction points with file:line citations
- Information density assessment per screen
- Mental-model load (what concepts must the user track simultaneously)
- Comparison to NR-D7a's newsroom upload UX (which shipped recently and is simpler)

Append findings to docs/audits/UPLOAD-AUDIT-2026-04-25.md as a new §10 — UI deep read.
```

### "Just answer the UX questions"

```
I want to answer the 3 UX questions from docs/upload/NEXT-SESSION.md §3 directly, 
without a structured brief conversation. My answers:

1. Primary creator: [YOUR ANSWER]
2. Typical session size: [YOUR ANSWER]
3. Story groups: [essential / nice-to-have / removable]

Plus the two follow-ons:
4. Backend continuation: [continue 8-PR plan / modify / rebuild from scratch]
5. UI direction: [refactor existing 4-stage wizard / rebuild simpler model]

Based on these answers, draft docs/upload/UX-BRIEF.md locking the decisions, then 
propose the Phase B / Phase C sequencing accordingly.
```

---

## 7. Don't-do list

To save the next session from common mistakes:

1. **Don't rebuild the storage adapter.** It's at `src/lib/storage/` and already in production via the newsroom build (NR-D7a). It's good. Reuse.
2. **Don't conflate vault upload with newsroom upload.** Newsroom upload (`/newsroom/[orgSlug]/manage/packs/[packSlug]/assets`) shipped in NR-D7a — that's a separate surface with its own data model.
3. **Don't propose an alternative architecture without reading the architecture brief first.** The brief is rigorous. If you have a better idea, articulate it against the brief, not in isolation.
4. **Don't dispatch PR 5 (flag flip) before Phase C settles.** PR 5 wires the UI to the real backend; if the UI is changing, the wiring changes.
5. **Don't add to the v1.1 backlog without checking** `docs/public-newsroom/DIRECTIVE_SEQUENCE.md` — there's a parallel v1.1 backlog there for newsroom; vault upload should have its own doc, not pollute the newsroom one.
6. **Don't restart the audit cold.** This doc + the audit doc are the entry. Read those first; only re-read source files for items §8 of the audit lists as gaps.

---

## 8. State to refresh on session start

Run these to ground the agent in current repo state (not stale audit):

```bash
# Confirm branch + clean working tree
git status

# Confirm Phase NR-2 is on origin
git log --oneline -5 origin/feat/newsroom-phase-nr-2

# Confirm upload pipeline still dormant
grep -r "FFF_REAL_UPLOAD" src/app/api/upload/route.ts src/app/api/v2/batch/route.ts

# Confirm no PR 3+ work landed since audit (if any landed, audit is stale)
ls scripts/ # PR 4 would add scripts/process-derivatives.ts
```

If any of those return surprising results, the audit is stale — re-do §8 of the audit before proceeding.

---

## 9. Footer

The audit is rigorous. The plan is sound. The dormant code is quality. The UX is the open question.

Don't underestimate the depth of work in PR 1+2 dormant code (idempotency, fingerprinting, compensating-delete, atomic two-row insert via `upload_commit(...)` plpgsql). That's load-bearing and shouldn't be discarded.

The hardest decision is the UX one. Once it's locked, the rest is execution.

---

End of session-resume script.
