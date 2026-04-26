# Frontfiles AI Suggestion Pipeline — Architecture Brief

**Status:** DRAFT — awaiting founder ratification before any Phase E directive composes
**Date:** 2026-04-26
**Scope:** Frontfiles AI suggestion pipeline — what it produces, what models it uses, how it stores proposals, how it surfaces them, how it fails, how it's governed for trust.
**Governs:** Phase E (AI suggestion pipeline) — runs in parallel with Phase B (backend), Phase C (UI rebuild), Phase F (price engine) per `UX-BRIEF.md` v3 §6
**Reads underlying:** `docs/upload/UX-BRIEF.md` v3 (§4.4 surfacing, §5.2 pillar definition, §7 open decisions #7-#12); `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 (sister architecture; defines what this pipeline does NOT cover); `src/lib/processing/IMPLEMENTATION-PLAN.md` (PR 4 Path B worker — this pipeline reuses worker infrastructure); `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` (constrains language for proposal copy)

---

## 1. What this brief is

A founder-locked record of the AI suggestion pipeline's architecture: what it produces, which models it uses, how it stores and surfaces proposals, what trust posture governs every output, and the v1/v2 staging that ships a useful subset before the harder cross-asset clustering work.

This brief is build-governing. If a later directive proposes a structure that contradicts §3 (locked decisions) or §4 (pipeline architecture) or §7 (trust posture), the directive is wrong, not the brief. The trust posture in particular is non-negotiable — any drift toward authoritative AI claims, "AI-verified" language, or auto-acceptance of proposals into authoritative metadata requires an explicit revision pass on this brief, not a quiet override.

The pipeline is one of three architectural pillars of the upload + vault platform alongside the derivative pipeline (Phase B, governed by `IMPLEMENTATION-PLAN.md`) and the price engine (Phase F, governed by `PRICE-ENGINE-BRIEF.md` v3). It is consumed by the upload UI as one source of proposals; the other source is the price engine.

---

## 2. Current-state read

The AI pipeline does not exist as runtime code. The current upload flow uses a `SimulationEngine` (per `ARCHITECTURE-BRIEF.md` §1.2) that generates fake EXIF/IPTC/XMP/C2PA data; no real model is invoked. PR 5 cutover replaces the simulation with the real backend pipeline (PRs 1.3, 3, 4 — all shipped), but the AI proposal layer is what this brief plans.

What does exist that this pipeline integrates with:

- **PR 4 worker infrastructure** (Phase B, shipped) — the same worker pattern used to process derivative pending rows is reused to process AI proposal pending rows. New job class, same scheduler.
- **`asset_media` schema** — proposal data is NOT stored on `asset_media`; that table holds the file/derivative state only. AI proposals get their own table.
- **Price engine** (Phase F, `PRICE-ENGINE-BRIEF.md` v3) — separate pillar; produces price recommendations. AI pipeline does NOT produce prices. Per UX-BRIEF v3 §3 Q6: "Price suggestions are NOT generated here."
- **UX-SPEC-V3** (Phase C C1, just composed) — defines the visual treatment for proposals (italic + ✓ accept; per-field bulk-accept rules; no bulk-accept for prices). This brief's surfaces section (§6) integrates against that spec.
- **BP-D7 copy audit** — established the "AI advisory, not authoritative" language posture. Proposals never use "AI-verified" / "AI-certified"; safe phrasings are "AI-suggested," "AI-flagged," "AI-consistent-with-claim."

---

## 3. Locked decisions

| # | Decision | Locked answer | Implication |
|---|---|---|---|
| E1 | Pipeline scope | **Per-asset proposals (caption + keywords + tags) in v1; batch-scoped Story group clustering in v2** | v1 ships the cheap, well-understood per-asset transformations. Clustering is harder (cross-asset; needs embeddings; requires sufficient session size to be useful) and ships when v1 has data to inform tuning. |
| E2 | Vision model (per-asset) | **Anthropic Claude Vision (claude-sonnet-4-6 or successor)** | Aligned with Anthropic-built platform. Cost reasonable. Quality high. Data residency clear. Trust posture aligned (Anthropic's Acceptable Use Policy + Frontfiles' constraints). Single vendor for v1 reduces operational complexity. |
| E3 | Embedding model (clustering, v2) | **Open-source CLIP-family for visual embeddings (e.g., `openai/clip-vit-large-patch14` via local inference); sentence-transformers for caption similarity** | Anthropic does not publish embedding APIs. Local inference for embeddings keeps data residency clean and cost predictable. Compute cost dominated by clustering pass at session boundaries. |
| E4 | Cost accounting | **Platform-paid in v1; per-call cost captured in audit log for future creator-metering** | Hide cost from creators in v1 — they shouldn't have to think about per-asset AI cost while building the habit of accepting/editing suggestions. Capture cost data so future creator-metering (or quota enforcement) is a config change, not a re-architecture. |
| E5 | Failure handling | **Advisory failure** — silent fail with one retry; absence of proposal does not block ingestion or delivery; creator can manually regenerate per-field | The asset commits regardless of whether the AI ran. The proposal table tracks `generation_status='failed'` but the UI gracefully handles absence (empty placeholder, "Regenerate" affordance). One automatic retry; then human-triggered. |
| E6 | Trust posture | **Advisory only — never authoritative.** Creator action required to accept any proposal into asset metadata. Bulk-accept allowed for caption/keywords/tags (per UX-SPEC-V3 §9.2). Language constrained per BP-D7 audit findings. | All proposal copy uses "AI suggestion," "AI thinks," "AI-flagged" — never "AI-verified," "AI-certified," "AI-validated." UI visual treatment per UX-SPEC-V3 §9.1 (italic + muted) reinforces non-authoritative status. |
| E7 | Storage architecture | **New `asset_proposals` table** (per-asset rows; one row per asset, with proposal fields as columns). **New `asset_proposal_clusters` table** (v2 only — one row per AI-detected cluster). **New `asset_proposal_audit_log` table** (mirrors `pricing_audit_log` shape). | Symmetric with price engine schema posture. Proposals separate from `asset_media`. Audit log separate from proposal table for the same reasons price engine separates them. |
| E8 | Trigger | **Inline with derivative processing** at ingestion. Same worker invocation; new job type. | Per UX-BRIEF v3 §5.2: same async pipeline as derivatives. Single worker process scans `asset_proposals` rows alongside `asset_media` rows. Reuses PR 4 reaper / FOR UPDATE SKIP LOCKED pattern. |
| E9 | Tag taxonomy alignment | **Prefer existing creator taxonomy; allow new tags above confidence threshold** | When suggesting tags, the AI prompt includes the creator's existing tag list as preferred vocabulary. New tags allowed only when AI confidence ≥ 0.75 (defensive default; tunable in F1 architecture brief). |

---

## 4. Pipeline architecture

### 4.1 Job classes

The pipeline has **two job classes**, with different trigger semantics and worker patterns:

**Class A — Per-asset job** (v1):
- Trigger: asset commit (`asset_proposals` row inserted with `generation_status='pending'` by enqueue helper)
- Inputs: original file bytes (via storage adapter); creator's tag taxonomy; asset format
- Outputs: caption + keywords + tags + confidence + per-call cost/latency
- Concurrency: per-asset; many assets process in parallel via the existing PR 4 worker pattern
- Idempotency: UNIQUE `(asset_id)` on `asset_proposals` table prevents duplicate rows; replay overwrites the proposal row

**Class B — Batch-scoped clustering job** (v2):
- Trigger: deferred batch analysis. Fires when (a) a batch transitions to `'committing'` state per `upload_batches`, OR (b) explicit creator action ("Re-analyze this session"). Does NOT fire per-asset.
- Inputs: visual embeddings of all assets in the batch (computed during Class A as a side-output); capture_date metadata; AI-generated captions
- Outputs: cluster assignments + cluster confidence (Silhouette score per cluster) + AI-suggested cluster names
- Concurrency: one job per batch; bounded by batch size (max ~2,000 assets per UX-BRIEF v3 §3 Q2)
- Idempotency: re-running for the same batch overwrites the cluster set; creator-accepted clusters are protected (their `accepted_as_story_group_id` is preserved)

### 4.2 Class A — per-asset job (v1)

**Per-asset processing pipeline:**

```
1. Worker claims asset_proposals row (FOR UPDATE SKIP LOCKED, transition pending→processing)
2. Stamp processing_started_at = now() (for reaper)
3. Fetch original bytes via storage bridge (same bridge as PR 4 derivative worker)
4. Build vision request:
   - Image: original bytes
   - Prompt: structured prompt requesting (caption, keywords, tags) per asset format
   - Tag taxonomy hint: creator's existing tags (top 50 by usage)
   - Output format: JSON with confidence per field
5. Call Anthropic Vision API (claude-sonnet-4-6 or current default)
6. Parse response:
   - caption: string, max 200 chars (per UX-SPEC-V3 IP-C3 if ratified)
   - keywords: string[], 3-8 items
   - tags: string[], filtered to only creator-existing tags + new tags above 0.75 confidence
   - confidence: per-field 0..1
7. Capture cost + latency from API response
8. Update asset_proposals row:
   - generation_status='ready', stamp values, model_version, cost, latency
   - Clear processing_started_at
9. (v2 side-effect) Compute and store visual_embedding for later clustering use
10. On exception: increment retry_count; if retry_count < 1, set status back to pending; else set status='failed' with error message
```

**Prompt design (high level):**

The prompt is structured to elicit JSON output with explicit confidence scoring. Per E9, the prompt includes the creator's existing tag taxonomy as preferred vocabulary. Prompt text itself is locked in F1 architecture brief (Phase E1 follow-on; this brief commits to the structure, not the exact wording).

Constraints baked into the prompt:
- "You are providing AI-suggested metadata that the creator will review. Be specific but conservative. If you are uncertain, lower your confidence score."
- "For tags: prefer the provided existing-tag list. Suggest a new tag only if no existing tag fits and your confidence is at least 0.75."
- "For captions: be descriptive of what is in the image. Do not infer intent or context not visually present."
- "Output as JSON; do not add commentary."

**Per-format treatment:**

| Format | Caption | Keywords | Tags |
|---|---|---|---|
| `photo` | Visual description | Visual concepts (subject, setting, mood) | Aligned to creator's photo tag taxonomy |
| `illustration` | Visual + style description | Style + subject | Aligned to creator's illustration tags |
| `infographic` | Topic + chart-type description | Subject domain | Aligned to creator's infographic tags |
| `vector` | Visual + style description | Same as illustration | Same as illustration |
| `video`, `audio`, `text` | NOT in v1 scope | — | — |

v1 ships image-format proposals only. Non-image formats receive no proposals (the asset still commits; the proposal row is created with `generation_status='not_applicable'` or similar — exact value resolved in F1).

### 4.3 Class B — batch-scoped clustering (v2)

**Story group clustering pipeline (v2):**

```
1. Trigger: batch state transitions to 'committing' (per upload_batches state machine)
   OR explicit creator "Re-analyze session" action
2. Query: SELECT visual_embedding, capture_date, caption FROM asset_proposals
   WHERE asset_id IN (assets of this batch)
3. Build cluster input matrix:
   - Visual embedding (CLIP, 512-dim vector) — primary signal
   - Capture date — secondary signal (time proximity favors clustering)
   - Caption embedding (sentence-transformers) — tertiary signal
4. Run HDBSCAN clustering (handles variable cluster sizes natively;
   doesn't require N to be specified; identifies noise points naturally)
5. For each cluster:
   - Compute Silhouette score
   - Generate cluster name via Claude (prompt: "Given these N captions and dates,
     suggest a 2-4 word descriptive title")
   - Insert asset_proposal_clusters row
   - Update asset_proposals.cluster_id for member assets
6. Skip surfacing clusters with Silhouette < 0.3 (low confidence; would create UX noise)
7. UI banner per UX-SPEC-V3 §5.2 — "5 assets appear to be from one shoot..."
```

**Cluster name generation (v2 detail):**

Per UX-SPEC-V3 IP-C1 (ratified default: AI auto-generated from content with date-range fallback):
- AI generates a 2-4 word descriptive title from captions
- If AI confidence is low or output is generic ("Photos"), fall back to date-range: "Mar 14–16, 2026"
- Creator can rename inline at any time

### 4.4 Schema

New tables in Phase E migrations. v1 ships two tables; v2 adds the clusters table.

**v1 tables (Phase E2):**

```sql
CREATE TABLE asset_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL UNIQUE REFERENCES vault_assets(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Generation state machine (mirrors asset_media pattern)
  generation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'processing', 'ready', 'failed', 'not_applicable')),
  processing_started_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  -- Per-field proposals (NULL until ready)
  caption TEXT,
  caption_confidence NUMERIC(3,2),
  keywords TEXT[],
  keywords_confidence NUMERIC(3,2),
  tags TEXT[],
  tags_confidence NUMERIC(3,2),
  -- v2 prep: visual_embedding stored at v1 generation time so v2 clustering
  -- can use it without re-running vision. Column added in v1; populated by
  -- v1 worker only when v2 clustering is enabled (otherwise NULL).
  visual_embedding vector(512),  -- requires pgvector extension
  -- Provenance
  model_version TEXT,
  generation_cost_cents INTEGER,
  generation_latency_ms INTEGER
);

CREATE INDEX asset_proposals_status_idx
  ON asset_proposals(generation_status);

CREATE INDEX asset_proposals_pending_idx
  ON asset_proposals(asset_id) WHERE generation_status = 'pending';

CREATE TABLE asset_proposal_audit_log (
  -- Mirrors pricing_audit_log shape (PRICE-ENGINE-BRIEF v3 §4.5).
  -- v1 ships 4 of 5 event types. recommendation_shown deferred to v2
  -- per same rationale as pricing audit (high-volume, low-signal).
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  asset_id UUID NOT NULL REFERENCES vault_assets(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
    -- v1: 'proposal_generated' | 'proposal_accepted' | 'proposal_overridden' | 'proposal_dismissed'
    -- v2: + 'proposal_shown' (deferred)
  proposal_id UUID REFERENCES asset_proposals(id),
  field_name TEXT,           -- 'caption' | 'keywords' | 'tags' | NULL for non-field events
  before_value JSONB,        -- previous value (NULL on first set)
  after_value JSONB,         -- new value (NULL on dismiss)
  surface TEXT NOT NULL,     -- 'upload' | 'vault_edit' | 'bulk_action'
  override_reason TEXT
);

CREATE INDEX asset_proposal_audit_log_asset_creator_time
  ON asset_proposal_audit_log(asset_id, creator_id, event_at DESC);
```

**v2 table (Phase E directive TBD, post v1 ship):**

```sql
CREATE TABLE asset_proposal_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id),
  batch_id UUID REFERENCES upload_batches(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  proposed_name TEXT,
  asset_count INTEGER NOT NULL,
  silhouette_score NUMERIC(3,2),
  model_version TEXT NOT NULL,
  -- Acceptance tracking
  accepted_as_story_group_id UUID,
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

ALTER TABLE asset_proposals
  ADD COLUMN cluster_id UUID REFERENCES asset_proposal_clusters(id),
  ADD COLUMN cluster_confidence NUMERIC(3,2);
```

### 4.5 Trigger and worker integration

The pipeline reuses the PR 4 worker infrastructure (Phase B, shipped per Path B). Specifically:
- The same `scripts/process-derivatives.ts` script picks up both `asset_media` pending rows AND `asset_proposals` pending rows.
- The script's reaper pass extends to clear stuck `asset_proposals` rows past the `FFF_PROCESSING_TIMEOUT_SECONDS` threshold.
- A new function `dispatchAssetProposalForProcessing(assetId, storage)` is added to the `dispatcher` module, mirroring `dispatchAssetForProcessing`. It runs the per-asset Class A pipeline.
- Commit-service fires this dispatch alongside the existing derivative dispatch (both are fire-and-forget).

This means Phase E does NOT introduce a new worker process. It extends the existing PR 4 worker with a second job type. Operationally, one cron / one schedule serves both pillars.

### 4.6 Trust posture

Same as price engine §7 (PRICE-ENGINE-BRIEF v3):

| Allowed | Forbidden |
|---|---|
| "AI suggestion" / "AI-suggested" | "AI-verified" |
| "AI thinks this is..." | "AI-validated" |
| "AI-flagged for review" | "AI-certified" |
| "Review AI suggestion" | "Confirmed by AI" |
| "Suggested caption" | "AI-approved" |

The pipeline never writes proposal values directly to `vault_assets.{title, description, tags}` — those columns are creator-authoritative. Proposal acceptance is an explicit creator action that copies the proposal value to the canonical asset metadata, with the audit log recording the acceptance.

---

## 5. Model selection (vendor + version)

### 5.1 Vision model (per-asset, v1)

**Anthropic Claude Vision** — `claude-sonnet-4-6` or current Anthropic vision-capable Sonnet model (per Anthropic's release cadence; F1 specifies the exact model and pin policy).

Why:
- Single vendor reduces operational complexity (one API key, one billing relationship, one terms of service)
- Quality competitive with leading vision models (per published benchmarks)
- Costs are predictable and reasonable for the per-asset volume we expect
- Data residency and AUP align with Frontfiles' editorial posture
- Already used elsewhere in Anthropic-built infrastructure assumptions

Alternatives considered (rejected for v1):
- OpenAI GPT-4o-vision: higher quality on some benchmarks; multi-vendor adds operational complexity; per-call cost slightly higher
- Open-source vision models (LLaVA, Qwen-VL): higher latency, lower quality, infrastructure cost (GPU hosting); revisit if cost or data-residency concerns demand

Pin policy (locked in F1): pin to a specific model version string in production; bump explicitly via a directive that tests proposal quality on a representative sample.

### 5.2 Embedding model (clustering, v2)

**Visual embeddings:** open-source CLIP-family (`openai/clip-vit-large-patch14` or successor) via local inference. Reasons:
- Anthropic does not publish embedding APIs as of brief date
- Local inference keeps data residency clean (no per-asset bytes to a third party for embedding)
- 512-dim vectors are well-supported in pgvector
- Free at inference time (modulo compute cost); no per-call API charge

**Caption embeddings:** sentence-transformers (`all-MiniLM-L6-v2` or successor) for the caption-similarity signal in clustering.

Both run in v2 only. v1 captures `visual_embedding` as a side-output (optional column populated only when v2 is being prepared) but does not yet cluster.

### 5.3 Cost envelope (v1)

Estimate per asset, v1:
- One Anthropic Vision API call per asset
- ~$0.005 - $0.015 per call depending on image size and Claude model tier
- One creator session of 10 assets ≈ $0.05 - $0.15 in AI cost
- Archive session of 1,000 assets ≈ $5 - $15

These are platform-paid in v1. Captured per-call in `asset_proposals.generation_cost_cents` so future creator-metering or platform-quota enforcement is a config change.

If a platform-wide spend cap needs to engage (e.g., single creator runs through 10,000 assets in one session), the worker checks a daily/monthly spend limit before each call and falls through to `generation_status='not_applicable'` with reason `platform_quota_exceeded` if exceeded. Specific limits resolved in F1.

---

## 6. Surfaces

### 6.1 Upload flow integration

Per UX-SPEC-V3 §9 — proposals appear in the asset list and side detail panel:

| Field | Display |
|---|---|
| Caption | Italic + muted ghost text in caption input; ✓ accept icon to right |
| Keywords | Same treatment; separate input |
| Tags | Ghost chips with "AI:" prefix in the tag chip input |
| Story group cluster (v2) | Banner above the asset list (Batch/Archive modes); accept/dismiss/details |

Per UX-SPEC-V3 §9.4 — every field has a "Regenerate" affordance (small ↻ icon) that re-invokes the AI for that field only.

### 6.2 Vault asset edit (post-upload)

After commit, the asset detail page in `/vault` shows existing proposals (from `asset_proposals`) on the edit screen. Creator can accept/edit/regenerate the same way as in upload.

If a proposal is missing (because v1 didn't run, or generation failed, or asset is non-image), an "Generate AI suggestions" affordance triggers the pipeline on demand.

### 6.3 Bulk operations (v2)

The bulk operations bar in upload (UX-SPEC-V3 §4.2 / §5) supports bulk-accept across selected assets for caption / keywords / tags. Per UX-SPEC-V3 §9.2, NEVER for prices — that constraint is reinforced in this brief by §3 E6 (trust posture) and §7.1 (language discipline).

Bulk-accept mechanics:
- Per field, applies to all selected assets that have a non-accepted AI proposal for that field
- Single creator action; logged as N audit events (one per asset, one per field)
- For tags specifically: union of existing tags + AI suggestions; deduped

---

## 7. Trust + governance

### 7.1 Language discipline

The pipeline's load-bearing property is trust. The trust posture is non-negotiable.

In addition to the allowed/forbidden table in §4.6:
- Proposal copy in UI never says "AI generated this" without a "review" or "suggestion" framing
- Per BP-D7 audit findings: never claim that the AI has performed verification, validation, certification, or fact-checking
- Captions specifically may not include factual claims AI cannot verify (people identification, location identification, event identification) — the prompt design enforces this constraint
- Tags follow the creator's taxonomy preferentially; new tag suggestions are clearly marked

### 7.2 Audit trail

Per PRICE-ENGINE-BRIEF v3 audit pattern, all proposal events are logged in `asset_proposal_audit_log`:

**v1 events:**
- `proposal_generated` — pipeline ran for an asset (kept in v1; bounded by ingest volume)
- `proposal_accepted` — creator accepted (per field; row records which field)
- `proposal_overridden` — creator set a value different from the proposal
- `proposal_dismissed` — creator viewed and explicitly dismissed without accepting

**v2 event:**
- `proposal_shown` — view-tracking; deferred for the same noise/value reason as price engine

Every event records: asset, creator, surface, field, before/after JSONB values, optional override reason.

### 7.3 Per-creator opt-in / opt-out

- Pipeline runs by default for all assets at ingestion (Class A, v1)
- Creators can opt out per asset (dismiss every proposal field), per format (admin setting "no AI suggestions for [format]"), or globally (settings toggle)
- Opt-out hides the UI surfacing; the pipeline still runs server-side (so re-enabling is instant; preserves data for analytics)
- (No per-creator vendor opt-in. The vendor is platform-locked; creators don't choose between Claude and other models. Future: if quality/cost/posture changes, vendor change is a platform decision, not per-creator.)

### 7.4 Confidence floors

- Proposals with `confidence < 0.3` per field are treated as "AI was uncertain": surfaced with extra muting + a "Low confidence" indicator; not bulk-acceptable above the indicator
- Tags: only suggested tags with `confidence ≥ 0.75` are surfaced (per E9)
- Cluster proposals (v2): only clusters with `silhouette_score ≥ 0.3` are surfaced

Specific confidence floors are tunable in F1 architecture brief.

---

## 8. Phase E sequencing

Phase E is staged into **v1 (ship)** and **v2 (growth)**. v1 is the per-asset proposal pipeline that gives creators caption/keywords/tags suggestions. v2 adds Story group clustering once v1 has shipped and provided embeddings to inform tuning.

```
Phase E — AI Pipeline v1 (parallel-able with Phase B, C, F)

  E1 Architecture brief — model selection, schema, prompt structure,
     cost envelope, trust posture
       • This document, awaiting founder ratification
       • Resolves §3 (locked decisions); surfaces §9 open decisions

  E1.5 Architecture brief follow-on — exact model pin, prompt text,
       confidence thresholds, per-format treatment details
       • Output: src/lib/processing/AI-PIPELINE-ARCHITECTURE.md
       • Founder ratifies before E2 starts
       • Resolves §9.1-§9.5

  E2 Schema migration + service skeleton
       • Tables: asset_proposals, asset_proposal_audit_log
       • Module: src/lib/ai-suggestions/{engine.ts, schema.ts, audit.ts, settings.ts}
       • Stub adapters: vision-anthropic adapter; mock adapter for tests
       • Full audit logging from day one (4 of 5 event types)

  E3 Per-asset job class — caption + keywords + tags via Anthropic Vision
       • Implementation of Class A pipeline (§4.2)
       • Tests: prompt construction; response parsing; confidence handling;
         retry-once behavior; cost capture

  E4 Worker integration — extend PR 4 dispatcher / scripts to handle
     asset_proposals pending rows alongside asset_media pending rows
       • Touches: scripts/process-derivatives.ts (extend findPendingAssets),
         dispatcher.ts (add dispatchAssetProposalForProcessing)
       • Reaper extends to cover asset_proposals
       • Tests: end-to-end pending → ready transition with mock vision adapter

  E5 UI integration — proposals appear in asset rows per UX-SPEC-V3 §9
       • Touches: new upload UI shell (Phase C C2); asset edit screens
       • Per-field accept/edit/dismiss/regenerate actions wire through
       • Bulk-accept for caption/keywords/tags (NOT prices)
       • Audit logging on every event

  E6 Vault asset edit integration — proposals visible + regeneratable on
     existing vault asset detail screens

  v1 EXIT: 6 directives. Caption/keywords/tags suggestions running on
           every asset commit; visible in upload + vault edit; full audit
           trail; cost capture; opt-in/opt-out controls.

Phase E — AI Pipeline v2 (after v1 ships and clustering signal is needed)

  E7 Visual embedding capture — extend Class A to also compute and store
     visual_embedding alongside the caption/keywords/tags
     (uses local CLIP inference)

  E8 Class B — batch-scoped clustering job
     - HDBSCAN clustering across batch
     - Cluster name generation via Claude
     - Confidence floor enforcement
     - asset_proposal_clusters table

  E9 UI — Story group cluster banners per UX-SPEC-V3 §5.2
     - Banner display in Batch/Archive modes
     - Accept/dismiss/see-details actions
     - Cluster acceptance creates Story groups
     - Re-analyze session affordance

  v2 EXIT: 3 additional directives. Clustering shipped; banners live;
           creator can manually trigger re-analysis.
```

Estimated **v1: 6 directives** plus the E1 + E1.5 architecture briefs (this doc + the follow-on detail brief). E1.5 is its own ratification gate before E2.

**v2: 3 additional directives**, deferred until v1 is in production and clustering signal is needed (likely 3-6 months post-v1 ship as platform volume grows).

Phase E runs in parallel with Phases B, C, F — touches a disjoint surface (new `src/lib/ai-suggestions/` module, new schema migrations). Integration points: Phase C UI consumes proposals; Phase B worker infrastructure is reused.

---

## 9. Open decisions still pending

These do not block E1 ratification but must be resolved before the relevant directive composes:

1. **Exact Anthropic model pin** (E2/E3) — claude-sonnet-4-6 vs successor; pin policy. Resolved in E1.5.
2. **Prompt text** (E3) — exact wording of the per-format prompts. Resolved in E1.5; tested against representative sample.
3. **Confidence floor values** (§7.4) — currently proposed: 0.3 for proposals, 0.75 for new tags, 0.3 silhouette for clusters. Tunable; defaults locked in E1.5.
4. **Per-format treatment** (§4.2) — how prompts differ across photo/illustration/infographic/vector. Resolved in E1.5.
5. **Platform spend cap and behavior** (§5.3) — daily/monthly cost ceiling; behavior on exceedance (queue / reject / degrade). Resolved in E1.5.
6. **Image size handling** (§4.2) — vision API has size limits; need to choose whether to send original or a resized derivative (the watermarked_preview from the derivative pipeline could be reused). Resolved in E1.5.
7. **pgvector availability** (E2) — Supabase Postgres needs pgvector enabled; verify before E2 schema migration. If unavailable, v1 visual_embedding column is deferred to v2 and stored elsewhere.
8. **Tag taxonomy size** (§E9) — top 50 tags by usage as the prompt hint; tunable. Resolved in E1.5.
9. **Cluster job trigger granularity** (§4.3) — fires on batch 'committing' transition vs creator-triggered. Resolved in v2 architecture work.
10. **Caption length cap** (per UX-SPEC-V3 IP-C3) — 200 chars proposed; resolved in C1 ratification or here.

---

## 10. Approval gate

Before any Phase E directive composes, the founder ratifies this brief.

Ratification means: the nine locked decisions in §3 stand, the architecture in §4 is the target, the trust posture in §6/§7 is the boundary condition, the v1/v2 sequencing in §8 is the order, the open decisions in §9 are tracked for E1.5 resolution.

Two-stage approval gate (matches PRICE-ENGINE-BRIEF pattern):
1. **This brief (E1)** — high-level architecture + locked decisions
2. **E1.5** (`AI-PIPELINE-ARCHITECTURE.md`, TBD) — model pin + prompt text + confidence values + per-format details. Founder ratifies before E2 schema migration.

---

## 11. Don't-do list

To keep subsequent sessions from drifting:

1. **Don't auto-accept any proposal into authoritative metadata.** Per E6, every acceptance is creator action. The AI never writes to `vault_assets.{title, description, tags}` directly.
2. **Don't use authoritative or certifying language in proposal copy.** Per §4.6 + §7.1, allowed: "AI suggestion," "AI-flagged"; forbidden: "AI-verified," "AI-certified," "AI-validated."
3. **Don't bulk-accept prices.** Per E6 + UX-SPEC-V3 §9.2 + PRICE-ENGINE-BRIEF v3 §11.16. AI pipeline doesn't generate prices, but if any future code path includes prices in a "bulk accept all proposals" action, it is wrong.
4. **Don't skip the audit log on any proposal event.** Generation, accept, override, dismiss are logged from v1. Trust infrastructure isn't deferrable.
5. **Don't ship clustering in v1.** Frontfiles doesn't yet have the volume or the embedding storage tested at scale to make clustering produce useful signal in initial sessions. Defer to v2.
6. **Don't ship without confidence floors.** Low-confidence proposals surface with extra muting and "Low confidence" indicators; never as authoritative-looking values.
7. **Don't introduce a new worker process for AI.** Reuse the PR 4 worker via the dispatcher extension. One worker, two job types.
8. **Don't expose AI cost to creators in v1.** Platform-paid; cost captured in audit log for future metering. Surfacing cost adds friction without value early.
9. **Don't conflate the AI pipeline with the price engine.** They are separate pillars per UX-BRIEF v3 §3 Q6 + Q8 / PRICE-ENGINE-BRIEF v3 §3. AI generates caption/keywords/tags/clusters; price engine generates price recommendations. Mixing their schemas, jobs, or surfaces is wrong.
10. **Don't ship v2 (clustering) without E1.5 + E7-E9 sequenced separately.** Clustering is its own architecture decision that requires the v1 data + embeddings to be available first. Don't try to compress E7-E9 into v1.
11. **Don't include factual claims in caption proposals that the AI cannot verify** (person identification, location identification beyond what EXIF GPS reveals, event identification, source attribution). The prompt design enforces this constraint; UI copy reinforces it; reviewers reject if it slips.

---

## 12. References

- UX brief (consumer surface): `docs/upload/UX-BRIEF.md` v3 §4.4 + §5.2 + §7
- UX spec (visual treatment): `docs/upload/UX-SPEC-V3.md` §9 (AI proposal surfacing) + §10 (exception model)
- Price engine brief (sister architecture; constraints inherited): `docs/pricing/PRICE-ENGINE-BRIEF.md` v3
- Implementation plan (worker infrastructure reused): `src/lib/processing/IMPLEMENTATION-PLAN.md` + `src/lib/processing/PR-4-PLAN.md`
- BP/Watermark copy audit (language discipline): `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md`
- Trust language posture (CLAUDE.md item 9): root CLAUDE.md
- Future architecture brief: `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` (TO BE CREATED in E1.5)

---

End of AI suggestion pipeline brief.
