-- ════════════════════════════════════════════════════════════════
-- P4 concern 1 — M5: seed the canonical system actor handle.
--
-- Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md §M5
-- Plan:      docs/audits/P4_IMPLEMENTATION_PLAN.md §4.2 M5
-- Spec:      docs/specs/ECONOMIC_FLOW_v1.md §8.4 "System actor"
--
-- Per §8.4: all platform-originated ledger events (cron-driven
-- expirations, 14-day auto-accept, asset-unavailable force-
-- termination, dispute admin rulings, appeal independent-review
-- rulings) reference this sentinel handle via actor_ref. The
-- handle is locked for the life of the platform per §8.4 and
-- must never be exposed to clients.
--
-- ───────────────────────────────────────────────────────────────
-- SENTINEL UUID CHOSEN: 00000000-0000-0000-0000-000000000001
-- ───────────────────────────────────────────────────────────────
-- Rationale: the all-zero-except-low-bit UUID is visibly
-- non-random, recognisable in logs and hash-chain walk-throughs,
-- and reserves 0000...0000 as an explicit "nil" value the
-- sentinel is adjacent to. Matches the recommendation in plan
-- §4.2 M5 skeleton. Locked for the life of the platform per §8.4.
--
-- Concern 1 ships the SQL seed only. The application-side constant
-- exposing this sentinel (planned at
-- src/lib/economic-flow/system-actor.ts) is deferred to concern 3
-- per directive §M5; no TypeScript surface is created in concern 1.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- actor_handles has NO actor_kind column (§8.4) — do not add one.
-- auth_user_id: NULL (never mapped to a real user).
-- tombstoned_at: NULL (never tombstoned).
-- ON CONFLICT (handle) DO NOTHING — idempotent under re-apply /
-- partial rollback / snapshot-restore.
INSERT INTO public.actor_handles (handle, auth_user_id, tombstoned_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  NULL,
  NULL
)
ON CONFLICT (handle) DO NOTHING;

COMMIT;
