# P5 Paused — Handoff Memo

**Paused:** 2026-04-18
**Reason:** Discovered Supabase setup has only one project (production). No dev environment exists. Cannot test schema migration safely. Need rest before resolving.

---

## Where P5 stopped

- v2.1 migration file **on disk, uncommitted, untracked**:
  `supabase/migrations/20260420010000_rename_direct_offer_to_special_offer.sql`
- 15-query pre-apply introspection pack **designed but not run** (it was about to be pasted into SQL Editor when the environment issue surfaced)
- Zero DB activity
- No new commits since P4 (HEAD = `8094e70`)

## Critical blocker discovered

Supabase dashboard shows only `FrontFiles's Project / main` with PRODUCTION badge. No dev branch, no second project, no local Supabase running (Docker daemon off). Applying the P5 migration to production as a first test is unacceptable.

**Before P5 can resume, pick one environment path:**

| Option | Friction | Cost | Notes |
|---|---|---|---|
| Supabase branching (preview branch off main) | Low | Included on Pro, unavailable on Free | Native feature; branches get isolated schema + seed |
| Second Supabase project for dev | Medium | New Free-tier project possible | Cleanest isolation; need to replay migration history into it |
| Local Supabase via Docker | Medium | Free | Requires Docker daemon running; you tried and it was off |
| Pause the rename entirely and ship under production with staged rollback | High risk | Free | Not recommended — terminology lock isn't urgent enough to warrant prod-first DDL |

## What's landed (all pushed to origin)

| Phase | Commit | Content |
|---|---|---|
| P0 | pre-flight audit | — (no commit) |
| P1 + P1.x | `5a43f84` | Docs rename + plural sweep + scope amendment |
| P2 | `9124c62` | `src/lib/direct-offer/` → `src/lib/special-offer/` + module identifiers |
| P3 | `9c4ef85` | `/api/direct-offer/` → `/api/special-offer/` + fetch callers |
| P4 | `8094e70` | 13 TS identifiers + 2 user-visible UI strings |
| P5 | pending | v2.1 migration on disk, unapplied |
| P6 | pending | TERMINOLOGY_LOCK.md + consolidated sweep + checkpoint tag |

## When you resume

Start with this prompt to Claude Code to re-orient it:

```
Resume P5. Last state: v2.1 migration file on disk at
supabase/migrations/20260420010000_rename_direct_offer_to_special_offer.sql,
uncommitted, unapplied. Discovered blocker: no dev environment (single
Supabase project = production). Before any DB work, decide environment
path: Supabase branching, second project, or local Docker. Give me a
decision brief — pros/cons for each against Frontfiles' current setup —
then we pick and execute. Do not touch the DB or the migration file
until the environment is sorted.
```

## Files to not lose

- `supabase/migrations/20260420010000_rename_direct_offer_to_special_offer.sql` (v2.1 migration, untracked, ~400 lines)
- `FEATURE_APPROVAL_ROADMAP.md` (P0-P4 chronicled)
- This memo

## What's still on the task list

- [#6] P5 — DB rename migration (in_progress, blocked on environment)
- [#7] P6 — TERMINOLOGY_LOCK.md + post-rename checkpoint tag (pending)

Rest well.
