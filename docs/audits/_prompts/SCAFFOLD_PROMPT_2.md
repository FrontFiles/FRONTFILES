# SCAFFOLD Prompt 2 — `GET /api/offers` + tests

**Concern:** P4/4A.2/SCAFFOLD
**Directive:** `docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md`
**Branch:** `feat/p4-scaffold-offers`
**Predecessor commit:** `97215e2` (directive APPROVED)

---

## Mandatory reading (before any code)

1. `docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md` — full directive. Pay special attention to:
   - §F1 (the contract for the new GET endpoint)
   - §F7 (test list)
   - §D1, §D6, §D8, §D9 (directives that constrain you)
   - §AUDIT-1 + §R3 (context: AUTH dependency closed, useSession is locked)
2. `src/app/api/offers/[id]/route.ts` — the GET-by-id handler. The new GET-list handler must mirror its auth + error shape **exactly** (per §D6 surface parity).
3. `src/app/api/offers/route.ts` — the existing file you are appending a GET export to. The existing POST stays untouched.
4. `src/lib/auth/require-actor.ts` — the auth helper.
5. `src/lib/db/client.ts` — `getSupabaseClientForUser(token)` is the user-JWT client you must use.
6. `node_modules/next/dist/docs/` — read the relevant routing guide before writing any handler. **This is not the Next.js you know.**

---

## Mandatory first action — re-baseline AC10 + AC12

Run these two commands **before writing any code**, capture the output, and report the exact numbers. These supersede the 1248 / 67 numbers locked at directive draft time.

```bash
npm run test 2>&1 | tail -30
npm run lint 2>&1 | tail -30
```

Expected report shape:

```
Test baseline (post-AUTH, pre-Prompt-2): N tests in M files (all pass | X failures)
Lint baseline (post-AUTH, pre-Prompt-2): K errors / J warnings
```

If the test baseline is not all-green, **stop and surface** before doing anything else. AC10 requires "baseline ≥ floor + new tests pass" — a non-green floor invalidates the gate.

After capture, append a §AUDIT-2 section to the directive with these numbers (this becomes the floor that Prompt 7's verification pass checks against).

---

## Scope of this prompt

Two files only:

1. **Modify:** `src/app/api/offers/route.ts` — append a `GET` export. The existing `POST` stays byte-identical.
2. **Create:** `src/app/api/offers/__tests__/get.route.test.ts` (note: per repo convention, tests live in `__tests__/` subdirectories — see `src/app/api/offers/[id]/__tests__/get.route.test.ts` for the canonical pattern; do **not** put tests in a `tests/` dir even if the directive's §F7 said so — repo convention wins).

Per §D8 (AC16 freeze), **no other file** may be touched in this prompt. If you discover a real need to touch one (e.g., a missing type export), stop and surface it as an R-revision request rather than touching the file.

---

## §F1 contract (verbatim from directive)

- **Auth:** same shape as `GET /api/offers/[id]` (see L60-88 of that file).
  - `requireActor()` → 404 / 401 / 403
  - Bearer token re-extracted for `getSupabaseClientForUser(accessToken)`
- **Query:** no params in v1. RLS filters under user-JWT — `offers_party_select` returns rows where `auth.uid() = buyer_id OR auth.uid() = creator_id`.
- **Order:** `ORDER BY created_at DESC`.
- **Limit:** hard cap at **100**. If 100 rows returned, set `truncated: true` in response.
- **Response shape (200):**
  ```ts
  {
    data: {
      offers: OfferRow[]
      truncated: boolean
    }
  }
  ```
- **Errors (must match `GET /api/offers/[id]` exactly):**
  - 404 `FEATURE_DISABLED` (flag off — `isEconomicV1UiEnabled() === false`)
  - 401 `UNAUTHENTICATED` (no/invalid Bearer)
  - 403 `ACTOR_NOT_FOUND` (valid JWT, no actor row)
  - 500 `INTERNAL` (Supabase error)

**Reasoning to follow** (from directive): "Belt-and-braces party guard from L114-123 of the by-id handler is **not** needed here because there's no specific offer to assert against — RLS filtering is sufficient and correct for a list query."

**LoC budget:** ~80 LoC handler + ~6 LoC header comment block.

---

## Tests required (§F7)

File: `src/app/api/offers/__tests__/get.route.test.ts`

Six cases minimum. Mirror the mock patterns used in `src/app/api/offers/[id]/__tests__/get.route.test.ts` — same Supabase mock shape, same `describe`/`it` style.

| # | Case | Expected |
|---|---|---|
| 1 | flag off (`isEconomicV1UiEnabled` returns false) | 404 with code `FEATURE_DISABLED` |
| 2 | no Bearer header | 401 with code `UNAUTHENTICATED` |
| 3 | invalid Bearer (Supabase rejects token) | 401 with code `UNAUTHENTICATED` |
| 4 | valid auth, no actor row in `actor_handles` | 403 with code `ACTOR_NOT_FOUND` |
| 5 | valid auth, party with rows | 200, `data.offers` is an array, `data.truncated === false` |
| 6 | valid auth, party with exactly 100 rows returned | 200, `data.truncated === true` |

If the existing test infrastructure makes case 6 awkward (e.g., the mock helpers don't support row-count assertions), surface it and propose the minimal fix rather than skipping.

---

## §D directives that govern this prompt

- **§D1.** No `@supabase/ssr`. No `next/headers`. Use Bearer token + `getSupabaseClientForUser(accessToken)`.
- **§D6.** Surface parity with `GET /api/offers/[id]` is non-negotiable. Same error envelope, same code strings, same response shape conventions.
- **§D8.** Only the two files listed above are mutable. Surface anything else.
- **§D9.** No "while I'm here" cleanups. Do not touch the existing POST. Do not refactor neighboring code. Do not lint-fix unrelated files.

---

## Done criteria

Before reporting done, verify:

- [ ] §AUDIT-2 baseline captured and appended to the directive
- [ ] `npm run test` is green, count is **floor + 6 (the new cases)** at minimum
- [ ] `npm run lint` count has not regressed
- [ ] `git diff src/app/api/offers/route.ts` shows GET addition only — POST byte-identical
- [ ] No new imports of `@supabase/ssr` or `next/headers` anywhere in the diff (run `git diff feat/p4-scaffold-offers..HEAD | grep -E "supabase/ssr|next/headers"` — should be empty)
- [ ] Header comment block on the new GET export documents: contract summary, link to §F1, error code list

## Report shape

When done, return:

```
Baseline (§AUDIT-2 captured):
  - Tests: N tests in M files, all green
  - Lint:  K errors / J warnings

Files touched:
  - src/app/api/offers/route.ts        (GET added, +X / -0)
  - src/app/api/offers/__tests__/get.route.test.ts  (new, +Y)
  - docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md  (§AUDIT-2 appended)

Verification:
  - Tests: N+6 tests, all green
  - Lint:  no regression
  - GET-by-id route diff: 0 lines
  - POST diff: 0 lines
  - SSR/headers grep: clean

Open items: [none | list]

Ready for Gate 1 verdict.
```

**Do not commit.** I'll review and stage the commit myself after verdict.
