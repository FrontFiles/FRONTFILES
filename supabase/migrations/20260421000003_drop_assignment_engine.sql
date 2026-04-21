-- ════════════════════════════════════════════════════════════════
-- P4 concern 1 — M3: drop the retiring Assignment Engine surface.
-- 15 tables + 19 enums per ECONOMIC_FLOW_v1 §14.1 "Assignment Engine
-- sunset" sub-clause and §17 live-code-to-spec crosswalk.
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.2 M3
-- Spec:      docs/specs/ECONOMIC_FLOW_v1.md §14.1, §17
--
-- Depends on M1 (buyer_company_role relocated) + M2 (certified→   -- allow-banned: pre-rename family cited in M2-dependency note
-- provenance rename). M1 is the critical dependency: without it,
-- the final DROP TYPE public.buyer_company_role at the bottom of
-- this file would cascade into both preserved identity-layer
-- membership tables.
--
-- ───────────────────────────────────────────────────────────────
-- NO DOWN FILE — rollback = git revert of this commit + restore
-- from pre-M3 pg_dump snapshot per plan §4.2 M3 and §12.1.
--
-- Rationale. Re-creating the Assignment Engine tables and enums
-- would undo the architectural cutover itself — they are by design
-- net-gone. The pre-M3 snapshot (captured as part of concern 1
-- integration run, path recorded in the exit report) is the sole
-- recovery surface if the forward state becomes untenable.
-- ───────────────────────────────────────────────────────────────
--
-- Order matters:
--   §A  Drop retiring tables (children before parents; CASCADE
--       covers leftover FKs / policies / triggers / views).
--   §B  Drop retiring enums (after the tables that typed columns
--       off them). The `assignment_state` and `dispute_state`
--       names are recreated in M4 with spec-canonical values per
--       §5 / §7 — this DROP is the prerequisite for that
--       recreation.
--   §C  Drop the now-orphaned public.buyer_company_role type.
--       Both dependent columns were switched to
--       identity_buyer_company_role in M1, so this DROP is safe
--       here and only here. The banned-term regex                  -- allow-banned: quotes the banned-term regex for documentation
--       (`certif|immutab|tamper.proof`) does NOT match             -- allow-banned: quotes the banned-term regex for documentation
--       `buyer_company_role`, so this DROP does not require an
--       allow-banned marker.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- §A  Drop retiring tables (15, per §17 crosswalk) ───────────────

-- Event / thread / intent surface first (leaf-ish in the FK graph).
DROP TABLE IF EXISTS public.special_offer_events      CASCADE;
DROP TABLE IF EXISTS public.special_offer_threads     CASCADE;
DROP TABLE IF EXISTS public.offer_checkout_intents    CASCADE;
DROP TABLE IF EXISTS public.assignment_events         CASCADE;

-- Dispute case + CCR surface (all reference assignments).
DROP TABLE IF EXISTS public.assignment_dispute_cases  CASCADE;
DROP TABLE IF EXISTS public.ccr_amended_fields        CASCADE;
DROP TABLE IF EXISTS public.commission_change_requests CASCADE;

-- Review / service / evidence / fulfilment surface.
DROP TABLE IF EXISTS public.review_records            CASCADE;
DROP TABLE IF EXISTS public.service_logs              CASCADE;
DROP TABLE IF EXISTS public.evidence_items            CASCADE;
DROP TABLE IF EXISTS public.fulfilment_submissions    CASCADE;

-- Milestones + rights + escrow (all pre-assignments in dep graph).
DROP TABLE IF EXISTS public.milestones                CASCADE;
DROP TABLE IF EXISTS public.escrow_records            CASCADE;
DROP TABLE IF EXISTS public.assignment_rights_records CASCADE;

-- Finally, assignments itself. CASCADE mops up anything left in the
-- dependency graph that slipped through the ordering above.
DROP TABLE IF EXISTS public.assignments               CASCADE;


-- §B  Drop retiring enums (19, per §17 crosswalk) ────────────────

-- special_offer_* family (renamed from direct_offer_* at 2026-04-20).
DROP TYPE IF EXISTS public.special_offer_event_type            CASCADE;
DROP TYPE IF EXISTS public.special_offer_auto_cancel_reason    CASCADE;
DROP TYPE IF EXISTS public.special_offer_status                CASCADE;

-- Role / filer / reviewer enums.
DROP TYPE IF EXISTS public.reviewer_role                       CASCADE;
DROP TYPE IF EXISTS public.dispute_filer_role                  CASCADE;

-- Dispute classifications.
DROP TYPE IF EXISTS public.assignment_dispute_resolution       CASCADE;
DROP TYPE IF EXISTS public.assignment_dispute_scope            CASCADE;
DROP TYPE IF EXISTS public.assignment_dispute_trigger          CASCADE;

-- CCR + review + evidence + fulfilment classifications.
DROP TYPE IF EXISTS public.ccr_state                           CASCADE;
DROP TYPE IF EXISTS public.review_determination                CASCADE;
DROP TYPE IF EXISTS public.evidence_item_kind                  CASCADE;
DROP TYPE IF EXISTS public.fulfilment_type                     CASCADE;

-- Milestone + assignment classification + offer party.
DROP TYPE IF EXISTS public.milestone_type                      CASCADE;
DROP TYPE IF EXISTS public.assignment_class                    CASCADE;
DROP TYPE IF EXISTS public.offer_party                         CASCADE;

-- Name-colliders with the spec's new enums — drop here so M4 can
-- recreate under the same name with §5 / §7 values.
DROP TYPE IF EXISTS public.dispute_state                       CASCADE;  -- spec recreates via text+CHECK, not enum
DROP TYPE IF EXISTS public.milestone_state                     CASCADE;
DROP TYPE IF EXISTS public.assignment_sub_state                CASCADE;
DROP TYPE IF EXISTS public.assignment_state                    CASCADE;  -- spec-canonical assignment_state recreated in M4


-- §C  Drop now-orphaned public.buyer_company_role ───────────────
-- Both preserved dependents (buyer_company_memberships.role,
-- company_memberships.role) were switched to
-- identity_buyer_company_role in M1. The only remaining internal
-- reference (public.reviewer_role) was dropped in §B above.
-- Identifier contains no banned-term regex match.
DROP TYPE IF EXISTS public.buyer_company_role;

COMMIT;
