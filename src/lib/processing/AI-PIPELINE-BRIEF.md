# Frontfiles AI Suggestion Pipeline — Architecture Brief

**Status:** REVISED 2026-04-27 (v2) — supersedes v1 (2026-04-26). Awaiting founder ratification before any Phase E directive composes.
**Date:** 2026-04-27
**Scope:** Frontfiles AI suggestion pipeline — what it produces, what models it uses, how it stores proposals, how it surfaces them, how it fails, how it's governed for trust.
**Governs:** Phase E (AI suggestion pipeline) — runs in parallel with Phase B (backend), Phase C (UI rebuild — shipped via PR #15), Phase F (price engine) per `UX-BRIEF.md` v3 §6.
**Reads underlying:**
- `INTEGRATION_READINESS.md` v2 (2026-04-17) — D1–D12 architectural locks, in particular **D6** (AI vendor = Vertex AI Gemini, locked by "Google for everything" scope), **D7** (embedding model = `text-embedding-004`), **D8** (per-creator AI processing residency: EU → `europe-west4`, US → `us-central1`), **D9** (data-out-of-training via Vertex AI endpoint, not Gemini Developer API)
- `PLATFORM_REVIEWS.md` v2 (2026-04-17) — **D-U2** (real AI clustering ships in v1; pgvector + Vertex AI wrapper are HARD launch gates)
- `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql` (2026-04-19, shipped) — pgvector extension, `asset_embeddings(extensions.vector(768))` with HNSW cosine, `ai_analysis` cache, `audit_log`. All RLS service-role-only.
- `CLAUDE_CODE_PROMPT_SEQUENCE.md` — **CCP 7** (Vertex AI wrapper + per-region routing) and **CCP 9** (Vision API + upload-pipeline enqueue) are queued prompts; this brief governs what they produce.
- `docs/upload/UX-BRIEF.md` v3 (§4.4 surfacing, §5.2 pillar definition, §7 open decisions); `docs/upload/UX-SPEC-V4.md` (post-PR-#15 surfacing); `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 (sister architecture; defines what this pipeline does NOT cover); `src/lib/processing/IMPLEMENTATION-PLAN.md` + `PR-4-PLAN.md` (worker infrastructure reused); `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` (constrains language for proposal copy).

**Revision summary (2026-04-27):** v1 (2026-04-26) introduced Anthropic Claude Vision + open-source CLIP embedding + clustering deferred to v2. Audit-first review on 2026-04-27 found this silently overrode D6/D7/D8/D9/D-U2 (locked 2026-04-17) plus the operationalized migration `20260419110000`. v2 re-aligns to those locks: vendor = Vertex AI Gemini Vision; embedding = `text-embedding-004` (768-dim, matches shipped column); clustering ships in v1 per D-U2; per-region routing per D8; data-out-of-training via Vertex endpoint per D9. Trust posture (§7) and proposal-table shapes (§4.4) survive vendor-neutral. See §13 Revision History.

---

## 1. What this brief is

A founder-locked record of the AI suggestion pipeline's architecture: what it produces, which models it uses, how it stores and surfaces proposals, what trust posture governs every output, and the v1 scope that ships per the prior platform-review locks.

This brief is build-governing. If a later directive proposes a structure that contradicts §3 (locked decisions) or §4 (pipeline architecture) or §7 (trust posture), the directive is wrong, not the brief. The trust posture in particular is non-negotiable — any drift toward authoritative AI claims, "AI-verified" language, or auto-acceptance of proposals into authoritative metadata requires an explicit revision pass on this brief, not a quiet override.

The pipeline is one of three architectural pillars of the upload + vault platform alongside the derivative pipeline (Phase B, governed by `IMPLEMENTATION-PLAN.md`) and the price engine (Phase F, governed by `PRICE-ENGINE-BRIEF.md` v3). It is consumed by the upload UI (V4, shipped via PR #15) as one source of proposals; the other source is the price engine.

---

## 2. Current-state read

The AI pipeline does not yet exist as runtime code. The `SimulationEngine` (per `ARCHITECTURE-BRIEF.md` §1.2) generates fake EXIF/IPTC/XMP/C2PA data; no real model is invoked. PR 5 cutover replaces the simulation with the real backend pipeline (PRs 1.3, 3, 4 — all shipped, dormant behind `FFF_REAL_UPLOAD=false`), but the AI proposal layer is what this brief plans.

What exists that this pipeline integrates with:

- **Migration `20260419110000_phase1_vector_cache_audit.sql` (shipped 2026-04-19)** — provisions pgvector extension, `asset_embeddings(extensions.vector(768))` with HNSW cosine index, `ai_analysis` cache table (read-through cache for Vertex AI / Vision API calls keyed on `(subject_type, subject_id, model, model_version, input_hash)`), and `audit_log` table. All three RLS service-role-only. **This brief reuses these tables; it does not replace them.**
- **PR 4 worker infrastructure** (Phase B, shipped) — the same worker pattern used to process derivative pending rows is reused to process AI proposal pending rows. New job class, same scheduler.
- **`asset_media` schema** — proposal data is NOT stored on `asset_media`; that table holds the file/derivative state only. AI proposals get their own table (§4.4).
- **Price engine** (Phase F, `PRICE-ENGINE-BRIEF.md` v3) — separate pillar; produces price recommendations. AI pipeline does NOT produce prices. Per UX-BRIEF v3 §3 Q6: "Price suggestions are NOT generated here."
- **UX-SPEC-V4** (Phase C, shipped via PR #15) — defines the visual treatment for proposals (italic + ✓ accept; per-field `→ all` button rules; no `→ all` for prices per L6). This brief's surfaces section (§6) integrates against that spec.
- **BP-D7 copy audit** — established the "AI advisory, not authoritative" language posture. Proposals never use "AI-verified" / "AI-certified"; safe phrasings are "AI-suggested," "AI-flagged," "AI-consistent-with-claim."

What is locked above this brief and conditions every decision below:

- **D6** (vendor = Vertex AI Gemini): single-vendor "Google for everything" framing
- **D7** (embedding model = Vertex `text-embedding-004`, 768-dim): native pgvector compatibility via the shipped column
- **D8** (per-creator residency: EU → `europe-west4`, US → `us-central1`): every Vertex call is regionally routed via the creator's `users.ai_region` field (added in CCP 7 work)
- **D9** (Vertex AI endpoint, not Gemini Developer API): keeps prompts out of training; required for the creator trust story
- **D-U2** (real AI clustering ships in v1): clustering is on the launch critical path, not a post-launch enrichment

---

## 3. Locked decisions

| # | Decision | Locked answer | Implication |
|---|---|---|---|
| E1 | Pipeline scope | **Per-asset proposals (caption + keywords + tags) AND batch-scoped Story group clustering both in v1**, per D-U2 lock | v1 ships both the cheap per-asset transformations AND the clustering pass that operates over the per-asset embeddings. Both run on the shipped pgvector + `asset_embeddings` + `ai_analysis` infrastructure. |
| E2 | Vision model (per-asset) | **Vertex AI Gemini Vision** — `gemini-2.5-flash` for per-asset metadata generation; `gemini-2.5-pro` reserved for cluster naming and complex prompts. Per D6 lock + "Google for everything" scope. **Per-region routing per D8**: EU creators → `europe-west4`, US creators → `us-central1`, routed via the `users.ai_region` field. **Vertex AI endpoint per D9** (never Gemini Developer API) | Single vendor; native EU/US residency; data out of training; aligned with `INTEGRATION_READINESS.md` Phase 4.B and CCP 7 prompt. Specific model pin + bump policy locked in E1.5. |
| E3 | Embedding model | **Vertex AI `text-embedding-004` (768-dim)** per D7 lock. Embeddings stored in shipped `asset_embeddings(extensions.vector(768))` table with HNSW cosine index. Embedding input shape: AI-generated caption + tags + format string concatenated (locked in E1.5) | Reuses the shipped column verbatim. No schema migration needed for embeddings. Same Vertex client routes embedding calls regionally per D8. |
| E4 | Cost accounting | **Platform-paid in v1; per-call cost captured via `ai_analysis.cost_cents` and `asset_proposal_audit_log` for future creator-metering** | Hide cost from creators in v1 — they shouldn't have to think about per-asset AI cost while building the habit of accepting/editing suggestions. Capture cost data so future creator-metering (or quota enforcement) is a config change, not a re-architecture. Daily/monthly platform spend ceiling locked in E1.5. |
| E5 | Failure handling | **Advisory failure** — silent fail with one retry; absence of proposal does not block ingestion or delivery; creator can manually regenerate per-field | The asset commits regardless of whether the AI ran. The proposal table tracks `generation_status='failed'` but the UI gracefully handles absence (empty placeholder, "Regenerate" affordance). One automatic retry; then human-triggered. Region failover policy locked in E1.5. |
| E6 | Trust posture | **Advisory only — never authoritative.** Creator action required to accept any proposal into asset metadata. Per-field `→ all` allowed for caption/keywords/tags/privacy/social-licensing/geography/licences (per UX-SPEC-V4 + D2.10); **never for price** (L6). Language constrained per BP-D7 audit findings. | All proposal copy uses "AI suggestion," "AI thinks," "AI-flagged" — never "AI-verified," "AI-certified," "AI-validated." UI visual treatment per UX-SPEC-V4 §9 (italic + muted) reinforces non-authoritative status. |
| E7 | Storage architecture | **New `asset_proposals` table** (per-asset rows; one row per asset, with proposal fields as columns). **New `asset_proposal_clusters` table — v1 per D-U2** (one row per AI-detected cluster). **New `asset_proposal_audit_log` table** (mirrors `pricing_audit_log` shape). Embeddings live in shipped `asset_embeddings`; cache hits live in shipped `ai_analysis`. | Symmetric with price engine schema posture. Proposals separate from `asset_media`. Audit log separate from proposal table for the same reasons price engine separates them. Reuses shipped pgvector + cache + audit infrastructure verbatim. |
| E8 | Trigger | **Per-asset job (Class A)**: inline with derivative processing at ingestion. Same worker invocation; new job type. **Cluster job (Class B)**: deferred batch analysis at `upload_batches` `'committing'` state transition, OR explicit creator action. | Per UX-BRIEF v3 §5.2: same async pipeline as derivatives. Single worker process scans `asset_proposals` rows alongside `asset_media` rows. Reuses PR 4 reaper / FOR UPDATE SKIP LOCKED pattern. |
| E9 | Tag taxonomy alignment | **Prefer existing creator taxonomy; allow new tags above confidence threshold** | When suggesting tags, the AI prompt includes the creator's existing tag list as preferred vocabulary. New tags allowed only when AI confidence ≥ 0.75 (defensive default; tunable in E1.5). Top-N taxonomy size locked in E1.5. |

---

## 4. Pipeline architecture

### 4.1 Job classes

The pipeline has **two job classes**, both shipping in v1 per D-U2:

**Class A — Per-asset job:**
- Trigger: asset commit (`asset_proposals` row inserted with `generation_status='pending'` by enqueue helper)
- Inputs: original file bytes (via storage adapter, then in-memory resize per E1.5 image-size strategy); creator's tag taxonomy; asset format; creator's `ai_region`
- Outputs: caption + keywords + tags + per-field confidence + per-call cost/latency; visual+text embedding written to `asset_embeddings` as a side-output
- Concurrency: per-asset; many assets process in parallel via the existing PR 4 worker pattern
- Idempotency: UNIQUE `(asset_id)` on `asset_proposals` table prevents duplicate rows; replay overwrites the proposal row and refreshes `asset_embeddings.updated_at`

**Class B — Batch-scoped clustering job (v1, per D-U2):**
- Trigger: deferred batch analysis. Fires when (a) a batch transitions to `'committing'` state per `upload_batches`, OR (b) explicit creator action ("Re-analyze this session"). Does NOT fire per-asset.
- Inputs: embeddings of all assets in the batch (already populated by Class A in `asset_embeddings`); `vault_assets.captured_at`; `asset_proposals.caption`
- Outputs: cluster assignments + cluster confidence (Silhouette score per cluster) + AI-suggested cluster names (via `gemini-2.5-pro`)
- Concurrency: one job per batch; bounded by batch size (max ~2,000 assets per UX-BRIEF v3 §3 Q2)
- Idempotency: re-running for the same batch overwrites the cluster set; creator-accepted clusters are protected (their `accepted_as_story_group_id` is preserved)

### 4.2 Class A — per-asset job

**Per-asset processing pipeline:**

```
1. Worker claims asset_proposals row (FOR UPDATE SKIP LOCKED, transition pending→processing)
2. Stamp processing_started_at = now() (for reaper)
3. Resolve creator's ai_region (from users table); load Vertex client for that region
4. Fetch original bytes via storage bridge (same bridge as PR 4 derivative worker)
5. In-memory resize the original to a Vertex-recommended long-edge (1568px default;
   E2 verifies against current Vertex docs per E1.5 §6.3) — uses original bytes,
   not watermarked_preview, to avoid contaminating the Vision input with the
   baked-in watermark bar
6. Build vision request:
   - Image: resized bytes (base64 inline if < 4 MiB, else signed URL)
   - Prompt: structured prompt requesting (caption, keywords, tags) per asset format
   - Tag taxonomy hint: creator's existing tags (top-N by usage; N locked in E1.5)
   - Output format: JSON with confidence per field
7. Read-through cache lookup in ai_analysis (per CCP 7 spec):
   - Key: (subject_type='asset', subject_id=asset_id, model='gemini-2.5-flash',
            model_version=<pinned>, input_hash=sha256(prompt + image_hash))
   - Hit → reuse cached output, skip API call (counts toward audit log as 'proposal_generated')
   - Miss → call Vertex AI Gemini Vision (gemini-2.5-flash by default), persist to ai_analysis
8. Parse response:
   - caption: string, max 200 chars (per UX-SPEC-V4 caption length cap, locked in E1.5)
   - keywords: string[], 3-8 items
   - tags: string[], filtered to only creator-existing tags + new tags above 0.75 confidence
   - confidence: per-field 0..1
9. Capture cost + latency from API response (Vertex returns token counts; cost computed
   per the published Vertex pricing table; updated quarterly via E1.5 bump policy)
10. Compute embedding: text-embedding-004 on (caption + " | " + tags.join(", ") + " | " + format)
    - Region matches the creator's ai_region (write region == read region, per D8)
    - Upsert into asset_embeddings (one row per asset)
11. Update asset_proposals row:
    - generation_status='ready', stamp values, model_version, cost, latency
    - Clear processing_started_at
12. On exception: increment retry_count; if retry_count < 1, set status back to pending; else set status='failed' with error message; circuit-breaker policy per region locked in E1.5
```

**Prompt design (high level):**

The prompt is structured to elicit JSON output with explicit confidence scoring. Per E9, the prompt includes the creator's existing tag taxonomy as preferred vocabulary. Prompt text itself is locked in E1.5 (this brief commits to the structure; E1.5 commits to the exact wording per format).

Constraints baked into the prompt:
- "You are providing AI-suggested metadata that the creator will review. Be specific but conservative. If you are uncertain, lower your confidence score."
- "For tags: prefer the provided existing-tag list. Suggest a new tag only if no existing tag fits and your confidence is at least 0.75."
- "For captions: be descriptive of what is in the image. Do not infer intent or context not visually present."
- "Output as JSON; do not add commentary."
- (BP-D7-aligned) "Do not assert factual claims about identified persons, locations, or events that you cannot derive from the image alone."

**Per-format treatment:**

| Format | Caption | Keywords | Tags |
|---|---|---|---|
| `photo` | Visual description | Visual concepts (subject, setting, mood) | Aligned to creator's photo tag taxonomy |
| `illustration` | Visual + style description | Style + subject | Aligned to creator's illustration tags |
| `infographic` | Topic + chart-type description | Subject domain | Aligned to creator's infographic tags |
| `vector` | Visual + style description | Same as illustration | Same as illustration |
| `video`, `audio`, `text` | NOT in v1 scope | — | — |

v1 ships image-format proposals only. Non-image formats receive `generation_status='not_applicable'` rows on the proposal table (so the audit trail still tracks why no proposal exists) but no Vertex calls are made.

### 4.3 Class B — batch-scoped clustering (v1, per D-U2)

**Story group clustering pipeline:**

```
1. Trigger: batch state transitions to 'committing' (per upload_batches state machine)
   OR explicit creator "Re-analyze session" action
2. Query: SELECT ae.embedding, va.captured_at, ap.caption
   FROM asset_embeddings ae
   JOIN vault_assets va ON va.id = ae.asset_id
   LEFT JOIN asset_proposals ap ON ap.asset_id = ae.asset_id
   WHERE ae.asset_id IN (assets of this batch)
3. Build cluster input matrix:
   - text-embedding-004 vector (768-dim) — primary signal (encodes caption + tags + format)
   - capture_date — secondary signal (time proximity favors clustering)
4. Run HDBSCAN clustering on cosine distance over the 768-dim embeddings
   (handles variable cluster sizes natively; doesn't require N to be specified;
    identifies noise points naturally)
5. For each cluster:
   - Compute Silhouette score
   - Generate cluster name via gemini-2.5-pro (prompt: "Given these N AI-generated
     captions and the date range, suggest a 2-4 word descriptive title")
   - Insert asset_proposal_clusters row
   - Update asset_proposals.cluster_id for member assets
6. Skip surfacing clusters with Silhouette < 0.3 (low confidence; would create UX noise)
7. UI banner per UX-SPEC-V4 — "5 assets appear to be from one shoot..."
```

**Cluster name generation:**

Per UX-SPEC-V4 cluster naming default (AI auto-generated from content with date-range fallback):
- gemini-2.5-pro generates a 2-4 word descriptive title from captions
- If AI confidence is low or output is generic ("Photos"), fall back to date-range: "Mar 14–16, 2026"
- Creator can rename inline at any time

**Why Vertex Gemini (not local CLIP) for embeddings:**

The 2026-04-19 migration's `asset_embeddings(vector(768))` was provisioned for `text-embedding-004` per D7. Re-using it removes the need for a 512-dim migration, a local-inference deployment, or a second vendor. The trade-off is that visual signal in the embedding flows via the AI-generated caption rather than via raw pixel embedding. v1 clustering accepts this trade because:
- The AI caption already encodes the visual content as language (Gemini Vision is highly accurate at this)
- Caption + tag + format concatenation gives the embedding multiple discriminative axes
- HDBSCAN over cosine similarity on 768-dim text embeddings is well-understood and well-tuned
- No GPU hosting; no second vendor; native EU/US residency

If clustering quality proves insufficient in production, evaluate Vertex's `multimodalembedding@001` (1408-dim native; would require a column migration to vector(1408) or a separate table). E1.5 names the quality-evaluation criteria and fallback path.

### 4.4 Schema

**Already shipped (migration `20260419110000_phase1_vector_cache_audit.sql`, 2026-04-19):**

```sql
-- Reused verbatim:
asset_embeddings (asset_id PK, embedding vector(768), model, model_version, region,
                  created_at, updated_at)
  + HNSW cosine index
  + RLS service-role-only

ai_analysis (id, subject_type, subject_id, model, model_version, region,
             input_hash, output JSONB, token_input, token_output, cost_cents,
             created_at)
  + UNIQUE (subject_type, COALESCE(subject_id, sentinel), model, model_version, input_hash)
  + RLS service-role-only

audit_log (id, event_type, actor_id, target_type, target_id, metadata JSONB,
           trace_id, ip_address, user_agent, created_at)
  + RLS service-role-only
```

**New tables in Phase E2 migration:**

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
  -- Cluster membership (populated by Class B)
  cluster_id UUID REFERENCES asset_proposal_clusters(id),
  cluster_confidence NUMERIC(3,2),
  -- Provenance (note: embedding lives in asset_embeddings, not here)
  model_version TEXT,
  generation_cost_cents INTEGER,
  generation_latency_ms INTEGER,
  region TEXT  -- 'europe-west4' | 'us-central1' per D8
);

CREATE INDEX asset_proposals_status_idx
  ON asset_proposals(generation_status);

CREATE INDEX asset_proposals_pending_idx
  ON asset_proposals(asset_id) WHERE generation_status = 'pending';

CREATE TABLE asset_proposal_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id),
  batch_id UUID REFERENCES upload_batches(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  proposed_name TEXT,
  asset_count INTEGER NOT NULL,
  silhouette_score NUMERIC(3,2),
  model_version TEXT NOT NULL,
  region TEXT NOT NULL,  -- per D8
  -- Acceptance tracking
  accepted_as_story_group_id UUID,
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE TABLE asset_proposal_audit_log (
  -- Mirrors pricing_audit_log shape (PRICE-ENGINE-BRIEF v3 §4.5).
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  asset_id UUID NOT NULL REFERENCES vault_assets(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
    -- v1: 'proposal_generated' | 'proposal_accepted' | 'proposal_overridden' |
    --     'proposal_dismissed' | 'cluster_proposed' | 'cluster_accepted' |
    --     'cluster_dismissed'
    -- v2: + 'proposal_shown' (deferred — high-volume, low-signal)
  proposal_id UUID REFERENCES asset_proposals(id),
  cluster_id UUID REFERENCES asset_proposal_clusters(id),
  field_name TEXT,           -- 'caption' | 'keywords' | 'tags' | NULL for non-field events
  before_value JSONB,        -- previous value (NULL on first set)
  after_value JSONB,         -- new value (NULL on dismiss)
  surface TEXT NOT NULL,     -- 'upload' | 'vault_edit' | 'bulk_action'
  override_reason TEXT
);

CREATE INDEX asset_proposal_audit_log_asset_creator_time
  ON asset_proposal_audit_log(asset_id, creator_id, event_at DESC);
```

The shipped `audit_log` (general-purpose) and the new `asset_proposal_audit_log` (proposal-event-grain) coexist — the same pattern PRICE-ENGINE-BRIEF v3 uses for `pricing_audit_log`. The general `audit_log` records system-grain events (`ai.gemini.call`, region failover, quota-cap engaged); the proposal audit log records every per-field acceptance/override/dismiss for trust-trail purposes.

### 4.5 Trigger and worker integration

The pipeline reuses the PR 4 worker infrastructure (Phase B, shipped per Path B). Specifically:
- The same `scripts/process-derivatives.ts` script picks up both `asset_media` pending rows AND `asset_proposals` pending rows.
- The script's reaper pass extends to clear stuck `asset_proposals` rows past the `FFF_PROCESSING_TIMEOUT_SECONDS` threshold.
- A new function `dispatchAssetProposalForProcessing(assetId, storage)` is added to the `dispatcher` module, mirroring `dispatchAssetForProcessing`. It runs the per-asset Class A pipeline.
- A new function `dispatchBatchClusteringForProcessing(batchId, storage)` runs Class B at batch commit.
- Commit-service fires the per-asset dispatch alongside the existing derivative dispatch (both fire-and-forget). Batch clustering is fired by the upload-batches state machine on `'committing'` transition.

Phase E does NOT introduce a new worker process. It extends the existing PR 4 worker with two new job types. Operationally, one cron / one schedule serves all three pillars (derivatives + per-asset proposals + cluster proposals).

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

**Vertex AI Gemini Vision** — `gemini-2.5-flash` for per-asset metadata generation.

Per D6 lock + "Google for everything" framing:
- Single vendor reduces operational complexity (one platform credential, one billing relationship, one terms of service)
- Vertex AI endpoint per D9 keeps prompts out of training (creator trust requirement)
- Native EU/US residency per D8 — no Bedrock/Vertex routing layer required (which would re-introduce the operational complexity D6 specifically rejected)
- Quality competitive with leading vision models (per published benchmarks)
- Costs are predictable and reasonable for the per-asset volume we expect

**Per-region routing** per D8:
- `users.ai_region` enum (`'eu' | 'us'`); default `'eu'` for new users outside the US (set during onboarding per CCP 7 work)
- Vertex client cached per region; both vision calls and embedding calls route via the creator's region
- Region failover: if creator's region is unhealthy (5 consecutive failures within 60s), circuit breaker opens; calls hold pending until cool-down, then retry. **Not** a cross-region failover in v1 — D8 residency is binding.

**Model pin policy:**
- Production pins to a specific model version string (resolved in E1.5)
- Bumps require a dedicated directive that tests proposal quality on a representative sample
- The `model_version` column on `asset_proposals` and `ai_analysis` records the actual version used per call, so cache invalidation on bump is automatic

Alternatives considered (rejected):
- **Anthropic Claude Vision**: rejected by D6 ("violates 'Google for everything' direction") and by D8 (Anthropic API is US-only; EU residency would require Anthropic-on-Bedrock or Anthropic-on-Vertex routing, which contradicts the single-vendor rationale)
- **OpenAI GPT-4o**: same D6 rejection
- **Open-source vision models (LLaVA, Qwen-VL)**: higher latency, lower quality, GPU hosting cost; would also require a parallel embedding stack

### 5.2 Embedding model

**Vertex AI `text-embedding-004` (768-dim)** per D7 lock.

Stored in shipped `asset_embeddings(extensions.vector(768))` table with HNSW cosine index. No schema migration needed.

**Embedding input shape** (locked in E1.5; default proposal):
```
caption + " | " + tags.join(", ") + " | " + format
```
- Truncated to Vertex's 8192-token input limit (caption is max 200 chars; tags rarely exceed 50 chars total; format is one word — total well under limit even pathologically)
- Same Vertex client + region as the Gemini Vision call (D8 residency: write region == read region)

**Cluster signal:** the 768-dim text embedding encodes (a) what's visible (via the AI caption), (b) how the creator categorizes it (via tags), and (c) format-distinct patterns. HDBSCAN over cosine similarity exploits all three.

**Quality evaluation gate (E1.5):** if cluster Silhouette scores remain pathologically low across ≥ 3 representative test batches, re-evaluate the embedding shape (alternatives: `multimodalembedding@001` 1408-dim with a column migration; or hybrid caption-text + Vision-API-labels embedding). E1.5 names the criteria.

### 5.3 Cost envelope (v1)

Per-asset cost composition:
- One Gemini Vision API call (`gemini-2.5-flash`) per asset
- One `text-embedding-004` call per asset (cheap; sub-cent)
- One `gemini-2.5-pro` call per cluster proposed (batch-amortized across cluster members)

**Numeric values are deliberately not asserted here.** Vertex pricing changes; pricing as-of-brief-composition is not load-bearing. E1.5 §7 locks the cost-tracking *schema* (which models, what dimensions to track) and the *bump cadence* (verified quarterly). E2 implementation directive verifies the current Vertex pricing at ship time; numeric ceiling defaults are part of E1.5 ratification.

Cost is platform-paid in v1. Every call captures cost-cents in `ai_analysis.cost_cents` (the read-through cache table) and aggregates to `asset_proposals.generation_cost_cents` so future creator-metering or platform-quota enforcement is a config change, not a re-architecture.

**Platform spend cap and behavior on exceedance** (locked in E1.5 §7):
- Daily and monthly platform-wide spend ceilings (defaults proposed in E1.5; founder approves at ratification)
- On exceedance: the worker checks the cap before each call; falls through to `generation_status='not_applicable'` with reason `'platform_quota_exceeded'`; logs `audit_log.event_type='ai.gemini.quota_exceeded'`; founder receives the alert via the existing audit → Sentry pipeline; auto-recovery at next day/month boundary

---

## 6. Surfaces

### 6.1 Upload flow integration

Per UX-SPEC-V4 (post-PR-#15) — proposals appear in the asset list and side detail panel:

| Field | Display |
|---|---|
| Caption | Italic + muted ghost text in caption input; ✓ accept icon to right; per-field `→ all` button per D2.10 |
| Keywords | Same treatment; separate input |
| Tags | Ghost chips with "AI:" prefix in the tag chip input |
| Story group cluster | Banner above the asset list (Batch/Archive modes); accept/dismiss/details |

Every field has a "Regenerate" affordance (small ↻ icon) that re-invokes the AI for that field only.

### 6.2 Vault asset edit (post-upload)

After commit, the asset detail page in `/vault` shows existing proposals (from `asset_proposals`) on the edit screen. Creator can accept/edit/regenerate the same way as in upload.

If a proposal is missing (because v1 didn't run, or generation failed, or asset is non-image), an "Generate AI suggestions" affordance triggers the pipeline on demand.

### 6.3 Bulk operations

The bulk operations bar in upload (UX-SPEC-V4) supports per-field `→ all` across selected/scoped assets for caption / keywords / tags / privacy / social-licensing / geography / licences. **Never for prices** — that constraint is reinforced in this brief by §3 E6 (trust posture) and by L6 + UX-SPEC-V4 §9.2 + PRICE-ENGINE-BRIEF v3 §11.16.

Per-field `→ all` mechanics:
- Applies to all in-scope assets that have a non-accepted AI proposal for that field
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
- `cluster_proposed` — Class B emitted a cluster
- `cluster_accepted` — creator accepted, creating a Story group
- `cluster_dismissed` — creator dismissed the cluster

**v2 event:**
- `proposal_shown` — view-tracking; deferred for the same noise/value reason as price engine

System-grain events go to the shipped `audit_log`:
- `ai.gemini.call` (cache miss)
- `ai.gemini.cache_hit`
- `ai.gemini.region_failover`
- `ai.gemini.quota_exceeded`

Every event records: asset, creator, surface, field, before/after JSONB values, optional override reason.

### 7.3 Per-creator opt-in / opt-out

- Pipeline runs by default for all assets at ingestion (Class A)
- Creators can opt out per asset (dismiss every proposal field), per format (admin setting "no AI suggestions for [format]"), or globally (settings toggle)
- Opt-out hides the UI surfacing; the pipeline still runs server-side (so re-enabling is instant; preserves data for analytics)
- (No per-creator vendor opt-in. The vendor is platform-locked per D6; creators don't choose between Vertex and other models. Future: if quality/cost/posture changes, vendor change is a platform decision, not per-creator.)

### 7.4 Confidence floors

- Proposals with `confidence < 0.3` per field are treated as "AI was uncertain": surfaced with extra muting + a "Low confidence" indicator; not bulk-acceptable above the indicator
- Tags: only suggested tags with `confidence ≥ 0.75` are surfaced (per E9)
- Cluster proposals: only clusters with `silhouette_score ≥ 0.3` are surfaced

Specific confidence floors are tunable in E1.5.

---

## 8. Phase E sequencing

Per D-U2, v1 ships per-asset proposals AND clustering together. v2 (post-launch enrichments) is intentionally narrow.

```
Phase E — AI Pipeline v1 (parallel-able with Phase B, F)

  E1 Architecture brief — model selection, schema, prompt structure,
     cost envelope, trust posture, per-region routing
       • This document (revised 2026-04-27), awaiting founder ratification
       • Resolves §3 (locked decisions); surfaces §9 open decisions

  E1.5 Architecture brief follow-on — exact model pin, prompt text,
       confidence thresholds, per-format treatment details, image-size
       strategy, cost ceiling, tag taxonomy size, embedding shape,
       region failover policy
       • Output: src/lib/processing/AI-PIPELINE-ARCHITECTURE.md
       • Founder ratifies before E2 starts
       • Resolves §9 open decisions

  E2 Schema migration + service skeleton
       • Tables: asset_proposals, asset_proposal_clusters, asset_proposal_audit_log
       • Module: src/lib/ai-suggestions/{engine.ts, schema.ts, audit.ts, settings.ts}
       • Stub adapter: vertex-gemini-vision adapter (production); mock adapter for tests
       • Full audit logging from day one
       • Note: pgvector + asset_embeddings + ai_analysis already shipped 2026-04-19

  E3 Per-asset job class — caption + keywords + tags via Vertex Gemini Vision
       • Implementation of Class A pipeline (§4.2)
       • Reuses ai_analysis cache (read-through per CCP 7 spec)
       • Writes asset_embeddings (text-embedding-004, region-routed per D8)
       • Tests: prompt construction; response parsing; confidence handling;
         retry-once behavior; cost capture; cache hit/miss; region routing

  E4 Worker integration — extend PR 4 dispatcher / scripts to handle
     asset_proposals pending rows alongside asset_media pending rows
       • Touches: scripts/process-derivatives.ts (extend findPendingAssets),
         dispatcher.ts (add dispatchAssetProposalForProcessing)
       • Reaper extends to cover asset_proposals
       • Tests: end-to-end pending → ready transition with mock vertex adapter

  E5 Cluster job class — batch-scoped clustering via HDBSCAN over asset_embeddings
       • Implementation of Class B pipeline (§4.3)
       • Cluster naming via gemini-2.5-pro
       • Trigger: upload_batches state machine on 'committing' transition
       • Tests: clustering reproducibility on fixture batch; silhouette floor;
         cluster name generation; idempotent re-run

  E6 UI integration — proposals appear in asset rows per UX-SPEC-V4
       • Touches: V4 upload UI shell (already shipped via PR #15);
         vault asset edit screens
       • Per-field accept/edit/dismiss/regenerate actions wire through
       • Per-field → all for caption/keywords/tags/etc. (NOT prices)
       • Cluster banner surfacing (Batch/Archive modes per UX-SPEC-V4)
       • Audit logging on every event

  v1 EXIT: 6 directives (E2-E6 implementation + E1.5 detail brief).
           Per-asset suggestions + clustering running on every batch commit;
           visible in upload + vault edit; full audit trail; cost capture;
           opt-in/opt-out controls; per-region residency.

Phase E v2 — post-launch enrichments (deferred)

  Future directives (TBD): face-detection consent flag, OCR caption suggestions,
  landmark/safe-search Vision API integration, multimodal embedding evaluation,
  proposal_shown view-tracking event.
```

Phase E runs in parallel with Phases B, F — touches a disjoint surface (new `src/lib/ai-suggestions/` module, new schema migrations on top of shipped pgvector). Integration points: Phase C UI (already shipped) consumes proposals; Phase B worker infrastructure is reused.

---

## 9. Open decisions still pending

These do not block E1 ratification but must be resolved in E1.5 before E2 composes:

1. **Exact Vertex model pins** (E2/E3) — `gemini-2.5-flash` (per-asset) and `gemini-2.5-pro` (cluster naming); specific version strings; bump policy. Resolved in E1.5.
2. **Prompt text per format** (E3) — exact wording of the per-format prompts for photo / illustration / infographic / vector. Resolved in E1.5; tested against representative sample.
3. **Confidence floor values** (§7.4) — currently proposed: 0.30 for proposals, 0.75 for new tags, 0.30 silhouette for clusters. Tunable; defaults locked in E1.5.
4. **Per-format treatment details** (§4.2) — concrete prompt differences across photo/illustration/infographic/vector. Resolved in E1.5.
5. **Platform spend cap and behavior** (§5.3) — daily/monthly cost ceiling values; behavior on exceedance (queue / reject / degrade). Resolved in E1.5.
6. **Image size strategy details** (§4.2) — long-edge 1568px in-memory resize from `original` (NOT `watermarked_preview` — that has a watermark baked in that would contaminate the Vision input); base64 inline up to 4 MiB else signed URL. Resolved in E1.5.
7. **Tag taxonomy size** (§E9) — top-N tags by usage as the prompt hint; tunable. Resolved in E1.5.
8. **Embedding input shape** (§5.2) — proposed: `caption + " | " + tags + " | " + format`. Locked in E1.5; quality-evaluation criteria for fallback to multimodalembedding@001.
9. **Region failover policy** (§5.1) — circuit breaker thresholds, cool-down duration, no cross-region fall-through (D8 binding). Locked in E1.5.
10. **Caption length cap** (UX-SPEC-V4) — 200 chars proposed; locked in E1.5.
11. **Cluster name generation prompt text** (§4.3) — exact prompt for gemini-2.5-pro. Resolved in E1.5.

Resolved during the 2026-04-27 audit (no longer open):
- ~~Anthropic model pin~~ → Vertex Gemini per D6
- ~~pgvector availability~~ → verified shipped via migration `20260419110000`
- ~~Cluster job trigger granularity~~ → batch `'committing'` transition + creator action (§4.3)

---

## 10. Approval gate

Before any Phase E directive composes, the founder ratifies this brief.

Ratification means: the nine locked decisions in §3 stand, the architecture in §4 is the target, the trust posture in §6/§7 is the boundary condition, the v1 sequencing in §8 is the order, the open decisions in §9 are tracked for E1.5 resolution.

Two-stage approval gate (matches PRICE-ENGINE-BRIEF pattern):
1. **This brief (E1, revised v2)** — high-level architecture + locked decisions + alignment to D6/D7/D8/D9/D-U2
2. **E1.5** (`AI-PIPELINE-ARCHITECTURE.md`) — model pin + prompt text + confidence values + per-format details + image-size strategy + cost ceiling + region failover. Founder ratifies before E2 schema migration.

---

## 11. Don't-do list

To keep subsequent sessions from drifting:

1. **Don't auto-accept any proposal into authoritative metadata.** Per E6, every acceptance is creator action. The AI never writes to `vault_assets.{title, description, tags}` directly.
2. **Don't use authoritative or certifying language in proposal copy.** Per §4.6 + §7.1, allowed: "AI suggestion," "AI-flagged"; forbidden: "AI-verified," "AI-certified," "AI-validated."
3. **Don't bulk-accept prices.** Per E6 + UX-SPEC-V4 §9.2 + L6 + PRICE-ENGINE-BRIEF v3 §11.16. AI pipeline doesn't generate prices, but if any future code path includes prices in a "bulk accept all proposals" action, it is wrong.
4. **Don't skip the audit log on any proposal event.** Generation, accept, override, dismiss, cluster_proposed, cluster_accepted, cluster_dismissed are all logged from v1. Trust infrastructure isn't deferrable.
5. **Don't introduce a second visual-embedding column or vector dimension.** Reuse `asset_embeddings(extensions.vector(768))` shipped 2026-04-19 per D7. If clustering quality demands `multimodalembedding@001` (1408-dim), that's a deliberate migration in v2, not a parallel column.
6. **Don't ship without confidence floors.** Low-confidence proposals surface with extra muting and "Low confidence" indicators; never as authoritative-looking values.
7. **Don't introduce a new worker process for AI.** Reuse the PR 4 worker via the dispatcher extension. One worker, three job types (derivatives + per-asset proposals + cluster proposals).
8. **Don't expose AI cost to creators in v1.** Platform-paid; cost captured for future metering. Surfacing cost adds friction without value early.
9. **Don't conflate the AI pipeline with the price engine.** They are separate pillars per UX-BRIEF v3 §3 Q6 + Q8 / PRICE-ENGINE-BRIEF v3 §3. AI generates caption/keywords/tags/clusters; price engine generates price recommendations. Mixing their schemas, jobs, or surfaces is wrong.
10. **Don't bypass per-region routing.** Every Vertex call goes through the regional client based on `users.ai_region` per D8. Cross-region fall-through is forbidden (residency is binding).
11. **Don't use the Gemini Developer API.** Vertex AI endpoint only per D9. Data-out-of-training is a creator-trust commitment.
12. **Don't include factual claims in caption proposals that the AI cannot verify** (person identification, location identification beyond what EXIF GPS reveals, event identification, source attribution). The prompt design enforces this constraint; UI copy reinforces it; reviewers reject if it slips.
13. **Don't send `watermarked_preview` to Vertex Vision.** That derivative has the Frontfiles watermark bar baked in — Gemini will see it and contaminate the caption. Always resize from `original` per E1.5 image-size strategy.
14. **Don't switch vendor without retracting D6 explicitly.** D6 is a single-vendor lock with documented rationale ("Google for everything"). Any future move to multi-vendor or non-Google AI requires a documented retraction in `INTEGRATION_READINESS.md`, not a quiet override in this brief or downstream.

---

## 12. References

- UX brief (consumer surface): `docs/upload/UX-BRIEF.md` v3 §4.4 + §5.2 + §7
- UX spec (visual treatment): `docs/upload/UX-SPEC-V4.md` (proposal surfacing) — UX-SPEC-V3 retired by V4
- Architectural locks: `INTEGRATION_READINESS.md` v2 D1–D12 + `PLATFORM_REVIEWS.md` v2 D-U2
- Implementation prompt sequence: `CLAUDE_CODE_PROMPT_SEQUENCE.md` CCP 7 (Vertex wrapper), CCP 9 (Vision API), CCP 14 (real AI clustering)
- Shipped infra: `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql`
- Price engine brief (sister architecture; constraints inherited): `docs/pricing/PRICE-ENGINE-BRIEF.md` v3
- Implementation plan (worker infrastructure reused): `src/lib/processing/IMPLEMENTATION-PLAN.md` + `src/lib/processing/PR-4-PLAN.md`
- BP/Watermark copy audit (language discipline): `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md`
- Trust language posture (CLAUDE.md item 9): root `CLAUDE.md`
- Future architecture brief: `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` (TO BE CREATED in E1.5)

---

## 13. Revision history

### v2 — 2026-04-27 (audit-first re-alignment to D6/D7/D8/D9/D-U2)

**Why revised:** v1 (2026-04-26) silently overrode four locked architectural decisions and one operationalized migration. A 2026-04-27 audit-first review caught the drift before E1.5 composition propagated it. Path B (honor the locks; revise E1) was selected over Path A (retract the locks; honor v1) because D8 (per-creator EU/US residency) is unsolvable on the Anthropic-only stack v1 proposed without re-introducing a routing layer (Bedrock or Vertex), which contradicts v1's own "single vendor reduces operational complexity" rationale.

**Changes from v1:**

| Section | v1 (2026-04-26) | v2 (2026-04-27) |
|---|---|---|
| Header `Reads underlying` | UX-BRIEF v3 + UX-SPEC-V3 + PRICE-ENGINE-BRIEF v3 + PR-4-PLAN + BP-D7 audit | + INTEGRATION_READINESS v2 (D1–D12), PLATFORM_REVIEWS v2 (D-U2), migration `20260419110000`, CLAUDE_CODE_PROMPT_SEQUENCE (CCP 7/9), UX-SPEC-V4 |
| §2 Current-state read | "AI pipeline does not exist as runtime code"; no acknowledgment of shipped pgvector / asset_embeddings / ai_analysis / audit_log | Acknowledges shipped migration `20260419110000` (pgvector + 768-dim embeddings + cache + audit_log) and the framing locks D6/D7/D8/D9/D-U2 |
| §3 E1 (scope) | Per-asset in v1; clustering in v2 | Per-asset AND clustering both in v1 per D-U2 |
| §3 E2 (vision model) | Anthropic Claude Vision (claude-sonnet-4-6) | Vertex AI Gemini Vision (gemini-2.5-flash + gemini-2.5-pro), per-region routing per D8, Vertex endpoint per D9 |
| §3 E3 (embedding) | Open-source CLIP (512-dim, local inference) + sentence-transformers | Vertex `text-embedding-004` (768-dim, matches shipped `asset_embeddings` column) |
| §3 E7 (storage) | New `asset_proposals` + `asset_proposal_audit_log`; new `asset_proposal_clusters` in v2; `visual_embedding` column on `asset_proposals` | Same three tables but `asset_proposal_clusters` is v1; embeddings live in shipped `asset_embeddings` (no `visual_embedding` column on `asset_proposals`); cache hits in shipped `ai_analysis` |
| §4.2 Class A pipeline | Anthropic Vision API call; visual_embedding stored on asset_proposals (v2 prep) | Vertex Gemini Vision call; cache lookup in `ai_analysis`; embedding upserted to shipped `asset_embeddings`; region routing per D8 |
| §4.3 Class B (clustering) | v2 only; CLIP visual + sentence-transformers caption + capture_date | v1 (per D-U2); 768-dim text-embedding-004 over caption + tags + format; HDBSCAN cosine; cluster naming via gemini-2.5-pro |
| §4.4 Schema | `asset_proposals` had `visual_embedding vector(512)` column; clusters table v2 | No visual_embedding column on `asset_proposals` (embeddings live in `asset_embeddings(768)`); clusters table v1; new `region` columns per D8 |
| §5.1 Vision model | Anthropic single-vendor rationale; Anthropic alternatives rejected | Vertex single-vendor rationale per D6; per-region routing per D8 native; Anthropic explicitly named as rejected (D6 + D8 reasons) |
| §5.2 Embedding | CLIP + sentence-transformers (local inference) | text-embedding-004 (Vertex; shipped column); fallback path to multimodalembedding@001 named for E1.5 |
| §5.3 Cost envelope | $0.005-$0.015/asset (Anthropic) | $0.0006-$0.0016/asset (Vertex); platform-paid; per-call captured; spend cap behavior described |
| §7.2 Audit trail | proposal_generated/accepted/overridden/dismissed | + cluster_proposed/cluster_accepted/cluster_dismissed; system-grain events to shipped `audit_log` (`ai.gemini.call`, etc.) |
| §7.3 Per-creator opt-in | "no per-creator vendor opt-in. Vendor platform-locked." | + explicit reference to D6 lock |
| §8 Phase E sequencing | v1 = 6 directives; v2 = 3 additional for clustering | v1 = 6 directives including clustering (E5); v2 = post-launch enrichments only |
| §9 Open decisions | 10 items including "Anthropic model pin" + "pgvector availability" + "cluster job trigger granularity" | 11 items; resolved during audit: Anthropic model pin (→ Vertex), pgvector availability (→ verified shipped), cluster trigger granularity (→ resolved in §4.3) |
| §11 Don't-do list | item 5: "Don't ship clustering in v1" | item 5 deleted (clustering ships v1); + items 5 (no second embedding column), 10 (don't bypass region routing), 11 (Vertex endpoint only), 13 (don't send watermarked_preview to Vision), 14 (don't switch vendor without retracting D6) |

**What survived unchanged:** §1 (purpose), §3 E4-E6 + E8-E9 (cost accounting, failure handling, trust posture, trigger pattern, taxonomy alignment), §4.5 (worker integration), §4.6 (trust posture table), §6 (surfaces — all vendor-neutral), §7.1 (language discipline), §7.4 (confidence floors), §10 (approval gate pattern), §12 (references — expanded). The trust posture and proposal-table shapes were always the load-bearing pillars; they don't depend on vendor choice.

### v1 — 2026-04-26 (initial composition)

Original brief composed without auditing `INTEGRATION_READINESS.md` v2, `PLATFORM_REVIEWS.md` v2, `CLAUDE_CODE_PROMPT_SEQUENCE.md`, or migration `20260419110000`. Locked Anthropic Claude Vision + open-source CLIP + clustering deferred to v2. Caught and revised by audit-first review on 2026-04-27 before any Phase E directive composed (no production impact).

---

End of AI suggestion pipeline brief (v2, 2026-04-27).
