-- ════════════════════════════════════════════════════════════════
-- DOWN for 20260421000004_economic_flow_v1_ddl.sql
--
-- Reverse order: drop triggers/functions → drop tables (children
-- before parents) → drop enums → drop stub admin function.
--
-- RLS policies and indexes die with their tables via CASCADE; the
-- Postgres dependency graph removes dependent objects automatically.
-- Triggers on tables we drop die with those tables; explicit DROP
-- TRIGGER calls are only needed for triggers on tables NOT dropped
-- here — none in this set.
--
-- Safe only if M5 has been rolled back (or no ledger_events rows
-- exist that reference the system actor seeded by M5 — M4's DOWN
-- drops actor_handles, which would fail under ON DELETE RESTRICT
-- if ledger_events rows reference it. Since M4 DOWN drops
-- ledger_events first, this is satisfied by DROP TABLE ordering.
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.2 M4 rollback
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── Drop tables (children before parents) ─────────────────────
-- ledger_events and actor_handles: ledger_events.actor_ref FK
-- restricts deletes on actor_handles → drop ledger_events first.
DROP TABLE IF EXISTS public.ledger_events           CASCADE;
DROP TABLE IF EXISTS public.assignment_deliverables CASCADE;
DROP TABLE IF EXISTS public.disputes                CASCADE;
DROP TABLE IF EXISTS public.assignments             CASCADE;
DROP TABLE IF EXISTS public.offer_briefs            CASCADE;
DROP TABLE IF EXISTS public.offer_assets            CASCADE;
DROP TABLE IF EXISTS public.offers                  CASCADE;
DROP TABLE IF EXISTS public.actor_handles           CASCADE;

-- ── Drop trigger functions ────────────────────────────────────
-- Triggers on dropped tables were cascaded; the functions remain
-- until dropped explicitly.
DROP FUNCTION IF EXISTS public.touch_updated_at()                    CASCADE;
DROP FUNCTION IF EXISTS public.enforce_ledger_hash_chain()           CASCADE;
DROP FUNCTION IF EXISTS public.enforce_offer_max_items()             CASCADE;
DROP FUNCTION IF EXISTS public.enforce_offers_note_cap()             CASCADE;
DROP FUNCTION IF EXISTS public.enforce_offer_target_type_xor()       CASCADE;
DROP FUNCTION IF EXISTS public.enforce_offer_assets_same_creator()   CASCADE;

-- ── Drop stub admin function ──────────────────────────────────
DROP FUNCTION IF EXISTS public.is_platform_admin()                   CASCADE;

-- ── Drop enums ────────────────────────────────────────────────
DROP TYPE IF EXISTS public.offer_target_type CASCADE;
DROP TYPE IF EXISTS public.assignment_state  CASCADE;
DROP TYPE IF EXISTS public.offer_state       CASCADE;

COMMIT;
