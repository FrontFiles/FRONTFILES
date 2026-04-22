# P4 Concern 4A.2.SCAFFOLD — Exit Report

## Verdict

Concern closed. AC1-AC15 all PASS; manual smokes M1 + M2 PASSED by founder 2026-04-22; baselines flat at tests 1276 / 10 / 0, lint 68 / 346, build clean with both offer routes `ƒ`-dynamic. Carry-overs logged below.

## Scope recap

Retired the 561-LoC legacy Special Offers mock at `src/app/vault/offers/page.tsx` and shipped its replacement: a server-component flag gate plus two brutalist-styled client components (`OffersListClient`, `OfferDetailClient`) for `/vault/offers` and `/vault/offers/[id]`, backed by a new `GET /api/offers` route with party-only RLS filtering. Both routes gate on `FFF_ECONOMIC_V1_UI` and dual-flag with `FFF_AUTH_WIRED` for Deploy-2 env-flip semantics. The `/api/special-offer/*` route handlers are explicitly untouched per §D7 — full retirement is concern 4A.2.C. P1 (pre-flight audit) and directive authoring landed before `feat/p4-scaffold-offers` diverged from `main`; neither appears in this concern's commit trail, and the earliest concern commit on this branch is `97215e2` (R3 closure).

## Acceptance criteria matrix (AC1–AC15)

| AC | Requirement (one-line) | Result | Evidence |
|---|---|---|---|
| AC1 | `GET /api/offers` matches §F1 contract | PASS | 6 Vitest cases in `src/app/api/offers/__tests__/get.route.test.ts` (commit `f34df12`); curl-level verification folded into M1/M2 smoke context |
| AC2 | `GET /api/offers` returns 404 when `ECONOMIC_V1_UI=false` | PASS | AC1 case 1 (`flag off → 404 FEATURE_DISABLED`) |
| AC3 | `GET /api/offers` returns only caller's offers (party-only RLS) | PASS | AC1 case 5 (`valid auth, party → 200`) |
| AC4 | Both `page.tsx` wrappers call `notFound()` when flag off | PASS | M1 smoke 2026-04-22 (both routes → 404); grep confirmed `notFound()` + `isEconomicV1UiEnabled()` pair in each wrapper (commit `2b109e0`) |
| AC5 | Both wrappers are server components (no `'use client'`) | PASS | `git grep -n "^'use client'"` on both wrapper files — zero matches |
| AC6 | Inner client components contain no Supabase imports | PASS | `git grep -nE "from '(@supabase/\|@/lib/supabase/)"` on both client leaves — zero matches |
| AC7 | Legacy page deleted, no `mockThreads` survives | PASS | `git grep -n -E '\bmockThreads\b\|\bmockEvents\b' -- src/` — zero matches after P5 overwrite + P6 audit |
| AC8 | No new imports of `/api/special-offer/*` introduced | PASS | `git grep -n 'api/special-offer' -- src/ ':!src/app/api/special-offer/**'` — zero matches |
| AC9 | No new `@supabase/ssr` or `next/headers` imports | PASS | `git grep -n -E "from '@supabase/ssr'\|from 'next/headers'" -- src/` — zero matches; §D1 preserved |
| AC10 | Vitest baseline ≥ floor | PASS | 1276 passed / 10 skipped / 0 failed (P7 verification, re-confirmed at P8 §4); floor 1270 per §R4 + §AUDIT-2 |
| AC11 | `npm run build` clean | PASS | Build exit 0; route manifest reports `/vault/offers` `ƒ` and `/vault/offers/[id]` `ƒ` (P7 + re-confirmed at P8 §4); §R7 force-dynamic lock verified |
| AC12 | No lint regression beyond ceiling | PASS | 68 errors / 346 warnings — at post-P5 floor, under §R4-raised ceiling of 69 |
| AC13 | Brutalist styling (§F6) honored | PASS | M2 smoke 2026-04-22 — system sans, black-on-white, no shadows/rounded/icons, signed-out branch visible per R6-pure architecture |
| AC14 | Existing `POST /api/offers` route unchanged | PASS | `git diff main...HEAD -- src/app/api/offers/route.ts` shows `GET` export addition only; `POST` handler block textually identical to merge base |
| AC15 | Existing `GET /api/offers/[id]` route unchanged | PASS | `git diff main...HEAD -- src/app/api/offers/[id]/route.ts` — zero diff |

## File inventory (§D8)

Concern authored or modified exactly 15 paths. Verified against `git diff --name-only main...HEAD` + the P8 commit (which adds 2 meta-bookkeeping files — SCAFFOLD_PROMPT_8.md and this exit report — outside this 15-path inventory).

### `docs/audits/` (1 path)

| Path | Status |
|---|---|
| `P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md` | NEW |

### `docs/audits/_prompts/` (6 paths)

| Path | Status |
|---|---|
| `SCAFFOLD_PROMPT_2.md` | NEW |
| `SCAFFOLD_PROMPT_3.md` | NEW |
| `SCAFFOLD_PROMPT_4.md` | NEW |
| `SCAFFOLD_PROMPT_5.md` | NEW |
| `SCAFFOLD_PROMPT_6.md` | NEW (committed in P8) |
| `SCAFFOLD_PROMPT_7.md` | NEW (committed in P8; P8 §2 applied 14→15 typo fix pre-commit) |

### `src/app/api/offers/` (2 paths)

| Path | Status |
|---|---|
| `route.ts` | MODIFIED — `GET` export appended; `POST` untouched (AC14) |
| `__tests__/get.route.test.ts` | NEW |

### `src/app/vault/offers/` (6 paths)

| Path | Status |
|---|---|
| `page.tsx` | MODIFIED — full rewrite, overwrote 561-LoC legacy mock at P5 (commit `2b109e0`) |
| `_components/OffersListClient.tsx` | NEW |
| `_components/__tests__/OffersListClient.test.tsx` | NEW |
| `[id]/page.tsx` | NEW |
| `[id]/_components/OfferDetailClient.tsx` | NEW |
| `[id]/_components/__tests__/OfferDetailClient.test.tsx` | NEW |

Totals: **13 NEW + 2 MODIFIED = 15 paths**. Matches P7's corrected file-inventory count (14→15 typo fix applied in P8 §2).

## Commit trail

Chronological (oldest → newest). Each SHA verified via `git show --format=%s --no-patch` before inclusion.

| # | SHA | Prompt / Revision | What shipped |
|---|---|---|---|
| 1 | `97215e2` | Directive R3 closure | directive APPROVED — R3 closes AUTH dependency |
| 2 | `f34df12` | P2 | Prompt 2 — GET /api/offers + tests (§AUDIT-2, R4) |
| 3 | `abca34d` | Directive R5 | reorder prompts, leaves before wrappers |
| 4 | `41fde76` | Directive R6 | close client-test infra gap via pure-helper pattern |
| 5 | `7ee350c` | P3 | OffersListClient + pure-helper tests (§R6) |
| 6 | `b665a2d` | P4 | OfferDetailClient + pure-helper smoke tests (§F4) |
| 7 | `2b109e0` | P5 | server-wrapper flag gates at /vault/offers and /vault/offers/[id] |
| 8 | `f91b4f6` | Directive R7 | lock force-dynamic into §F2 canonical pattern |

Eight commits total: **4 prompt commits** (P2 / P3 / P4 / P5) + **4 directive-revision commits** (R3 closure / R5 / R6 / R7). No standalone "P1 pre-flight audit" or "directive authored" commit lives on this branch — both predate the branch's divergence from `main`.

## Baseline floors (AC10/AC11/AC12)

- **Tests**: 1276 passed / 10 skipped / 0 failed (P7 verification pass, re-confirmed at P8 §4).
- **Lint**: 68 errors / 346 warnings (floor held; §R4-raised ceiling 69 → post-P5 legacy deletion dropped to 68).
- **Build**: clean; `/vault/offers` reports `ƒ` (dynamic), `/vault/offers/[id]` reports `ƒ` (dynamic). §R7 force-dynamic lock verified in the route manifest.

## Manual smokes (AC4, AC13)

- **M1 — AC4 flag-off 404 smoke** (executed 2026-04-22): with `FFF_ECONOMIC_V1_UI=false`, both `/vault/offers` and `/vault/offers/[id]/<uuid>` returned Next's default 404 page. Chrome rendered correctly around the 404 body. Flag gate confirmed functional.
- **M2 — AC13 flag-on brutalist render smoke** (executed 2026-04-22): with `FFF_ECONOMIC_V1_UI=true`, both routes returned 200 with brutalist client-component output — system sans, black-on-white, centered container, no shadows / no rounded corners / no icons / no color drift beyond the sanctioned `text-blue-600` on links. Signed-out branch visible ("Sign in to view your offers." and "Sign in to view this offer.") — correct per R6-pure architecture, where the signed-in render path is covered by the pure-helper tests inside the 1276-test suite rather than exercised end-to-end in the browser.

Tree returned to Deploy-1 floor (`FFF_ECONOMIC_V1_UI=false`) after the smoke.

## Carry-overs (out of this concern)

- `/api/special-offer/*` route-handler retirement → concern **4A.2.C** (preserved here per §D7).
- Nav / chrome labels still saying "Special Offers" → concern **4A.2.C** or a later documentation cleanup concern.
- ESLint `no-restricted-syntax` mis-fire on test-file env stubs (`SUPABASE_SERVICE_ROLE_KEY` inside `scopeEnvVars([…])` / `vi.stubEnv(…)`) → ops-hygiene concern logged outside this directive; reference count ≥4 (2 from Prompt 2's new test file, ≥2 pre-existing in the by-id test neighbor).
- RTL / Playwright CT coverage on new client components → **"Client testing foundations"** concern, outside this directive (§R6 footnote). Scaffold ships with R6-pure architecture: pure render helpers + `renderToString`, honoring §D3 without a new dependency. Deeper state-transition coverage is the follow-up trigger.
- Lint-floor improvement (below 68 / 346) → not in scope; the current floor is the post-legacy-deletion agreed number.

## Closed

2026-04-22 — concern 4A.2.SCAFFOLD closed against final commit `<P8-COMMIT-SHA>`.
