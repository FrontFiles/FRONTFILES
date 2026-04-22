# SCAFFOLD Prompt 7 — Verification pass (AC1-AC15, evidence-only)

You are Claude Code executing Prompt 7 of P4 concern 4A.2.SCAFFOLD.
This is the **final verification pass** before the exit report at
Prompt 8. It walks the §AC acceptance-criteria matrix end to end,
re-runs every automatable check, and produces the audit-grade
evidence package the founder will cite in the exit report.

**Under the normal (expected) case, this prompt produces zero file
changes and zero commits.** Everything surfaced is evidence: grep
output, test/lint/build numbers, git diff stats, and two manual-
smoke items explicitly handed back to the founder to execute.

If any automatable check fails, the decision tree is the same as P6:
surface the failure with full context, **pause**, and hand back to
the founder. Do not attempt to "fix while you're here" — §D9.

---

## MANDATORY READING (in order, before you run anything)

1. **`docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md`** —
   specifically:
   - §AC (L305-323) — the full AC1-AC15 matrix this prompt verifies
   - §D8 (L336-347) — the file-mutability freeze this prompt audits
   - §R4 commentary (L85-91) — AC12 floor was raised 67 → 69
   - §AUDIT-2 (L453-472) — test floor raised to 1270 (1264 + 6 route
     cases from Prompt 2); lint floor stays at 67 (raised to 69 by
     §R4 for Prompt-2 symmetric cost)
2. **`SCAFFOLD_PROMPT_6.md`** — the grep matrix you just ran (AC7,
   AC8, AC9 already verified at P6). You re-run them here for exit
   evidence but may reference the P6 report shape.
3. **`SCAFFOLD_PROMPT_2.md`** through **`SCAFFOLD_PROMPT_5.md`** —
   each prompt's DONE CRITERIA section tells you what each commit
   was supposed to contain. Use these as your reference for file-
   inventory + commit-scope verification.

You do **not** need to re-read the client components or the route
handler source. The AC matrix is testable from grep, baseline runs,
and git metadata alone.

---

## CURRENT BASELINES (post-P5, post-R7, pre-P7)

These are the exact numbers you must match or beat:

| Baseline | Floor | Ceiling | Source |
|---|---|---|---|
| Tests passed | 1276 | 1276 (no new tests expected at P7) | §R4 + P3/P4 leaf additions |
| Tests skipped | 10 | 10 | §AUDIT-2 + concern |
| Tests failed | 0 | 0 | |
| Lint errors | — | 68 | §R4 revised ceiling is 69; post-P5 legacy deletion drops to 68 |
| Lint warnings | — | 346 | Post-concern state |
| Build | clean | clean | |
| `/vault/offers` | ƒ | ƒ | §R7 (force-dynamic required) |
| `/vault/offers/[id]` | ƒ | ƒ | §R7 (force-dynamic required) |

Any delta against this table is a defect and blocks exit. Surface
and pause.

---

## AC MATRIX — run each row, report the evidence

For every row below, execute the verification command, paste the
literal output (or "no matches"), and mark PASS / FAIL / DEFER. The
report format at the end of this prompt specifies exactly how to
structure each entry.

### AC1 — `GET /api/offers` contract (§F1)

- Verification: Vitest covers this. The 6 route cases in
  `src/app/api/offers/__tests__/get.route.test.ts` exhaustively
  exercise the §F1 contract (flag-off 404, no-Bearer 401, invalid-
  Bearer 401, no-actor 403, happy-path 200, truncation flag).
- Command: `npm run test -- src/app/api/offers/__tests__/get.route.test.ts`
- Expected: 6 passing, 0 failing.
- Curl-level verification (AC table L309) is **deferred to manual
  smoke** — requires a live Bearer and actor row; mark as
  MANUAL-SMOKE in the report.

### AC2 — flag-off 404 on GET route

- Verification: covered by case 1 of the same route test. No separate
  action.
- Expected: included in the AC1 test sweep above.

### AC3 — RLS party-only filtering on GET route

- Verification: covered by case 5 (valid-auth, party → 200).
- Expected: included in the AC1 test sweep above.

### AC4 — both `page.tsx` wrappers call `notFound()` when flag off

- Verification: grep proves the code path exists; actual 404 behavior
  needs a manual smoke (MANUAL-SMOKE; see section below).
- Commands:
  ```
  git grep -n 'notFound()' -- 'src/app/vault/offers/page.tsx' 'src/app/vault/offers/[id]/page.tsx'
  git grep -n 'isEconomicV1UiEnabled()' -- 'src/app/vault/offers/page.tsx' 'src/app/vault/offers/[id]/page.tsx'
  ```
- Expected: both files return exactly one match for each pattern; the
  two calls sit on adjacent lines inside the default export.

### AC5 — both wrappers are server components

- Verification: grep for `'use client'` returns zero inside both
  wrapper files.
- Command:
  ```
  git grep -n "^'use client'" -- 'src/app/vault/offers/page.tsx' 'src/app/vault/offers/[id]/page.tsx'
  ```
- Expected: no matches.

### AC6 — inner client components have no Supabase imports

- Verification: grep for any `@supabase/*` or `@/lib/supabase/*`
  import inside the two client-leaf files.
- Command:
  ```
  git grep -nE "from '(@supabase/|@/lib/supabase/)" -- \
    'src/app/vault/offers/_components/OffersListClient.tsx' \
    'src/app/vault/offers/[id]/_components/OfferDetailClient.tsx'
  ```
- Expected: no matches.

### AC7 — legacy page deleted, no `mockThreads` survives

- Verification: P6 already proved this; re-run the canonical query
  here for exit evidence.
- Command:
  ```
  git grep -n -E '\bmockThreads\b|\bmockEvents\b' -- 'src/'
  ```
- Expected: no matches.

### AC8 — no new `/api/special-offer/*` consumers

- Verification: re-run the P6 Query 4 with route-handler exclusion.
- Command:
  ```
  git grep -n 'api/special-offer' -- 'src/' \
    ':!src/app/api/special-offer/**'
  ```
  (Fallback: pipe through `grep -v 'src/app/api/special-offer/'`.)
- Expected: no matches.

### AC9 — no new `@supabase/ssr` or `next/headers` imports

- Verification: repo-wide grep against both.
- Command:
  ```
  git grep -n -E "from '@supabase/ssr'|from 'next/headers'" -- 'src/'
  ```
- Expected: no matches.

### AC10 — test baseline ≥ 1270 passing

- Verification: full `npm run test` run.
- Expected: **1276 passed / 10 skipped / 0 failed**. Any regression
  is a defect.

### AC11 — `npm run build` clean

- Verification: full `npm run build` run.
- Expected: clean compile, zero errors, zero warnings; route table
  reports both `/vault/offers` and `/vault/offers/[id]` as `ƒ`
  (dynamic). Surface the relevant route-table lines in the report.

### AC12 — lint errors ≤ post-R4 ceiling

- Verification: full `npm run lint` run.
- Expected: **≤ 68 errors / ≤ 346 warnings**. R4 raised the ceiling
  to 69 to absorb Prompt 2's symmetric test-file cost; the legacy-
  mock deletion at P5 naturally dropped the number to 68. Any
  regression above 68 is a defect.

### AC13 — brutalist styling constraints (§F6) honored

- Verification: MANUAL-SMOKE — requires browser render. Mark as
  MANUAL-SMOKE in the report and enumerate the specific visual
  assertions the founder must check (see manual-smoke section below).

### AC14 — existing `POST /api/offers` route unchanged (GET-addition
only)

- Verification: git diff of the route file against the pre-concern
  merge base, grepped for evidence that the POST handler block was
  not touched.
- Commands:
  ```
  # Locate the merge base of this branch against main
  MERGE_BASE=$(git merge-base HEAD main)
  echo "Merge base: $MERGE_BASE"

  # Full diff of the route file since branching
  git diff "$MERGE_BASE"...HEAD -- 'src/app/api/offers/route.ts' | head -120
  ```
- Expected: diff shows added `GET` export only; the `POST` export and
  its helper functions remain textually identical to the merge-base
  version. If any line inside the POST handler shows `+` or `-`,
  that is a defect — surface the exact lines.

### AC15 — existing `GET /api/offers/[id]` route unchanged (zero
diff)

- Verification: git diff of the by-id route file against merge base.
- Command:
  ```
  git diff "$MERGE_BASE"...HEAD -- 'src/app/api/offers/[id]/route.ts'
  ```
- Expected: **zero diff** (empty output). Any output at all is a
  defect.

---

## FILE-INVENTORY AUDIT (§D8 freeze)

§D8 enumerates the files this concern is allowed to touch. Verify
nothing else was modified on the branch.

- Command:
  ```
  git diff --name-only "$MERGE_BASE"...HEAD | sort
  ```
- Expected list (exactly 15 paths, in alphabetical order):
  ```
  docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md
  docs/audits/_prompts/SCAFFOLD_PROMPT_2.md
  docs/audits/_prompts/SCAFFOLD_PROMPT_3.md
  docs/audits/_prompts/SCAFFOLD_PROMPT_4.md
  docs/audits/_prompts/SCAFFOLD_PROMPT_5.md
  docs/audits/_prompts/SCAFFOLD_PROMPT_6.md
  docs/audits/_prompts/SCAFFOLD_PROMPT_7.md
  src/app/api/offers/__tests__/get.route.test.ts
  src/app/api/offers/route.ts
  src/app/vault/offers/[id]/_components/OfferDetailClient.tsx
  src/app/vault/offers/[id]/_components/__tests__/OfferDetailClient.test.tsx
  src/app/vault/offers/[id]/page.tsx
  src/app/vault/offers/_components/OffersListClient.tsx
  src/app/vault/offers/_components/__tests__/OffersListClient.test.tsx
  src/app/vault/offers/page.tsx
  ```
- Notes:
  - The directive + six `SCAFFOLD_PROMPT_*.md` files are the
    concern's scaffolding. Their presence is expected; §D8 implicitly
    covers them via "This directive (revisions only)" and the
    prompt-file directory precedent from B1/B2 / AUTH.
  - `__tests__/` subdirectories replace the `tests/` convention from
    the original §F7 draft per the §R4 path correction. Both test
    files have `.test.tsx` / `.test.ts` filenames.
  - `SCAFFOLD_PROMPT_7.md` appears in the expected list because this
    prompt itself lives there — your own report file will appear in
    the diff until P8 commits it.
- If the actual list contains anything NOT in the expected list →
  defect. Surface and pause.
- If the actual list is missing anything from the expected list →
  also a defect. Surface and pause.

---

## COMMIT-TRAIL AUDIT

Enumerate every commit made on the concern branch and confirm each
is concern-scoped.

- Command:
  ```
  git log --oneline "$MERGE_BASE"..HEAD
  ```
- Expected commits (exact count: 8, newest first):
  ```
  f91b4f6 chore(p4-4a.2): R7 — lock force-dynamic into §F2 canonical pattern
  2b109e0 feat(p4-4a.2): server-wrapper flag gates at /vault/offers and /vault/offers/[id]
  b665a2d feat(offers): OfferDetailClient + pure-helper smoke tests (P4 §F4)
  7ee350c feat(p4/4A.2/SCAFFOLD): Prompt 3 — OffersListClient + pure-helper tests (§R6)
  41fde76 docs(p4/4A.2/SCAFFOLD): R6 — close client-test infra gap via pure-helper pattern
  abca34d docs(p4/4A.2/SCAFFOLD): R5 — reorder prompts, leaves before wrappers
  f34df12 feat(p4/4A.2/SCAFFOLD): Prompt 2 — GET /api/offers + tests (§AUDIT-2, R4)
  97215e2 docs(p4/4A.2/SCAFFOLD): directive APPROVED — R3 closes AUTH dependency
  ```
- Expected commit count: 8 (5 `feat`/`docs` of substantive work + 3
  directive revisions R3/R5/R6 — R4 folded into `f34df12`; R7 is its
  own commit `f91b4f6`).
- Any additional commits → surface, do not touch.
- Any missing commits → likely tracker drift; surface and ask.

---

## MANUAL-SMOKE ITEMS FOR FOUNDER (AC4, AC13)

Claude Code does not have a browser. The following two AC rows
require founder execution before P8 can close the concern.

### M1 — flag-off 404 smoke (AC4)

**Setup:** confirm `.env.local` has `ECONOMIC_V1_UI=false` (or does
not set it; default is false).

**Steps:**
1. `npm run dev` (local)
2. Visit `http://localhost:3000/vault/offers` → expect Next's default
   404 page.
3. Visit `http://localhost:3000/vault/offers/00000000-0000-0000-
   0000-000000000000` → expect Next's default 404 page.
4. Stop the dev server.

**Pass criterion:** both routes return the 404 page with the flag
off. Any 200 render means the flag gate is broken.

### M2 — flag-on brutalist render smoke (AC13 + AC4-positive)

**Setup:** set `ECONOMIC_V1_UI=true` in `.env.local`. Must also
have a signed-in actor to exercise the authenticated path; if no
actor seed is available, the loading + "Sign in" branches are
acceptable visual assertions.

**Steps:**
1. `npm run dev`
2. Visit `/vault/offers` signed out → confirm the unauthenticated
   branch renders ("Sign in to view your offers.") in system sans,
   black on white, no chrome.
3. Sign in. Re-visit `/vault/offers` → confirm list rows render in
   brutalist style (system sans, `text-sm` / `text-base`, no
   shadows, no rounded corners, no icons, thin black bottom
   borders). If the test DB has no offers for this actor, the empty
   branch ("No offers yet.") is the correct visual target.
4. Visit `/vault/offers/00000000-0000-0000-0000-000000000000` (any
   non-existent UUID) → confirm the "Offer not found." branch
   renders in brutalist style.
5. Stop the dev server. Revert `ECONOMIC_V1_UI` to `false` (or
   unset) before committing anything.

**Pass criterion:** all three states render in the §F6 style. Any
deviation (shadows, rounded corners, color drift, icons, serif
fonts, spacing violations) is a defect.

---

## FORBIDDEN ACTIONS

Under no circumstance does this prompt: add a new file to `src/`;
edit an existing file in `src/`; rename anything; modify tests;
change a lint rule; touch `.env*`; touch `/api/special-offer/*` route
handlers; commit anything.

The one allowed write is your report, pasted back into chat — not
to a file.

---

## REPORT FORMAT

Surface exactly these sections; no more, no less:

```
### AC matrix

| # | Criterion | Status | Evidence |
|---|---|---|---|
| AC1 | GET /api/offers §F1 contract | PASS via 6 route cases / MANUAL-SMOKE for curl | <test count + filename> |
| AC2 | Flag-off 404 on GET route | PASS (covered by AC1 case 1) | <ref> |
| AC3 | RLS party-only filtering | PASS (covered by AC1 case 5) | <ref> |
| AC4 | Wrappers call notFound() when flag off | PASS-grep + MANUAL-SMOKE (M1) | <grep output> |
| AC5 | Wrappers are server components | PASS | <grep output> |
| AC6 | Client leaves have no Supabase imports | PASS | <grep output> |
| AC7 | mockThreads retired | PASS | <grep output> |
| AC8 | No new /api/special-offer/* consumers | PASS | <grep output> |
| AC9 | No new @supabase/ssr or next/headers | PASS | <grep output> |
| AC10 | Test baseline | PASS at 1276 / 10 / 0 (floor 1270) | <npm run test tail> |
| AC11 | Build clean | PASS | <route-table lines for /vault/offers and /vault/offers/[id]> |
| AC12 | Lint | PASS at 68 / 346 (ceiling 68) | <npm run lint tail> |
| AC13 | Brutalist styling | MANUAL-SMOKE (M2) | deferred to founder |
| AC14 | POST /api/offers unchanged | PASS | <diff summary> |
| AC15 | GET /api/offers/[id] unchanged | PASS (zero diff) | <empty> |

### Baseline runs — raw output tails

#### npm run test
<last 10 lines>

#### npm run lint
<last 5 lines + full error/warning count line>

#### npm run build
<route table rows for /vault/offers and /vault/offers/[id], plus the final "compiled successfully" line>

### File-inventory audit

- Merge base: <SHA>
- Actual files changed (count + list, alphabetized)
- Expected files changed (count + list, alphabetized)
- Delta: <match | list extras and missing>

### Commit-trail audit

- Expected commit count: 8
- Actual commit count: <N>
- Commits (newest first):
<oneline log output>
- Delta: <match | list extras and missing>

### Manual-smoke items for founder

- M1 (flag-off 404): DEFERRED to founder — steps above
- M2 (flag-on brutalist render): DEFERRED to founder — steps above

### Defects surfaced

<list anything that failed, PAUSED and awaiting founder review; say
"none" if clean>

### Not committed — awaiting review
```

---

## COMMIT GUIDANCE

In the expected clean case (all AC rows PASS or MANUAL-SMOKE, file
inventory matches, commits match, baselines flat), **do not commit
anything**. The report is the deliverable. The founder will run the
two manual-smoke items M1 + M2, issue the Gate 1 verdict on P7, and
then move to Prompt 8 (exit report).

If the report surfaces a defect and the founder approves a
correction path in chat, a follow-up prompt (not this one) will
execute the correction.

---

## WHY THIS PROMPT IS EVIDENCE-ONLY

The concern is already functionally complete at commit `f91b4f6`:
the GET list route is built and tested (Prompt 2), both client
leaves are built and tested (Prompts 3-4), the server wrappers
bridge flag + leaf (Prompt 5), the canonical pattern is locked
(R7), and the legacy-orphan audit came back clean (Prompt 6). What
remains is **proof**: a structured re-run of every acceptance
criterion, producing the evidence the exit report will cite.

A passing P7 is the founder's signal that the concern is ship-
ready behind both flags (`FFF_AUTH_WIRED=false`,
`ECONOMIC_V1_UI=false`) and that the Deploy 2 env-change flip will
bring up the full surface without a rebuild.
