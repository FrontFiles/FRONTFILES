# Upload Flow — Audit + Rebuild Recommendation

**Date:** 2026-04-25
**Author:** Audit pass, founder-dispatched
**Scope:** Vault-side upload flow (`/vault/upload`) — backend pipeline + UI
**Reads underlying:** `src/lib/processing/ARCHITECTURE-BRIEF.md`, `src/lib/processing/IMPLEMENTATION-PLAN.md`, `src/lib/upload/PR-1.1-PLAN.md`, `src/lib/upload/PR-1.2-PLAN.md`, `src/lib/processing/PR-2-PLAN.md`, `src/components/upload-v2/README.md`, `/api/upload/route.ts`, `/api/v2/batch/*/route.ts`, `commit-service.ts`, `UploadShellV2.tsx`

**Out of scope:** Newsroom-side upload (NR-D7a; just shipped). This audit is the paid-FF / vault side.

---

## 1. Headline finding

**The upload flow is in PR 2 — dormant. Production users hit a simulation; no file bytes leave the browser.**

The 8-PR plan documented in `IMPLEMENTATION-PLAN.md` is well-thought-out and 4 PRs of substrate are landed. Everything is gated behind `FFF_REAL_UPLOAD=false`. The flag has not been flipped. Per the architecture brief (2026-04-16):

> "The upload pipeline is **entirely simulated**. No file bytes leave the browser. ... No upload API route exists. No `/api/upload`, no presigned URL generation, no storage bucket write."

Since that brief was written, PR 1, 1.1, 1.2, and 2 have landed — but all return 503 by default. **The runtime is unchanged.** The UI feels like upload because the simulation engine fakes progress + analysis. No persistence happens.

**This is not a bug — it's the deliberate state per the plan.** PR 5 was always going to be the cutover. The question is whether to continue the existing plan or restart.

---

## 2. Current-state matrix

### Backend pipeline (8-PR plan from `IMPLEMENTATION-PLAN.md`)

| PR | Scope | Status | Evidence |
|---|---|---|---|
| **PR 1** | Storage adapter substrate (fs + Supabase impls, path helpers, validation) | ✅ Landed 2026-04-16 | `src/lib/storage/` — we extended this for newsroom in NR-D7a. Tests 44/44 green at landing. |
| **PR 1.1** | Single-file flow plumbing | ✅ Landed (file present) | `src/lib/upload/PR-1.1-PLAN.md` exists; impact unclear without reading the plan |
| **PR 1.2** | Batch service (multi-file with atomic commit) | ✅ Landed | `/api/v2/batch/*` routes + `batch-service.ts` + 3 test files. All 503 behind flag. |
| **PR 2** | Upload API route + commit service + idempotency | ✅ Landed 2026-04-16 (DORMANT) | `/api/upload/route.ts` — 213 lines; `commit-service.ts` — orchestration; idempotency via `(creator_id, client_upload_token)` UNIQUE; SHA-256 fingerprinting; compensating-delete on partial failure; tests 78/78 at landing (122/122 cumulative with PR 1). 503 behind flag. |
| **PR 3** | Derivative row enqueue on commit | ❓ Unclear | Need to read full `commit-service.ts` to confirm whether the 3 derivative rows (thumbnail/watermarked_preview/og_image) are inserted post-commit. Plan describes the behavior but landing notes weren't checked in the audit pass. |
| **PR 4** | Processing worker activation | ❌ Not landed | No `scripts/process-derivatives.ts`; only verify-* scripts in `scripts/`. The pipeline + dispatcher modules in `src/lib/processing/` exist but no caller invokes them. |
| **PR 5** | Runtime cutover (flag flip) | ❌ Not landed | `FFF_REAL_UPLOAD` still gates 503; UI still calls simulation engine. |
| **PR 6** | Backfill / regeneration CLI | ❌ Not landed | No backfill script. Plan describes the query but no implementation. |
| **PR 7** | Drop mock preview fallback in delivery resolver | ❌ Not landed | `src/lib/media/asset-media-repo.ts` still has the mock path mapping per the brief §1.4. |
| **PR 8** | Drop legacy `vault_assets.watermark_mode` column | ❌ Not landed | Brief lists this as legacy still present. |

**Net: 4 of 8 PRs landed. 4 remaining (PR 3 unclear, PR 4–8 confirmed not done).**

### UI surface

`/vault/upload` page → `UploadShellV2` orchestrator → 4 stages:

| Stage | Component | Role |
|---|---|---|
| 1. **Add Files** | `AddFilesScreen.tsx` | Drop files / load demo scenario; set defaults (privacy, licences) |
| 2. **Analysis** | `AnalysisScreen.tsx` | Simulated upload + analysis pipeline; creates Story group proposals |
| 3. **Review & Assign** | `ReviewAssignScreen.tsx` | **Hero screen.** 4-zone layout: Story Groups (left), Asset Table (center), Asset Detail (right), Publish Bar (bottom). All editing inline. |
| 4. **Commit to Vault** | `CommitScreen.tsx` | Pre-commit summary + post-commit completion |

Plus 11 supporting components: `UploadV2Context`, `ExpressCard`, `AssetTable`, `PublishBar`, `ReviewHeaderBar`, `StoryProposalsBanner`, `StoryGroupsPanel`, `AssetDetailPanel`, `DevHarness`, `README.md`.

Total: **15 files in `src/components/upload-v2/`**, all client-side React. State managed by single `useReducer` in `UploadV2Context.tsx` with 10+ pure selectors.

---

## 3. UX assessment

### What the founder said

> "we must rebuild the ui. its too confusing and hard to understand"

### What I see in the code that supports that

1. **The "hero" Review/Assign screen has 4 simultaneous zones** (Story Groups, Asset Table, Asset Detail, Publish Bar). For a creator uploading 5–50 files, that's a high-density interface. The README itself describes this as a 3-zone layout in §4-Step Flow but lists 4 zones in §Why storyGroupId. Internal documentation drift.
2. **Story groups as a first-class concept** — the system auto-proposes Story groups, but assignment requires explicit creator action via dropdown (no drag-drop per the README's known-limitations list). Creators must understand: "what's a Story group, why are some assets proposed in one but not assigned, what's my action?"
3. **Exception model has 10+ exception types** (`needs_story`, `needs_privacy`, `manifest_invalid`, `needs_price`, `needs_licences`, `no_price_private`, `no_licences_private`, `duplicate_unresolved`, `low_confidence`, `provenance_pending`) split across blocking vs. advisory. The Publish button gates on blocking exceptions; the message for the creator is generated from these. High vocabulary load.
4. **Express flow vs. manual review** — there's an `expressEligible` selector + `APPLY_EXPRESS_FLOW` action, suggesting two distinct paths for creators. Not clear from the README how a creator chooses or when express applies.
5. **Self-described limitations** (from README §Known Limitations):
   - "No drag-and-drop between Story groups (uses dropdown assignment)"
   - "No keyboard shortcuts (J/K navigation, Space to select)"
   - "No split/merge Story group operations"
   - "No duplicate resolution wizard (side-by-side comparison)"
   - "No group size warnings for groups >15 files"
   - "No undo for actions"
   - "Mock simulation only — no real file upload or backend integration"

The combination of (a) a multi-screen wizard with a dense hero screen, (b) a non-obvious primary concept (Story groups) introduced auto-magically, (c) high-cardinality exception vocabulary, and (d) explicit gaps around standard creator-tool patterns (drag-drop, keyboard nav, undo, duplicate resolution) is a textbook "powerful but confusing" UX. The founder's complaint is well-founded.

### What I'd want to verify before recommending rebuild scope

1. **Does the Story-group concept actually map to how creators think?** — Story groups are an editorial concept (multiple photos from one event/topic). For a journalist uploading from a shoot, this maps cleanly. For a generalist creator uploading mixed content, it adds friction. Worth a 30-min user-research pass before redesigning.
2. **What's the actual upload-session size distribution?** — If 80% of sessions are <5 files, the heavy multi-screen wizard is overengineered. If 80% are 20+ files, the wizard pays for itself.
3. **What's the tax of express flow vs. review?** — If most sessions trigger express, the review/assign screen is a tail-case interface. If most trigger review, simplification has high ROI.

---

## 4. Backend assessment — continue or rebuild?

### Option A — Continue the 8-PR plan

**Resume at PR 3.** The plan is well-architected, the invariants are sound (DB-authoritative, derivative-isolation, fail-closed, idempotency), and PR 1+2 are quality work that would be wasteful to throw out. Remaining PRs:

- **PR 3** — Derivative row enqueue (small; adds to commit-service)
- **PR 4** — Worker activation (medium; new script + worker.ts + dispatcher wiring + reaper)
- **PR 5** — Flag flip + UI cutover (medium; touches v2-state.ts COMPLETE_COMMIT path; preserves simulation as test scenario)
- **PR 6** — Backfill CLI (small; query + script)
- **PR 7** — Drop mock fallback (small; one-line in `asset-media-repo.ts`)
- **PR 8** — Drop watermark_mode column (small; migration)

**Estimated 5 directives** (PR 3 + PR 4 + PR 5 + PR 6 + PR 7/8 combined). 1–2 weeks of focused work at the pace of recent NR directives.

**Why this works:** PR 1+2 are dormant and already meet exit criteria. The architecture is right. The runtime gap is exactly what's documented. No surprises.

**Why this might not work:** the existing plan was written for a specific UX (5-screen wizard with Story groups). If the UI rebuild changes the data flow (e.g., flatter model, no Story-group concept, or different commit semantics), some of PR 3–5 needs adjustment.

### Option B — Rebuild backend from scratch

Discard PRs 1–2 dormant code; rebuild based on a simpler architecture.

**Why this might appeal:** if the UI rebuild changes the requirements significantly (e.g., removes Story groups, or moves to inline-publish vs. batch-commit), the existing dormant code may not fit.

**Why I don't recommend this:** the storage adapter (PR 1) is already in production via the newsroom build (NR-D7a). The upload-API + commit-service architecture (PR 2) is sound and has comprehensive idempotency + compensating-delete logic that took real effort to design. Throwing that out for "rebuild" instinct rather than concrete misalignment is wasteful.

### Recommendation: **Option A (continue), with one explicit decision gate before PR 5.**

Resume PR 3. Land PR 4. Then **before PR 5 (the runtime cutover) lands**, redesign the UI. PR 5 is the integration point — it wires the real upload to whatever UI exists. So:

1. Ship PR 3 + PR 4 (backend pipeline complete and worker-activatable; still dormant).
2. Redesign the UI in parallel (or sequentially).
3. PR 5 wires the new UI to the real backend.
4. PR 6 + PR 7 + PR 8 finish the runtime cutover.

This preserves all the dormant work AND lets the UI rebuild inform the cutover details.

---

## 5. UI assessment — refactor or rebuild?

### Option A — Refactor existing UI

Keep the 4-stage wizard structure. Improve:
- Simplify Review/Assign hero to 2–3 zones max
- Add drag-and-drop for Story group assignment
- Reduce exception vocabulary; group related exceptions
- Add undo for destructive actions
- Add keyboard shortcuts for power users
- Resolve the express-vs-review path ambiguity

**Pros:** preserves significant work (15 components + reducer + selectors); known patterns; lower risk.

**Cons:** the structural complexity (4-zone hero + Story groups + exception system) is the source of confusion, not surface polish. Refactor may surface new issues without resolving the core "what is this asking me to do?" problem.

### Option B — Rebuild UI with a simpler model

Start from a different mental model. Possibilities:
- **Flat list, inline edit** — single-screen UI; all assets shown as a list; metadata edited inline; no separate wizard stages
- **Two-track UX** — express path (1-screen, AI suggests everything, creator confirms) vs. detailed path (3-screen for experienced creators); user picks at start
- **Story-group-optional** — Story groups become an editorial enhancement, not a primary concept; default flow ignores them; advanced flow exposes them

**Pros:** opportunity to fundamentally simplify. Many of the "Known Limitations" become non-issues if the model is different (no need for split/merge if Story groups aren't the primary structure).

**Cons:** significant work; throws out the reducer + selectors + screen components; risks losing capability that mattered.

### Recommendation — depends on user research

**I cannot make this call from a code audit alone.** This is a product decision that needs:
- 30–60 min looking at usage data (how many uploads per session, how often Story groups are used, how often express flow triggers)
- 1–2 conversations with current creators about what's confusing
- A founder-level call on what the upload-flow product is trying to do

If the answer is "Story groups are essential and the flow is right but execution is confusing" → Option A (refactor).
If the answer is "Story groups are nice-to-have and most sessions are 5–10 files" → Option B (rebuild simpler).

**My provisional default (subject to founder ratification): Option B.** Rationale: the README's own Known Limitations list reads like "power-user features we didn't build" (drag-drop, keyboard nav, undo, split/merge). That suggests the existing UI is built for a power-user case but lacks the affordances power users expect. Simpler default + power features added later may be a better trajectory than incrementally polishing the heavy default.

---

## 6. Recommended sequencing

### Phase A — Decide (before any code work)

**A1 — UX brief** (founder + agent): What is the upload flow's job? Who's the primary creator persona? What's the typical session shape? 1–2 hour conversation, document the answers in a new `docs/upload/UX-BRIEF.md`.

**A2 — Backend continuity decision** (based on A1's UX outcome): Continue the 8-PR plan as written, or modify (e.g., simplify the batch model, drop derivative roles, change commit semantics).

**A3 — UI direction decision**: Refactor (Option A) or rebuild (Option B), based on A1.

### Phase B — Backend complete (in parallel with UI design)

**B1 — Resume PR 3**: Derivative row enqueue. Small directive (~3–5 deliverables). Leaves PR 1+2 dormant code wired up so the worker has work to find.

**B2 — Resume PR 4**: Worker activation. Medium directive (~6–8 deliverables). Critical work — the worker selects from `asset_media WHERE status='pending'` with `FOR UPDATE SKIP LOCKED`, runs the processing pipeline, writes derivatives. Includes the stuck-processing reaper.

After B1 + B2: the backend pipeline is functionally complete and dormant-tested.

### Phase C — UI rebuild or refactor

Depends on Phase A's decision. Likely 3–6 directives if rebuild; 1–3 if refactor.

### Phase D — Runtime cutover

**D1 — PR 5**: Flag flip. The UI calls the real `/api/upload` (or `/api/v2/batch` for batch case). Simulation kept as a test scenario. ~3–5 deliverables.

**D2 — PR 6**: Backfill CLI. Small directive.

**D3 — PR 7 + PR 8**: Drop mock fallback + drop legacy column. Small directive(s); could combine.

### Total estimated scope

- **Phase A**: 1–2 sessions of conversation + decision documentation
- **Phase B (PR 3 + PR 4)**: 2 directives, ~12 deliverables total
- **Phase C (UI)**: 1–6 directives depending on rebuild vs. refactor
- **Phase D (cutover)**: 3 directives, ~10 deliverables total

Net: roughly the same scale as Phase NR-2 (12 directives). Spread across 1–2 weeks at recent pace.

---

## 7. Open questions for founder

These are the decisions Phase A needs to lock:

1. **Backend continuation**: Continue the 8-PR plan as architected, or modify? My recommendation: continue.
2. **UI direction**: Refactor existing 4-stage wizard, or rebuild simpler? My recommendation: rebuild simpler — but this is a product call, not a technical one.
3. **Story-group concept**: Primary feature, optional enhancement, or remove? Currently primary in the existing UI; founder's "confusing" complaint may center on this.
4. **Express vs. review path**: One path or two? Currently bifurcated; could unify with a smarter default.
5. **Session-size assumption**: What's the typical and max session size? Affects whether the heavy wizard is justified.
6. **Newsroom upload reuse**: NR-D7a shipped a working newsroom upload (drag-drop zone + per-asset metadata + scan polling). Should the vault rebuild draw on those patterns? Some of the NR-D7a infrastructure (storage adapter, signed URLs, scanner pattern) is shared substrate; UX patterns could be too.

---

## 8. What this audit did NOT cover

For a complete pre-rebuild picture, also worth examining (next session):

- **`commit-service.ts` full body** — confirm whether PR 3 derivative enqueue is wired or pending
- **`v2-state.ts` reducer** — understand the state machine in depth before deciding refactor vs. rebuild
- **`AnalysisScreen.tsx` + `ReviewAssignScreen.tsx`** — read the actual UI code for the dense screens
- **`processing/dispatcher.ts` + `processing/pipeline.ts`** — understand the dormant processing module's call surface
- **`PR-1.1-PLAN.md` + `PR-1.2-PLAN.md` + `PR-2-PLAN.md`** — the per-PR planning docs that detail what landed
- **Usage / instrumentation** — if there's analytics on the existing upload flow, look at session counts, abandon rates per stage, error rates

---

## 9. Bottom line

The upload pipeline is a well-architected dormant build. The UI is a high-power, high-complexity surface that the founder finds confusing. Neither needs to be thrown away wholesale. The right path is:

1. **Decide the UX direction first** (before any code work)
2. **Resume the backend PR sequence** (PR 3 + PR 4) in parallel
3. **Implement the UI direction** (refactor or rebuild)
4. **Cut over to real upload** (PR 5–8) once UI is settled

This is roughly Phase NR-2-sized work — significant, but tractable at the pace of recent directives. The dormant infrastructure is an asset, not a liability.

**Next step (founder action):** Decide whether to start with Phase A (UX brief conversation) or jump directly to Phase B (resume PR 3 / PR 4 backend work) and parallelize the UX decision. My recommendation: Phase A first — the UX outcome materially affects PR 5's shape and may affect what gets built in PR 3–4.

---

End of audit.
