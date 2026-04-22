-- ════════════════════════════════════════════════════════════════
-- PREFLIGHT introspection pack for migration
--   20260421000002_rename_certified_to_provenance.sql
--
-- Purpose
--   Derive the live-DB inventory that the forward migration claims
--   to rename. Each query returns a labelled row set; together the
--   pack covers every object class touched by the forward migration:
--   3 tables (source + target), 1 column, 1 enum value, 2 triggers,
--   plus the protect_ready_package() function body check.
--
-- Gating
--   This file gates the apply of
--   20260421000002_rename_certified_to_provenance.sql.
--   Do not apply the forward migration until every query returns the
--   expected result against remote-dev:
--     Q1–Q3  → source tables all exist
--     Q4–Q6  → target tables do NOT exist (canary)
--     Q7     → source column exists on certified_package_items
--     Q8     → target column does NOT exist on certified_package_items
--     Q9     → package_artifact_type contains source value 'certificate'
--     Q10    → package_artifact_type does NOT yet contain 'provenance_record'
--     Q11    → both source triggers exist on certified_packages
--     Q12    → protect_ready_package() function exists and its body
--              contains no internal references to the four renamed
--              identifiers (banned-term check gated by rename hygiene)
--
-- Run mode
--   RUN-ONCE BEFORE APPLY. Read-only; no schema or data changes.
--   Safe to re-run as a discovery aid; not registered with the
--   migrations runner (filename lives under _preflight/, not
--   migrations/ root).
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md §M2 preflight
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.3
-- Precedent: supabase/migrations/_preflight/20260420010000_rename_introspection.sql
-- ════════════════════════════════════════════════════════════════


-- allow-banned: Q1 source table existence check — rename source identifier
-- Q1  Existence: certified_packages
SELECT
  'Q1 certified_packages exists' AS label,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'certified_packages'  -- allow-banned: rename source identifier
      AND c.relkind = 'r'
  ) AS present;


-- allow-banned: Q2 source table existence check — rename source identifier
-- Q2  Existence: certified_package_items
SELECT
  'Q2 certified_package_items exists' AS label,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'certified_package_items'  -- allow-banned: rename source identifier
      AND c.relkind = 'r'
  ) AS present;


-- allow-banned: Q3 source table existence check — rename source identifier
-- Q3  Existence: certified_package_artifacts
SELECT
  'Q3 certified_package_artifacts exists' AS label,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'certified_package_artifacts'  -- allow-banned: rename source identifier
      AND c.relkind = 'r'
  ) AS present;


-- Q4  Canary: provenance_packages does NOT yet exist
SELECT
  'Q4 canary — provenance_packages must NOT yet exist' AS label,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'provenance_packages'
      AND c.relkind = 'r'
  ) AS present;


-- Q5  Canary: provenance_package_items does NOT yet exist
SELECT
  'Q5 canary — provenance_package_items must NOT yet exist' AS label,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'provenance_package_items'
      AND c.relkind = 'r'
  ) AS present;


-- Q6  Canary: provenance_package_artifacts does NOT yet exist
SELECT
  'Q6 canary — provenance_package_artifacts must NOT yet exist' AS label,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'provenance_package_artifacts'
      AND c.relkind = 'r'
  ) AS present;


-- allow-banned: Q7 source column check — rename source identifier
-- Q7  Source column: certification_hash_at_issue present on
--     certified_package_items
SELECT
  'Q7 certification_hash_at_issue on certified_package_items' AS label,  -- allow-banned: rename source identifier
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'certified_package_items'            -- allow-banned: rename source identifier
      AND column_name  = 'certification_hash_at_issue'        -- allow-banned: rename source identifier
  ) AS present;


-- Q8  Canary: target column provenance_hash_at_issue does NOT yet exist
SELECT
  'Q8 canary — provenance_hash_at_issue must NOT yet exist' AS label,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name  = 'provenance_hash_at_issue'
  ) AS present;


-- allow-banned: Q9 enum value check — rename source value
-- Q9  package_artifact_type enum carries source value 'certificate'
SELECT
  'Q9 package_artifact_type has certificate value' AS label,  -- allow-banned: rename source value
  EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'package_artifact_type'
      AND e.enumlabel = 'certificate'  -- allow-banned: rename source value
  ) AS present;


-- Q10 Canary: target enum value 'provenance_record' does NOT yet exist
SELECT
  'Q10 canary — provenance_record enum value must NOT yet exist' AS label,
  EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'package_artifact_type'
      AND e.enumlabel = 'provenance_record'
  ) AS present;


-- allow-banned: Q11 trigger existence check — rename source identifiers
-- Q11 Source triggers: trg_certified_packages_updated_at and
--     trg_certified_packages_protect present on certified_packages
SELECT
  'Q11 source triggers on certified_packages' AS label,  -- allow-banned: rename source identifier
  tg.tgname                          AS trigger_name,
  CASE
    WHEN tg.tgname IN (
      'trg_certified_packages_updated_at',     -- allow-banned: rename source identifier
      'trg_certified_packages_protect'          -- allow-banned: rename source identifier
    ) THEN 'FLAGGED — must be renamed (forward §trigger-hygiene)'
    ELSE NULL
  END AS flag
FROM pg_trigger tg
JOIN pg_class     cls ON cls.oid = tg.tgrelid
JOIN pg_namespace n   ON n.oid   = cls.relnamespace
WHERE n.nspname = 'public'
  AND cls.relname = 'certified_packages'  -- allow-banned: rename source identifier
  AND NOT tg.tgisinternal
ORDER BY tg.tgname;


-- Q12 protect_ready_package() body inspection — surface any internal
--     references to the four renamed identifiers. The forward
--     migration (per plan §4.2 M2 and P4_PREREQUISITES.md Entry 2)
--     expects ZERO internal refs — only error strings and OLD/NEW
--     row refs are present. Any non-null body match here is a gating
--     finding and must be surfaced before M2 applies.
SELECT
  'Q12 protect_ready_package() body refs' AS label,
  p.proname    AS function_name,
  CASE
    WHEN pg_get_functiondef(p.oid) ~ 'certified_packages|certified_package_items|certified_package_artifacts|certification_hash_at_issue'  -- allow-banned: rename source identifiers enumerated for regex
      THEN 'FLAG — body references a renamed identifier; update in M2'
    ELSE 'OK — body references no renamed identifier (error-string-only hygiene path)'
  END AS audit_finding
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'protect_ready_package';
