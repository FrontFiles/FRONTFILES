-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — E5: Add 'cluster' to ai_analysis_subject_type enum
--
-- Per E5-DIRECTIVE.md §3 hard prerequisites: "If the CHECK constraint
-- hardcodes a list excluding 'cluster', E5 ships a small migration
-- adding the value."
--
-- Audit confirmed at implementation: ai_analysis_subject_type is an
-- ENUM (not a CHECK), and its values are: asset, story, query, brief,
-- post. No 'cluster' value. E5's cluster-naming.ts caches naming
-- results with subject_type='cluster' per E1.5 §9.5; without this
-- enum extension, those inserts fail.
--
-- ALTER TYPE ... ADD VALUE is non-transactional in older Postgres but
-- supported on Supabase's current Postgres. Ships as its own migration
-- to keep the change small + reversible.
-- ════════════════════════════════════════════════════════════════

ALTER TYPE ai_analysis_subject_type ADD VALUE IF NOT EXISTS 'cluster';
