-- ════════════════════════════════════════════════════════════════
-- PREFLIGHT introspection pack for migration
--   20260420010000_rename_direct_offer_to_special_offer.sql (v2.1)
--
-- Purpose
--   Derive the live-DB inventory that the forward migration claims
--   to rename. Each query returns a labelled row set; together the
--   pack covers every object class touched by the migration's
--   §Scope (14 unique DB objects) plus the implicit-named
--   constraints called out in v2.1 §6a/§6b (PKs + inline FK).
--
-- Gating
--   This file gates the apply of
--   20260420010000_rename_direct_offer_to_special_offer.sql.
--   Do not apply the forward migration until every query below
--   returns the expected result against remote-dev:
--     Q1, Q2 → table exists
--     Q3     → row counts match the captured baseline
--     Q4–Q8  → object inventory matches §Scope (flagged objects
--              all present under their direct_offer_* names)
--     Q9–Q14 → no extra references to direct_offer_* outside
--              §Scope; no out-of-scope dependents discovered
--     Q15    → canary returns ZERO rows (no special_offer_* objects
--              exist yet; if non-zero, the rename is partially
--              applied or a name collision is present and must be
--              resolved before re-running the forward migration)
--
-- Run mode
--   RUN-ONCE BEFORE APPLY. Read-only; no schema or data changes.
--   Safe to re-run as a discovery aid; not registered with the
--   migrations runner (filename lives under _preflight/, not
--   migrations/ root).
-- ════════════════════════════════════════════════════════════════


-- Q1  Existence: direct_offer_threads
SELECT
  'Q1 direct_offer_threads exists' AS label,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'direct_offer_threads'
      AND c.relkind = 'r'
  ) AS present;


-- Q2  Existence: direct_offer_events
SELECT
  'Q2 direct_offer_events exists' AS label,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'direct_offer_events'
      AND c.relkind = 'r'
  ) AS present;


-- Q3  Row counts on both tables (baseline for post-apply parity)
SELECT
  'Q3 row counts' AS label,
  (SELECT COUNT(*) FROM public.direct_offer_threads) AS direct_offer_threads_rows,
  (SELECT COUNT(*) FROM public.direct_offer_events)  AS direct_offer_events_rows;


-- Q4  Indexes on both tables
SELECT
  'Q4 indexes' AS label,
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('direct_offer_threads', 'direct_offer_events')
ORDER BY tablename, indexname;


-- Q5  Constraints on both tables — flagged: pkey × 2, fkey × 1
SELECT
  'Q5 constraints' AS label,
  n.nspname            AS schema,
  cls.relname          AS table_name,
  con.conname          AS constraint_name,
  con.contype          AS constraint_type,  -- p=primary, f=foreign, c=check, u=unique
  CASE
    WHEN con.conname IN (
      'direct_offer_threads_pkey',
      'direct_offer_events_pkey',
      'direct_offer_events_thread_id_fkey'
    ) THEN 'FLAGGED — must be renamed (v2.1 §6a/§6b)'
    ELSE NULL
  END AS flag
FROM pg_constraint con
JOIN pg_class      cls ON cls.oid = con.conrelid
JOIN pg_namespace  n   ON n.oid   = cls.relnamespace
WHERE n.nspname = 'public'
  AND cls.relname IN ('direct_offer_threads', 'direct_offer_events')
ORDER BY cls.relname, con.contype, con.conname;


-- Q6  Triggers on both tables — flagged: no_update, no_delete
SELECT
  'Q6 triggers' AS label,
  n.nspname           AS schema,
  cls.relname         AS table_name,
  tg.tgname           AS trigger_name,
  pg_get_triggerdef(tg.oid) AS trigger_def,
  CASE
    WHEN tg.tgname IN (
      'trg_direct_offer_events_no_update',
      'trg_direct_offer_events_no_delete'
    ) THEN 'FLAGGED — must be dropped + recreated (forward §4 / §7)'
    ELSE NULL
  END AS flag
FROM pg_trigger tg
JOIN pg_class     cls ON cls.oid = tg.tgrelid
JOIN pg_namespace n   ON n.oid   = cls.relnamespace
WHERE n.nspname = 'public'
  AND cls.relname IN ('direct_offer_threads', 'direct_offer_events')
  AND NOT tg.tgisinternal
ORDER BY cls.relname, tg.tgname;


-- Q7  Function existence: direct_offer_events_immutable() in public
SELECT
  'Q7 function direct_offer_events_immutable' AS label,
  n.nspname  AS schema,
  p.proname  AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid)                 AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'direct_offer_events_immutable';


-- Q8  Policies on both tables — flagged: participant_read × 2
SELECT
  'Q8 policies' AS label,
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  CASE
    WHEN policyname IN (
      'direct_offer_threads_participant_read',
      'direct_offer_events_participant_read'
    ) THEN 'FLAGGED — must be dropped + recreated (forward §3 / §8)'
    ELSE NULL
  END AS flag
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('direct_offer_threads', 'direct_offer_events')
ORDER BY tablename, policyname;


-- Q9  Views, materialised views, and functions whose source text
--     references direct_offer_* (textual scan via pg_get_viewdef /
--     pg_get_functiondef). Flags hidden dependents that an
--     OID-based rename would NOT auto-update.
SELECT
  'Q9 view/mat-view text refs' AS label,
  n.nspname AS schema,
  c.relname AS object_name,
  CASE c.relkind
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
  END AS object_kind,
  pg_get_viewdef(c.oid, true) AS object_def
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND c.relkind IN ('v', 'm')
  AND pg_get_viewdef(c.oid, true) ~ 'direct_offer'
ORDER BY n.nspname, c.relname;

SELECT
  'Q9 function text refs' AS label,
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) ~ 'direct_offer'
ORDER BY n.nspname, p.proname;


-- Q10 Foreign keys in OTHER tables that point INTO
--     direct_offer_threads or direct_offer_events. Any non-zero
--     result represents an out-of-scope dependent that the §6
--     ALTER TABLE ... RENAME TO will carry transparently (FKs
--     work by OID), but whose constraint NAME may still embed
--     the old table name and need a follow-up rename.
SELECT
  'Q10 inbound FKs' AS label,
  src_n.nspname  AS source_schema,
  src_cls.relname AS source_table,
  con.conname     AS constraint_name,
  tgt_n.nspname   AS target_schema,
  tgt_cls.relname AS target_table,
  pg_get_constraintdef(con.oid) AS constraint_def
FROM pg_constraint con
JOIN pg_class     src_cls ON src_cls.oid = con.conrelid
JOIN pg_namespace src_n   ON src_n.oid   = src_cls.relnamespace
JOIN pg_class     tgt_cls ON tgt_cls.oid = con.confrelid
JOIN pg_namespace tgt_n   ON tgt_n.oid   = tgt_cls.relnamespace
WHERE con.contype = 'f'
  AND tgt_n.nspname = 'public'
  AND tgt_cls.relname IN ('direct_offer_threads', 'direct_offer_events')
  AND NOT (src_n.nspname = 'public'
           AND src_cls.relname IN ('direct_offer_threads', 'direct_offer_events'))
ORDER BY src_n.nspname, src_cls.relname, con.conname;


-- Q11 Columns in OTHER tables whose name contains 'direct_offer'.
--     Excludes the two renamed tables themselves; any hit here is
--     a column-name dependent that the §6 table rename does NOT
--     touch.
SELECT
  'Q11 columns named direct_offer*' AS label,
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name ~ 'direct_offer'
  AND NOT (table_name IN ('direct_offer_threads', 'direct_offer_events'))
ORDER BY table_schema, table_name, column_name;


-- Q12 Custom types / enums whose name contains 'direct_offer'.
--     Confirms the 3 enum types in §1 of the migration; flags any
--     extras the migration does not handle.
SELECT
  'Q12 custom types named direct_offer*' AS label,
  n.nspname AS schema,
  t.typname AS type_name,
  t.typtype AS type_kind,  -- e=enum, c=composite, d=domain, b=base
  CASE
    WHEN t.typname IN (
      'direct_offer_status',
      'direct_offer_event_type',
      'direct_offer_auto_cancel_reason'
    ) THEN 'EXPECTED — enum covered by forward §1'
    WHEN t.typtype = 'c' AND t.typrelid != 0
      THEN 'AUTO — composite row type, renames automatically with parent table'
    WHEN t.typtype = 'b' AND t.typname LIKE '\_%'
      THEN 'AUTO — array wrapper, renames automatically with parent type'
    ELSE 'UNEXPECTED — investigate before apply'
  END AS flag
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND t.typname ~ 'direct_offer'
ORDER BY n.nspname, t.typname;


-- Q13 Sequence ownership on direct_offer_* tables.
--     Sequences owned by the renamed tables follow the table
--     rename via OID; their NAMES, however, may embed the old
--     table name and require explicit rename.
SELECT
  'Q13 sequences owned by direct_offer_*' AS label,
  seq_n.nspname  AS sequence_schema,
  seq_cls.relname AS sequence_name,
  tab_n.nspname  AS owning_schema,
  tab_cls.relname AS owning_table,
  att.attname    AS owning_column
FROM pg_class      seq_cls
JOIN pg_namespace  seq_n   ON seq_n.oid = seq_cls.relnamespace
LEFT JOIN pg_depend dep    ON dep.objid = seq_cls.oid
                          AND dep.classid = 'pg_class'::regclass
                          AND dep.deptype = 'a'
LEFT JOIN pg_class      tab_cls ON tab_cls.oid = dep.refobjid
LEFT JOIN pg_namespace  tab_n   ON tab_n.oid   = tab_cls.relnamespace
LEFT JOIN pg_attribute  att     ON att.attrelid = dep.refobjid
                              AND att.attnum    = dep.refobjsubid
WHERE seq_cls.relkind = 'S'
  AND tab_n.nspname  = 'public'
  AND tab_cls.relname IN ('direct_offer_threads', 'direct_offer_events')
ORDER BY seq_n.nspname, seq_cls.relname;


-- Q14 Comment objects on direct_offer_* targets (table, column,
--     trigger, function, policy). Forward §9 rewrites the two
--     table-level COMMENTs; this query surfaces any other comment
--     objects whose body or attachment carries the old name.
SELECT
  'Q14 comments on direct_offer_* targets' AS label,
  cls.relname  AS table_name,
  CASE
    WHEN d.objsubid = 0 THEN 'TABLE'
    ELSE 'COLUMN ' || a.attname
  END          AS target,
  d.description
FROM pg_description d
JOIN pg_class      cls ON cls.oid = d.objoid
JOIN pg_namespace  n   ON n.oid   = cls.relnamespace
LEFT JOIN pg_attribute a ON a.attrelid = d.objoid
                        AND a.attnum    = d.objsubid
                        AND d.objsubid <> 0
WHERE n.nspname = 'public'
  AND cls.relname IN ('direct_offer_threads', 'direct_offer_events')
ORDER BY cls.relname, d.objsubid;

SELECT
  'Q14 comments mentioning direct_offer in body' AS label,
  d.classoid::regclass AS attached_to_catalog,
  d.objoid             AS attached_to_oid,
  d.objsubid           AS sub_id,
  d.description
FROM pg_description d
WHERE d.description ~ 'direct_offer'
ORDER BY d.classoid::regclass::text, d.objoid;


-- Q15 Canary: ZERO rows expected pre-apply. Any object in pg_class
--     whose name matches 'special_offer%' indicates either:
--       (a) the rename has been partially applied already, or
--       (b) a name collision exists — e.g. a leftover artefact
--           from an earlier aborted run.
--     In either case, resolve before applying the forward
--     migration to avoid CREATE-side conflicts in §7 / §8.
SELECT
  'Q15 canary — special_offer_* objects pre-apply (expect 0)' AS label,
  n.nspname  AS schema,
  c.relname  AS object_name,
  c.relkind  AS object_kind  -- r=table, i=index, S=sequence, v=view, m=mat-view, c=composite, t=toast, f=foreign
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND c.relname ~ '^special_offer'
ORDER BY n.nspname, c.relname;
