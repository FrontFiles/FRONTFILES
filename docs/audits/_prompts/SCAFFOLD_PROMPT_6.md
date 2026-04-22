# SCAFFOLD Prompt 6 — Legacy-orphan audit (evidence-only, per §R5)

You are Claude Code executing Prompt 6 of P4 concern 4A.2.SCAFFOLD.
This is an **evidence-only audit pass**. The legacy 561-LoC Special
Offers mock was retired at Prompt 5 by overwriting
`src/app/vault/offers/page.tsx` in place (commit `2b109e0`). Your job
here is to confirm nothing else in the tree still depends on that
retired surface: no dangling imports, no stranded helpers, no new
call-sites pointing at the soon-to-die `/api/special-offer/*` routes.

**Under the normal (expected) case, this prompt produces zero file
changes.** A clean report, pasted back to the founder, closes the
prompt. `git rm` is permitted **only** if an orphaned sibling file
surfaces that is plainly dead-on-arrival; if so, surface the file
first, propose the `git rm`, and **pause for founder approval before
running it**. Do not pre-emptively delete anything.

---

## MANDATORY READING (in order, before you run any grep)

1. **`docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md`** — anchor on:
   - §F5 (legacy page removal — lines 264-272)
   - §R5 execution-order revision (lines 95-112), especially L104 for
     what P6 is and is not
   - §D7 (the `/api/special-offer/*` route handlers are **preserved**;
     retirement is concern 4A.2.C — line 335)
   - §D9 (no "while I'm here" scope creep)
   - AC7 + AC8 (acceptance criteria this prompt satisfies — lines
     315-316)
2. **`SCAFFOLD_PROMPT_5.md` grep-evidence section** — lines 244-265.
   P5 already performed a first-pass grep at overwrite time. P6
   re-runs the same queries from a clean HEAD and adds three scoped
   checks P5 did not run.
3. The current contents of `src/app/vault/offers/` — run `find
   src/app/vault/offers -type f | sort` as your first action and
   compare to the expected-file list below.

---

## EXPECTED SURVIVING FILE LIST (`src/app/vault/offers/`)

After P5, exactly six files should exist under `src/app/vault/offers/`
and nothing else:

```
src/app/vault/offers/page.tsx
src/app/vault/offers/_components/OffersListClient.tsx
src/app/vault/offers/_components/__tests__/OffersListClient.test.tsx
src/app/vault/offers/[id]/page.tsx
src/app/vault/offers/[id]/_components/OfferDetailClient.tsx
src/app/vault/offers/[id]/_components/__tests__/OfferDetailClient.test.tsx
```

If the `find` lists **any additional file** (a stale helper, an old
types file, a forgotten `.bak`, a leftover test, anything) — that
file is an orphan candidate. Surface it by path, describe what it
appears to be (open it read-only; do not modify), and pause for
founder approval before proposing `git rm`.

---

## GREP AUDIT — exact queries, expected outcomes, and false-positive
## callouts

Run each query below from the repo root. Paste the **full literal
output** (or "no matches") in your report. Do not paraphrase.

### Query 1 — primary legacy-data symbols

```
git grep -n -E '\bmockThreads\b|\bmockEvents\b' -- 'src/'
```

**Expected:** no matches. Both names are idiosyncratic to the retired
mock. Any surviving match is a real orphan and blocks exit.

### Query 2 — legacy component and type names

```
git grep -n -E '\bThreadCard\b|\bNegotiationEvent\b|\bhandleThreadUpdate\b|\bEVENT_LABELS\b' -- 'src/'
```

**Expected:** no matches. These are also idiosyncratic to the retired
mock. Any surviving match is a real orphan and blocks exit.

### Query 3 — `STATUS_STYLES` **with context guard** (false-positive
alert)

```
git grep -n '\bSTATUS_STYLES\b' -- 'src/'
```

**Expected matches (permitted; NOT legacy-offer orphans):**

- `src/components/assignment/DocumentsPanel.tsx` — this file defines
  **its own** `STATUS_STYLES` for document-status styling in the
  assignments surface. Unrelated to the retired offer mock. Do not
  flag.

**Unexpected matches (real orphans; block exit):**

- Any match inside `src/app/vault/offers/**` — should be none.
- Any match that is plainly the **legacy offer-status map**
  (`{ negotiating: ..., accepted: ..., declined: ..., countered: ...
  }` shape). If you can't distinguish the two by name alone, open the
  file and read the surrounding 10 lines of context before classifying.

### Query 4 — `/api/special-offer/*` **consumers** (AC8)

The `src/app/api/special-offer/**/route.ts` handlers themselves
**are preserved** (§D7). This query targets everything **else**:

```
git grep -n 'api/special-offer' -- 'src/' \
  ':!src/app/api/special-offer/**'
```

(If your `git grep` flavor doesn't support the pathspec exclusion,
fall back to:
`git grep -n 'api/special-offer' -- 'src/' | grep -v
'src/app/api/special-offer/'`.)

**Expected:** no matches. The legacy page was the only consumer; it
died with the overwrite. Any surviving consumer is a real orphan and
blocks exit. Do **not** modify the route handlers themselves under
any circumstance — that scope belongs to concern 4A.2.C.

### Query 5 — imports from the deleted legacy page

```
git grep -n "from '@/app/vault/offers/page'" -- 'src/' 2>&1
git grep -n "from './page'" -- 'src/app/vault/offers/' 2>&1
git grep -n "from '\\.\\./offers/page'" -- 'src/app/vault/' 2>&1
```

**Expected:** no matches across all three. `page.tsx` files are not
typically imported as modules in the App Router, but we verify.

### Query 6 — references to the retired legacy chrome/types the mock
used

```
git grep -n -E '\bVaultLeftRail\b' -- 'src/app/vault/offers/'
git grep -n "from '@/lib/mock-data'" -- 'src/'
```

**Expected:** no matches in the `vault/offers/` tree. `VaultLeftRail`
may be used elsewhere (it is a shared vault chrome component); only
flag if it appears inside `src/app/vault/offers/**`. `@/lib/mock-data`
should not resolve anywhere; if it does, surface and note.

---

## BASELINE CHECK (AC10, AC11, AC12)

Even though P6 is expected to change zero files, re-run the three
standard baselines and confirm they are flat against the post-P5
floor (`f91b4f6` HEAD at time of writing):

1. `npm run test` — **1276 passed / 10 skipped**, zero failures, zero
   new skips.
2. `npm run lint` — **≤ 68 errors / ≤ 346 warnings** (the current
   floor; R7 was docs-only and did not shift either number).
3. `npm run build` — clean. Route table must show both
   `/vault/offers` and `/vault/offers/[id]` as `ƒ` (dynamic). If
   either reverts to `○` (static), that is a regression — surface it.

Any delta on any baseline is a defect and blocks exit, because this
prompt authored zero code and therefore cannot have moved any number.

---

## WHAT TO DO IF AN ORPHAN SURFACES

Decision tree, in priority order:

1. **Legacy symbol (Queries 1-3) matches in a non-legacy file** →
   surface the path(s), paste ≤10 lines of context, **do not modify**,
   pause for founder review. Likely outcome: a targeted follow-up
   cleanup, not a P6 commit.
2. **`/api/special-offer/*` consumer (Query 4) found in non-route
   code** → same — surface, context, pause. Do **not** try to "fix"
   by deleting the consumer, and especially do **not** touch the
   route handlers.
3. **Import of the deleted `page.tsx` (Query 5)** → same. If it
   exists, the P5 overwrite broke a live reference; founder must
   triage whether to restore, re-point, or delete.
4. **Extra file in `src/app/vault/offers/` beyond the expected six**
   → surface path, open read-only, describe contents in one paragraph,
   propose `git rm` with justification, **pause**. Do not run `git
   rm` until founder approves in chat.

Under no circumstance does this prompt: add a new file; edit an
existing file; rename a file; modify a test; change a lint rule;
touch `/api/special-offer/*` route handlers; or update chrome/nav
labels elsewhere in the tree (§D9).

---

## OUT OF SCOPE FOR P6 (explicit)

These items are intentionally deferred:

- Full retirement of `/api/special-offer/*` route handlers — concern
  4A.2.C, per §D7.
- Nav/chrome labels anywhere in the app still saying "Special Offers"
  or linking to the legacy URL pattern — documentation/label cleanup,
  concern 4A.2.C or later, not P6.
- ESLint `no-restricted-syntax` mis-fire on test-file env stubs — ops-
  hygiene concern logged outside this directive.
- Retrofitting RTL or Playwright CT coverage on the new client
  components — "Client testing foundations" concern, outside this
  directive (see §R6 footnote).
- Lint-floor chasing — the current 68/346 floor is the agreed post-
  legacy-deletion number; do not try to improve it.

---

## REPORT FORMAT

Surface exactly these sections; no more, no less:

```
### Surviving files under src/app/vault/offers/
<paste full `find` output, one path per line>

### Expected vs. actual
- Expected: 6 files (see list in prompt)
- Actual: <N> files
- Verdict: <match | mismatch — list extras and missing>

### Grep evidence
- Query 1 (mockThreads / mockEvents): <no matches | listing>
- Query 2 (ThreadCard / NegotiationEvent / handleThreadUpdate /
  EVENT_LABELS): <no matches | listing>
- Query 3 (STATUS_STYLES with context guard): <listing; classify each
  match as permitted-DocumentsPanel-reuse or flagged-legacy-orphan>
- Query 4 (/api/special-offer consumers outside route handlers):
  <no matches | listing>
- Query 5 (imports of the deleted page.tsx): <no matches for all
  three variants | listing>
- Query 6 (VaultLeftRail in vault/offers, @/lib/mock-data anywhere):
  <no matches | listing>

### Baselines
- Tests: <actual>/<actual skipped> (floor 1276/10) — delta <+/-0/+/-0>
- Lint: <errors> errors / <warnings> warnings (floor 68/346) — delta
  <+/-0/+/-0>
- Build: <clean | errors reported below>
  /vault/offers: <ƒ | ○>
  /vault/offers/[id]: <ƒ | ○>

### Orphans surfaced
<list each orphan surfaced, classified per decision tree above; say
"none" if clean>

### Proposed actions (if any)
<say "none — no code changes required" in the clean case; otherwise
enumerate any `git rm` proposals with path + one-sentence
justification, and mark them as `PAUSED — awaiting founder approval`>

### Not committed — awaiting review
```

---

## COMMIT GUIDANCE (clean-case)

In the expected clean case (all grep queries empty, directory
matches expected, baselines flat, zero actions proposed), **do not
commit anything**. Surface the report, stop, and hand back to the
founder. The founder will close the prompt by updating the tracker
and moving to Prompt 7 (verification pass) — no P6 commit is
required because no artifact was produced.

If an orphan surfaces and the founder approves a `git rm`, the
resulting commit message should use the shape:

```
chore(p4-4a.2): P6 — remove orphaned <path> (post-legacy-mock retirement)

Surfaced during P6 legacy-orphan audit per §R5. <One-paragraph
justification: what the file was, why it's dead, why no consumers
remain.>

Refs: P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md §F5, §R5, AC7.
```

---

## WHY THIS PROMPT IS THIS SMALL

P5's overwrite did the heavy lifting: the 561-LoC mock is gone,
including all three `/api/special-offer/*` call-sites at its
L333/L385/L446. Per §R5 L110: *"§F5's 'Remove entirely' language now
reads as: the removal is effected at P5 by overwriting [the page] with
the new server-component wrapper. P6 verifies no collateral
(`mockThreads` consumers elsewhere, imports of the deleted page)
survives."*

In other words: P6 is the proof step, not the doing step. A clean
grep matrix is the entire deliverable.
