# Session opener — 2026-04-30 (resume Stage B / pricing dimension cascade)

**For:** fresh Claude session post 2026-04-29 evening cascade-A composition session, which built on the 2026-04-28 Stage B founder-calibration session that surfaced the path-(1) architectural correction.

**Paste the block below to start the new session. Adjust the "Default opener" line if you want a different direction.**

---

```
I'm resuming work on the Frontfiles platform. Two sessions of context to absorb:

  - 2026-04-28 (Stage B founder calibration): founder began Phase 2 spine-cell work;
    captured cell #1 photo/standard/editorial = €220; mid-session founder discovered
    intrusion_level was in the cell key without economic justification; founder also
    deferred commercial + advertising to v2 (only Editorial + CC + Social in v1).
  - 2026-04-29 (cascade A composition): composed L1 v2.2 amendment dropping
    intrusion_level from pricing dimensions (path-(1)); composed Phase α
    CANONICAL-SOURCES.md as 5-tier source registry with §11 7-cell editorial spec
    drop-in. Sandbox could not commit due to stuck .git/index.lock.

Read these in order before responding:

  1. /Users/jnmartins/dev/frontfiles/CLAUDE.md (project posture)
  2. /Users/jnmartins/dev/frontfiles/AGENTS.md (test runner rule + repo rules)
  3. docs/licence/LICENCE-TAXONOMY-BRIEF.md v2.2 (L1; uncommitted in working
     tree; cascade A composed 2026-04-29; awaits founder ratification)
  4. docs/pricing/calibration/CANONICAL-SOURCES.md (Phase α; uncommitted; 531
     lines; §11 = path-(1)-ready 7-cell editorial spec)
  5. docs/pricing/calibration/STAGE-B-SESSION-LOG-2026-04-28.md (v1 scope
     decisions — commercial + advertising deferred to v2; SOCIAL is in v1
     scope, not parking lot)
  6. docs/pricing/calibration/CALIBRATION-PROCESS.md (founder workflow)
  7. docs/pricing/PRICE-ENGINE-ARCHITECTURE.md v3 (F1 — pending v4 corrigendum
     per cascade C)
  8. docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md v2 (F1.5 — pending v3
     corrigendum per cascade C)
  9. docs/licence/L2-DIRECTIVE.md (schema directive — cascade B is a NARROW
     comment amendment per L2 §11 don't-do #9; pricing_format_defaults +
     pricing_platform_floors are F-track L4 + F2 territory, NOT L2)

Standing posture per CLAUDE.md:
  - Audit first; never jump to implementation
  - Propose before locking; explicit IPs surfaced as HALT
  - Architecture before implementation
  - Tight per-directive commits with selective stage
  - Founder ratifies before code
  - When local origin/main is stale (host-key fetch failure), read directives
    from branch refs directly, not via comparison to origin/main; never
    assert about main's content from a stale local

ARCHITECTURAL CORRECTION LOCKED 2026-04-29 (path 1):
  intrusion_level (light/standard/heavy) is the creator's chosen WATERMARK
  intensity on the public preview image — System A vocabulary per
  src/lib/processing/profiles.ts:60-169 SEED_PROFILES + cross-referenced in
  docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md §4. The licensed
  file delivered to the buyer is the original (unwatermarked). Pricing has
  zero structural reason to vary by watermark choice. intrusion_level is
  DROPPED from any pricing table cell key. Per L1 v2.2 §5.0 + §10 don't-do
  #13.

  Already-shipped watermark layer (no action needed; no migration to undo):
  vault_assets.intrusion_level + watermark_profiles + watermark_intrusion_level
  enum + indexes already landed in supabase/migrations/20260417100001/2/3_
  watermark_profile_*.sql. These are correct System A surface; cascade B-F
  do NOT touch them. vault_assets.intrusion_level STAYS as a watermark-system
  column; pricing engine MUST NOT query it.

Current state (post 2026-04-29 evening):

PRICING + CALIBRATION TRACK
  v1 SCOPE per Stage B 2026-04-28 §3.1/3.2: Editorial + CC + Social.
  Commercial + Advertising deferred to v2. v1 calibration burden after
  scope-pivots: ~31 cells under path-(1) shape (was 162 under v2 shape).

  - Phase α (calibration sources registry) — composed 2026-04-29:
      α.1 skeleton + 5-tier authority hierarchy
      α.2 (B) source-gap research (NUJ specific URLs, EFA, AIGA methodology,
           EU collecting societies)
      α.3 final 7-cell editorial spec (path-(1)-ready)
    Output: docs/pricing/calibration/CANONICAL-SOURCES.md (uncommitted)

  - Cascade A — L1 v2.2 amendment composed 2026-04-29:
      §5.0 NEW (pricing dimensions explicit lock-in)
      §5.1, §5.4, §5.5, §5.7 amended (cell math + schema keys)
      §10 don't-do #13 + #14 added
      §11 references expanded; §12 v2.2 history entry
    Output: docs/licence/LICENCE-TAXONOMY-BRIEF.md (uncommitted)

  - Cascade B-F NOT STARTED (sequenced after A ratifies; see CASCADE B-F below)

  - Stage B founder calibration values (final, ready for L5 drop-in;
    sourced + confidence-rated in CANONICAL-SOURCES.md §11):
      photo / editorial         €220 (HIGH)
      illustration / editorial  €200 (MEDIUM-HIGH)
      infographic / editorial   €280 (MEDIUM)
      vector / editorial        €150 (MEDIUM)
      video / editorial         €300 (MEDIUM-HIGH)
      audio / editorial         €130 (MEDIUM-HIGH)
      text / editorial          €350 (HIGH)
    Format hierarchy at editorial standard: text > video > infographic >
    photo > illustration > vector > audio.

WORKING TREE STATE
  Branch: docs/pricing-stage-b-editorial-format-defaults
  Tracking: 1 commit AHEAD of origin/main (8e47ec0 — social licence spec
            draft + Stage B session log + cell #1 photo/standard/editorial
            €220 partial-fill; unpushed from 2026-04-28 sandbox session).
            Push order: 8e47ec0 (already on this branch) first, then
            cascade A artifacts on top.

  Uncommitted files (5):
    - docs/licence/LICENCE-TAXONOMY-BRIEF.md (M) — L1 v2.2 amendment
      (cascade A; goes in PR-A2)

    - docs/pricing/calibration/CANONICAL-SOURCES.md (??) — Phase α registry,
      531 lines (goes in PR-A1)

    - docs/pricing/calibration/format_defaults_v1_eur.csv (M) — DOOMED by
      cascade F. File is L5-shipped 7×3×3 = 63-cell schema; working tree
      has rebalancing edits across 13 rows (14 rows currently carry
      calibration_basis text from Stage B exploration including the
      €220 anchor). Revert via `git checkout HEAD --` to restore L5-shipped
      state; cascade D rebuilds the file at 7 rows × 1 schema after L5
      tooling rebuild (drop intrusion + commercial + advertising columns
      per Stage B v1 deferrals; only editorial + later social rows remain).

    - src/app/vault/upload/page.tsx (M) — Upload V4 / D2.1 directive comment
      refresh aligning page-surface header with V4/D2.1 reality after the
      dormant-flag pass replaced the C2 V3 shell at ./_components/UploadShell.
      Verified: docs/upload/D2.1-DIRECTIVE.md and docs/upload/UX-SPEC-V4.md
      both exist as full directives. NOT pricing-related. Branch ALREADY
      EXISTS: `chore/upload-page-docstring-v3-to-v4` (last commit
      2026-04-29). Cherry-pick the working-tree edit onto that branch (or
      diff to confirm equivalence — the existing branch may already carry
      the same change). Do NOT include in PR-A1 / PR-A2.

    - docs/SESSION-OPENER-2026-04-30.md (??) — this opener; commit on its
      own branch `docs/session-opener-2026-04-30`.

  CRITICAL: .git/index.lock is stuck (verified empty file, dated 2026-04-29
  14:27). First action: `rm .git/index.lock` from host terminal (sandbox
  cannot unlink files inside .git/), then `git status` to confirm clean
  lock state.

RECOMMENDED BRANCH SHAPE WHEN INDEX LOCK CLEARS
  Four separate branches/PRs for clean history:

    PR-A1: docs/pricing-canonical-sources-registry
           file: docs/pricing/calibration/CANONICAL-SOURCES.md
           purpose: Phase α calibration sources registry (independent
                    governance artifact; §11 = cell spec for cascade F)

    PR-A2: docs/licence-l1-v2.2-amendment-drop-intrusion
           file: docs/licence/LICENCE-TAXONOMY-BRIEF.md
           purpose: L1 v2.2 amendment (cascade A); references PR-A1 §11

    PR-A3: chore/upload-page-docstring-v3-to-v4 (BRANCH ALREADY EXISTS)
           file: src/app/vault/upload/page.tsx
           purpose: Upload V4 / D2.1 page-surface comment-only refresh
           Action: diff existing branch against working-tree edit; if
                   equivalent, just push the existing branch and discard
                   the working-tree change. If different, cherry-pick or
                   rebase as appropriate.

    PR-OPENER: docs/session-opener-2026-04-30
               file: docs/SESSION-OPENER-2026-04-30.md
               purpose: session housekeeping; lands any time

    cleanup: revert format_defaults_v1_eur.csv via
             `git checkout HEAD -- docs/pricing/calibration/format_defaults_v1_eur.csv`
             (let cascade D regenerate it from scratch at the new shape)

  PR-A1 merges first (provides §11 spec); PR-A2 references it cleanly.
  PR-A3 + PR-OPENER are independent; land any time. 8e47ec0 must push
  before any of these PRs open (currently unpushed on this branch).

CASCADE B-F SEQUENCING (post-A ratification)

  Cascade B — L2 directive amendment (NARROW)
    L2-DIRECTIVE.md currently defines only pricing_cc_variants,
    pricing_sublabel_multipliers, pricing_use_tier_multipliers (per L2 §11
    don't-do #9: "Don't introduce pricing_format_defaults in L2 — that's
    F-track L4 corrigendum + F2 schema migration territory"). Cascade B
    scope is therefore narrow:
      - Edit L2 §6.2 pricing_cc_variants comment (line 206 area): drop the
        speculative "(format, intrusion)" clause; replace with "(format)"
        only per L1 v2.2 §5.4
      - Tighten §11 don't-do #9; add a new don't-do confirming
        intrusion_level is forbidden from any future pricing table per
        L1 v2.2 §10 #13
      - Optional: add a v1-scope-narrowing comment per Stage B v1
        deferrals (commercial + advertising sublabel rows + use_tier rows
        are placeholder-only for v1; L5 calibration fills only editorial
        rows now + social rows once L1 v2.1 amendment lands)
    No migration changes. L2 migration is unshipped. Pricing-table
    migrations don't exist anywhere yet (`(no pricing_* table CREATE in
    any migration)` verified 2026-04-29). Watermark migrations are
    correct and unaffected.
    Touches: docs/licence/L2-DIRECTIVE.md only
    Est: ~10 min compose + founder ratify

  Cascade C — L4a F1 v4 + F1.5 v3 corrigenda (THIS is the actual
              schema-level intrusion_level removal — not cascade B)
    F1 v4: §3.1 dimension table, §3.2 cell math, §3.3 indexes for
            pricing_format_defaults + pricing_platform_floors (drop
            intrusion_level dimension)
    F1.5 v3: CSV schemas in §6 / §6A / §6B (drop intrusion column)
    L4b BRIEF v4 (PR #35, merged 8d95b89) is UNAFFECTED by path-(1) —
    Recommendation[] shape is taxonomy-driven, not intrusion-driven; no
    L4b corrigendum needed.
    Touches: docs/pricing/PRICE-ENGINE-ARCHITECTURE.md,
             docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md
    Est: ~30 min compose + founder ratify

  Cascade D — L5 tooling rebuild (v1-editorial-only fill scope per Stage B
              §3.1/3.2; commercial + advertising rows stay as forward-compat
              placeholders since L2 schema CHECK accepts both)
    bootstrap-calibration-csvs.ts: regenerate 5 CSVs without intrusion
                                   column; v1 fill scope is editorial-only
    csv-to-seed-migration.ts: validators + cross-CSV checks updated for
                              new shape (no intrusion column)
    __tests__/csv-to-seed-migration.test.ts: 42 tests update
    CALIBRATION-PROCESS.md: rewrite §2 / §4 / §6 (drop intrusion-level
                            ratio guidance from §4 Phase 3; add
                            v1-editorial-only fill scope framing; add
                            reference to CANONICAL-SOURCES.md §11 for
                            editorial cell drop-in values)
    Touches: scripts/pricing/, docs/pricing/calibration/
    Est: ~45 min compose + founder ratify

  Cascade E — DEFERRED (out of sequence in original opener)
    The previously-named "pricing engine TypeScript update" is downstream
    of F2 (schema migration) + F3 (format_defaults adapter implementation),
    NEITHER OF WHICH EXISTS. Verified 2026-04-29: src/lib/pricing/ does
    not exist; no pricing_* migrations are in supabase/migrations/. F1.5
    §1 sequencing is F1.5 → F2 → F3+. Cascade E is not actionable in the
    current cascade arc; re-evaluate after F2 + F3 land against the
    cascade-D-regenerated CSVs.

  Cascade F — Drop reverted format_defaults CSV; populate 7-row CSV
    Use CANONICAL-SOURCES.md §11 spec values + basis text drop-in
    Single PR ratifying the 7 final editorial cells
    Est: ~15 min

  TOTAL CASCADE B + C + D + F (excluding deferred E):
    ~1.5–2 hours focused composition; sliced into 4 PRs.

SOCIAL LICENCE — v1 CRITICAL PATH (NOT parking lot)
  Per Stage B 2026-04-28 §3.2, v1 scope = Editorial + CC + Social. Social
  cannot be deferred without rescoping v1.

  Current state:
    - SOCIAL-LICENCE-SPEC-V1-DRAFT.md composed 2026-04-28 (founder-authored;
      Claude audit pass complete; sits on the unpushed 8e47ec0 commit on
      this branch)
    - 4 outstanding corrections pending founder decision
    - Architectural placement lock pending: SOCIAL as a sublabel under
      editorial vs. SOCIAL as a new top-level licence class
    - L1 v2.1 amendment for social licence has NOT yet composed; it
      composes after corrections + placement lock resolve
    - Ordering question: cascade A's L1 v2.2 (path-(1)) is composed first;
      L1 v2.1 (social) composes after. Choose: (i) v2.2 lands as v2.2 with
      v2.1 expected to renumber on rebase, or (ii) absorb social into a
      combined L1 v2.2 amendment. Founder decision needed.
    - Calibration impact: ~4 social cells need calibration once L1 v2.1
      lands and cascade tooling supports social as a class. Add to v1
      calibration target.

  Action required (founder): pick placement (sublabel vs top-level);
  respond to 4 corrections. Then Claude composes L1 v2.1 amendment;
  cascades may re-sequence.

OTHER OPEN ITEMS (founder-gated; no Claude work needed unless flagged)

  Watermark track:
    WM-D1 — Founder approves at least 1 profile per (intrusion_level,
            template_family) pair before PR 5 staging cutover. Per
            BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md §5 WM-IP-4:
            "0 of 6 profiles currently approved." Verified in
            src/lib/processing/profiles.ts: all 6 SEED_PROFILES are
            approvalStatus: 'draft'. Light typically passes as-is;
            standard + heavy need design review.
    WM-D3 — pick none → light or none → standard for legacy mapping;
            one-line edit in src/lib/processing/ARCHITECTURE-BRIEF.md §7.1

  AI cutover (FFF_AI_REAL_PIPELINE=true flip):
    AI-1 — fill 7 nulls in VERTEX_PRICING in src/lib/ai-suggestions/cost.ts.
            Stub is fully scaffolded (verified 2026-04-29): VERTEX_PRICING
            constant exists with 3 role buckets, centsForCall throws if any
            null, verification gate #5 wired. Real action: visit
            cloud.google.com/vertex-ai/generative-ai/pricing; replace nulls
            with cents-per-1m-tokens values; date-stamp the verification
            comment. ~5 min data fill.
    AI-2 — verify @google-cloud/vertexai SDK shape (1.12.0 landed)
    AI-3 — pick HDBSCAN library + replace runHdbscan + silhouettePerCluster
           stubs in clustering.ts (per E5-DIRECTIVE.md §7.2 evaluation
           criteria; current stubs throw with explicit guidance comments)
    AI-4 — GCP service account + Vertex AI User role + JSON key
    AI-5 — calibrate min_cluster_size + silhouette floor against
           representative batches via scripts/manual-test-cluster-batch.ts
    AI-6 — wire aiRealPipeline + creatorId props in
           src/app/vault/upload/page.tsx (small Claude work after AI-1..5)
    AI-7 — flip FFF_AI_REAL_PIPELINE=true in deployed env

  Other follow-ups:
    T0.5 — answer 4 of 5 product questions in
           docs/audits/T0_5_SPECIAL_OFFER_DECISION_MEMO.md:
             Q1 Retention                — pending
             Q2 Audit obligations        — pending
             Q3 Asset source             — pending
             Q4 Assignment shape         — adjudicated 2026-04-20
                                           to single-shot per
                                           ECONOMIC_FLOW_v1.md §2
             Q5 Cutover semantics        — pending
           Unblocks T4 implementation.
    P4 G3 — Gate 3 ratification of docs/audits/P4_IMPLEMENTATION_PLAN.md
            (Draft 1, 2026-04-20)
    BP-IPs — Blue Protocol IP-resolution (BP-IP-1 5-vs-7 state model;
             BP-IP-2 CANONICAL_SPEC.md placement; BP-IP-3 priority vs
             upload rebuild; BP-IP-4 CEL existence verification). Per
             BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md §5.

REASONABLE NEXT-SESSION OPENER DIRECTIVES — PICK ONE AND WE GO

  (a) "Verify index lock cleared, push 8e47ec0, split working tree into
       PR-A1 + PR-A2, cherry-pick / push PR-A3 (existing branch), open
       PRs" — closes the gap that 2026-04-29 sandbox couldn't. ~15 min if
       lock is clear; if not, stops and asks founder to manually
       rm .git/index.lock from host terminal. Recommended first move.

  (b) "Compose cascade B (narrow L2 amendment per L2 §11 don't-do #9 +
       L1 v2.2 §5.4)" — ~10 min compose. Assumes cascade A is committed
       (or accepts continued working-tree stacking).

  (c) "Compose cascades B + C + D back-to-back" — narrow L2 amendment +
       F1 v4 + F1.5 v3 + L5 tooling rebuild. Founder ratifies between
       each. ~90 min total. Cascade F (~15 min) follows.

  (d) "Resolve social licence first" — answer 4 corrections + lock
       placement; Claude composes L1 v2.1 amendment; cascades re-sequence.
       v1 critical path; arguably should land before cascades B-F finalize
       so the L5 tooling rebuild in cascade D can include social rows
       in one pass.

  (e) "Audit cascade A first; review L1 v2.2 amendment end-to-end before
       approving" — read amendment with fresh eyes; approve /
       approve-with-corrections / revise. Doesn't compose anything new.

  (f) "Switch tracks — work on AI / Watermark / T0.5 / P4 G3 / BP-IPs"
       — leave pricing cascade for later; founder picks a different
       priority. Tell me which.

  (g) "Just tell me what's next" — meta directive; propose one concrete
       next move based on current state and rationale.

DEFAULT IF I SAY "PROCEED":
  Option (a) — verify index lock cleared; push 8e47ec0; split working tree
  into PR-A1 + PR-A2 + PR-A3 + PR-OPENER; open PRs. The 2026-04-29 sandbox
  left work uncommitted; the cheapest forward motion is completing the
  commit loop before stacking more work.

Tell me which.
```

---

## Why this opener structure (revision history)

- **Original (composed 2026-04-29 evening):** 245 lines; 9 corrections
  surfaced by 2026-04-30 audit.
- **This revision (2026-04-30):** rebuilt 4 sections (Working Tree State,
  Cascade B, Cascade E, Other Open Items); promoted Social Licence to v1
  critical path (was incorrectly in parking lot); added 5 inline
  amendments (path-(1) lock now grounds the watermark migrations as
  already-shipped; format_defaults CSV reframed as 7×3×3 = 63-cell schema
  with 14 calibration_basis rows, not "13 cells filled"; AI-1 reframed as
  data-fill against scaffolded stub; T0.5 corrected to 4 of 5 pending;
  WM-D1 corrected to 0 of 6 approved per WM-IP-4; L4b confirmed unaffected
  by path-(1) — no corrigendum needed). Corrected Stage B framing date
  (sessions are 2026-04-28 founder calibration + 2026-04-29 cascade A
  composition; original conflated them).

## Notes on usage

- If you commit cascade A + Phase α work yourself before pasting, change
  the WORKING TREE STATE section to reflect what's already on main and
  which branch you ended up on.
- If `.git/index.lock` is gone before next session, the "verify index lock
  cleared" instruction in option (a) is cheap (one `git status` check) and
  harmless if redundant.
- If you decide path (1) needs revisiting (it shouldn't, but if), paste
  the block but add at top: `OVERRIDE: revisit path-(1) decision; do not
  assume v2.2 amendment is correct.`
- The `Default if I say "proceed"` line is the only line a fresh session
  will execute autonomously without question — keep it conservative.
- The PR-A3 cherry-pick: diff `chore/upload-page-docstring-v3-to-v4`
  against the working-tree change first; if equivalent (likely, since both
  reference the V3→V4 docstring update), just push the existing branch
  and discard the working-tree change. Don't double-commit.

[View the saved opener](computer:///Users/jnmartins/dev/frontfiles/docs/SESSION-OPENER-2026-04-30.md)
