# P4 Concern 1 — Claude Code Directive

**Status.** Drafted 2026-04-20 under `P4_IMPLEMENTATION_PLAN.md` §13.3 template. **Not yet dispatched.** Dispatch blocked by pre-P4 gate items in §3 of the plan (see §D below).

**Governs.** A single execution session with Claude Code. One concern, one exit report. Derived from `docs/audits/P4_IMPLEMENTATION_PLAN.md` §4.

**Cross-references.** `docs/specs/ECONOMIC_FLOW_v1.md` §7, §8, §14.1, §17; `docs/audits/P4_IMPLEMENTATION_PLAN.md` §4 (concern 1 body), §10 (risk register R1–R2, R5), §12 (rollback plan), §13.3 (directive template); `docs/audits/P4_PREREQUISITES.md` entries 1–2.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: P4 Concern 1 — Schema migration set

SCOPE
You are implementing concern 1 of the P4 cutover for Frontfiles per
docs/audits/P4_IMPLEMENTATION_PLAN.md §4. Goal: deliver five sequenced
Supabase SQL migrations (M1–M5) plus rollback and preflight machinery
that (a) relocate the buyer_company_role enum to an identity-layer
location, (b) rename the certified_packages family to provenance_packages
with the certification_hash_at_issue column rename and the
package_artifact_type.certificate value rename, (c) drop the 15
Assignment Engine tables and 19 Assignment Engine enums per
ECONOMIC_FLOW_v1 §17, (d) land the spec-canonical economic-layer DDL
(offers, offer_assets, offer_briefs, assignments, assignment_deliverables,
disputes, ledger_events, actor_handles — eight tables) with RLS,
triggers, and the ledger hash chain per ECONOMIC_FLOW_v1 §7 / §8, and
(e) seed the canonical system actor handle. The old names above are
cited as rename sources only; they do not survive the migration set.

GATE
Do not open, read, or modify any file outside the paths listed in §4.2
and §4.3 of the plan (supabase/migrations/20260421000001*.sql through
20260421000005*.sql, their matching _rollbacks/*.DOWN.sql files, and the
_preflight/20260421000002_rename_introspection.sql script). If you need
to read any spec or audit doc for context, you may read it; do not
modify specs or audits.

If any precondition below mismatches, STOP and report. Do not attempt
workarounds.

PRECONDITIONS (verify in order; stop at first failure)
1. On branch feat/p4-economic-cutover. If not, stop.
2. `git status` is clean (no uncommitted changes).
3. docs/audits/P4_IMPLEMENTATION_PLAN.md exists and is committed at the
   current HEAD or an ancestor. Cite the SHA in your exit report.
4. docs/audits/P4_UI_DEPRECATION_AUDIT.md exists and is committed.
5. docs/audits/P4_PREREQUISITES.md entry 1 references BOTH
   buyer_company_memberships.role AND company_memberships.role.
6. A fresh Supabase local dev project is running (`supabase start` in
   the repo root). `supabase migration list` returns cleanly.
7. `bun run test` reports zero file-load errors. If KD-9 work is not
   yet landed, stop and surface it — concern 1 can still ship but
   concern 2 cannot.

DELIVERABLES (five migration files, four DOWN files, one preflight)
File list, in the order you should produce them:
  1. supabase/migrations/20260421000001_relocate_buyer_company_role.sql
  2. supabase/migrations/_rollbacks/20260421000001_relocate_buyer_company_role.DOWN.sql
  3. supabase/migrations/_preflight/20260421000002_rename_introspection.sql
  4. supabase/migrations/20260421000002_rename_certified_to_provenance.sql
  5. supabase/migrations/_rollbacks/20260421000002_rename_certified_to_provenance.DOWN.sql
  6. supabase/migrations/20260421000003_drop_assignment_engine.sql
     (NO DOWN file — M3 rollback is git-revert + snapshot-restore per plan §4.2 M3
     and §12.1. Document this in the migration header comment.)
  7. supabase/migrations/20260421000004_economic_flow_v1_ddl.sql
  8. supabase/migrations/_rollbacks/20260421000004_economic_flow_v1_ddl.DOWN.sql
  9. supabase/migrations/20260421000005_seed_system_actor.sql
  10. supabase/migrations/_rollbacks/20260421000005_seed_system_actor.DOWN.sql

The DDL skeletons in plan §4.2 (M1–M5) are starting points, NOT final
content. Plan §4.2 explicitly notes "DDL shape (skeleton only; full DDL
derives from ECONOMIC_FLOW_v1 §7 / §8)" for M4. For every table, enum,
policy, trigger, index, and constraint in M4, the source of truth is
ECONOMIC_FLOW_v1 §7 and §8 (plus §4 for offer states, §5 for assignment
states, §8.2a for dispute events and evidence_type, §8.3 for ledger
storage and hash formula, §8.4 for actor_handles, §12.4 for reason
codes). Read the spec. Match the spec exactly. If the spec and the plan
skeleton conflict, the spec wins; surface the conflict in your exit
report.

NO FABRICATED VALUES. Every enum value, column name, and column type in
M4 must appear verbatim in §4 / §5 / §7 / §8 / §8.2a / §8.3 / §8.4 /
§12.4. If you find yourself writing an identifier that is not grep-able
in those sections, stop and reread the spec. Known gotchas:
  • offer_state has SIX persisted values, not seven — `draft` is
    client-only per §4 and MUST NOT appear in the enum.
  • assignment_state has NINE values per §5: active, delivered,
    revision_requested, accepted_by_buyer, cashed_out, disputed,
    refunded, split, `dispute.under_appeal` (literal, with the dot).
  • actor_handles has NO `actor_kind` column. Primary key is
    `handle uuid`, not `id`. User reference is `auth_user_id →
    auth.users(id)`, not `user_id → users(id)`.
  • ledger_events columns are `payload_version text default 'v1'`
    (NOT `payload_v smallint`), `prev_event_hash` (NOT `prev_hash`),
    `created_at` (NOT `emitted_at`). actor_ref references
    `actor_handles(handle)`, NOT `actor_handles(id)`.
  • ledger_events.thread_type is `text not null check (...)` per
    §8.3 literal — NOT a PostgreSQL enum.
  • Hash formula per §8.3: sha256(prev_event_hash || payload_version
    || event_type || canonical payload || created_at ISO-8601 ||
    actor_ref). It does NOT include thread_type or thread_id.
  • disputes.state, disputes.reason_code, disputes.resolution are
    text + CHECK per §7 literal — not CREATE TYPE enums.
  • dispute evidence_type lives inside the `dispute.evidence_submitted`
    payload per §8.2a — it is NOT a column type and NOT a DDL enum.
  • reason_code CHECK set per §12.4 is 7 values, not 5: buyer-initiated
    (delivery_incomplete, delivery_off_brief, rights_mismatch,
    unresponsive_creator, other) + creator-initiated
    (creator_cannot_deliver, buyer_fraud_suspicion, other).
  • assignments table does NOT carry gross_fee or platform_fee_bps.
    Per §6: "Assignment never re-snapshots the fee. All money values
    are derived from the originating offer via join on
    assignments.offer_id → offers.gross_fee, offers.platform_fee_bps."

Specific requirements by migration:

M1 — identity schema choice
  The plan references `identity.buyer_company_role` as a placeholder
  schema. Before writing M1, run `\dn` (or equivalent) on the dev DB to
  check whether an `identity` schema exists. If yes, use it. If no,
  use a standalone type name `identity_buyer_company_role` in the
  `public` schema. Document the choice in the M1 header comment.
  Cover BOTH buyer_company_memberships AND company_memberships with
  ALTER COLUMN statements (per P4_PREREQUISITES entry 1).

M2 — rename family + trigger body update
  Rename three tables, one column, one enum value, two trigger names.
  CREATE OR REPLACE the protect_ready_package function body with the
  error-message updates per plan §4.2 M2 skeleton. Per the P4 audit,
  the function body does NOT reference retiring table names internally
  — only OLD/NEW row refs. So the body update is narrowly about error
  strings + comment hygiene. Verify this by reading
  supabase/migrations/20260413230016_transactions_and_certified_packages_v2.sql
  lines 483–519 before writing M2. If you find internal table refs the
  audit missed, surface it; do not silently handle.

M3 — Assignment Engine drop (15 tables + 19 enums)
  Use CASCADE where needed. Order matters: drop child tables before
  parents; drop enums after their dependent tables. The list in plan
  §4.2 M3 is correct to the best of the audit's knowledge — verify
  against ECONOMIC_FLOW_v1 §17 crosswalk before pasting.
  CRITICAL: DROP TYPE IF EXISTS public.buyer_company_role MUST come
  AFTER all Assignment Engine tables are dropped and AFTER M1's
  ALTER COLUMNs executed (already ordered correctly if M1 ran first).
  Header comment must cite: "NO DOWN FILE — rollback = git revert of
  this commit + restore from pre-M3 pg_dump snapshot per plan §4.2 M3."

M4 — spec-canonical DDL (widest surface)
  This is the largest migration. Source of truth: ECONOMIC_FLOW_v1 §7
  and §8 (plus §4 offer states, §5 assignment states, §8.2a dispute
  dual-thread and evidence_type, §8.3 hash chain, §8.4 actor_handles,
  §8.5 Stripe ordering, §11.5 brief-pack delivery tracking, §12.4
  reason codes). Include:
    - Only the enums that §7 / §8 actually require as PG types:
      offer_state (§7, §4 values), assignment_state (§7, §5 values),
      offer_target_type (§7 inline). Everything else the skeleton
      originally listed as CREATE TYPE is either text + CHECK per
      spec literal (dispute_state, thread_type, reason_code,
      resolution) or lives inside an event payload rather than as a
      column type (evidence_type) or does not exist at all (actor_kind).
    - Every CREATE TABLE in §7: offers, offer_assets, offer_briefs,
      assignments (shape derived from §5/§6/§8.5/§11.5 — NO fee
      snapshot), assignment_deliverables, disputes, ledger_events,
      actor_handles. Eight tables total.
    - RLS enabled on all eight tables, plus the per-table policy
      shapes below (full SQL in the migration):
        • offers / offer_assets / offer_briefs — buyer or creator on
          the parent offer may SELECT; no public; service-role never
          used for offer routes (§7 RLS line).
        • assignments / assignment_deliverables — buyer or creator on
          the underlying offer may SELECT.
        • disputes — party to the assignment or platform admin may
          SELECT.
        • ledger_events — party to the thread (resolved via
          actor_ref → actor_handles.auth_user_id = auth.uid()) or
          platform admin may SELECT. NO INSERT / UPDATE / DELETE from
          any non-service role (§8.3: "Append-only. No updates or
          deletes from any role."). Writes go through SECURITY
          DEFINER transition functions that own the hash-chain
          invariant.
        • actor_handles — user may SELECT only the row where
          auth_user_id = auth.uid(); platform admin may SELECT all
          (§8.4).
    - The enforce_ledger_hash_chain() function and its BEFORE INSERT
      trigger on ledger_events (skeleton in plan §4.2 M4; match §8.3
      formula literally: prev_event_hash || payload_version ||
      event_type || canonical payload || created_at ISO-8601 ||
      actor_ref — no thread_type, no thread_id in the digest).
    - Same-creator trigger on offer_assets (§7 hard constraint).
    - target_type XOR trigger ensuring an offer populates offer_assets
      OR offer_briefs, not both (§7).
    - 500-char cap trigger on offers.current_note (§7).
    - Max-20-items trigger on offer_assets and offer_briefs (F9).
    - Indexes per §8.3 (ledger_events_thread on
      (thread_type, thread_id, created_at)) plus the thread-level
      lookups needed by RLS predicates.
    - Foreign keys per §7 relationship lines.
  Do NOT include catalog/bundle purchase paths (§1 out-of-scope).
  Do NOT include milestone columns, review-record columns, or
  service-log columns (all v2+ per §13).

M5 — system actor seed
  Trivial. Insert one row into public.actor_handles with:
    - handle = a sentinel UUID locked for the life of the platform
      per §8.4. Recommend '00000000-0000-0000-0000-000000000001'::uuid
      unless you see a reason to pick differently; document the chosen
      value in the M5 header comment.
    - auth_user_id = NULL (never mapped to a real user).
    - tombstoned_at = NULL (never tombstoned).
  ON CONFLICT (handle) DO NOTHING.
  actor_handles has no actor_kind column (§8.4) — do not add one.
  In the same commit (or a concern-3 follow-up, founder choice), expose
  the sentinel via a single server-side config constant at
  src/lib/economic-flow/system-actor.ts (or equivalent location). Never
  expose it to clients (§8.4 last line).

Preflight (M2 only)
  Script queries pg_tables and pg_type for the three rename-source
  table names and the three rename-target table names. Exits non-zero
  if any source missing or any target already present. Pattern after
  supabase/migrations/_preflight/20260420010000_rename_introspection.sql.

BANNED TERMS
Per ECONOMIC_FLOW_v1 §9 and project conventions, the following terms
are banned in new code and new comments: certified, certification,
tamper-proof, immutable. Acceptable terms: verifiable, tamper-evident,
provenance-aware, independently reviewable.

Exception 1: the literal identifier strings `certified_packages`,
`certified_package_items`, `certified_package_artifacts`,
`certification_hash_at_issue`, and `'certificate'` (as an enum value)
appear in RENAME statements (M2) and in an M2 rollback mapping. These
are allowed because they are the pre-rename source names. Mark the
containing line or block with `-- allow-banned: rename source identifier`
comments.

`public.buyer_company_role` does NOT require an allow-banned marker —
the banned-term regex (`certif|immutab|tamper.proof`) does not match
that identifier. M3's DROP TYPE statement is clean as-is.

No other occurrences of banned terms are acceptable. Run
`rg -n 'certif|immutab|tamper.proof' supabase/migrations/20260421*.sql`
and confirm every match is either inside a rename/drop-related
statement in M2 or inside an `allow-banned` comment.

ACCEPTANCE CRITERIA (all must hold)
1. Five migrations apply cleanly against a fresh Supabase dev project
   in sequence: `supabase db reset` then `supabase db push` completes
   without error.
2. Four DOWN files (M1, M2, M4, M5) apply cleanly after their parent
   migration: for each, run parent UP then DOWN, verify state returns
   to pre-UP.
3. Pre-M3 snapshot captured: `pg_dump` of the full DB immediately
   before M3 applies, saved to a clearly-named file, path recorded in
   your exit report.
4. Banned-term lint returns only allow-banned-marked lines.
5. `\d` on each spec-canonical table (offers, offer_assets, offer_briefs,
   assignments, assignment_deliverables, disputes, ledger_events,
   actor_handles — EIGHT tables) matches §7 column-for-column.
6. `\dT` returns exactly three new enums (offer_state, assignment_state,
   offer_target_type) with values matching §4 / §5 / §7.
7. Hash-chain trigger round-trip verified: inline DO block in M4 (or a
   separate quick script) inserts two events on the same thread, checks
   prev_event_hash of event 2 equals event_hash of event 1, AND
   recomputes event_hash off-trigger using the §8.3 formula
   (prev_event_hash || payload_version || event_type || canonical
   payload || created_at ISO-8601 || actor_ref) and confirms the
   recomputed value matches the stored event_hash byte-for-byte.
8. `public.assignments` has NO `gross_fee` or `platform_fee_bps`
   column (§6 derivation-by-join invariant).
9. Every committed migration file opens with a header comment citing
   this directive's file path (docs/audits/P4_CONCERN_1_DIRECTIVE.md)
   and the plan section it maps to (§4.2 M1–M5).

VERIFY COMMANDS
Run all of these and include output in your exit report:
  - `rg -n 'certif|immutab|tamper.proof' supabase/migrations/20260421*.sql`
  - `supabase db reset && supabase db push` (or equivalent clean-apply)
  - `psql $SUPABASE_LOCAL_DB_URL -c '\dt'` (table list)
  - `psql $SUPABASE_LOCAL_DB_URL -c '\dT'` (enum list)
  - `git status`
  - `git diff --stat`

COMMIT
One commit per migration file is acceptable but not required. A single
concern-scoped commit is preferred if the set is clean. Commit message
template:

  feat(db): P4 concern 1 — schema migration set (M1–M5)

  Implements docs/audits/P4_IMPLEMENTATION_PLAN.md §4:
  - M1 relocates buyer_company_role to identity-layer location
  - M2 renames packages family with column + enum-value rename
  - M3 drops 15 Assignment Engine tables and 19 enums per §17
  - M4 lands spec-canonical economic-layer DDL per §7 / §8
  - M5 seeds system actor handle

  Directive: docs/audits/P4_CONCERN_1_DIRECTIVE.md
  Plan: docs/audits/P4_IMPLEMENTATION_PLAN.md §4
  Spec: docs/specs/ECONOMIC_FLOW_v1.md §7, §8, §14.1, §17

  Co-Authored-By: Claude <noreply@anthropic.com>

Do NOT merge to main. The feature branch feat/p4-economic-cutover
accumulates concerns 1–5; merge happens at P5.

EXIT REPORT
Produce a terminal-paste-ready report with these sections:
  1. Preconditions check — each of #1–#7 with PASS/FAIL and a line
     explaining why.
  2. File list — every file you created, with line counts.
  3. Dev-DB apply — output of the clean-apply verify commands.
  4. Banned-term lint — full output of the rg command.
  5. Acceptance checklist — each of criteria 1–9 with PASS/FAIL.
  6. Open items — anything you spotted that warrants founder review
     before concern 2 begins (spec/plan conflicts, unresolved
     sequencing questions, unexpected surface).
  7. Commit SHA(s).
  8. Suggested next directive — "proceed to concern 2" or "pause for
     founder review of X."
```

---

## B — What the directive governs

This directive hands one concern to Claude Code. It does not hand the full P4 cutover. After concern 1's exit report is reviewed under §13.2 gate-per-concern discipline, a separate directive for concern 2 follows. The five concerns + two gates shape is in the plan.

## C — What the directive does NOT govern

- Concern 2 (tests) — separate directive drafted post concern-1 acceptance.
- Concern 3 (`AUTH_WIRED` plumbing) — separate directive; can run in parallel with concerns 1–2.
- Concerns 4 (UI cutover) and 5 (doc retirement) — separate directives; scheduled post concerns 1–3.
- Merge to `main` — explicitly forbidden at concern 1. Merge is a P5 event.

## D — Dispatch readiness checklist

This directive does **not** ship to Claude Code until all of the following are ✓:

| # | Gate | State | Blocker? |
|---|---|---|---|
| 1 | P4 plan + UI audit committed to `main` | ✗ — both files untracked as of 2026-04-20 | Yes |
| 2 | Feature branch `feat/p4-economic-cutover` created off `main` | ✗ — not created | Yes |
| 3 | Fresh Supabase local dev project running; `supabase migration list` clean | unknown — founder logistics | Yes |
| 4 | Stripe Connect test-mode credentials accessible | unknown — founder logistics | No (needed for concern 2, not concern 1 strictly) |
| 5 | KD-9 resolved; `bun run test` zero file-load errors | ✗ — still pending per REMEDIATION_PLAN appendix F | **Hard blocker** for concern 2; soft blocker for concern 1 |
| 6 | Plan signed off under §15 review gate | ✓ — approved 2026-04-20 path A | No |
| 7 | This directive reviewed by founder before dispatch | ✗ — pending | Yes |

Gate 5 note: concern 1 migrations do not need KD-9 resolved to be authored — they are DDL, not Vitest code. But concern 2 (which validates concern 1) does. The P4 plan treats KD-9 as hard for the whole P4 acceptance envelope. If founder wants to parallelize, Claude Code can author concern 1 migrations against a live Supabase dev project while KD-9 work proceeds separately — but the concern 1 exit report cannot claim full acceptance until concern 2 runs green.

---

## E — Proposed dispatch sequence

1. Founder commits `P4_IMPLEMENTATION_PLAN.md` + `P4_UI_DEPRECATION_AUDIT.md` + this directive (`P4_CONCERN_1_DIRECTIVE.md`) to `main` as a single commit.
2. Founder creates `feat/p4-economic-cutover` off that commit.
3. KD-9 work proceeds. When `bun run test` reports zero file-load errors, flag.
4. Founder provisions fresh Supabase local dev project.
5. Founder reviews this directive (§A body) one last time.
6. Founder dispatches the §A body to Claude Code in a fresh session, on branch `feat/p4-economic-cutover`.
7. Claude Code produces exit report.
8. Founder reviews exit report; approves or requests revisions.
9. On approval, concern 2 directive drafted.

---

## F — Revision history

- **2026-04-20 — Draft 1.** Initial directive drafted per plan §13.3 template. Not yet dispatched. Dispatch blocked by §D items 1, 2, 3, 7.
- **2026-04-20 — Draft 2 (pre-dispatch correction).** Pre-dispatch red-team of §A body against ECONOMIC_FLOW_v1 §4 / §5 / §7 / §8 / §8.2a / §8.3 / §8.4 / §12.4 surfaced nine drifts inherited from the plan §4.2 M4 skeleton (fabricated enum values for `evidence_type` and `reason_code`; wrong column names on `ledger_events` — `payload_v` / `prev_hash` / `emitted_at`; wrong PK / column shape on `actor_handles` including a fabricated `actor_kind` enum; wrong hash formula missing `payload_version` / `created_at` / `actor_ref` and including `thread_type` / `thread_id`; wrong assignment_state and offer_state enum values; missing `offer_assets` / `offer_briefs` from the table list; missing trigger enumeration; spurious Exception 2 for `public.buyer_company_role`). Corrections applied: plan §4.2 M4 rewritten against spec; M5 seed corrected to the spec's sentinel-UUID shape; directive §A expanded with a "no fabricated values" guard and an itemised gotcha list; RLS bullet enumerated per-table; added acceptance criterion 8 (assignments carries no fee columns); acceptance criterion 5 expanded to the eight tables; acceptance criterion 7 extended to off-trigger hash recomputation. Concurrent edit: spec header bumped from "revision 4" to "revision 6" (stale since §15 revisions 5 and 6 landed 2026-04-20). Still not dispatched.

---

_End of P4 concern 1 directive._
