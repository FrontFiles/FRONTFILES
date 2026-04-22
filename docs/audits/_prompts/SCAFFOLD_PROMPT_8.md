# SCAFFOLD Prompt 8 — Exit report + bundle commit (concern-closing)

You are Claude Code executing Prompt 8 of P4 concern 4A.2.SCAFFOLD.
This is the **concern-closing prompt**. P5 shipped the brutalist
wrappers. P6 verified zero legacy orphans. P7 ran the AC1-AC15
matrix; all 13 automatable ACs passed and the two manual smokes
(AC4 flag-off 404 = M1, AC13 flag-on brutalist render = M2) were
PASSED by the founder on 2026-04-22 against `feat/p4-scaffold-offers`
at HEAD `f91b4f6`. Tree was returned to Deploy-1 floor (flag false)
after the smoke.

P8 bundles the two untracked prompt files (6, 7) plus this prompt
(8) plus a new exit report into a single concern-closing commit. It
also fixes one bookkeeping typo P7 surfaced (14-vs-15 path-count in
SCAFFOLD_PROMPT_7.md).

**P8 MUST NOT touch any source code.** §D8 file-mutability freeze
still applies. §D9 no-while-I'm-here still applies. The only
mutations allowed are: authoring `SCAFFOLD_PROMPT_8.md` (this file,
as a new doc), authoring the exit report at the path below, and
editing SCAFFOLD_PROMPT_7.md to correct the one typo called out
in §2 below.

---

## MANDATORY READING (in order)

1. `docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md` — full read.
   Anchor on §AC (AC1-AC15), §F1-§F7, §R1-§R7, §D1-§D9.
2. `docs/audits/_prompts/SCAFFOLD_PROMPT_1.md` through
   `SCAFFOLD_PROMPT_7.md` — full read. The exit report cites
   commits and evidence from each.
3. `git log --oneline main..HEAD` — enumerate the concern commit
   trail from the current branch against `main`. You should see
   exactly 8 commits (the eight SHAs listed in §3 below — confirm
   each by `git show --stat`).

---

## EXECUTION ORDER (strict)

### §1. Author this prompt to disk

Save the full text of this prompt (what Claude Code is currently
executing) to:

```
docs/audits/_prompts/SCAFFOLD_PROMPT_8.md
```

Exact text. Do not paraphrase or restructure.

### §2. Fix the 14→15 path-count typo in SCAFFOLD_PROMPT_7.md

Read `docs/audits/_prompts/SCAFFOLD_PROMPT_7.md` in full. Find the
preamble sentence in the §D8 file-inventory section that says
"exactly 14 paths" (or similar phrasing asserting 14). Correct the
count to 15 — the enumerated list has 15 items (1 directive +
6 prompt files + 2 api/offers files + 6 vault/offers source files).

Do not restructure the section. One-word correction only.
Verify by re-counting the enumerated list and confirming 15.

### §3. Author the exit report

Write a new file at:

```
docs/audits/P4_CONCERN_4A_2_SCAFFOLD_EXIT_REPORT.md
```

Required sections, in order, each titled exactly as shown:

```
# P4 Concern 4A.2.SCAFFOLD — Exit Report

## Verdict
<one sentence: concern closed / PASSED / carry-overs logged
separately>

## Scope recap
<2-3 sentences on what the concern was: retire 561-LoC Special
Offers mock, ship server-component wrappers + brutalist client
components for /vault/offers and /vault/offers/[id], gate on
FFF_ECONOMIC_V1_UI, preserve /api/special-offer/* routes per §D7>

## Acceptance criteria matrix (AC1–AC15)
<markdown table, one row per AC, columns:
  | AC | Requirement (one-line) | Result | Evidence |
Evidence column cites: commit SHA, file path, test name, or
"M1/M2 smoke 2026-04-22" for the two manual ACs.
Every row must resolve to PASS or DEFERRED-with-reason.
No "partial" or "TBD" allowed — this is the closing report.>

## File inventory (§D8)
<enumerate the 15 paths this concern authored or modified,
grouped by directory. Flag each as NEW or MODIFIED. Confirm
every path against `git diff --stat main...HEAD`.>

## Commit trail
<markdown table with 8 rows in chronological order, columns:
  | # | SHA | Prompt | What shipped |
The 8 SHAs are:
  1. f91b4f6 (R7 directive amendment — force-dynamic lock)
  2. 2b109e0 (P5 — server-component wrappers shipped)
  3. b665a2d (P4 — OfferDetailClient + tests)
  4. 7ee350c (P3 — OffersListClient + tests)
  5. 41fde76 (P2 — GET /api/offers + tests)
  6. abca34d (P1 — pre-flight audit)
  7. f34df12 (directive authored)
  8. 97215e2 (concern scaffolding/memory)
Verify each SHA with `git show --format=%s --no-patch <sha>`
before writing. If any SHA doesn't match the branch, STOP and
surface the discrepancy to the founder — do not commit.>

## Baseline floors (AC10/AC11/AC12)
<three-line summary:
  - Tests: 1276 passed / 10 skipped / 0 failed
  - Lint: 68 errors / 346 warnings (floor held)
  - Build: clean; /vault/offers and /vault/offers/[id] both `ƒ`
Cite the P7 verification pass as evidence.>

## Manual smokes (AC4, AC13)
<brief narrative:
  - M1 (AC4, flag-off 404): executed 2026-04-22, both routes
    returned 404 as expected, chrome rendered correctly around
    the 404 body.
  - M2 (AC13, flag-on brutalist render): executed 2026-04-22,
    both routes returned 200 with brutalist client-component
    output (system sans, black-on-white, centered, no
    shadows/rounded/icons). Signed-out branch visible ("Sign
    in to view your offers." / "Sign in to view this offer.")
    — correct per R6-pure architecture; signed-in render path
    covered by the 1276-test suite.
Tree returned to Deploy-1 floor (FFF_ECONOMIC_V1_UI=false)
after the smoke.>

## Carry-overs (out of this concern)
<enumerate, one line each, with destination concern where known:
  - /api/special-offer/* route-handler retirement → concern
    4A.2.C (preserved here per §D7)
  - Nav/chrome labels still saying "Special Offers" → concern
    4A.2.C or later documentation cleanup
  - ESLint no-restricted-syntax mis-fire on test-file env stubs
    → ops-hygiene concern logged outside this directive
  - RTL / Playwright CT coverage on new client components →
    "Client testing foundations" concern, outside this directive
    (§R6 footnote)
  - Lint-floor improvement (below 68/346) → not in scope; the
    current floor is the post-legacy-deletion agreed number>

## Closed
<one-line timestamp closing the concern against the final commit
SHA produced by this prompt. Leave the SHA placeholder as
`<P8-COMMIT-SHA>` — the founder will backfill after merge.>
```

The report is evidence-only prose. Do not add opinion, no "lessons
learned", no future recommendations beyond the carry-overs list.

### §4. Verify baselines one more time

Even though P7 already did this, re-confirm flat:

```
npm run test -- --run 2>&1 | tail -5
npm run lint 2>&1 | tail -3
npm run build 2>&1 | tail -20
```

Expected: tests 1276/10/0, lint 68/346 or lower, build clean with
both routes `ƒ`. Any delta is a defect — STOP and surface to the
founder before committing. P8 authored zero code; no number can
have moved.

### §5. Bundle commit

Stage and commit exactly four files:

```
git add \
  docs/audits/_prompts/SCAFFOLD_PROMPT_6.md \
  docs/audits/_prompts/SCAFFOLD_PROMPT_7.md \
  docs/audits/_prompts/SCAFFOLD_PROMPT_8.md \
  docs/audits/P4_CONCERN_4A_2_SCAFFOLD_EXIT_REPORT.md
```

Verify with `git status` that no other paths are staged. If
anything else is staged (node_modules drift, stray .bak files,
lightningcss-darwin-arm64 package.json residue, etc.) — unstage
it. P8 is docs-only.

Commit with:

```
chore(p4-4a.2): P8 — concern exit report + prompt bundle close

Closes P4 concern 4A.2.SCAFFOLD. Bundles SCAFFOLD_PROMPT_{6,7,8}.md
(previously evidence-only / untracked) and the concern exit report.
Also corrects the 14→15 path-count bookkeeping typo P7 surfaced in
SCAFFOLD_PROMPT_7.md.

AC1-AC15: all PASS. Tests 1276/10/0, lint 68/346, build clean,
both /vault/offers routes ƒ-dynamic. M1 + M2 manual smokes PASSED
2026-04-22. Tree at Deploy-1 floor.

Carry-overs (logged in exit report, not this commit):
  - /api/special-offer/* retirement → 4A.2.C
  - Nav/chrome "Special Offers" labels → 4A.2.C or later
  - ESLint no-restricted-syntax test-stub mis-fire → ops-hygiene
  - Client testing foundations (RTL/Playwright CT) → separate
    concern per §R6 footnote

Refs: P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md §AC, §F1-§F7, §R1-§R7,
§D1-§D9.
```

Do not push. Founder will review the commit and push manually.

---

## OUT OF SCOPE FOR P8 (explicit)

- Any source-code mutation. §D8 freeze. If a source file looks
  wrong to you, surface to the founder — do not fix in P8.
- /api/special-offer/* route handlers. §D7. Retirement is 4A.2.C.
- Nav labels, chrome copy, routing tables anywhere else in the
  tree. §D9.
- Lint-floor chasing. 68/346 is the agreed post-legacy-deletion
  floor.
- ESLint rule configuration changes (no-restricted-syntax
  mis-fire). Ops-hygiene, separate concern.
- Any new test file. Coverage concerns belong to "Client testing
  foundations" (§R6 footnote).
- Pushing the commit. Founder pushes manually.

---

## EXPECTED END STATE

After P8 commits cleanly:

- Working tree clean (`git status` shows nothing).
- `git log --oneline main..HEAD` shows 9 commits (the original 8
  plus P8's).
- Branch `feat/p4-scaffold-offers` is ready for PR review.
- Concern 4A.2.SCAFFOLD is closed; exit report lives at
  `docs/audits/P4_CONCERN_4A_2_SCAFFOLD_EXIT_REPORT.md`.
- Baselines remain flat (tests 1276/10/0, lint 68/346, build
  clean, both offers routes ƒ-dynamic).

Hand the report (last 30 lines of the exit report + the new commit
SHA) back to the founder. The founder will backfill the
`<P8-COMMIT-SHA>` placeholder, close the task tracker entry, and
proceed to concern 4A.2.C.

---

## WHY THIS PROMPT IS THIS SMALL

The heavy lifting was done in P1-P7. P8 is paperwork: bundle the
evidence files, write the closing narrative, commit. The only
code-like artifact is the 14→15 typo correction, which is a
one-word edit. Everything else is prose authored from already-
gathered evidence.

---

## CORRECTIONS APPLIED (RESUME, before §1 execution)

The founder issued three corrections after Claude Code's initial
STOP for SHA-mapping verification. These are part of the authoritative
P8 specification and were applied before any writes:

### CORRECTION 1 — §MANDATORY READING item 2

Read `SCAFFOLD_PROMPT_2.md` through `SCAFFOLD_PROMPT_7.md`. Six files,
not seven. `SCAFFOLD_PROMPT_1.md` does not exist on disk — P1 did not
produce a prompt file; the directive itself is the P1 deliverable.
Note this in the exit report's §Scope recap.

### CORRECTION 2 — §3 exit report, §Commit trail table

Use this exact 8-row table, chronological (oldest → newest):

| # | SHA       | Prompt / Revision   | What shipped |
|---|-----------|---------------------|--------------|
| 1 | 97215e2   | Directive R3 closure| directive APPROVED — R3 closes AUTH dependency |
| 2 | f34df12   | P2                  | Prompt 2 — GET /api/offers + tests (§AUDIT-2, R4) |
| 3 | abca34d   | Directive R5        | reorder prompts, leaves before wrappers |
| 4 | 41fde76   | Directive R6        | close client-test infra gap via pure-helper pattern |
| 5 | 7ee350c   | P3                  | OffersListClient + pure-helper tests (§R6) |
| 6 | b665a2d   | P4                  | OfferDetailClient + pure-helper smoke tests (§F4) |
| 7 | 2b109e0   | P5                  | server-wrapper flag gates at /vault/offers and /vault/offers/[id] |
| 8 | f91b4f6   | Directive R7        | lock force-dynamic into §F2 canonical pattern |

Do not rename or reclassify. The 4 directive-revision commits
(R3/R5/R6/R7) and the 4 prompt commits (P2/P3/P4/P5) are all
legitimate concern artifacts. There is no "P1 commit" and no
"directive authored" commit on this branch.

### CORRECTION 3 — §Scope recap

Add one sentence: "P1 (pre-flight audit) and directive authoring
landed before `feat/p4-scaffold-offers` diverged from main; neither
appears in this concern's commit trail. The earliest concern commit
on this branch is `97215e2` (R3 closure)."
