-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — Phase 1 Infrastructure: pgvector + caches + audit
--
-- Adds three foundational primitives required by downstream phases:
--   1. pgvector extension + asset_embeddings table
--      (semantic search + AI story clustering per D-U2 hard launch gate)
--   2. ai_analysis cache table
--      (read-through cache for Vertex AI / Vision API calls per D8)
--   3. audit_log table
--      (append-only audit of Stripe, AI, auth, KYC events)
--
-- All three tables have RLS enabled with NO client-facing policies —
-- service-role only. These tables are never touched by client code
-- directly. Server-side code accesses them via service role.
-- ════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §1  pgvector extension                                     │
-- │                                                             │
-- │  Supabase convention: extensions live in the 'extensions'   │
-- │  schema, not public.                                        │
-- └─────────────────────────────────────────────────────────────┘

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §2  asset_embeddings                                       │
-- │                                                             │
-- │  One embedding vector per asset. Used for:                  │
-- │   - semantic search over vault assets                       │
-- │   - story clustering (D-U2 hard launch gate)                │
-- │   - cross-story discovery                                   │
-- │                                                             │
-- │  Vector dimension: 768 — matches Vertex AI                  │
-- │  text-embedding-004 per decision D7.                        │
-- │  HNSW index on cosine similarity.                           │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE asset_embeddings (
  asset_id        uuid PRIMARY KEY REFERENCES vault_assets(id) ON DELETE CASCADE,
  embedding       extensions.vector(768) NOT NULL,
  model           text NOT NULL DEFAULT 'text-embedding-004',
  model_version   text NOT NULL,
  region          text NOT NULL DEFAULT 'us-central1',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- HNSW index for fast cosine-similarity search
CREATE INDEX asset_embeddings_hnsw_cosine
  ON asset_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops);

-- Lookups by model version (for invalidation / re-embedding campaigns)
CREATE INDEX asset_embeddings_model_idx
  ON asset_embeddings (model, model_version);

-- Keep updated_at fresh
CREATE TRIGGER trg_asset_embeddings_updated_at
  BEFORE UPDATE ON asset_embeddings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE asset_embeddings ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE asset_embeddings IS
  'Vector embeddings for vault assets. One row per asset. Written by the processing pipeline after upload commit. Read by semantic search, story clustering, cross-story discovery. Service-role only from the DB side; server-side code wraps visibility with vault_assets RLS.';


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §3  ai_analysis cache                                      │
-- │                                                             │
-- │  Read-through cache for AI calls (Vertex Gemini + Vision).  │
-- │  Prevents re-billing for identical queries; reduces latency.│
-- │                                                             │
-- │  Cache key: (subject_type, subject_id, model, model_version,│
-- │              input_hash). Upsert on unique conflict.        │
-- └─────────────────────────────────────────────────────────────┘

CREATE TYPE ai_analysis_subject_type AS ENUM (
  'asset',    -- asset-level analysis (Vision OCR, labels, face detection)
  'story',    -- story-level summarisation / clustering
  'query',    -- query understanding for /search
  'brief',    -- assignment brief parsing
  'post'      -- post content analysis (v2)
);

CREATE TABLE ai_analysis (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  subject_type    ai_analysis_subject_type NOT NULL,
  subject_id      uuid,                                 -- NULL for 'query' type

  model           text NOT NULL,                        -- 'gemini-2.5-flash', 'vision-2', etc.
  model_version   text NOT NULL,                        -- explicit version for cache invalidation
  region          text NOT NULL,                        -- 'europe-west4' or 'us-central1' per D8

  input_hash      text NOT NULL,                        -- sha256 of normalised input payload
  output          jsonb NOT NULL,                       -- model response

  token_input     integer,                              -- cost metering
  token_output    integer,
  cost_cents      integer,                              -- estimated cost in cents

  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_analysis_input_nonempty CHECK (length(input_hash) > 0),
  CONSTRAINT ai_analysis_query_has_null_subject
    CHECK (
      (subject_type = 'query' AND subject_id IS NULL)
      OR (subject_type <> 'query' AND subject_id IS NOT NULL)
    )
);

-- Cache-key uniqueness: one cached output per unique query fingerprint.
-- COALESCE folds NULL subject_id (query type) into a sentinel UUID so
-- the unique index still discriminates by input_hash for queries.
CREATE UNIQUE INDEX ai_analysis_cache_key
  ON ai_analysis (
    subject_type,
    COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    model,
    model_version,
    input_hash
  );

-- Lookups by subject (get all analyses for a given asset)
CREATE INDEX ai_analysis_subject_idx
  ON ai_analysis (subject_type, subject_id, created_at DESC)
  WHERE subject_id IS NOT NULL;

-- Cost/volume reporting windows
CREATE INDEX ai_analysis_time_idx
  ON ai_analysis (created_at DESC);

ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only.

COMMENT ON TABLE ai_analysis IS
  'Read-through cache for Vertex AI / Vision API calls. Every AI call checks this table first by (subject_type, subject_id, model, model_version, input_hash). Cache hits skip the API call. Also used for cost metering and audit. Service-role only.';


-- ┌─────────────────────────────────────────────────────────────┐
-- │  §4  audit_log                                              │
-- │                                                             │
-- │  Append-only ledger of security + compliance events:        │
-- │   - auth.signin, auth.signout, auth.signup                  │
-- │   - stripe.webhook, stripe.refund, stripe.dispute           │
-- │   - ai.vision.analyse, ai.gemini.call                       │
-- │   - kyc.update, kyc.verified                                │
-- │   - asset.commit, licence.minted                            │
-- │                                                             │
-- │  Append-only is enforced at the application layer           │
-- │  (src/lib/logger.ts writes rows; no UPDATE/DELETE path).    │
-- │  DB-level immutability can be added via trigger later.      │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type      text NOT NULL,            -- dot-separated domain.action (e.g. 'stripe.webhook.received')
  actor_id        uuid,                     -- auth.uid() when known; NULL for system events

  target_type     text,                     -- 'asset', 'user', 'transaction', 'licence_grant', etc.
  target_id       text,                     -- string form — may be non-uuid (e.g. stripe reference)

  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- event-specific context

  trace_id        text,                     -- matches pino trace_id + Sentry trace for correlation
  ip_address      inet,
  user_agent      text,

  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_log_event_type_nonempty CHECK (length(event_type) > 0)
);

-- Primary query pattern: recent events of a given type
CREATE INDEX audit_log_event_time_idx
  ON audit_log (event_type, created_at DESC);

-- Actor timeline: all events by a given user
CREATE INDEX audit_log_actor_time_idx
  ON audit_log (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- Target timeline: all events touching a given entity
CREATE INDEX audit_log_target_idx
  ON audit_log (target_type, target_id, created_at DESC)
  WHERE target_id IS NOT NULL;

-- Trace-ID lookup for incident correlation
CREATE INDEX audit_log_trace_idx
  ON audit_log (trace_id)
  WHERE trace_id IS NOT NULL;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only. Only server-side code writes;
-- staff / incident-response tools read via service role.

COMMENT ON TABLE audit_log IS
  'Append-only audit log of security + compliance events. Written by server-side code via src/lib/logger.ts. Read by staff tools and incident-response workflows. Rows are never updated or deleted in application code.';


-- ════════════════════════════════════════════════════════════════
-- END Phase 1 infrastructure migration.
--
-- Downstream dependencies unlocked:
--   - CCP 7 (Vertex AI wrapper) reads/writes ai_analysis for caching
--   - CCP 9 (Vision API wrapper) writes ai_analysis on upload commit
--   - CCP 5 (Sentry + pino logger) writes audit_log on every event
--   - Area 1 story clustering (D-U2 hard gate) writes + reads
--     asset_embeddings
--   - Discovery /search does vector similarity queries on
--     asset_embeddings
-- ════════════════════════════════════════════════════════════════
