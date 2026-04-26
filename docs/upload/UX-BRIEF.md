# Vault Upload — UX Brief

**Status:** DRAFT v3 — awaiting founder ratification before any Phase B / Phase C / Phase E / Phase F directive composes
**Date:** 2026-04-26 (revised same day after persona expansion and price engine pillar addition)
**Scope:** Vault-side upload flow (`/vault/upload`). Newsroom upload (NR-D7a) is out of scope and remains shipped. Full archive migration (10,000+ assets) is a separate future workstream, not this UI. The price engine pillar is governed by its own brief (`docs/pricing/PRICE-ENGINE-BRIEF.md`); this brief integrates with it as a consumer.
**Governs:** Phase B (backend resume), Phase C (UI rebuild), Phase D (cutover), Phase E (AI suggestion pipeline). Phase F (price engine) is governed separately by `PRICE-ENGINE-BRIEF.md`.
**Supersedes:** UX-BRIEF.md v1 (same date, earlier in session — missed the archive-uploader persona and the AI-suggestion pillar) and v2 (missed the price engine as a separate pillar; treated price suggestions as a sub-feature of the AI pipeline)
**Reads underlying:** `docs/audits/UPLOAD-AUDIT-2026-04-25.md`, `src/lib/processing/ARCHITECTURE-BRIEF.md`, `src/lib/processing/IMPLEMENTATION-PLAN.md`, `src/components/upload-v2/README.md`, `docs/pricing/PRICE-ENGINE-BRIEF.md`

---

## 1. What this brief is

A founder-locked record of the seven product decisions that govern the vault upload rebuild, the concrete UI model and architectural pillars those decisions imply, and the sequencing for getting from the current dormant state to a real production upload flow. The brief exists so subsequent directives (PR 3 backend resume, AI suggestion pipeline, UI rebuild, PR 5 cutover) can be composed against a stable target rather than re-litigating product questions inside implementation passes.

This brief is build-governing. If a later directive proposes a structure that contradicts §3 (locked decisions) or §4 (UI model) or §5 (architectural pillars), the directive is wrong, not the brief. Drift requires an explicit revision pass on this document, not a quiet override during implementation.

---

## 2. Current-state read (one paragraph)

The upload pipeline is in PR 2 dormant. Production users hit a simulation; no file bytes leave the browser. PRs 1, 1.1, 1.2, 2 of an 8-PR plan landed and are gated behind `FFF_REAL_UPLOAD=false`. The UI at `/vault/upload` is a 4-stage wizard (Add Files → Analysis → Review & Assign → Commit) with a 4-zone hero screen built around Story groups as the primary editorial concept. The founder finds the UI confusing. The audit (2026-04-25) recommended continuing the backend plan and rebuilding the UI; this brief locks that direction with concrete specifics. The brief also surfaces a new pillar — the AI suggestion pipeline — that the existing implementation plan does not cover.

---

## 3. Locked decisions

| # | Decision | Locked answer | Implication |
|---|---|---|---|
| Q1 | Primary creator persona | **Journalist, dual-mode**: (a) shooting on assignment (recent work, mid-batch, fresh metadata) and (b) uploading from archive (historical work, large batch, sparse-or-mixed metadata) — same person, two modes | The default UI must serve both modes natively. Brand and generalist creators are accommodated, not privileged. |
| Q2 | Session size in the standard UI | **Trimodal in `/vault/upload`**: 1–5 / 20–50 / 50–~2,000. **Above 2,000 is out of scope for this UI** — handled by a separate archive migration tool (CLI / admin path, future workstream). | One UI must scale 1 → ~2,000 gracefully via density-scaling. Past ~2,000 is a different surface with different mechanics. |
| Q3 | Story groups in the UI vs. in the AI layer | **Visually optional in the UI default; first-class in the AI suggestion layer.** Story groups are not the primary visual concept; AI-proposed group clusters are a primary assistive output. | Toggle hidden by default; AI proposals appear as one-click-accept suggestions whenever group clusters are detected with sufficient confidence. |
| Q4 | Backend continuation | **Continue 8-PR plan as architected** | PRs 1–2 dormant code (idempotency, fingerprinting, compensating-delete, atomic two-row insert via `upload_commit()`) stays load-bearing. Resume PR 3 → PR 4 → PR 5 → PR 6/7/8. No re-architecture. |
| Q5 | UI direction | **Rebuild simpler — single-flow, density-scaling**, plus a fourth density mode for archive sessions where AI group proposals are the primary review unit | The 4-stage wizard, the 4-zone hero, and Story-group-as-primary all collapse. New model spelled out in §4. |
| Q6 | AI suggestion architecture | **Inline with derivative processing at ingestion** — captions, keywords, tags, Story group clusters generated as part of the same async pipeline that produces derivatives. **Price suggestions are NOT generated here** — they come from the price engine pillar (Q8). | New architectural pillar (§5.2) parallel to the existing derivative pipeline. Adds a new PR sequence beyond the existing 8-PR plan. Story group clustering is batch-scoped, not per-asset — distinct job class. |
| Q7 | Archive migration tool (10,000+) | **Separate surface, not `/vault/upload`** — likely a CLI or admin web tool, with its own UX and operational posture | Out of scope for Phase B/C/D. Acknowledged here so it is not conflated with the standard upload flow. Shares substrate (storage adapter, derivative pipeline, AI suggestion pipeline, price engine) — does not share UI. |
| Q8 | Price engine | **Third architectural pillar, governed by `docs/pricing/PRICE-ENGINE-BRIEF.md` v2** — recommendation engine with **internal-only runtime inputs** (creator history + format defaults in v1; cross-creator anonymized comparables added in v2). External market data (Getty/AP/Reuters/fotoQuote) is **calibration-source-only**, used offline to seed format_defaults table; never a runtime adapter. Advisory authority only; surfaces in upload, vault edit, pricing admin (v1) and bulk re-pricing (v2). | Phase F runs in parallel with B/C/E. Price suggestions in the upload UI (§4.4) are engine-fed, not AI-pipeline-fed. Engine is consumed by the upload UI, not embedded in it. v1 ships in 8 directives; v2 adds 3 more deferred until platform volume justifies. |

---

## 4. UI model (the rebuild target)

### 4.1 Governing shape

**Single screen at `/vault/upload`.** No wizard. No stages. Three vertically stacked regions, all present from first interaction:

1. **Drop zone** (top, persistent) — accepts file drops at any time during the session, including after assets are already in the list. Shows session-level defaults toggle (privacy, licences, tags) as a collapsible header bar.
2. **Asset list** (center, virtualized) — flat list, one row per asset, inline edit for primary metadata. Density and primary review unit adapt to count (see §4.2).
3. **Commit bar** (bottom, sticky) — shows ready/total count, blocking-exception summary in plain language, primary commit CTA. Disabled when blocking exceptions remain.

The flow from creator action to commit is: drop files → AI proposals + derivatives generate inline → creator reviews and accepts/adjusts → commit. No screen transition. No "next step" friction. The commit bar is always visible so the creator always knows what blocks them.

### 4.2 Density scaling — four modes

The same single screen handles 1 file and 2,000 files by adapting density and shifting the primary review unit, not by switching layouts:

| Mode | Session size | Asset row | Primary review unit | Bulk operations | AI group proposals |
|---|---|---|---|---|---|
| **Linear** | 1–5 | Full per-row inline detail (thumbnail, filename, all primary metadata fields visible and editable) | Per-asset | Hidden | Hidden (insufficient material to cluster) |
| **Compact** | 6–19 | Compact row with summary metadata + exception chips; click row to open side detail panel | Per-asset | Hidden by default; toggleable | Hidden by default; available as on-demand action |
| **Batch** | 20–99 | Compact row, virtualized, multi-select keyboard support | Per-asset, but bulk-edit is a primary action | Visible: multi-select, bulk-edit, filter by exception, sort | **Proposed** when clusters detected; appears as banner + per-asset chip suggestion |
| **Archive** | 100–~2,000 | Highly compact row (thumbnail, filename, AI caption preview, status); click row to expand into side panel | **Per-cluster** (AI-proposed groups) is primary; per-asset review is drill-down | Always visible; cluster-level operations (bulk-accept proposed group, bulk-edit caption template, bulk-set price by cluster) | **Primary surface** — AI group clusters appear as accordion sections at the top of the list, each with bulk actions |

The thresholds are guidelines, not hard gates. The bulk bar can be invoked manually at any count. The side panel is always reachable from any row. The principle: small sessions never see batch UI; large sessions get cluster-level review without modal switching; archive sessions stop pretending the creator will review every asset individually.

### 4.3 Story groups — opt-in UI overlay, AI-proposed by default

Story groups are a UI overlay on top of the asset list. The behavior:

- **Default visibility:** off in Linear mode; off-but-toggleable in Compact mode; **proposed by AI** in Batch and Archive modes.
- **AI proposals:** when the AI suggestion pipeline (§5.2) detects a group cluster with sufficient confidence, a proposal banner surfaces above the cluster: *"5 assets appear to be from one shoot — accept as a group?"* One-click accept creates the group; the assets reflow into an accordion section.
- **Manual creation:** creator can always create a group from selected assets ("Group selected").
- **Edit operations:** rename, split, merge, reassign (drag-drop or right-click). All inline.
- **Persistence:** toggle state is per-session, not per-creator.

The journalist on a shoot in Batch mode (e.g., 30 photos from one event) gets a single "Group these 30 as one story?" proposal and accepts it in one click. The journalist in Archive mode (e.g., 800 photos from a decade of work) gets dozens of cluster proposals and accepts/rejects/edits each. The creator uploading 3 polished assets never sees the concept.

### 4.4 AI suggestion surfacing in the UI

For every asset, two pipelines feed proposals into the UI:

**From the AI suggestion pipeline (§5.2):**
- **Caption** — natural-language description of the image content
- **Keywords** — short list of indexable terms
- **Tags** — categorical chips matching the creator's existing tag taxonomy where possible
- **Story group cluster suggestions** (batch-scoped) — proposed groupings across the session

**From the price engine (§5.4 — see `PRICE-ENGINE-BRIEF.md`):**
- **Price recommendation** — advisory base price in the creator's currency, with confidence indicator, basis summary, and drillable breakdown of which adapters contributed (creator history, comparables, format defaults, optional external benchmarks)

These appear in the asset row and side detail panel as **proposals**, visually distinguished from creator-authored values. Suggested approach (refine in UX-SPEC-V3):

- Suggested values appear in muted/italic text by default
- One-click accept turns a single suggestion into a creator-authored value (now bold/normal weight)
- Bulk-accept actions are allowed for captions/tags/keywords: "Accept all suggested captions in this group", "Accept all suggested tags above 90% confidence", etc.
- **Bulk-accept is NOT allowed for prices** — every price acceptance is per-asset, explicit. Per founder standing posture and `PRICE-ENGINE-BRIEF.md` §7, the engine is advisory and the creator-set price is authoritative.
- Editing a suggested value transitions it to creator-authored automatically
- A "regenerate suggestion" action is available per-field for any asset
- Price suggestions show a "Why this price?" affordance that expands the basis breakdown — drillable evidence is the trust mechanism per `PRICE-ENGINE-BRIEF.md` §7.1

### 4.5 Exception model — collapsed vocabulary

The current 10+ exception types collapse to 5 user-facing categories. Internal types may stay granular for selectors; what the creator sees is one of:

| Category | Includes (internal types) | Surfacing |
|---|---|---|
| **Processing** | `analyzing`, `suggesting`, derivative-pending | Subtle spinner / "AI working" indicator on row; not a blocking exception, just a state |
| **Needs info** | `needs_privacy`, `needs_price`, `needs_licences`, `manifest_invalid` | Yellow chip on row + line in commit bar summary; blocks commit if PUBLIC/RESTRICTED |
| **Duplicate** | `duplicate_unresolved` | Orange chip on row + side-by-side resolver in detail panel; blocks commit until resolved |
| **Low confidence** | `low_confidence`, `provenance_pending` | Gray advisory chip; does not block commit |
| **Ready** | (no exceptions, all required fields present) | Green chip; counts toward "ready/total" in commit bar |

The `needs_story` exception disappears entirely (Story groups are optional). The PRIVATE-vs-PUBLIC rules from the existing `getAssetExceptions` selector survive — PRIVATE assets without price/licences are not blocked.

### 4.6 What the new flow drops

From the existing `src/components/upload-v2/`:

- The 4-stage wizard structure (`AddFilesScreen`, `AnalysisScreen`, `ReviewAssignScreen`, `CommitScreen`) — collapses into one screen
- The 4-zone hero layout (`StoryGroupsPanel` + `AssetTable` + `AssetDetailPanel` + `PublishBar` simultaneously)
- The express-vs-review path bifurcation (`expressEligible` selector, `APPLY_EXPRESS_FLOW` action, `ExpressCard`) — density scaling does the same job more cleanly
- The `StoryProposalsBanner` as a primary always-on surface (replaced by AI-proposal banners that appear conditionally at the cluster level when relevant)
- The 10+ exception type vocabulary at the user-visible layer
- The separate Analysis screen as a stage (analysis runs inline; progress shows on each row's chip during processing)
- The separate Commit screen (commit summary expands inline from the commit bar; post-commit success state replaces the screen body in place)

### 4.7 What the new flow preserves

- `V2Asset` shape and the asset-level data model (`src/lib/upload/v2-types.ts`)
- The reducer pattern (single `useReducer` for all editable state)
- The mock scenarios (`v2-mock-scenarios.ts`) — used to test the new flow against the same data the old flow uses, with new archive-scale scenarios added
- Pure asset-level selectors (`getAssetExceptions`, `getPublishReadiness`, `getTotalListedValue`, `getCompletionSummary`) — they compute facts, not layout
- The session-defaults model (privacy, licences, tags applied to new assets) — surfaced as a collapsible header bar
- The simulation engine (`v2-simulation-engine.ts`) — kept as a test fixture for the new UI

What does NOT survive in its current form: the action set (`ADD_STORY_GROUP_PROPOSAL`, `ASSIGN_ASSET_TO_STORY`, `ACCEPT_ALL_PROPOSED_ASSIGNMENTS`, `APPLY_EXPRESS_FLOW`, `BULK_ASSIGN_ASSETS`) — these are all coupled to the old UX shape. The new reducer needs a new action set. Story-group-related actions return as a smaller set when the overlay is implemented. New actions are also needed for AI proposal acceptance (`ACCEPT_PROPOSAL`, `BULK_ACCEPT_PROPOSALS_FOR_GROUP`, `REGENERATE_PROPOSAL`).

---

## 5. Architectural pillars

The upload system has **three parallel pillars** at runtime. The derivative pipeline and AI suggestion pipeline are triggered at ingestion and share worker infrastructure. The price engine is on-demand (not ingestion-triggered) and is consumed by the upload UI as one of several callers. All three share substrate (storage adapter, ingestion path, asset identity model) but operate on different data and produce different outputs with different trust postures.

### 5.1 Derivative pipeline (existing 8-PR plan)

**Status:** PRs 1, 1.1, 1.2, 2 landed dormant. PRs 3–8 remaining per `IMPLEMENTATION-PLAN.md`.

**Produces:** files. `original`, `thumbnail`, `watermarked_preview`, `og_image`, written to storage; `asset_media` rows track storage_ref + generation_status.

**Trigger:** asset ingestion (commit).
**Job class:** per-asset, per-derivative-role.
**Failure mode:** fail-closed (404 until `generation_status='ready'`). Governed by `ARCHITECTURE-BRIEF.md`.

This pillar is unchanged by the persona expansion. It remains per-asset and agnostic to AI suggestions and Story groups.

### 5.2 AI suggestion pipeline (NEW — Phase E)

**Status:** not started. Not in the existing `IMPLEMENTATION-PLAN.md`. Needs its own brief + plan.

**Produces:** metadata proposals. Stored in a new table (working name: `asset_proposals`) with columns for `caption`, `keywords[]`, `tags[]`, `price_suggestion_cents`, `price_basis`, `confidence`, `model_version`, `generated_at`, `accepted_at` (nullable).

**Trigger:** asset ingestion (commit), same as derivative pipeline.
**Job classes:**
- **Per-asset:** caption, keywords, tags, price suggestion. Use vision + text models. One job per asset.
- **Batch-scoped (deferred):** Story group clustering. Cannot run per-asset because it needs cross-asset context (visual similarity, temporal proximity, caption similarity). Runs after a session-bounded set of assets has completed per-asset processing — likely triggered by the commit action or by an explicit "analyze batch" job.

**Failure mode:** advisory. AI proposal failure does NOT block ingestion or delivery. The asset commits without a proposal; the row in `asset_proposals` is marked failed; the creator can manually trigger regeneration. AI proposal absence is not an exception in the user-visible model.

**Cost / model selection:** open decision (see §7).

**Trust posture:** all AI outputs are proposals, not authoritative metadata. Creator action is required to accept any proposal into the asset's authoritative metadata. Price suggestions are explicitly advisory and labeled as such — never auto-applied even on bulk-accept.

**Worker reuse:** the same worker infrastructure built in PR 4 (selection via `FOR UPDATE SKIP LOCKED`, reaper, retry semantics) extends to handle `asset_proposals` rows. Two job types in one worker, or two workers sharing a base — TBD in the AI pipeline plan.

### 5.3 Why these are parallel pillars, not nested

The derivative pipeline writes files; the AI suggestion pipeline writes metadata proposals. They have different failure semantics (fail-closed vs advisory), different consumers (delivery resolver vs UI), different cost profiles (CPU+IO for derivatives, model inference for AI), and different sensitivity (derivative bytes are deterministic; AI outputs are probabilistic and require trust-aware framing).

Coupling them under a single pipeline would push fail-closed semantics onto AI outputs (wrong: AI failure shouldn't 404 a preview) or push advisory semantics onto derivatives (wrong: a missing watermarked preview must 404, not "advise"). They share trigger and worker substrate but stay structurally separate.

### 5.4 Price engine pillar (Phase F — separate brief)

**Status:** governed by `docs/pricing/PRICE-ENGINE-BRIEF.md`. Summary only here.

**Produces:** price recommendations stored in `pricing_recommendations` table. One base price per asset; multiplier model (existing `EXCLUSIVE_MULTIPLIERS` in `src/lib/types.ts`) handles per-licence/per-tier derivation downstream.

**Trigger:** on-demand (not ingestion-bound). Called by:
- Upload UI during AI suggestion pipeline (per-asset, at ingestion)
- Vault asset edit (when creator views or edits an existing asset's price)
- Bulk re-pricing tool (across selected assets, on creator action)
- Pricing admin (preview recommendations under different settings)

**Architecture:** four pluggable input adapters (creator history, anonymized cross-creator comparables, format defaults, deferred external benchmarks); a composer that weights and combines them; output is `Recommendation` with confidence + drillable basis breakdown.

**Failure mode:** advisory. Recommendation absence does not block any flow. The creator-set `vault_assets.creator_price_cents` remains canonical.

**Trust posture (non-negotiable):** advisory only; engine never mutates `creator_price_cents`; basis statements use precise non-authoritative language ("recommended", "based on", "comparable to" — never "fair", "certified", "validated"); audit trail of every recommendation event in `pricing_audit_log`.

**Why separate from the AI pipeline:** different schema, different surfaces (engine has four; AI pipeline has one — the upload UI), different data inputs (engine pulls from `licence_grants` and historical sales; AI pipeline pulls from file bytes), different governance (engine has creator-controlled settings via pricing admin; AI pipeline does not), different sensitivity (price errors have direct commercial consequences; caption errors are embarrassing but not commercial).

**Why separate from the derivative pipeline:** entirely different concern; no shared substrate beyond asset identity.

---

## 6. Phase sequencing

```
Phase A — Decide (this brief)
  A1 ✅ UX brief locked v2 (this document)
  A2 ✅ Backend continuity locked (Q4)
  A3 ✅ UI direction locked (Q5)
  A4 ✅ AI pipeline existence locked (Q6) — full plan still TBD
  A5 ✅ Archive tool out of scope acknowledged (Q7)

Phase B — Backend complete (parallel-able with Phase C and Phase E)
  B1 PR 3 — Derivative row enqueue on commit
       • Audit-first: read commit-service.ts in full to confirm what's wired
       • Compose PR-3-PLAN.md against existing IMPLEMENTATION-PLAN.md §PR 3
       • Implement; tests; merge dormant
  B2 PR 4 — Worker activation + reaper
       • Compose PR-4-PLAN.md
       • Implement worker.ts, dispatcher wiring, scripts/process-derivatives.ts
       • Reaper, tests, merge dormant
       • Worker designed to be extensible to handle Phase E job types
  Exit: derivative pipeline functionally complete and dormant-tested

Phase C — UI rebuild (parallel-able with Phase B)
  C1 UX spec — concrete component spec, interaction patterns, exception copy, AI proposal surfacing
       • Output: docs/upload/UX-SPEC-V3.md
       • Founder ratifies before C2 starts
  C2 New shell + state
       • New page surface (replaces UploadShellV2 or sits alongside under flag)
       • New reducer with new action set including AI proposal acceptance actions
       • Preserve V2Asset and asset-level selectors
       • Mock simulation wired to new state shape
  C3 Asset list + inline edit + AI proposal surfacing (with mock proposals)
  C4 Bulk operations bar + filters (Batch + Archive density modes)
  C5 Optional Story groups overlay + AI group proposal banners
  C6 Exception simplification + commit bar polish
  Exit: new UI feature-complete against simulation; mock scenarios pass behavioral parity

Phase E — AI suggestion pipeline (NEW; parallel-able with Phase B, C, F)
  E1 AI architecture brief — model selection, cost, schema, failure handling, trust posture
       • Output: src/lib/processing/AI-PIPELINE-BRIEF.md
       • Founder ratifies before E2 starts
  E2 Schema migration — asset_proposals table, indexes
  E3 Per-asset job class — caption, keywords, tags (NOT prices — those come from Phase F)
  E4 Batch-scoped job class — Story group clustering (deferred batch analysis)
  E5 UI integration — proposals appear in asset rows; accept/edit/regenerate actions wire through; price field consumes Phase F engine
  Exit: AI pipeline functionally complete with mock or real models behind a flag

Phase F — Price engine v1 (NEW; parallel-able with Phase B, C, E; governed by docs/pricing/PRICE-ENGINE-BRIEF.md v3)
  F1 Engine architecture brief — internals, schema, basis disclosure, format_defaults initial table content, calibration sources documented
       • Output: docs/pricing/PRICE-ENGINE-ARCHITECTURE.md (extends PRICE-ENGINE-BRIEF v2)
       • Founder ratifies before F2
  F2 Schema migration + recommendation service skeleton (4 v1 tables: pricing_recommendations, pricing_admin_settings, pricing_audit_log, pricing_platform_floors)
  F3 Adapter — format_defaults (always-on baseline; codified judgment seeded from offline calibration)
  F4 Adapter — creator_history (self-referential)
  F7 Pricing admin / settings UI (replaces vault/pricing/page.tsx)
  F8 Vault asset edit integration (recommended-price affordance on existing edit screens)
  F10 Upload flow integration (engine called by Phase E pipeline; advisory ghost-text in price field)
  F11 Consolidation passes — refactor special_offer/ and any hand-rolled price logic to consume engine
  v1 Exit: 8 directives. Engine producing recommendations from creator_history + format_defaults; integrated in upload + vault edit + admin; full audit trail; consolidated with offer flow. Deployable.

Phase F — Price engine v2 (deferred until v1 ships and platform volume justifies)
  F5 Adapter — frontfiles_comparables (cross-creator anonymized; dual gate N≥10 + IQR≤50%; null on fail)
  F2.5 pricing_inputs snapshot table (full reproducibility for v2+ recommendations)
  F9 Bulk re-pricing tool (new vault surface)
  v2 Exit: 3 additional directives. Comparables shipped; bulk surface live; full snapshot reproducibility.

NO Phase F directive for external benchmarks. External market data is offline calibration only (see PRICE-ENGINE-BRIEF.md v3 §4.2.4); never a runtime adapter.

Phase D — Runtime cutover (requires B, C, E, F complete)
  D1   PR 5 — Flag flip + new UI POSTs to /api/upload (idempotent)
  D1.5 System B watermark retirement — feature-flagged staged rollout (NEW per BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26 §7)
       • Remove WatermarkOverlay rendering from PreviewMedia.tsx, AssetCard.tsx,
         ArticlePreview.tsx, AssetViewers.tsx, DiscoveryResultsGrid.tsx,
         share/[token]/opengraph-image.tsx, and any other consumer
       • Delete src/components/watermark/* (after consumer migration)
       • Delete src/lib/watermark/* (after consumer migration)
       • Delete src/hooks/useWatermark.ts
       • Migrate src/data/assets.ts from WatermarkMode to intrusionLevel
       • Triple-gate pre-condition (ALL must hold before D1.5 composes —
         protects against premature cutover that would expose unwatermarked bytes):
           (a) PR 5 live and stable in production (not staging)
           (b) Derivative pipeline has non-zero real creator usage
               (N real assets processed end-to-end through watermarked_preview
               role with generation_status='ready'; not synthetic)
           (c) At least one approved watermark profile per (intrusion_level,
               template_family) pair, AND each visually verified via
               /dev/watermark-approval by founder before approval
       • Rollout: feature-flagged (FFF_DISABLE_CLIENT_WATERMARK_OVERLAY);
         staging → one internal org for one creator session → platform-wide;
         flag removed in small follow-up after one stable week
  D2   PR 6 — Backfill CLI for any pre-existing originals missing derivative rows or proposals
  D3   PR 7 — Drop mock preview fallback in delivery resolver
  D4   PR 8 — Drop legacy watermark_mode column (after founder decision in ARCH-BRIEF §7.1)
  Exit: simulation removed from production path; System B retired; cleanup complete

(Future, separate workstream — not Phase B/C/D/E)
  Archive migration tool (10,000+ asset imports via CLI or admin path)
       • Reuses storage adapter, derivative pipeline, AI suggestion pipeline
       • Separate UX, separate operational posture (queued, async, multi-day)
       • Out of scope for this brief
```

Estimated total within Phases B + C + D + E + F (v1 only): **~20–24 directives** (B: 2, C: 5–6, E: 4–5, F v1: 8, D: 3–4). v2 of Phase F adds 3 more directives, deferred until post-ship. Significantly larger than NR-2 due to AI pipeline + price engine pillar additions, but B/C/E/F all parallel-able so calendar expansion is sub-linear. Realistic estimate: 5–8 weeks for the v1-complete state at recent pace. Phase D is gated on B + C + E + F-v1 (not F-v2).

Phase B, Phase C, Phase E, and Phase F touch disjoint surface and can parallelize:
- Phase B: `src/lib/upload/commit-service.ts`, `src/lib/processing/` (derivative path)
- Phase C: `src/components/upload-v2/`, `src/lib/upload/v2-state.ts`
- Phase E: new `src/lib/ai-suggestions/`, new schema migration, possible additions to `src/lib/processing/` worker
- Phase F: new `src/lib/pricing/`, new schema migration (4 tables), evolution of `src/app/vault/pricing/page.tsx`, new bulk re-pricing surface

Integration moments (where parallel phases must synchronize):
- Phase C UI consumes Phase F engine recommendations in the price field (§4.4)
- Phase C UI consumes Phase E proposals in caption/tags/keywords fields (§4.4)
- Phase E pipeline calls Phase F engine as one of its proposal sources at ingestion
- Phase D PR 5 cutover wires the new UI to all real backends (B + E + F all complete)

---

## 7. Open decisions still pending

These do not block Phase B or Phase C kickoff. Phase E E1 brief must resolve §7.7–§7.11 before E2 can start. PR 5 (cutover) cannot ship without §7.1–§7.6.

From `ARCHITECTURE-BRIEF.md` §7 (unchanged):
1. **Watermark profile approval** — at least one approved profile per (`intrusion_level`, `format_family`) pair
2. **Derivative dimension targets frozen** — thumbnail 400px short edge, watermarked_preview 1600px long edge, og_image 1200×630
3. **`watermark_mode='none'` mapping for beta import** — light vs standard
4. **`detail_preview` merge timing** — distinct role at activation, or merged with `watermarked_preview`
5. **Storage bucket choice** — Supabase Storage vs S3 vs other
6. **Concurrency model** — in-process queue vs external

New decisions introduced by this brief (Phase E):
7. **AI model selection** — vision/captioning model (Anthropic vision, OpenAI vision, open-source). Probably one provider per concern (caption, embedding for clustering). Has cost, latency, accuracy, and data-residency implications.
8. **Cost accounting** — platform-paid vs creator-metered. Affects pricing model and API quota concerns.
9. **(Removed)** ~~Price suggestion basis~~ — moved to `PRICE-ENGINE-BRIEF.md` §3 (locked: four input adapters) and §9 (open decisions on vendor, anonymization, refresh cadence). Phase F governs.
10. **Story group clustering algorithm** — visual similarity (CLIP embeddings) + temporal proximity + caption similarity, weighted how? Confidence threshold for proposing? Affects false-positive rate of group proposals.
11. **AI failure handling at row level** — silent fail (proposal absent, creator manually triggers), retry-with-backoff, fail-and-flag. Likely silent fail with one retry.
12. **Tag taxonomy alignment** — should AI tag suggestions snap to the creator's existing tag taxonomy, or propose new ones? Probably both: prefer existing tags, allow new with confidence threshold.
13. **Archive migration tool spec** — separate brief required. CLI vs admin web; queued ingestion; per-batch progress reporting; failure recovery. Future workstream.

Phase F open decisions are tracked in `PRICE-ENGINE-BRIEF.md` §9 and are not duplicated here.

---

## 8. Approval gate

Before any Phase B, Phase C, or Phase E directive is composed, the founder ratifies this brief.
Before any Phase F directive is composed, the founder ratifies `PRICE-ENGINE-BRIEF.md` separately.

Ratification means: the eight locked decisions in §3 stand, the UI model in §4 is the target, the architectural pillars in §5 are the structure, the sequencing in §6 is the order. If any of those is wrong, this brief gets revised before any code work begins.

Three ratification gates exist in total:
1. **This brief** (`UX-BRIEF.md` v3) — UI direction + Phases B/C/E sequencing
2. **`PRICE-ENGINE-BRIEF.md`** — Phase F (price engine) sequencing + trust posture + scope
3. **Phase E1** (`AI-PIPELINE-BRIEF.md`, TBD) — AI model selection + schema + trust posture (gates Phase E code work)
4. **Phase F1** (`PRICE-ENGINE-ARCHITECTURE.md`, TBD) — engine internals + external benchmark legal decision (gates Phase F code work after F2)

Recommended ratification path: read both `UX-BRIEF.md` v3 and `PRICE-ENGINE-BRIEF.md` end-to-end, flag specific lines that are wrong or under-specified, push corrections back. I revise. We approve. Phase B + Phase C + Phase E + Phase F kick off in parallel.

---

## 9. Don't-do list

To keep subsequent sessions from drifting:

1. **Don't reintroduce a 4-stage wizard.** The single-screen model in §4.1 is the target. If a directive proposes stages, it is wrong.
2. **Don't make Story groups a primary visual concept.** They are an opt-in overlay per §4.3. AI group *proposals* are first-class (§5.2), but the UI default is not group-centric. If a directive proposes group-centric default UI, it is wrong.
3. **Don't bifurcate the flow into express vs review paths.** Density scaling per §4.2 replaces this. If a directive proposes two flows, it is wrong.
4. **Don't rebuild the storage adapter or the commit-service idempotency.** Those are PR 1+2 dormant work, sound and load-bearing. Reuse, don't rewrite.
5. **Don't dispatch PR 5 (flag flip) until Phases C and E are functionally complete.** PR 5 wires the UI to the real backend AND to AI proposals; if either is in flux, the wiring is unstable.
6. **Don't conflate vault upload with newsroom upload.** Newsroom upload (`/newsroom/[orgSlug]/manage/packs/[packSlug]/assets`) shipped in NR-D7a and is a separate surface with its own data model. They share the storage adapter; they do not share UX.
7. **Don't conflate the standard upload UI with the future archive migration tool.** This brief governs `/vault/upload` for sessions up to ~2,000 assets. The 10,000+ migration tool is a separate workstream with its own surface.
8. **Don't auto-apply AI price suggestions.** Per Q6 trust posture, price suggestions are advisory only. Bulk-accept actions for captions/tags/keywords are fine; price requires explicit per-asset acceptance.
9. **Don't couple AI proposal failure to ingestion success.** AI is advisory; an asset commits even if its AI proposal job fails. The proposal pipeline is separate from the derivative pipeline for this exact reason (§5.3).
10. **Don't skip the audit-first step on PR 3.** Read `commit-service.ts` in full before composing `PR-3-PLAN.md`. The audit flagged the derivative-enqueue status as unclear; that needs confirming before scoping.

---

## 10. References

- Audit: `docs/audits/UPLOAD-AUDIT-2026-04-25.md`
- Architecture brief: `src/lib/processing/ARCHITECTURE-BRIEF.md`
- Implementation plan (8-PR derivative pipeline): `src/lib/processing/IMPLEMENTATION-PLAN.md`
- Per-PR plans landed: `src/lib/upload/PR-1.1-PLAN.md`, `src/lib/upload/PR-1.2-PLAN.md`, `src/lib/processing/PR-2-PLAN.md`
- Existing UI surface map: `src/components/upload-v2/README.md`
- Session resume script: `docs/upload/NEXT-SESSION.md` (will become stale upon ratification of this brief)
- **Price engine brief** (Phase F): `docs/pricing/PRICE-ENGINE-BRIEF.md`
- AI pipeline architecture brief (Phase E1): `src/lib/processing/AI-PIPELINE-BRIEF.md` (TO BE CREATED)
- Price engine architecture brief (Phase F1): `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (TO BE CREATED)
- New UX spec (Phase C1): `docs/upload/UX-SPEC-V3.md` (TO BE CREATED)

---

End of UX brief v3.
