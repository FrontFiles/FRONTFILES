# SCAFFOLD Prompt 3 — `OffersListClient` + pure-helper smoke tests

**Concern:** P4/4A.2/SCAFFOLD
**Directive:** `docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md`
**Branch:** `feat/p4-scaffold-offers`
**Predecessor commit:** Prompt 2 = `f34df12`; R5 reorder = `abca34d`; R6 (to be committed just before this prompt runs)
**Revisions in force:** §R3, §R4, §R5, **§R6** (client-test infra gap closed — pure helper + `renderToString`, no RTL, no jsdom)

---

## Mandatory reading (before any code)

1. `docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md`. Pay special attention to:
   - **§R5** — why this is a leaf prompt (no server-component wrapper here).
   - **§R6** — why testing uses `react-dom/server.renderToString` + a pure render helper, not RTL. **Do not propose installing RTL or jsdom. That decision is closed.** If the architecture feels awkward, re-read AUTH §R3 for the in-family precedent.
   - **§F3** — behavior contract for the component.
   - **§F6** — brutalist styling constraints (non-negotiable per §D4).
   - **§D1, §D3, §D6, §D8, §D9** — governing constraints.
2. `src/hooks/useSession.ts` — the session API. Public surface:
   ```ts
   export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'
   export function useSession(): {
     session: Session | null
     accessToken: string | null
     status: SessionStatus
   }
   ```
   Note the L35-40 source comment explaining the repo's client-test gap. That's the same gap R6 closes with the pure-helper pattern.
3. `src/app/api/offers/route.ts` — the GET handler this component consumes. Response envelope on 200: `{ data: { offers: OfferRow[], truncated: boolean } }`. Error codes: `FEATURE_DISABLED` (404), `UNAUTHENTICATED` (401), `ACTOR_NOT_FOUND` (403), `INTERNAL` (500).
4. Look at how AUTH §R3 structured its pure-Node tests — mirror that style.
5. `node_modules/next/dist/docs/` — read the relevant guide for `use client` and `Link` before writing any component. **This is not the Next.js you know.**

---

## Scope — two files only

1. **Create:** `src/app/vault/offers/_components/OffersListClient.tsx` (new client component — owns hooks/fetch/state, renders via the pure helper below).
2. **Create:** `src/app/vault/offers/_components/__tests__/OffersListClient.test.tsx` (new tests — pure-helper assertions + one component-level loading-branch check using `renderToString`).

Per §D8, **no other file** may be touched. In particular:

- Do **not** overwrite `src/app/vault/offers/page.tsx`. That's Prompt 5.
- Do **not** create any `page.tsx` server component here. That's Prompt 5.
- Do **not** touch `src/app/api/offers/route.ts`. Shipped at `f34df12`.
- Do **not** touch `package.json`, `vitest.config.ts`, or any setup file. R6 explicitly forbids adding RTL / jsdom / happy-dom / test infra deps.

If you hit a real need to touch another file, stop and surface — do not touch it.

---

## Architecture — component + pure helper split (§R6)

The two-layer split is the whole point of R6. Read this carefully.

**Layer 1 — the component (`OffersListClient.tsx`):**

- `'use client'` at top.
- Owns the hook wiring: `useSession()`, `useEffect`, `useState`.
- Owns the fetch call and its state transitions.
- **Does not render JSX directly.** Instead, computes a view state (a plain data object) and delegates rendering to the pure helper.

**Layer 2 — the pure render helper (exported from the same file):**

- Named export `renderOffersListBody(view, selfUserId)` (or equivalent; keep the name stable).
- Pure function: given a view state and a self-user-id, returns `ReactElement`.
- No hooks. No network. No `useEffect`. No `useState`. No `window`, no `document`.
- All §F3 rendering behavior lives here: empty state, truncated banner, row grid, handle fallback, the `<Link>` hrefs, the styling per §F6.

**View state shape** — recommended (adjust if you find a cleaner shape, but document any deviation):

```ts
type OffersListView =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'error' }
  | { kind: 'loaded'; offers: OfferRow[]; truncated: boolean }
```

The component reduces `(status, fetchState)` → `OffersListView` and passes that to the helper.

Why this split: the helper is trivially unit-testable by feeding it hand-built view states and asserting `renderToString(helper(view, selfId))` contains what §F3 promises. The component's only testable job here is "during the loading branch, no fetch fires" — one small assertion via `renderToString(<OffersListClient />)` with mocked `useSession`.

---

## §F3 behavior contract (verbatim, but expressed against the new architecture)

**Component (Layer 1) behavior:**

1. Read `{ accessToken, status }` from `useSession()`.
2. Reduce to view state:
   - `status === 'loading'` → `{ kind: 'loading' }`
   - `status === 'unauthenticated'` → `{ kind: 'unauthenticated' }`
   - `status === 'authenticated'` + local fetch not resolved → `{ kind: 'loading' }`
   - `status === 'authenticated'` + fetch error (network or non-2xx) → `{ kind: 'error' }`
   - `status === 'authenticated'` + fetch success → `{ kind: 'loaded', offers, truncated }`
3. The fetch itself: `fetch('/api/offers', { headers: { Authorization: \`Bearer ${accessToken}\` } })` inside a `useEffect` keyed on `accessToken`. Guard against stale updates if the component unmounts or the token changes mid-flight (`isCancelled` flag inside the effect).
4. Return `renderOffersListBody(view, session?.user?.id ?? null)`.

**Pure helper (Layer 2) behavior — all branches return JSX matching §F6 styling:**

- `loading` → plain text `Loading offers…` (use the exact string; tests will assert it).
- `unauthenticated` → plain text `Sign in to view your offers.`
- `error` → plain text `Could not load offers.`
- `loaded` + `offers.length === 0` → plain text `No offers yet.`
- `loaded` + non-empty offers:
  - If `truncated === true`, render a single line of plain text above the list: `Showing first 100 offers.`
  - One row per offer. No `<table>` tag — CSS grid. Columns: counterparty handle, `target_type`, `gross_fee` + `currency`, `state`, `expires_at` formatted as `YYYY-MM-DD` (`new Date(expires_at).toISOString().slice(0, 10)`).
  - Each row is a `<Link href={\`/vault/offers/${offer.id}\`}>` (from `next/link`).
  - **Counterparty handle fallback** (§D5, scaffold-grade): given `selfUserId`, derive the counterparty as `offer.buyer_id === selfUserId ? offer.creator_id : offer.buyer_id`, then render `slice(0, 8)` as the handle. If `selfUserId` is `null` (shouldn't happen on a loaded view, but guard), render `—`. Comment the fallback in source as temporary, pointing at the "handle-resolution follow-up concern."

**Header comment block on `OffersListClient.tsx`** must document: contract summary (§F3), reference to §R5 and §R6, and the handle-fallback compromise (§D5).

**Imports allowed:**
- `'use client'` pragma
- `react` (hooks, `ReactElement`, `ReactNode`)
- `next/link`
- `@/hooks/useSession`
- Type imports from the offers domain (e.g., `OfferRow` — already re-exported from the API route file; if not, surface it as a gap rather than inventing a new type)

**Imports forbidden (§D1, §D3, §R6):**
- `@supabase/ssr`, `next/headers` — anywhere
- Any Supabase client — the component goes through the API route
- `@testing-library/react`, `@testing-library/dom`, `jsdom`, `happy-dom` — not installed, not to be installed

**LoC budget:** ~150 LoC total across the component + helper + header comment.

---

## §F6 styling constraints (non-negotiable per §D4)

- System sans only — `font-sans` utility. No font imports.
- Type scale: `text-sm` for body, `text-base` for row content. No `text-xs`, no `text-xl+`.
- Color: `text-black` on `bg-white`. `text-blue-600` only for links / the counterparty handle cell (inside a `<Link>`, so already blue). No greys for text — greys only as 1px borders.
- Borders: `border-b border-black` between rows. No rounded corners, no shadows.
- Spacing: `px-6 py-4` per row, `max-w-3xl mx-auto` for the page container.
- No icons, no images, no avatars, no animations, no transitions.
- Focus rings allowed for accessibility (`focus-visible:outline-black`). Comment as intentional.

---

## Tests (§F7 as respecified by §R6) — 3 cases

**File:** `src/app/vault/offers/_components/__tests__/OffersListClient.test.tsx`

Runs under Vitest Node environment (existing config). No RTL, no jsdom. Use `react-dom/server`'s `renderToString` for string assertions.

Boilerplate pattern (adjust to repo's actual Vitest conventions — look at existing Node-env tests for import order and describe/it style):

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { renderOffersListBody } from '../OffersListClient'
// For case 1 only:
import OffersListClient from '../OffersListClient'
```

| # | Case | How to test |
|---|---|---|
| 1 | `status === 'loading'` — no fetch fires during the loading branch | `vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: null, accessToken: null, status: 'loading' }) }))`. `const fetchSpy = vi.spyOn(globalThis, 'fetch')`. Call `renderToString(<OffersListClient />)`. Assert: output string contains `Loading offers…`; `fetchSpy` was not called. (`renderToString` does not run `useEffect`, which is exactly what makes this assertion clean.) |
| 2 | Pure helper, loaded with 2 rows, `truncated: false` | Build a fake `OffersListView` with `kind: 'loaded'`, `offers: [r1, r2]`, `truncated: false`. Call `renderToString(renderOffersListBody(view, 'self-uuid'))`. Assert: output contains the `href` for each row (`/vault/offers/${r1.id}` and `/vault/offers/${r2.id}`), the `target_type`, `gross_fee`, `currency`, `state`, and the `YYYY-MM-DD`-formatted `expires_at` of each row; the counterparty handle is the 8-char prefix of the *other* party's ID. Output must NOT contain `Showing first 100 offers.` |
| 3 | Pure helper, empty loaded state | `{ kind: 'loaded', offers: [], truncated: false }`. `renderToString(renderOffersListBody(view, 'self-uuid'))`. Assert: output contains `No offers yet.` |

Fake `OfferRow` shape for tests: inline-construct a minimal-but-realistic object matching the DB row type (buyer_id, creator_id, gross_fee, currency, state, target_type, expires_at, id). If you need more than a trivial stub, surface whether an existing test fixture is already available in `src/app/api/offers/__tests__/get.route.test.ts` (shipped at `f34df12`) rather than duplicating.

Do not test the helper under `truncated: true` as a fourth case — the banner logic is a single conditional, and the prompt caps at 3 cases. If the assertion feels thin, combine: in case 2 assert the absence of the banner; leave presence to be covered in Prompt 7's verification pass or a later hardening concern.

---

## §D directives that govern this prompt

- **§D1.** No `@supabase/ssr`. No `next/headers`. No Supabase client import.
- **§D3.** No new dependencies. Do not edit `package.json`.
- **§D4.** Brutalist baseline is non-negotiable. Reject any embellishment beyond §F6.
- **§D5.** Counterparty handle fallback to ID prefix is sanctioned. Comment as temporary.
- **§D6.** The fetch call consumes `{ data: { offers, truncated } }` exactly as shipped at `f34df12`. Any mismatch is a scaffold failure — surface before coding around it.
- **§D8.** Only the two files listed above are mutable. Surface anything else.
- **§D9.** No "while I'm here" cleanups. Do not touch the legacy `vault/offers/page.tsx`. Do not refactor neighbors. Do not lint-fix unrelated files.

---

## Baselines (from §AUDIT-2 + §R4)

- **Tests floor (AC10):** 1270 passing, 0 failing. Expected new total: **1270 + 3 = 1273**.
- **Lint floor (AC12):** 69 errors, 346 warnings. Expected new total: **≤ 69 errors / ≤ 346 warnings**. Any regression requires stop-and-surface before committing.

---

## Done criteria

Before reporting done, verify:

- [ ] `npm run test` is green, count is **1273** (floor + 3)
- [ ] `npm run lint` shows **≤ 69 / ≤ 346** — no regression beyond §R4 floor
- [ ] `npm run build` is clean — the new component compiles (no unused-import warnings, no TS errors)
- [ ] `git diff --stat HEAD` shows **exactly 2 new files**, both under `src/app/vault/offers/_components/`
- [ ] `git diff abca34d..HEAD | grep -E "supabase/ssr|next/headers|testing-library|jsdom|happy-dom"` — should be empty
- [ ] `git diff abca34d..HEAD -- package.json vitest.config.ts` — should be empty
- [ ] `OffersListClient.tsx` header comment documents: §F3 contract summary, §R5 + §R6 references, §D5 handle-fallback note
- [ ] The pure helper `renderOffersListBody` is a named export (tests need to import it)
- [ ] Component is orphaned (no importer yet — that's expected per §R5, wired at P5)

---

## Report shape

When done, return:

```
Files touched:
  - src/app/vault/offers/_components/OffersListClient.tsx                   (new, +X)
  - src/app/vault/offers/_components/__tests__/OffersListClient.test.tsx    (new, +Y)

Verification:
  - Tests: N tests (was 1270) — delta +3, all green
  - Lint:  K errors / J warnings (was 69 / 346) — delta 0 / ≤0
  - Build: clean
  - Orphan check: OffersListClient has no importer (expected per §R5; wired at P5)
  - package.json / vitest.config.ts: untouched
  - SSR/headers/RTL/jsdom grep: clean

Open items: [none | list]

Ready for Gate 1 verdict.
```

**Do not commit.** I'll review and stage the commit myself after verdict.
