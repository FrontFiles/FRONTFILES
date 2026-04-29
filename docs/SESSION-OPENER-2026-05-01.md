# Session continuation — 2026-05-01 (post cascade A–F)

**For:** the next Claude session after the 6-PR pricing-track stack merges to main.

**Composed 2026-04-30** at the close of the cascade A–F session that pushed the full path-(1) arc to remote. This opener supersedes `SESSION-OPENER-2026-04-30.md` (which is itself open as PR #43); the prior opener captured the pre-push state, this one captures the post-push state.

---

## What landed 2026-04-29 → 2026-04-30

9 PRs pushed across two sessions. 6 stacked (must merge in order) + 3 independent (any order).

### Pricing-track stack (merge order: #41 → #45 → #44 → #46 → #47 → #48)

| PR | Title | Notes |
|---|---|---|
| #41 | Phase α — canonical sources registry (CANONICAL-SOURCES.md, 531 lines) | §11 = drop-in spec for cascade F |
| #45 | Cascade A — L1 v2.2 amendment [RECONSTRUCTED] | **Read once against intent before merge.** Reconstructed 2026-04-30 from session-context recall after the original 2026-04-29 working-tree composition was destroyed by a runbook git checkout. ~90-95% fidelity per session memory. §12 v2.2 entry carries the composition note. |
| #44 | Cascade B — L2 v1.1 amendment (NARROW; doc-only) | L2 don't-do #9 line-206 comment edit + new don't-do #13. No schema impact. |
| #46 | Cascade C — F1 v4 + F1.5 v3 corrigenda (doc-only) | 14 + 24 changes per §12 / §17 v4/v3 history tables. |
| #47 | Cascade D — L5 tooling rebuild (code) | Bootstrap + converter + 38/38 tests passing + CALIBRATION-PROCESS.md v2. v3 stale-template check rejects pre-v3 6-column CSVs. |
| #48 | Cascade F — populate 7 editorial cells + regenerate platform_floors | Cell hierarchy: text > video > infographic > photo > illustration > vector > audio. 14 of 21 rows blank as forward-compat placeholders for commercial/advertising (deferred to v2). |

### Independent PRs (any order)

| PR | Title |
|---|---|
| #40 | Social licence draft + Stage B session log + cell #1 (the original 8e47ec0 commit) |
| #42 | Upload V4 / D2.1 page-surface comment refresh |
| #43 | Session opener 2026-04-30 (the prior opener doc) |

---

## State after all 9 merge

**Stage B v1 editorial scope closed.** `pricing_format_defaults` carries 7 calibrated editorial cells + 14 forward-compat placeholder rows; bootstrap + converter + tests aligned to v3 cell-key shape (no `intrusion_level`); CALIBRATION-PROCESS.md drops the 0.7×/1.3× drift defaults; L1 v2.2 + L2 v1.1 + F1 v4 + F1.5 v3 all carry consistent path-(1) lock.

**F2 schema migration unblocked.** All prerequisites in place:
- L2 v1.1 — licence-specific tables (`pricing_cc_variants`, `pricing_sublabel_multipliers`, `pricing_use_tier_multipliers`) schema spec
- L4a F1 v4 §3.1 + §4.1 — `pricing_format_defaults` + `pricing_platform_floors` schema spec
- Cascade D converter — produces SQL seed from cascade F CSVs (run on the merged-main tree to generate F2's INSERT block)

**Already-shipped watermark layer untouched** throughout — `vault_assets.intrusion_level` + `watermark_profiles` + `watermark_intrusion_level` enum (migrations `20260417100001/2/3`) preserved as the System A surface; pricing engine MUST NOT query them.

---

## Standing posture per CLAUDE.md (brief)

- Audit first; never jump to implementation
- Founder ratifies before code
- Architecture before implementation
- Tight per-directive commits with selective stage
- When local origin/main is stale (host-key fetch failure), read directives from branch refs directly; never assert about main's content from a stale local

---

## Sandbox lock-avoidance rule (lesson learned 2026-04-30)

The sandbox cannot unlink files inside `.git/`. Any `git status` / `git diff` / `git log` invoked from sandbox creates `.git/index.lock` and leaves it stuck — blocking subsequent host-terminal git ops. **Rule for this and future sessions: I will use Read / Grep / `ls` / `cat` only inside sandbox. All git operations run on host.** Before any host-terminal git block, prefix with `rm -f .git/index.lock`.

---

## Immediate next steps (pick one to drive)

### (a) Founder review + merge the 6-PR pricing-track stack

Read PR #45 carefully against intent (RECONSTRUCTED warning). Merge cadence:

```
#41 → #45 → #44 → #46 → #47 → #48
```

Each PR's diff context expands as its dependencies merge. Merge independents (#40, #42, #43) any time.

### (b) After merges land — F2 schema migration directive composes

F2 is the first F-track schema PR. It composes the `pricing_format_defaults` + `pricing_platform_floors` migrations + includes the SQL seed (output of cascade D converter against cascade F CSVs).

**F2 directive composer prompt (paste into a fresh Claude Code session in `/Users/jnmartins/dev/frontfiles/` after PRs #41–#48 merge):**

```
You are composing F2 — the schema migration directive for pricing_format_defaults
and pricing_platform_floors. This stands up the pricing-engine schema substrate
the L1 v2.2 + cascade A-F arc has prepared.

CONTEXT
- PRs #41 (Phase α), #45 (L1 v2.2), #44 (L2 v1.1), #46 (cascade C: F1 v4 + F1.5
  v3), #47 (cascade D: L5 tooling rebuild), #48 (cascade F: 7 editorial cells +
  floors regen) have all merged to main
- Schema specs locked at:
  - F1 v4 §3.1 (pricing_format_defaults table structure: format, licence_class,
    currency, baseline_cents, table_version, calibration_basis, +provenance
    columns; UNIQUE on (format, licence_class, currency, table_version);
    CREATE INDEX active row on (format, licence_class, currency))
  - F1 v4 §4.1 (pricing_platform_floors table structure: format, licence_class,
    currency, min_cents, +provenance columns; UNIQUE active on (format,
    licence_class, currency))
- L2 v1.1 already covers pricing_cc_variants + pricing_sublabel_multipliers +
  pricing_use_tier_multipliers (composed as L2 directive at PR #44; migration
  unshipped — F2 may or may not absorb the L2 tables in the same migration;
  founder decides at directive ratification)
- Cascade D converter (scripts/pricing/csv-to-seed-migration.ts) emits SQL seed
  by running it against the merged-main format_defaults_v1_eur.csv +
  platform_floors_v1_eur.csv (and the 3 multiplier + CC CSVs)

POSTURE per /Users/jnmartins/dev/frontfiles/CLAUDE.md
- Audit first
- Be precise + concrete
- Founder ratifies before code (F2 directive composes; F2 implementation PR
  follows after directive ratifies)
- Don't bypass approval gates

PRE-FLIGHT (read before composing)
1. docs/licence/L2-DIRECTIVE.md (structural template — F2 directive mirrors
   this brief's structure: §1 What F2 is, §2 audit findings, §3 hard
   prerequisites, §4 scope boundary, §5 files added/touched, §6 schema spec,
   §7 SQL seed strategy, §8 verification gates, §9 DOWN migration, §10 RLS,
   §11 approval gate, §12 don't-do list, §13 references)
2. docs/pricing/PRICE-ENGINE-ARCHITECTURE.md (F1 v4) §3 + §4
3. docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md (F1.5 v3) §10 (converter SQL
   INSERT shapes)
4. supabase/migrations/20260417100001_watermark_profile_enums.sql +
   20260420000000_rls_all_tables.sql (RLS conventions to mirror)
5. scripts/pricing/csv-to-seed-migration.ts (verify the SQL emit shape matches
   what the F2 directive specs)
6. Latest migration timestamp on main (use the next available timestamp; do
   NOT skip ahead)

OUTPUT
- New file: docs/pricing/F2-DIRECTIVE.md (~700-800 lines, mirroring L2)
- Working tree: this single file modified
- Do NOT compose the migration file itself (that's F2 implementation; happens
  after directive ratifies)
- Do NOT commit, do NOT push; founder reviews diff first

OPEN DECISIONS to surface in §11 approval gate (not pre-decide)
1. Combined or separate migrations? (one .sql file for both pricing tables vs
   one per table)
2. Bundle L2 v1.1 tables into F2's migration? (cleaner single migration; or
   keep L2 implementation as a separate F2.5 PR for cleaner gate control)
3. Initial seed strategy? (a) F2 migration includes the SQL seed inline; (b)
   F2 migration ships empty + a separate seed migration runs the converter
   output; (c) seed runs as a one-off script in production
4. table_version handling in seed (what version number for v1 editorial-only
   data; how versioning increments at recalibration)
5. RLS service-role-only confirmation (mirrors L2 §6.6 pattern)

Report format when done:
"F2 directive composed. <X> sections; <Y> open decisions surfaced in §11.
Working tree: docs/pricing/F2-DIRECTIVE.md (M, <N> lines). Ready for founder
review."
```

After F2 directive ratifies → F2 implementation PR composes the actual migration files + runs converter + bundles SQL seed.

---

## Parking lot (founder-side; no Claude composition pending)

- **L1 v2.1 (social licence)** — resolve 4 corrections + lock architectural placement (sublabel under editorial vs new top-level class). Then L1 v2.1 amendment composes; then v1 social-class calibration follows. **v1 critical path per Stage B 2026-04-28 §3.2** — Stage B isn't fully closed until social lands.
- **AI cutover** (AI-1..AI-7):
  - AI-1: VERTEX_PRICING null fill in `src/lib/ai-suggestions/cost.ts` (~5 min data fill against scaffolded stub)
  - AI-2: verify `@google-cloud/vertexai` SDK shape (1.12.0 landed)
  - AI-3: pick HDBSCAN library + replace `runHdbscan` + `silhouettePerCluster` stubs
  - AI-4: GCP service account + Vertex AI User role + JSON key
  - AI-5: cluster calibration via `scripts/manual-test-cluster-batch.ts`
  - AI-6: wire `aiRealPipeline` + `creatorId` props in `src/app/vault/upload/page.tsx`
  - AI-7: flip `FFF_AI_REAL_PIPELINE=true` in deployed env
- **WM-D1** — approve ≥ 1 watermark profile per (intrusion_level, template_family) pair (0 of 6 currently approved per BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md §5 WM-IP-4)
- **WM-D3** — pick `none → light` or `none → standard` for legacy mapping (one-line edit in `src/lib/processing/ARCHITECTURE-BRIEF.md` §7.1)
- **T0.5** — answer 4 of 5 product questions in `docs/audits/T0_5_SPECIAL_OFFER_DECISION_MEMO.md` (Q1 Retention, Q2 Audit obligations, Q3 Asset source, Q5 Cutover semantics; Q4 Assignment shape adjudicated 2026-04-20)
- **P4 G3** — Gate 3 ratification of `docs/audits/P4_IMPLEMENTATION_PLAN.md` (Draft 1, 2026-04-20)
- **BP-IPs** — Blue Protocol IP-resolution (BP-IP-1 5-vs-7 state model; BP-IP-2 CANONICAL_SPEC.md placement; BP-IP-3 priority vs upload rebuild; BP-IP-4 CEL existence verification)

---

## DEFAULT IF I SAY "PROCEED"

Pre-flight: confirm PRs #41 → #48 are all merged to main; confirm `git status` clean; confirm `bun run test scripts/pricing/__tests__/csv-to-seed-migration.test.ts` passes on main. If yes → paste the F2 directive composer prompt above into a fresh Claude Code session and let it compose. If PRs aren't merged yet → halt and surface which PRs need attention.

---

## Notes on usage

- This opener supersedes `SESSION-OPENER-2026-04-30.md`. PR #43 may be merged or closed at founder discretion; the opener it carries is now historical.
- If the cascade A-F PRs need rework (e.g., founder review of #45 surfaces corrections to L1 v2.2), the dependent PRs may need rebase. Cascade B → F all stack on each other; a force-push to PR #45's branch would require force-pushing #44, #46, #47, #48 in turn.
- The F2 composer prompt assumes all 6 stacked PRs are merged. If only some are merged, surface the gap and pause.
- This opener doc itself can either be committed and pushed (its own PR), or left as a working-tree convenience that gets superseded by the next session's opener.

[View this opener](computer:///Users/jnmartins/dev/frontfiles/docs/SESSION-OPENER-2026-05-01.md)
