# E2 — AI Suggestion Pipeline Schema + Service Skeleton

**Status:** RATIFIED 2026-04-27 + IMPLEMENTED via PR #17 (2026-04-27). Status block updated in the AI-track status-hygiene PR (2026-04-28); directive body unchanged.
**Date:** 2026-04-27
**Predecessor gates passed:** E1 v2 (revised 2026-04-27, ratified) + E1.5 (composed 2026-04-27, ratified)
**Governing documents:**
- `src/lib/processing/AI-PIPELINE-BRIEF.md` v2 (E1) — locks vendor, scope, schema patterns, trust posture
- `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` (E1.5) — locks model pins, prompts, ceilings, image strategy, region failover
- `INTEGRATION_READINESS.md` v2 — D6/D7/D8/D9 architectural locks
- `PLATFORM_REVIEWS.md` v2 — D-U2 lock (clustering in v1)
- `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql` — shipped pgvector + asset_embeddings + ai_analysis + audit_log
- `supabase/migrations/20260420000000_rls_all_tables.sql` — RLS conventions

**Objective:** Stand up the proposal-storage layer and the typed service skeleton that E3-E6 fill in. E2 ships dormant — no Vertex calls yet, no UI integration, no worker dispatch. The migration is reversible; the module is mock-only behind typed adapters; existing code is untouched.

---

## 1. What E2 is

E2 lays the foundation. It produces three things:

1. **Schema migration** — 4 new tables: `asset_proposals`, `asset_proposal_clusters`, `asset_proposal_audit_log`, `ai_pipeline_settings`. RLS service-role-only on every new table. Reversible.
2. **Service skeleton** — `src/lib/ai-suggestions/` module with typed engine API, Zod schemas, audit-log helper, settings reader, type definitions, and adapter interface (vertex-vision stub + mock).
3. **Tests** — schema validators; audit-log writer; settings reader; mock-adapter contract; one end-to-end mock-mode test demonstrating the pipeline shape.

E2 is **dormant** at merge — no Vertex SDK installed, no worker registered, no UI consuming proposals. The migration is the load-bearing piece; everything else is interface scaffolding that E3-E6 use.

---

## 2. Audit findings (current-state read)

| Surface | State | E2 implication |
|---|---|---|
| `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql` | Shipped 2026-04-19. Provisions pgvector extension, `asset_embeddings(extensions.vector(768))` HNSW cosine, `ai_analysis` cache, `audit_log`. All RLS service-role-only. | Reused verbatim. E2 does NOT touch these tables. E2's audit-log helper writes to existing `audit_log` for system-grain events; new `asset_proposal_audit_log` for field-grain events (per E1 §7.2 dual-table pattern). |
| `supabase/migrations/20260420000000_rls_all_tables.sql` | Shipped 2026-04-17. Generalised RLS pass; explicitly notes that `asset_embeddings`, `ai_analysis`, `audit_log` were pre-locked. | E2's new tables are also pre-locked at creation (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the migration); they will appear in the next generalised pass as already-handled, same as the 20260419 tables. |
| `src/lib/processing/dispatcher.ts` | Built (PR 4). Per-asset derivative dispatch via `dispatchAssetForProcessing(assetId, storage)`. | NOT touched in E2. E4 extends with `dispatchAssetProposalForProcessing` and `dispatchBatchClusteringForProcessing`. |
| `src/lib/processing/reaper.ts` | Built (PR 4). Sweeps stuck `asset_media` rows. | NOT touched in E2. E4 extends to cover `asset_proposals`. |
| `src/lib/upload/commit-service.ts` | Built (PR 4). Fires derivative dispatch on commit. | NOT touched in E2. E4 adds the proposal dispatch hook here. |
| `package.json` | No `@google-cloud/aiplatform`, no `@google/generative-ai` SDK | NOT installed in E2. E3 (or CCP 7, whichever ships first) introduces the Vertex SDK. E2's vertex-vision adapter is a typed interface stub that throws `NotImplementedError` if called in production mode. |
| `src/lib/ai-suggestions/` | Does not exist. | E2 creates this directory and its module files. |
| Migration filename pattern | `YYYYMMDDHHMMSS_descriptive_name.sql`; rollbacks at `_rollbacks/<filename>.DOWN.sql` | E2 follows this pattern. Filename uses ship-date timestamp (not 2026-04-27 unless that's the actual ship date). |
| RLS convention | Service-role-only on AI-related tables; no client policies (per `20260419110000` and `20260420000000` precedent) | E2 mirrors this for all 4 new tables. |
| `users.ai_region` enum field | Does not exist yet. INTEGRATION_READINESS Phase 4.B.5a or CCP 7 creates it. | E2 does NOT need it (no Vertex calls in E2). E3 needs it; E3's directive includes 4.B.5a as a prerequisite check. |

---

## 3. Scope boundary

E2 **does**:
- Add migration `<TIMESTAMP>_ai_pipeline_e2_schema.sql` creating 4 tables + indexes + RLS + comments
- Add rollback `_rollbacks/<TIMESTAMP>_ai_pipeline_e2_schema.DOWN.sql`
- Create directory `src/lib/ai-suggestions/` with 7 files (engine, schema, audit, settings, types, adapters/index, adapters/mock-vision)
- Create directory `src/lib/ai-suggestions/__tests__/` with tests for the 5 most load-bearing modules
- Create stub `src/lib/ai-suggestions/adapters/vertex-vision.ts` (interface + NotImplementedError throw)
- Add typed environment-aware settings reader (production reads row; dev/preview applies 10% multiplier per §6.3)
- Wire the `src/lib/ai-suggestions/types.ts` file to be the single source of truth for proposal shapes consumed by E5+ UI

E2 **does not**:
- Install Vertex AI SDK (E3)
- Implement actual Vertex Vision calls (E3)
- Compute or store embeddings (E3 — uses already-shipped `asset_embeddings`)
- Implement HDBSCAN clustering (E5)
- Touch `dispatcher.ts`, `reaper.ts`, `commit-service.ts`, `scripts/process-derivatives.ts` (E4)
- Touch any UI component (E6)
- Touch `asset_embeddings`, `ai_analysis`, or `audit_log` table schemas (already shipped; reused)
- Touch `vault_assets` schema
- Add `users.ai_region` (CCP 7 / Phase 4.B.5a)
- Create a Vertex pricing constants file with verified numbers (E3 — verifies and lands at ship time)
- Wire RLS client policies (service-role-only is the v1 posture per E1 §3 E7)
- Activate any feature flag or env var (no flag flips in E2)

---

## 4. Migration

### 4.1 Filename

`supabase/migrations/<YYYYMMDDHHMMSS>_ai_pipeline_e2_schema.sql` — timestamp = ship date / time. Recent example: `20260427000003_asset_media_processing_started_at.sql`. The next available timestamp at ship time should be used.

### 4.2 Up-migration content

```sql
-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — E2: AI suggestion pipeline schema (proposal storage layer)
--
-- Per AI-PIPELINE-BRIEF.md v2 §4.4 and AI-PIPELINE-ARCHITECTURE.md.
--
-- Adds the proposal-storage and pipeline-settings layer. Reuses shipped
-- pgvector infrastructure (asset_embeddings, ai_analysis, audit_log)
-- from migration 20260419110000_phase1_vector_cache_audit.sql.
--
-- All four tables are RLS-enabled service-role-only at creation, matching
-- the established AI-related-table posture. No client policies.
--
-- Down-migration at supabase/migrations/_rollbacks/<filename>.DOWN.sql.
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  ai_pipeline_settings                                   │
-- │                                                             │
-- │  Singleton table — one row, founder-tunable.                │
-- │  Holds tuning knobs for the AI pipeline that E1.5 commits   │
-- │  to "founder-approved at ratification" rather than baking  │
-- │  into code constants. Production env reads this row;       │
-- │  preview/dev applies env-aware multipliers in the settings │
-- │  reader (src/lib/ai-suggestions/settings.ts).              │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE ai_pipeline_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Singleton key — enforces one-row-only via UNIQUE + CHECK.
  singleton_key TEXT NOT NULL UNIQUE DEFAULT 'global'
    CHECK (singleton_key = 'global'),

  -- Cost ceilings (E1.5 §7.2; production defaults; preview/dev applies multiplier)
  daily_cap_cents INTEGER NOT NULL DEFAULT 50000,      -- $500/day production default
  monthly_cap_cents INTEGER NOT NULL DEFAULT 1000000,  -- $10000/month production default

  -- Tag taxonomy (E1.5 §8)
  tag_taxonomy_top_n INTEGER NOT NULL DEFAULT 50,

  -- Confidence floors (E1.5 §5)
  confidence_floor_caption NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  confidence_floor_keywords NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  confidence_floor_tags_existing NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  confidence_floor_tags_new NUMERIC(3,2) NOT NULL DEFAULT 0.75,
  confidence_floor_silhouette NUMERIC(3,2) NOT NULL DEFAULT 0.30,

  -- Image-prep (E1.5 §6)
  vision_max_long_edge_px INTEGER NOT NULL DEFAULT 1568,
  vision_jpeg_quality INTEGER NOT NULL DEFAULT 85
    CHECK (vision_jpeg_quality BETWEEN 1 AND 100),

  -- Circuit breaker (E1.5 §11)
  circuit_failure_threshold INTEGER NOT NULL DEFAULT 5,
  circuit_cooldown_ms INTEGER NOT NULL DEFAULT 60000,

  -- Bookkeeping
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

CREATE TRIGGER trg_ai_pipeline_settings_updated_at
  BEFORE UPDATE ON ai_pipeline_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE ai_pipeline_settings ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE ai_pipeline_settings IS
  'Singleton (one-row) tuning table for the AI suggestion pipeline. Read by src/lib/ai-suggestions/settings.ts; preview/dev apply env-aware multipliers on cost ceilings. Founder-tunable. Service-role only.';

-- Seed the singleton row immediately so reads never fail.
INSERT INTO ai_pipeline_settings (singleton_key) VALUES ('global');


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  asset_proposal_clusters                                │
-- │                                                             │
-- │  One row per AI-detected cluster. Created by Class B        │
-- │  clustering job (E5). Forward-referenced by                 │
-- │  asset_proposals.cluster_id (NULLable; populated by E5).    │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE asset_proposal_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  proposed_name TEXT,
  asset_count INTEGER NOT NULL CHECK (asset_count > 0),
  silhouette_score NUMERIC(3,2),
  model_version TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('europe-west4', 'us-central1')),

  -- Acceptance tracking (per E1 §4.4)
  accepted_as_story_group_id UUID,
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Mutual exclusion: a cluster is either accepted, dismissed, or pending — never both.
  CONSTRAINT cluster_resolution_exclusive CHECK (
    NOT (accepted_at IS NOT NULL AND dismissed_at IS NOT NULL)
  )
);

CREATE INDEX asset_proposal_clusters_creator_batch_idx
  ON asset_proposal_clusters (creator_id, batch_id, generated_at DESC);

CREATE INDEX asset_proposal_clusters_pending_idx
  ON asset_proposal_clusters (creator_id, generated_at DESC)
  WHERE accepted_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE asset_proposal_clusters ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE asset_proposal_clusters IS
  'AI-detected story group clusters from Class B clustering job. One row per cluster. Forward-referenced by asset_proposals.cluster_id. Service-role only.';


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  asset_proposals                                        │
-- │                                                             │
-- │  One row per asset. Created by Class A per-asset job (E3).  │
-- │  Holds caption / keywords / tags + per-field confidence +   │
-- │  cluster membership + provenance.                           │
-- │                                                             │
-- │  Embeddings live in asset_embeddings (shipped 2026-04-19);  │
-- │  cache hits live in ai_analysis (shipped 2026-04-19).       │
-- │  No duplication.                                            │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE asset_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL UNIQUE REFERENCES vault_assets(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Generation state machine (mirrors asset_media pattern)
  generation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'processing', 'ready', 'failed', 'not_applicable')),
  processing_started_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0
    CHECK (retry_count >= 0),
  error TEXT,

  -- Per-field proposals (NULL until ready)
  caption TEXT
    CHECK (caption IS NULL OR length(caption) <= 200),
  caption_confidence NUMERIC(3,2)
    CHECK (caption_confidence IS NULL OR (caption_confidence >= 0 AND caption_confidence <= 1)),
  keywords TEXT[],
  keywords_confidence NUMERIC(3,2)
    CHECK (keywords_confidence IS NULL OR (keywords_confidence >= 0 AND keywords_confidence <= 1)),
  tags TEXT[],
  tags_confidence NUMERIC(3,2)
    CHECK (tags_confidence IS NULL OR (tags_confidence >= 0 AND tags_confidence <= 1)),

  -- Cluster membership (populated by Class B; both NULL until cluster proposed)
  cluster_id UUID REFERENCES asset_proposal_clusters(id) ON DELETE SET NULL,
  cluster_confidence NUMERIC(3,2)
    CHECK (cluster_confidence IS NULL OR (cluster_confidence >= 0 AND cluster_confidence <= 1)),

  -- Provenance (note: embedding lives in asset_embeddings, not here)
  model_version TEXT,
  generation_cost_cents INTEGER
    CHECK (generation_cost_cents IS NULL OR generation_cost_cents >= 0),
  generation_latency_ms INTEGER
    CHECK (generation_latency_ms IS NULL OR generation_latency_ms >= 0),
  region TEXT
    CHECK (region IS NULL OR region IN ('europe-west4', 'us-central1'))
);

CREATE INDEX asset_proposals_status_idx
  ON asset_proposals (generation_status);

CREATE INDEX asset_proposals_pending_idx
  ON asset_proposals (asset_id) WHERE generation_status = 'pending';

CREATE INDEX asset_proposals_cluster_idx
  ON asset_proposals (cluster_id) WHERE cluster_id IS NOT NULL;

ALTER TABLE asset_proposals ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE asset_proposals IS
  'Per-asset AI-generated metadata proposals (caption / keywords / tags) + cluster membership. One row per asset. Embeddings live in asset_embeddings. Cache hits live in ai_analysis. Service-role only.';


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  asset_proposal_audit_log                               │
-- │                                                             │
-- │  Field-grain audit of every proposal event (generated /     │
-- │  accepted / overridden / dismissed) and cluster event       │
-- │  (cluster_proposed / cluster_accepted / cluster_dismissed). │
-- │  System-grain events (ai.gemini.call, etc.) go to the       │
-- │  shipped audit_log table — different table for different    │
-- │  query patterns.                                            │
-- │                                                             │
-- │  Mirrors pricing_audit_log shape (PRICE-ENGINE-BRIEF v3).   │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE asset_proposal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  asset_id UUID NOT NULL REFERENCES vault_assets(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'proposal_generated',
      'proposal_accepted',
      'proposal_overridden',
      'proposal_dismissed',
      'cluster_proposed',
      'cluster_accepted',
      'cluster_dismissed'
    )),

  proposal_id UUID REFERENCES asset_proposals(id) ON DELETE SET NULL,
  cluster_id UUID REFERENCES asset_proposal_clusters(id) ON DELETE SET NULL,
  field_name TEXT
    CHECK (field_name IS NULL OR field_name IN ('caption', 'keywords', 'tags')),
  before_value JSONB,
  after_value JSONB,
  surface TEXT NOT NULL
    CHECK (surface IN ('upload', 'vault_edit', 'bulk_action', 'system')),
  override_reason TEXT
);

CREATE INDEX asset_proposal_audit_log_asset_creator_time_idx
  ON asset_proposal_audit_log (asset_id, creator_id, event_at DESC);

CREATE INDEX asset_proposal_audit_log_event_type_time_idx
  ON asset_proposal_audit_log (event_type, event_at DESC);

CREATE INDEX asset_proposal_audit_log_creator_time_idx
  ON asset_proposal_audit_log (creator_id, event_at DESC);

ALTER TABLE asset_proposal_audit_log ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE asset_proposal_audit_log IS
  'Field-grain audit of AI proposal events. Append-only at the application layer. System-grain AI events go to audit_log (shipped 2026-04-19). Service-role only.';


-- ════════════════════════════════════════════════════════════════
-- END E2 schema migration.
--
-- Downstream dependencies unlocked:
--   - E3 (per-asset Vertex Gemini Vision job) writes asset_proposals + ai_analysis
--   - E3 also writes asset_embeddings (already shipped)
--   - E4 (worker integration) extends dispatcher + reaper for asset_proposals
--   - E5 (Class B clustering) writes asset_proposal_clusters + updates
--     asset_proposals.cluster_id
--   - E6 (UI integration) reads asset_proposals + asset_proposal_clusters via
--     server-side service-role; client receives proposal data through API
--     routes that re-author the access boundary (RLS posture preserved).
-- ════════════════════════════════════════════════════════════════
```

### 4.3 Down-migration content

```sql
-- supabase/migrations/_rollbacks/<TIMESTAMP>_ai_pipeline_e2_schema.DOWN.sql
--
-- Reverses E2 schema migration. Drop order respects FK dependencies:
--   1. asset_proposal_audit_log (FKs to asset_proposals + asset_proposal_clusters)
--   2. asset_proposals (FK to asset_proposal_clusters)
--   3. asset_proposal_clusters (no incoming FKs after step 2)
--   4. ai_pipeline_settings (independent)

DROP TABLE IF EXISTS asset_proposal_audit_log;
DROP TABLE IF EXISTS asset_proposals;
DROP TABLE IF EXISTS asset_proposal_clusters;
DROP TABLE IF EXISTS ai_pipeline_settings;
```

### 4.4 Migration verification

After `supabase db push` (or equivalent local-apply step):

```bash
# Verify tables exist
psql "$DATABASE_URL" -c "\dt asset_proposal*"
psql "$DATABASE_URL" -c "\dt ai_pipeline_settings"

# Verify RLS enabled (rowsecurity = 't' for all four)
psql "$DATABASE_URL" -c "
  SELECT relname, relrowsecurity
  FROM pg_class
  WHERE relname IN (
    'asset_proposals', 'asset_proposal_clusters',
    'asset_proposal_audit_log', 'ai_pipeline_settings'
  );
"

# Verify settings singleton seeded
psql "$DATABASE_URL" -c "
  SELECT singleton_key, daily_cap_cents, monthly_cap_cents, tag_taxonomy_top_n
  FROM ai_pipeline_settings;
"
# Expected: 1 row, singleton_key='global', daily=50000, monthly=1000000, top_n=50

# Verify CHECK constraints reject invalid data
psql "$DATABASE_URL" -c "
  INSERT INTO ai_pipeline_settings (singleton_key) VALUES ('not-global');
"
# Expected: ERROR — CHECK constraint singleton_key violated
```

Rollback verification:

```bash
psql "$DATABASE_URL" -f supabase/migrations/_rollbacks/<TIMESTAMP>_ai_pipeline_e2_schema.DOWN.sql
psql "$DATABASE_URL" -c "\dt asset_proposal*"
# Expected: no rows
```

---

## 5. Module structure

### 5.1 Directory layout

```
src/lib/ai-suggestions/
├── engine.ts                  # public API; thin orchestration over adapters
├── schema.ts                  # Zod schemas for proposal data shapes
├── types.ts                   # shared types (re-exports from schema.ts)
├── audit.ts                   # write helper for asset_proposal_audit_log
├── settings.ts                # read helper for ai_pipeline_settings + env multipliers
├── models.ts                  # typed model-pin constants (per E1.5 §3.1)
├── adapters/
│   ├── index.ts               # adapter selection (mock/real per env)
│   ├── vertex-vision.ts       # production stub — throws NotImplementedError until E3
│   └── mock-vision.ts         # mock adapter for tests + dev mode
└── __tests__/
    ├── audit.test.ts
    ├── settings.test.ts
    ├── schema.test.ts
    ├── models.test.ts
    └── engine.mock-flow.test.ts  # one end-to-end mock test
```

### 5.2 `engine.ts` — public API

```typescript
/**
 * Frontfiles — AI Suggestion Pipeline (engine)
 *
 * Public API consumed by E4 worker integration and E6 UI surfaces.
 * E2 ships the typed surface; E3+ implement the real Vertex calls behind it.
 *
 * SCOPE: the engine returns the AI-generated content shape (VisionResponse).
 * Persistence to asset_proposals is the WORKER's responsibility (E4) — the
 * engine is pure orchestration over adapters + cache + (in E3) embedding.
 *
 * SERVER-ONLY. Never import from a client component.
 */

import type { AssetFormat } from '@/lib/upload/v2-types'
import type { VisionResponse, VertexRegion } from './types'
import { getAdapter } from './adapters'
import { getEffectiveSettings } from './settings'

export interface GenerateProposalOpts {
  assetId: string
  creatorId: string
  format: AssetFormat
  imageBytes: Buffer            // resized per E1.5 §6 BEFORE this call
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp'
  region: VertexRegion          // resolved upstream from users.ai_region (UserAiRegion → VertexRegion mapping in CCP 7's getClient)
}

/**
 * Generate per-asset proposal content (Class A) — mock-mode in E2; real Vertex
 * in E3. Returns the AI's response; the WORKER (E4) is responsible for
 * inserting/updating the asset_proposals row and writing the audit event.
 *
 * Throws if the production adapter is selected before E3 lands the SDK.
 */
export async function generateAssetProposal(
  opts: GenerateProposalOpts,
): Promise<VisionResponse> {
  const adapter = getAdapter()
  const settings = await getEffectiveSettings()
  return adapter.analyseImage({
    imageBytes: opts.imageBytes,
    imageMime: opts.imageMime,
    format: opts.format,
    region: opts.region,
    // taxonomy injection happens here in E3; mock returns deterministic fixture
    taxonomyTopN: [],
    settings,
  })
}

// Cluster-naming public API stub (E5 fills in real call)
export async function generateClusterName(/* opts */): Promise<string | null> {
  throw new Error('generateClusterName not implemented — lands in E5')
}
```

### 5.3 `schema.ts` — Zod schemas

Centralises every Vertex/Gemini response shape and DB row shape. E3 imports these for response parsing; E5 imports for cluster shape; E6 imports for type inference on UI props.

```typescript
import * as z from 'zod'

// Per E1.5 §4.3 — Gemini structured output schema (Zod-mirrored for parsing safety)
export const VisionResponseSchema = z.object({
  caption: z.string().max(200),
  caption_confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()).min(3).max(8),
  keywords_confidence: z.number().min(0).max(1),
  tags: z.array(z.string()),
  tags_confidence: z.number().min(0).max(1),
  new_tags_with_confidence: z
    .array(
      z.object({
        tag: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .optional()
    .default([]),
})

// DB row shape for asset_proposals
export const ProposalRecordSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  generated_at: z.string(),  // ISO timestamp
  generation_status: z.enum(['pending', 'processing', 'ready', 'failed', 'not_applicable']),
  processing_started_at: z.string().nullable(),
  retry_count: z.number().int().min(0),
  error: z.string().nullable(),
  caption: z.string().nullable(),
  caption_confidence: z.number().nullable(),
  keywords: z.array(z.string()).nullable(),
  keywords_confidence: z.number().nullable(),
  tags: z.array(z.string()).nullable(),
  tags_confidence: z.number().nullable(),
  cluster_id: z.string().uuid().nullable(),
  cluster_confidence: z.number().nullable(),
  model_version: z.string().nullable(),
  generation_cost_cents: z.number().int().nullable(),
  generation_latency_ms: z.number().int().nullable(),
  region: z.enum(['europe-west4', 'us-central1']).nullable(),
})

// DB row shape for asset_proposal_clusters
export const ClusterRecordSchema = z.object({
  id: z.string().uuid(),
  creator_id: z.string().uuid(),
  batch_id: z.string().uuid().nullable(),
  generated_at: z.string(),
  proposed_name: z.string().nullable(),
  asset_count: z.number().int().min(1),
  silhouette_score: z.number().nullable(),
  model_version: z.string(),
  region: z.enum(['europe-west4', 'us-central1']),
  accepted_as_story_group_id: z.string().uuid().nullable(),
  accepted_at: z.string().nullable(),
  dismissed_at: z.string().nullable(),
})

// Audit event shape
export const AuditEventSchema = z.object({
  asset_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  event_type: z.enum([
    'proposal_generated',
    'proposal_accepted',
    'proposal_overridden',
    'proposal_dismissed',
    'cluster_proposed',
    'cluster_accepted',
    'cluster_dismissed',
  ]),
  proposal_id: z.string().uuid().nullable().optional(),
  cluster_id: z.string().uuid().nullable().optional(),
  field_name: z.enum(['caption', 'keywords', 'tags']).nullable().optional(),
  before_value: z.unknown().nullable().optional(),
  after_value: z.unknown().nullable().optional(),
  surface: z.enum(['upload', 'vault_edit', 'bulk_action', 'system']),
  override_reason: z.string().nullable().optional(),
})

export type VisionResponse = z.infer<typeof VisionResponseSchema>
export type ProposalRecord = z.infer<typeof ProposalRecordSchema>
export type ClusterRecord = z.infer<typeof ClusterRecordSchema>
export type AuditEvent = z.infer<typeof AuditEventSchema>
```

### 5.4 `types.ts` — shared type re-exports

```typescript
// Single import surface for downstream code (E4-E6, UI components):
//   import type { ProposalRecord, ClusterRecord, ... } from '@/lib/ai-suggestions/types'

export type {
  VisionResponse,
  ProposalRecord,
  ClusterRecord,
  AuditEvent,
} from './schema'

// Two distinct region types — keep them distinct, do not unify:
//   UserAiRegion = high-level enum stored on users.ai_region (set at onboarding)
//   VertexRegion = infrastructure-grain region used in API calls and stored on
//                  asset_proposals.region / asset_proposal_clusters.region
// The mapping UserAiRegion → VertexRegion happens in CCP 7's getClient(region)
// wrapper. Storage rows record the resolved Vertex region, not the user's enum.
export type UserAiRegion = 'eu' | 'us'
export type VertexRegion = 'europe-west4' | 'us-central1'

export type ProposalEventType =
  | 'proposal_generated'
  | 'proposal_accepted'
  | 'proposal_overridden'
  | 'proposal_dismissed'
  | 'cluster_proposed'
  | 'cluster_accepted'
  | 'cluster_dismissed'
```

### 5.5 `audit.ts` — audit-log writer

```typescript
import { getSupabaseClient } from '@/lib/db/client'
import { AuditEventSchema, type AuditEvent } from './schema'

/**
 * Write a proposal-event row to asset_proposal_audit_log.
 *
 * Validates input via Zod before insert. Throws on validation failure
 * (caller's responsibility — audit-log writes should fail loud, not
 * silently drop). Service-role client is required.
 */
export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  const validated = AuditEventSchema.parse(event)
  const supabase = await getSupabaseClient()
  const { error } = await supabase
    .from('asset_proposal_audit_log')
    .insert(validated)
  if (error) {
    throw new Error(`Failed to write proposal audit event: ${error.message}`)
  }
}
```

### 5.6 `settings.ts` — settings reader with env multipliers

```typescript
import { getSupabaseClient } from '@/lib/db/client'

export interface EffectiveSettings {
  daily_cap_cents: number
  monthly_cap_cents: number
  tag_taxonomy_top_n: number
  confidence_floor_caption: number
  confidence_floor_keywords: number
  confidence_floor_tags_existing: number
  confidence_floor_tags_new: number
  confidence_floor_silhouette: number
  vision_max_long_edge_px: number
  vision_jpeg_quality: number
  circuit_failure_threshold: number
  circuit_cooldown_ms: number
}

const DEV_MULTIPLIER = 0.1  // 10% of production cost ceilings in dev/preview

let _cachedRow: EffectiveSettings | null = null
let _cachedAt = 0
const CACHE_TTL_MS = 60_000  // 60s — enough to avoid per-call DB hits, fresh enough for tuning

export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const now = Date.now()
  if (_cachedRow && now - _cachedAt < CACHE_TTL_MS) {
    return _cachedRow
  }
  const supabase = await getSupabaseClient()
  const { data, error } = await supabase
    .from('ai_pipeline_settings')
    .select('*')
    .eq('singleton_key', 'global')
    .single()
  if (error || !data) {
    throw new Error(`Failed to read ai_pipeline_settings: ${error?.message ?? 'no row'}`)
  }
  // Live read of NODE_ENV (NOT the Zod-parsed snapshot from `env`) so vi.stubEnv-based
  // tests can flip prod/dev mode per case. Aligns with the codebase's `flags` getter
  // pattern — CCP Pattern-a Option 2b; see src/lib/env.ts. The Zod-parsed `env` is
  // frozen at module load and cannot be re-stubbed once `getEffectiveSettings` has
  // imported it.
  const isProd = process.env.NODE_ENV === 'production'
  const result: EffectiveSettings = {
    daily_cap_cents: isProd
      ? data.daily_cap_cents
      : Math.round(data.daily_cap_cents * DEV_MULTIPLIER),
    monthly_cap_cents: isProd
      ? data.monthly_cap_cents
      : Math.round(data.monthly_cap_cents * DEV_MULTIPLIER),
    tag_taxonomy_top_n: data.tag_taxonomy_top_n,
    confidence_floor_caption: Number(data.confidence_floor_caption),
    confidence_floor_keywords: Number(data.confidence_floor_keywords),
    confidence_floor_tags_existing: Number(data.confidence_floor_tags_existing),
    confidence_floor_tags_new: Number(data.confidence_floor_tags_new),
    confidence_floor_silhouette: Number(data.confidence_floor_silhouette),
    vision_max_long_edge_px: data.vision_max_long_edge_px,
    vision_jpeg_quality: data.vision_jpeg_quality,
    circuit_failure_threshold: data.circuit_failure_threshold,
    circuit_cooldown_ms: data.circuit_cooldown_ms,
  }
  _cachedRow = result
  _cachedAt = now
  return result
}

/** Clear cache — for tests and for the (TBD) admin tuning surface. */
export function invalidateSettingsCache(): void {
  _cachedRow = null
  _cachedAt = 0
}
```

### 5.7 `models.ts` — model pin constants

```typescript
/**
 * Frontfiles — AI Suggestion Pipeline Model Pins
 *
 * Per E1.5 §3.1. Specific Vertex version strings locked at E2 ship time.
 * Bump policy: typed constant + regression sample (E1.5 §12.4).
 *
 * NOTE: at E2 ship time, verify the current Vertex-published stable version
 * for each model family at cloud.google.com/vertex-ai/generative-ai/docs/models
 * and update the constants below. The string "VERIFY_AT_E2_SHIP" must be
 * replaced before merge.
 */

export const MODELS = {
  vision_per_asset: 'gemini-2.5-flash',  // VERIFY exact version string at E2 ship
  cluster_naming: 'gemini-2.5-pro',      // VERIFY exact version string at E2 ship
  embedding: 'text-embedding-004',       // D7 lock; verify Vertex pin format
} as const

export type ModelRole = keyof typeof MODELS
```

### 5.8 `adapters/index.ts` — adapter selection

```typescript
import { env } from '@/lib/env'
import { mockVisionAdapter } from './mock-vision'
import { vertexVisionAdapter } from './vertex-vision'
import type { VisionAdapter } from './types'

export function getAdapter(): VisionAdapter {
  // E2 default: mock adapter everywhere except production with explicit flag.
  // E3 introduces FFF_AI_REAL_PIPELINE flag and the real Vertex SDK; until
  // then, the real adapter throws NotImplementedError.
  if (env.NODE_ENV === 'production' && process.env.FFF_AI_REAL_PIPELINE === 'true') {
    return vertexVisionAdapter
  }
  return mockVisionAdapter
}
```

### 5.9 `adapters/vertex-vision.ts` — production stub

```typescript
import type { VisionAdapter } from './types'

class NotImplementedError extends Error {
  constructor() {
    super(
      'vertex-vision adapter not yet implemented — lands in E3 alongside @google-cloud/aiplatform SDK install',
    )
  }
}

export const vertexVisionAdapter: VisionAdapter = {
  async analyseImage() {
    throw new NotImplementedError()
  },
}
```

### 5.10 `adapters/mock-vision.ts` — test/dev adapter

Returns deterministic fixture per format. Used by E2 tests, E3 tests (until real Vertex calls work in CI), and dev-mode dual-mode operation.

```typescript
import type { VisionAdapter, AnalyseImageOpts } from './types'
import type { VisionResponse } from '../schema'

const FIXTURE_BY_FORMAT: Record<string, VisionResponse> = {
  photo: {
    caption: 'Mock caption for photo asset',
    caption_confidence: 0.85,
    keywords: ['mock', 'photo', 'fixture'],
    keywords_confidence: 0.80,
    tags: [],
    tags_confidence: 0.75,
    new_tags_with_confidence: [],
  },
  illustration: {
    caption: 'Mock caption for illustration asset',
    caption_confidence: 0.85,
    keywords: ['mock', 'illustration', 'fixture'],
    keywords_confidence: 0.80,
    tags: [],
    tags_confidence: 0.75,
    new_tags_with_confidence: [],
  },
  // infographic, vector mirror illustration shape
}

export const mockVisionAdapter: VisionAdapter = {
  async analyseImage(opts: AnalyseImageOpts): Promise<VisionResponse> {
    return FIXTURE_BY_FORMAT[opts.format] ?? FIXTURE_BY_FORMAT.photo
  },
}
```

### 5.11 `adapters/types.ts`

```typescript
import type { VisionResponse } from '../schema'
import type { EffectiveSettings } from '../settings'
import type { AssetFormat } from '@/lib/upload/v2-types'
import type { VertexRegion } from '../types'

export interface AnalyseImageOpts {
  imageBytes: Buffer
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp'
  format: AssetFormat
  region: VertexRegion
  taxonomyTopN: string[]
  settings: EffectiveSettings
}

export interface VisionAdapter {
  analyseImage(opts: AnalyseImageOpts): Promise<VisionResponse>
}
```

---

## 6. Tests

### 6.1 Coverage matrix

| File | Coverage |
|---|---|
| `__tests__/audit.test.ts` | writeAuditEvent rejects malformed event_type; writes round-trip; FK constraints honored |
| `__tests__/settings.test.ts` | reader returns prod values when NODE_ENV=production; applies 10% multiplier in dev/preview; cache TTL respected; invalidateSettingsCache works |
| `__tests__/schema.test.ts` | VisionResponseSchema rejects caption > 200 chars; keywords < 3 or > 8; confidence outside [0,1]; ProposalRecordSchema validates DB row shape; ClusterRecordSchema validates cluster shape |
| `__tests__/models.test.ts` | MODELS constant is non-empty; values match locked pin pattern (string non-empty; documented format families) |
| `__tests__/engine.mock-flow.test.ts` | end-to-end: mock adapter returns fixture; engine surfaces it; audit-log roundtrip succeeds; one full Class A simulation (mock-mode) |

### 6.2 Test infrastructure

- Tests run via `bun run test` (vitest); see `vitest.setup.ts` for env loading
- Use `scopeEnvVars` helper (per `src/lib/test/env-scope.ts`) for env-flag tests
- Mock Supabase client: reuse the existing test helpers in `src/lib/test/` if present; otherwise add a small `mockSupabaseClient.ts` helper local to ai-suggestions tests

### 6.3 Test count target

5 test files; ~25-30 cases total. Bounded.

---

## 7. Verification gates

Before merge:

```bash
# 1. tsc clean (no new errors; 8 pre-existing tolerated per session-wrap)
npx tsc --noEmit 2>&1 | grep -cE "error TS"
# Expected: 8 (pre-existing baseline)

# 2. vitest green
bun run test 2>&1 | tail -10
# Expected: all suites pass; +5 new test files; +25-30 new cases

# 3. Migration applies cleanly on local Supabase
supabase db reset                    # full reset
supabase db push                     # apply all migrations including E2
psql "$DATABASE_URL" -c "\dt asset_proposal*" -c "\dt ai_pipeline_settings"
# Expected: all 4 tables exist

# 4. RLS enabled on every new table
psql "$DATABASE_URL" -c "
  SELECT relname, relrowsecurity FROM pg_class
  WHERE relname IN ('asset_proposals','asset_proposal_clusters',
                    'asset_proposal_audit_log','ai_pipeline_settings');
"
# Expected: 4 rows, all rowsecurity=t

# 5. Settings singleton seeded
psql "$DATABASE_URL" -c "SELECT count(*) FROM ai_pipeline_settings;"
# Expected: 1

# 6. Rollback works
psql "$DATABASE_URL" -f supabase/migrations/_rollbacks/<TIMESTAMP>_ai_pipeline_e2_schema.DOWN.sql
psql "$DATABASE_URL" -c "\dt asset_proposal*" -c "\dt ai_pipeline_settings"
# Expected: no rows
# Then re-apply forward to leave the dev DB in the post-E2 state

# 7. Build green
bun run build 2>&1 | tail -5
# Expected: build exits 0; route count unchanged (no new routes)

# 8. No new tsc errors introduced
# (covered by gate 1 — count must equal 8, not 9+)
```

---

## 8. Approval gate

Founder reviews the PR before merge. Specifically verify:

| Item | What "approved" means |
|---|---|
| Migration filename uses ship-date timestamp | Not `2026-04-27` if ship is later |
| Version pin strings in `models.ts` are `VERIFY_AT_E2_SHIP` | Replaced with verified-current Vertex model version strings before merge. Pricing constants live in `cost.ts` (E3 scope per E2 don't-do #10) — not E2's concern. |
| Cost ceiling defaults in `ai_pipeline_settings` seed | $500/day + $10000/month or amended values |
| RLS service-role-only is honored on all 4 tables | No client-facing policies added |
| Mock adapter covers photo/illustration; infographic/vector mirror illustration shape | Or explicit fixture-extension call |
| Tests pass + tsc clean + migration applies | All 8 verification gates green |
| Out-of-scope items remain out-of-scope | No Vertex SDK install; no UI changes; no dispatcher hook |

Founder's options at PR review:
1. **Approve + merge** — E3 directive composes next
2. **Approve with corrections** — name the diff; engineer applies; re-review
3. **Revise** — substantive concern; redraft directive
4. **Reject** — rare for E2 since architecture is locked; would mean E1 v2 / E1.5 was wrong, not E2

---

## 9. Don't-do list

To prevent scope creep during E2 implementation:

1. **Don't install `@google-cloud/aiplatform` or any Vertex SDK.** That lands in E3 alongside the real adapter. E2's vertex-vision.ts is a stub.
2. **Don't touch existing migrations.** `20260419110000` (pgvector + asset_embeddings + ai_analysis + audit_log) and `20260420000000` (RLS pass) are shipped and reused as-is.
3. **Don't add `users.ai_region` column.** That's INTEGRATION_READINESS Phase 4.B.5a / CCP 7. E3 verifies the column exists before its first Vertex call.
4. **Don't wire the dispatcher.** `dispatchAssetProposalForProcessing` lands in E4. E2 leaves `dispatcher.ts` and `commit-service.ts` untouched.
5. **Don't extend the reaper.** Same as above — E4.
6. **Don't add UI.** UX-SPEC-V4 surfaces are unchanged; E6 wires proposal data through.
7. **Don't seed test data into `vault_assets` or `users` for the new tables.** Test fixtures use existing seed UUIDs or in-memory mocks.
8. **Don't add client RLS policies.** The pipeline is service-role only in v1 (E1 §3 E7).
9. **Don't activate any FFF env flag.** No `FFF_AI_REAL_PIPELINE` flip; no `FFF_REAL_UPLOAD` change.
10. **Don't add Vertex pricing values** beyond `VERIFY_AT_E2_SHIP` placeholders. Verified pricing lands in E3 with the SDK.
11. **Don't add proposal-related routes** in `src/app/api/`. API surface lands in E6.
12. **Don't break existing tests.** Run `bun run test` before and after — pass count must be ≥ baseline.

---

## 10. Out of scope (deferred to later directives)

| Concern | Lands in |
|---|---|
| Vertex AI SDK install + real Vertex Vision call | E3 |
| Embedding write to `asset_embeddings` | E3 |
| `ai_analysis` cache read-through layer | E3 (and CCP 7) |
| `users.ai_region` column + onboarding wiring | INTEGRATION_READINESS Phase 4.B.5a / CCP 7 |
| `scripts/process-derivatives.ts` extension | E4 |
| `dispatcher.ts` + `reaper.ts` extension | E4 |
| `commit-service.ts` proposal dispatch hook | E4 |
| HDBSCAN clustering + cluster naming via gemini-2.5-pro | E5 |
| UI: proposal surfacing in upload flow | E6 |
| UI: proposal surfacing in vault asset edit | E6 |
| API routes for proposal accept/dismiss/regenerate | E6 |
| `proposal_shown` view-tracking event | v2 enrichment (deferred per E1 §7.2) |
| Per-creator opt-out UI + toggle persistence | E6 |
| Founder admin: Regenerate-quota-recovered-assets tool | E6 |
| Per-creator-locale cluster naming | v2 enrichment |

---

## 11. References

- Parent briefs: `src/lib/processing/AI-PIPELINE-BRIEF.md` v2 (E1) + `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` (E1.5)
- Architectural locks: `INTEGRATION_READINESS.md` v2 D1–D12 + `PLATFORM_REVIEWS.md` v2 D-U2
- Implementation prompt sequence: `CLAUDE_CODE_PROMPT_SEQUENCE.md` (CCP 7 in particular for the Vertex client wrapper E3 will use)
- Shipped infra: `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql`
- RLS conventions: `supabase/migrations/20260420000000_rls_all_tables.sql`
- Migration filename pattern: `supabase/migrations/20260427000003_asset_media_processing_started_at.sql` (recent example)
- Plan template precedent: `src/lib/processing/PR-4-PLAN.md`
- Trust language: `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md`

---

End of E2 directive.
