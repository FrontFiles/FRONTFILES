# P4 Concern 4A.2 — SCAFFOLD (`/vault/offers` minimum-viable UI)

**Status:** APPROVED 2026-04-22 — execution starts at Prompt 2 (Prompt 1 complete; AUTH dependency closed; see §R3)
**Branch:** `feat/p4-scaffold-offers` (created from `main` at merge SHA `a9ad787`)
**Predecessor:** P4 Concern 4A.2.AUTH (browser auth substrate) — closed, see `P4_CONCERN_4A_2_AUTH_EXIT_REPORT.md` (merged at `a9ad787`)
**Successor:** P4 Concern 4A.2.C (special-offer surface retirement, deferred from B2 per directive §F11-DEFER-RATIONALE)

---

## §CONTEXT

P4 Part B2 shipped the spec-canonical offer + accept server contract behind two flags (`FFF_AUTH_WIRED`, `ECONOMIC_V1_UI`), both off in production. There are presently **zero** UI callers of the new server surface. The legacy mock at `/vault/offers/page.tsx` (561 LoC, hardcoded `mockThreads`, calls `/api/special-offer/*` at L333/L385/L446) is unrelated to the new contract and unaware of either flag.

This concern is **not** the v1 product UI. It is a deliberately minimal scaffold whose only jobs are:

1. Replace the mock at `/vault/offers/*` with a real, flag-gated, brutalist-leaning surface that reads from the spec-canonical server contract.
2. Add the one missing read endpoint (`GET /api/offers`) the new surface needs.
3. Unblock founder-led UI/feature iteration on a stable base.

Anything beyond that — compose flow, accept flow, state-transition UI, counterparty profiles, design polish, error/empty refinement — is **out of scope** and belongs to subsequent product-UI concerns.

---

## §SCOPE

In scope:

1. New server route `GET /api/offers` returning the caller's offers (party-only, RLS-enforced).
2. Server-component flag-gate wrappers at `/vault/offers/page.tsx` and `/vault/offers/[id]/page.tsx` per the canonical pattern in `flags.ts` L86-117.
3. Client-component children that fetch from the API and render minimal list + detail views.
4. Removal of the legacy mock + the three `/api/special-offer/*` POST sites in the existing page.
5. Minimal brutalist styling (typography + spacing + 1px borders; no card chrome, no colors beyond black/blue/white).
6. A small set of Vitest unit tests covering the new route handler's auth + RLS surface parity, and a smoke render test for each new client component.

Out of scope (each is its own follow-up concern):

- `/vault/assignments/*` and `/vault/disputes/*` scaffolds (mentioned in `flags.ts` L91-93 as future-flagged, but explicitly **not** this concern).
- Compose / create-offer UI.
- Accept-offer UI (the F4 server contract from B2 has no UI caller and stays that way until a dedicated UX pass).
- State-transition affordances (cancel, expire, reject).
- Brief-pack vs asset-pack composer UI.
- Loading skeletons, optimistic updates, prefetching, suspense boundaries.
- Empty-state illustration, copy polish, error-state taxonomy.
- Internationalization, accessibility audit (deferred to a dedicated WCAG concern), keyboard navigation polish.
- Removal of the special-offer surface itself — deferred to concern 4A.2.C.

---

## §NON-SCOPE — explicit denials

The following will be requested during execution and must be refused without re-opening the directive:

| Request | Refusal reason |
|---|---|
| "Add a 'New offer' button" | Compose flow is a separate concern. |
| "Add accept/reject buttons on the detail page" | Accept UI is a separate concern; F4 has no UI caller by design. |
| "Add filters / sort / search" | Out of scope for a scaffold. |
| "Add a counterparty avatar / profile link" | Profile surface is a separate concern. |
| "Use a card component / shadcn / a UI library" | Brutalist baseline is intentional; no component-library churn in a scaffold. |
| "Add toast notifications" | No mutating actions in this concern; nothing to toast. |
| "Add SSR data fetching with `@supabase/ssr`" | Architectural decision (see §D2): client-fetch via Bearer token only. |
| "Pre-render the list with `generateStaticParams`" | Auth-gated; static generation is wrong. |

---

## §REVISIONS

R1 (initial draft, 2026-04-21) — Path α (client-fetch + new GET list endpoint) selected over Path β (SSR auth infrastructure) per audit finding: repo has zero `@supabase/ssr` imports, zero `next/headers` consumers, single-pattern API-route + Bearer auth model. SSR is a platform decision that should not be made under scaffold time pressure.

R2 (2026-04-21, post Prompt 1) — **This directive is PAUSED pending completion of concern 4A.2.AUTH.** §AUDIT-1 below uncovered that the repo has no client-side authentication substrate at all: zero client pages `fetch(`, zero hold a Supabase session, `/signin` is a declared visual mockup. Path α cannot ship without a real Bearer-token-producing session in the browser. Founder selected **α-prereq**: draft and execute `P4_CONCERN_4A_2_AUTH_DIRECTIVE.md` first, then resume this directive at Prompt 2. The scaffold's §F3/§F4 will consume whatever session-read API the AUTH concern establishes (to be referenced explicitly in an R3 revision before resumption).

R3 (2026-04-22, AUTH closure + Gate 0 approval) — **R2 closed; directive resumes.** Concern 4A.2.AUTH shipped and merged at `a9ad787` (PR #5). The session-read API §F3/§F4 must consume is now locked: **`useSession()` from `src/hooks/useSession.ts`**, returning `{ session, accessToken, status }` where `status ∈ 'loading' | 'authenticated' | 'unauthenticated'`. Client components in this concern read `accessToken` for the `Authorization: Bearer …` header and gate fetch on `status === 'authenticated'`. The §F3 fallback path ("if no such pattern exists, surface the gap and pause") is now obsolete and removed.

Gate 0 founder decisions (2026-04-22):

1. **Counterparty handle resolution** — accept ID-prefix fallback (`actor_id.slice(0, 8)`); proper handle-resolution deferred to a follow-up concern.
2. **Pagination** — skip; v1 hard-cap at 100 with `truncated` flag stays as drafted.
3. **Branch name** — `feat/p4-scaffold-offers` confirmed.
4. **Sequencing with 4A.2.C** — strictly sequential; this concern ships before special-offer retirement.

Execution sequence: Prompt 1 already complete (see §AUDIT-1, 2026-04-21). Execution starts at **Prompt 2**. Test/lint baselines (AC10, AC12) re-captured at start of Prompt 2 since AUTH added new tests; the new floor replaces the 1248 / 67 numbers locked at draft time.

R4 (2026-04-22, post Prompt 2 — Gate 1 verdict: APPROVE WITH CORRECTION) — Prompt 2 shipped: `GET /api/offers` added (+84 LoC), paired test file created at `src/app/api/offers/__tests__/get.route.test.ts` (+236 LoC). POST byte-identical; GET-by-id route untouched; no `@supabase/ssr` or `next/headers` imports introduced. Baseline (§AUDIT-2): 1264 tests / 67 lint errors. Post-Prompt-2: **1270 tests green (+6 per §F7), 69 lint errors / 346 warnings (+2 / +2)**.

The +2 lint regression is structurally inherited from §F7's mirror mandate and §D6's surface-parity directive: both errors are `no-restricted-syntax` firing on the literal `'SUPABASE_SERVICE_ROLE_KEY'` inside `scopeEnvVars([...])` and `vi.stubEnv(…)` — the exact same 2-error profile the reference test `src/app/api/offers/[id]/__tests__/get.route.test.ts` produces. This is pattern symmetry, not new smell. Accepted as symmetric cost.

Corrections locked by this revision:

1. **AC12 floor raised 67 → 69** for the remainder of this concern. The "pre-existing 67" phrasing in AC12 is superseded; the Prompt 7 verification pass compares against **69 errors / 346 warnings**, not 67 / 344. No further lint regression beyond 69 is acceptable.
2. **§F7 test path corrected** — the drafted path `src/app/api/offers/tests/get.test.ts` conflicts with repo convention (`__tests__/` subdirectories; see `src/app/api/offers/[id]/__tests__/get.route.test.ts` and every other in-repo test neighbor). Actual path shipped: `src/app/api/offers/__tests__/get.route.test.ts`. §D8's file-mutability list is amended to match.
3. **Next-cycle hygiene item logged** — the ESLint `no-restricted-syntax` rule that forbids the literal `'SUPABASE_SERVICE_ROLE_KEY'` in `src/app/**` mis-fires on test files that legitimately stub env vars via `vi.stubEnv`. Exempting `**/__tests__/**` (or scoping the rule to non-test files) is a one-line config change owed to a separate ops-hygiene concern. Not in scope here per §D9. Reference count: 2 mis-fires introduced by Prompt 2, plus ≥2 pre-existing mis-fires in the by-id test — ≥4 total to retire.

Prompt 2 committed as a single commit on `feat/p4-scaffold-offers`. Execution continues at Prompt 3.

R5 (2026-04-22, pre Prompt 3 — execution-order correction) — **The §PROMPTS table's original 3→4→5→6 ordering is replaced.** Reason: original Prompt 3 (server-component wrappers) `import`s `<OffersListClient />` and `<OfferDetailClient />`, which are not introduced until Prompts 4 and 5 respectively. Firing the original Prompt 3 as-drafted would produce unresolved-module errors, breaking AC11 (`npm run build`) and trapping the concern in a revise-before-merge loop at Gate 1. Leaves must land before wrappers.

Corrected sequence (scope and LoC budget unchanged; only order shifts):

| # | Title | Why this position |
|---|---|---|
| P3 | **`OffersListClient` + smoke tests** (§F3, §F7) | Leaf. No dependency on future prompts. |
| P4 | **`OfferDetailClient` + smoke tests** (§F4, §F7) | Leaf. No dependency on future prompts. |
| P5 | **Server-component wrappers** (§F2) — overwrites legacy `src/app/vault/offers/page.tsx` in place; creates new `src/app/vault/offers/[id]/page.tsx` | Now both imports resolve. The overwrite at `vault/offers/page.tsx` naturally retires the legacy 561-LoC mock. |
| P6 | **Legacy-orphan audit** — grep evidence that `mockThreads` has zero remaining consumers and no other file imported the deleted legacy page. `git rm` only if any orphan file (e.g., a sibling helper) survives. | P5's overwrite is the actual deletion; P6 is evidence-only per §F5's intent. |
| P7 | Verification pass | Unchanged. |
| P8 | Exit report | Unchanged. |

Between P3 and P5, the two new client component files (`OffersListClient.tsx`, `OfferDetailClient.tsx`) live as orphans (no server importer yet). TypeScript and ESLint tolerate unreferenced exports; tests cover them; no regression. They are wired up at P5.

§F5's "Remove entirely" language now reads as: the removal is effected at P5 by overwriting `src/app/vault/offers/page.tsx` with the new server-component wrapper. P6 verifies no collateral (`mockThreads` consumers elsewhere, imports of the deleted page) survives.

§D8's file-mutability list remains authoritative per-prompt; no file newly added by this reordering.

R6 (2026-04-22, pre Prompt 3 — client-test infra gap closed) — Claude Code stopped at Prompt 3 with a structural blocker: the repo has zero `@testing-library/react`, zero `jsdom` / `happy-dom`, zero `.test.tsx` files, and `vitest.config.ts` runs under the Node environment. `useSession.ts` source comment at L35-40 explicitly documents this gap. §F7 as drafted assumed Vitest + RTL; that assumption was wrong.

Claude Code proposed three forks: **R6-install** (add RTL + jsdom + setup), **R6-pure** (extract pure render helper, test via `react-dom/server.renderToString` — same pattern AUTH §R3 used), **R6-defer** (ship untested, punt to follow-up).

Founder decision: **R6-pure.** Rationale:

1. **Platform decisions don't belong in scaffolds.** Choosing a client-test stack (RTL vs Playwright CT vs Storybook-first visual) is an architectural commitment for the whole repo — not a footnote inside a scaffold concern. Same principle §R1 invoked when it rejected Path β (SSR auth) for the same reason.
2. **§D3 is founder-locked, not a Claude-Code interpretation surface.** "No new dependencies. Use what's already in `package.json`" is explicit. Reinterpreting it inline because a later prompt hits friction is the policy drift §D9 was written to prevent.
3. **AUTH §R3 is the in-family precedent.** Thirty-six hours ago, the same gap surfaced and the founder chose pure-Node state-machine extraction over installing RTL. Flipping that decision now, inside a different scaffold concern, is inconsistent.

R6-pure architecture for §F3 / §F4 client components:

- The React component (`OffersListClient`, `OfferDetailClient`) owns hook wiring and state: `useSession()`, `useEffect` to fetch, and a local state machine that resolves into a **view state** — a plain data shape describing what should render.
- A **pure render helper** (e.g., `renderOffersListBody(view: OffersListView, selfUserId: string | null): ReactElement`) consumes the view state and emits the JSX tree. No hooks inside the helper. No network.
- Tests import the helper directly, call it with hand-built view states, and use `react-dom/server.renderToString` (from the already-present `react-dom` dep) to produce a string to assert against. One additional case uses `renderToString` on the component itself with a mocked `useSession` return + `vi.spyOn(globalThis, 'fetch')` to prove no fetch fires during the loading branch.

This mirrors AUTH §R3's precedent and honors §D3 without a new dependency.

Coverage trade accepted: `renderToString` does not execute `useEffect`, so effect-driven state transitions can only be covered by feeding their *resolved* view states through the pure helper. The component's state-reduction logic itself is exercised only at the loading-branch boundary in this concern. Deeper state-transition coverage is a follow-up concern (see below).

New follow-up concern logged (outside this directive, to be opened after the scaffold lands): **"Client testing foundations."** Charter: evaluate RTL vs Playwright Component Testing vs Storybook-first visual regression; decide the standard for Frontfiles client UI; retrofit the scaffold's client components with full state-transition coverage. Owner: founder. Trigger: scaffold concern exits.

§F7's Prompt 3 + Prompt 4 test sections are re-specified by the updated `SCAFFOLD_PROMPT_3.md` / `SCAFFOLD_PROMPT_4.md` working aids — `tests/` / `__tests__/` path stays (repo convention per §R4), case count stays at 3 per component, but each case is now a pure-helper + `renderToString` assertion rather than an RTL render.

---

## §F — Functional requirements

### §F1 — `GET /api/offers` (NEW)

**File:** `src/app/api/offers/route.ts` — append a `GET` export alongside the existing `POST`.

**Contract:**

- Auth: same shape as `GET /api/offers/[id]` (see L60-88 of that file). `requireActor()` → 404 / 401 / 403; Bearer token re-extracted for `getSupabaseClientForUser(accessToken)`.
- Query: no params in v1. RLS does the filtering — under user-JWT, `offers_party_select` returns rows where `auth.uid() = buyer_id OR auth.uid() = creator_id`.
- Order: `ORDER BY created_at DESC`.
- Limit: hard cap at **100** rows in v1 (no pagination yet — surface a `truncated: true` flag if the cap is hit so the UI can show a banner; pagination is a follow-up).
- Response shape on 200:
  ```ts
  {
    data: {
      offers: OfferRow[]
      truncated: boolean
    }
  }
  ```
- Error surface — must match `GET /api/offers/[id]` exactly:
  - 404 `FEATURE_DISABLED` (flag off)
  - 401 `UNAUTHENTICATED` (no/invalid Bearer)
  - 403 `ACTOR_NOT_FOUND` (valid JWT, no actor row)
  - 500 `INTERNAL` (Supabase error)

**Reasoning:** Mirrors the GET-by-id handler near-line-for-line. Belt-and-braces party guard from L114-123 of the by-id handler is **not** needed here because there's no specific offer to assert against — RLS filtering is sufficient and correct for a list query.

**LoC budget:** ~80 LoC of handler + ~6 LoC of header comment block.

### §F2 — Server-component flag gate (canonical pattern)

**Files:** new outer `page.tsx` at `/vault/offers` and `/vault/offers/[id]`.

Each must follow the exact pattern documented at `flags.ts` L100-105:

```ts
import { isEconomicV1UiEnabled } from '@/lib/flags'
import { notFound } from 'next/navigation'

export default function Page() {
  if (!isEconomicV1UiEnabled()) notFound()
  return <OffersListClient />   // or <OfferDetailClient id={…} />
}
```

The server component does **zero** data work — only flag check + child render. This is the only sanctioned bridge between server (flag) and client (data) in this concern.

**LoC budget:** ~15 LoC per page wrapper × 2 = ~30 LoC.

### §F3 — `OffersListClient` (NEW client component)

**File:** `src/app/vault/offers/_components/OffersListClient.tsx`

Behavior:

1. Read `{ accessToken, status }` from `useSession()` (see `src/hooks/useSession.ts`, established by concern 4A.2.AUTH at merge SHA `a9ad787`). Gate fetch on `status === 'authenticated'`. While `status === 'loading'`, render the loading state (per item 3 below). On `'unauthenticated'`, render an error line `Sign in to view your offers.` (no redirect from a client component).
2. `fetch('/api/offers', { headers: { Authorization: \`Bearer ${accessToken}\` } })`.
3. Three states: `loading` → `error` → `loaded`.
4. `loaded` renders:
   - One row per offer.
   - Per-row columns (no table tag; CSS grid): counterparty handle, target_type, gross_fee + currency, state, expires_at (formatted as `YYYY-MM-DD`).
   - Each row is a `<Link href={\`/vault/offers/${offer.id}\`}>`.
   - If `truncated`, render a single line of plain text above the list: `Showing first 100 offers.`
5. Empty state: single line of plain text — `No offers yet.`
6. Error state: single line of plain text — `Could not load offers.` (no retry button in v1; reload-the-page is acceptable for a scaffold).
7. The component derives the counterparty handle from `buyer_id` vs `creator_id` against the current actor's `authUserId`. If the handle for that ID is not available client-side (likely, given the actor lookup is server-side today), fall back to rendering a short ID prefix (`buyer_id.slice(0, 8)`). This is a known scaffold-grade compromise; full counterparty resolution is a follow-up concern. Comment must say so.

**LoC budget:** ~150 LoC.

### §F4 — `OfferDetailClient` (NEW client component)

**File:** `src/app/vault/offers/[id]/_components/OfferDetailClient.tsx`

Behavior:

1. Same auth pattern as F3 — `useSession()` → `{ accessToken, status }`; gate fetch on `status === 'authenticated'`; surface `Sign in to view this offer.` on `'unauthenticated'`.
2. `fetch(\`/api/offers/${id}\`, { headers: { Authorization: \`Bearer ${accessToken}\` } })`.
3. States: loading / error / 404 / loaded.
4. `loaded` renders, in order, each as a plain text block (no cards):
   - Header: `Offer ${id.slice(0, 8)}`.
   - Counterparty + role line: `You are the buyer.` or `You are the creator.` (derived as in F3).
   - State line: `State: ${state}`.
   - Money line: `${gross_fee} ${currency} · platform fee ${platform_fee_bps / 100}%`.
   - Expires line: `Expires: ${expires_at}`.
   - Note: `Note:\n${current_note ?? '—'}`.
   - Items section, branched on `target_type`:
     - `single_asset` / `asset_pack`: `Assets:` heading + ordered list of `${position}. ${asset_id.slice(0, 8)}`.
     - `single_brief` / `brief_pack`: `Briefs:` heading + ordered list of `${position}. ${spec.title} — ${spec.deliverable_format}, ${spec.deadline_offset_days}d`.
   - Rights section: `Rights:` heading + JSON.stringify of the `rights` field, pretty-printed (scaffold-grade — proper rights renderer is a follow-up).
5. 404 from API → render `Offer not found.` plain text. Do not call `notFound()` from a client component.

**LoC budget:** ~180 LoC.

### §F5 — Removal of the legacy page

**File:** `src/app/vault/offers/page.tsx` (existing, 561 LoC).

Remove entirely. Replaced by the F2 server-component wrapper.

The three `/api/special-offer/*` POST call-sites at L333/L385/L446 die with the file. Do **not** open the special-offer route handlers in this concern — full retirement of `/api/special-offer/*` is concern 4A.2.C.

If grep after deletion finds any other consumer of `mockThreads` or the legacy types from this file, surface it and pause — there should be none, but verify.

### §F6 — Styling baseline

Constraints:

- System sans only (`font-sans` Tailwind utility, no font import).
- Type scale: `text-sm` for body, `text-base` for row content, `text-lg` for the detail-page header. No `text-xs`, no `text-xl+`.
- Color: `text-black` on `bg-white` only. `text-blue-600` only on links and on the row's counterparty handle. No greys for text content (use them only for 1px borders).
- Borders: `border-b border-black` between list rows. No rounded corners. No shadows.
- Spacing: `px-6 py-4` per row, `max-w-3xl mx-auto` for the page container.
- No icons. No images. No avatars.
- No animations, no transitions.

If a deviation is necessary for accessibility (e.g., focus ring), allow it — but call it out in the prompt.

### §F7 — Tests

**Files:**
- `src/app/api/offers/tests/get.test.ts` (NEW) — Vitest, ~6 cases:
  1. flag off → 404 `FEATURE_DISABLED`
  2. no Bearer → 401
  3. invalid Bearer → 401
  4. valid auth, no actor → 403
  5. valid auth, party → 200, returns array (uses Supabase mock matching the existing test patterns)
  6. truncation flag set when 100+ rows
- `src/app/vault/offers/_components/tests/OffersListClient.test.tsx` (NEW) — Vitest + RTL, ~3 cases: loading → loaded → empty.
- `src/app/vault/offers/[id]/_components/tests/OfferDetailClient.test.tsx` (NEW) — Vitest + RTL, ~3 cases: loaded asset-pack, loaded brief-pack, 404.

Existing 1248-test baseline must remain green; new count is the floor for the next concern.

---

## §AC — Acceptance criteria (for exit report)

| # | Criterion | Verification |
|---|---|---|
| AC1 | `GET /api/offers` exists and matches §F1 contract | `curl` with valid Bearer returns `{data:{offers,truncated}}` |
| AC2 | `GET /api/offers` returns 404 when `ECONOMIC_V1_UI=false` | env flip + curl |
| AC3 | `GET /api/offers` returns only the caller's offers (party-only) | RLS test in §F7 |
| AC4 | Both new page.tsx wrappers call `notFound()` when flag off | Manual: visit URL with flag off → 404 |
| AC5 | Both wrappers are server components (no `'use client'`) | grep |
| AC6 | Inner components are client components and contain no Supabase imports | grep |
| AC7 | Old `/vault/offers/page.tsx` deleted, no `mockThreads` references survive | grep |
| AC8 | No new imports of `/api/special-offer/*` introduced | grep |
| AC9 | No new imports of `@supabase/ssr` or `next/headers` introduced | grep |
| AC10 | Vitest baseline ≥ 1248 + new tests pass | `npm run test` |
| AC11 | `npm run build` clean | CI / local |
| AC12 | No new lint errors beyond the pre-existing 67 | `npm run lint` |
| AC13 | Brutalist styling constraints from §F6 honored | manual visual check |
| AC14 | Existing `POST /api/offers` route unchanged | git diff on that file shows GET addition only |
| AC15 | Existing `GET /api/offers/[id]` route unchanged | git diff = 0 |

---

## §D — Directives

- **§D1.** **No SSR auth infrastructure.** Do not import `@supabase/ssr`. Do not import from `next/headers`. Do not introduce a server-component Supabase client. The repo's single auth pattern is API-route + Bearer; this concern preserves it.
- **§D2.** **Server components are flag gates only.** Zero data reads. Zero environment touches beyond the flag accessor.
- **§D3.** **No new dependencies.** Use what's already in `package.json`. If a need surfaces (e.g., date formatting), use stdlib (`Date.toISOString().slice(0,10)`).
- **§D4.** **Brutalist baseline is non-negotiable.** Reject any styling embellishment beyond §F6.
- **§D5.** **The actor handle gap is a known compromise.** ID-prefix fallback is acceptable in this concern. A handle-resolution concern follows.
- **§D6.** **Surface parity with `GET /api/offers/[id]`.** Error codes, response envelope, header conventions all identical. If a divergence is necessary, pause and surface it.
- **§D7.** **The special-offer surface stays untouched.** Do not delete the route handlers, do not modify them. Concern 4A.2.C owns retirement.
- **§D8.** **AC16 freeze.** During execution, the only files mutable by Claude Code are:
  - `src/app/api/offers/route.ts` (GET addition only)
  - `src/app/api/offers/tests/get.test.ts` (new)
  - `src/app/vault/offers/page.tsx` (full rewrite)
  - `src/app/vault/offers/[id]/page.tsx` (new)
  - `src/app/vault/offers/_components/OffersListClient.tsx` (new)
  - `src/app/vault/offers/[id]/_components/OfferDetailClient.tsx` (new)
  - `src/app/vault/offers/_components/tests/OffersListClient.test.tsx` (new)
  - `src/app/vault/offers/[id]/_components/tests/OfferDetailClient.test.tsx` (new)
  - This directive (revisions only)
  - The exit report (new at conclusion)
  Any other file touch requires a documented R-revision and founder ack.
- **§D9.** **No "while I'm here" cleanups.** The 67 pre-existing lint errors stay untouched. Pruning belongs to its own concern.

---

## §PROMPTS — execution sequence

Each prompt is a single Claude Code invocation. Verdict-gated by founder before the next.

| # | Title | Output | LoC est. |
|---|---|---|---|
| 1 | **Pre-flight audit** — confirm client-side Bearer-token pattern exists (or surface gap); confirm no other consumer of `mockThreads`; re-verify no `@supabase/ssr` or `next/headers` consumers. | Audit memo appended to this directive as `§AUDIT-1`. No code. | **DONE** (see §AUDIT-1, 2026-04-21; AUTH closed via §R3) |
| 2 | **Add `GET /api/offers`** + tests | route.ts (GET added), get.test.ts (new) | **DONE** (see §AUDIT-2, 2026-04-22; Gate 1 APPROVE WITH CORRECTION per §R4; commit `f34df12`) |
| 3 | **Build `OffersListClient`** + smoke tests (see §R5) | client component + test | ~200 |
| 4 | **Build `OfferDetailClient`** + smoke tests (see §R5) | client component + test | ~250 |
| 5 | **Add server-component wrappers** (flag-gated) at both routes; overwrites legacy `vault/offers/page.tsx` in place; creates new `vault/offers/[id]/page.tsx` (see §R5) | page.tsx × 2 | ~30 |
| 6 | **Legacy-orphan audit** — grep evidence that `mockThreads` has zero consumers and the deleted legacy page is not imported elsewhere; `git rm` only if any orphan survives (see §R5) | grep evidence + optional git rm | ~0 |
| 7 | **Verification pass** — run full test suite, build, lint; capture deltas vs baseline | text-only report | 0 |
| 8 | **Exit report** — `P4_CONCERN_4A_2_SCAFFOLD_EXIT_REPORT.md` mirroring B2's structure | new doc | ~250 |

**Total LoC budget:** ~880 (close to the original ~750 estimate; +130 for the truncation flag + the slightly more thorough test set).

**Total prompts:** 8 (was estimated at 6-8; landed at 8 with the audit prompt promoted to its own gate per founder's standing audit-first preference).

**Wall-clock estimate:** 2-3 days solo, assuming verdicts within ~2 hours.

---

## §APPROVAL GATES

- **Gate 0 (now):** founder verdict on this directive — approve / approve-with-corrections / revise / reject.
- **Gate 1:** after Prompt 1 — if the client-side Bearer pattern doesn't exist, this concern pauses and a Path-α-prereq concern slots in front of it.
- **Gate 2:** after Prompt 7 — verification pass must show zero baseline regression. If any AC is partial, the exit report flags it explicitly and founder decides whether to ship as-is or correct.

---

## §RESOLVED — Gate 0 founder decisions (2026-04-22)

All four open questions closed. See §R3 for the decision record.

| # | Question | Decision |
|---|---|---|
| 1 | Counterparty handle resolution | **Accept ID-prefix fallback.** Proper handle resolution deferred to a follow-up concern. |
| 2 | Pagination in `GET /api/offers` | **Skip.** v1 hard-cap at 100 with `truncated` flag. |
| 3 | Branch name | **`feat/p4-scaffold-offers`** confirmed. |
| 4 | Sequencing with 4A.2.C | **Strictly sequential.** Scaffold ships first; special-offer retirement follows as its own concern. |

---

## §AUDIT-1 — Pre-flight audit findings (Prompt 1, 2026-04-21)

### Confirmed clean

| Check | Result |
|---|---|
| `@supabase/ssr` consumers | **0 files** — confirmed. SSR auth genuinely not in the repo. |
| `next/headers` consumers | **0 files** — confirmed. No cookie/header-based server reads. |
| `mockThreads` consumers outside the legacy page | **0 other files** — only `src/app/vault/offers/page.tsx`. Safe to delete. |
| `@supabase/supabase-js` installed | Yes — `^2.103.2`. Used only by `src/lib/db/client.ts` for service-role + user-JWT server clients. |

### Material finding — Gate 1 triggered

**The repo has no client-side auth pattern at all. The 44 existing `'use client'` pages do not authenticate, fetch from the repo's API, or hold a real Supabase session.** Specifically:

- **0 client `.tsx` files** call `fetch(`. (Confirmed via grep across `/src/app/**/*.tsx`.)
- **0 client `.tsx` files** read `getSession`, `getUser`, `accessToken`, or use `Authorization: Bearer …`.
- **0 files anywhere** import `createBrowserClient` or `createClientComponentClient`.
- **No `src/lib/supabase/` directory** exists.
- **`/signin/page.tsx` is a visual mockup** by explicit author comment (L8-17): *"Real auth (Supabase Auth or equivalent) is explicitly out of scope for this phase."* The submit handler is `router.push('/onboarding')`. There is no auth backend wired into the browser.

**Implication for Path α:** §F3/§F4 as written read *"the Supabase access token from the existing client-side session."* That session does not exist. A user reaching `/vault/offers` in the browser today has no identity the server could validate.

The scaffold therefore cannot ship as written. One of three forks is required.

### Three forks (founder decision)

| Fork | What it is | LoC | Time | Risk | Notes |
|---|---|---|---|---|---|
| **α-mock** | Scaffold ships as a new mock — pages render hardcoded fixture offers, no fetch. Defers all auth wiring. | ~250 | ~1 day | Low | Replaces "mock with random shape" with "mock with real shape." Doesn't actually exercise the B2 server contract. Burns the work twice (now and again when auth lands). |
| **α-prereq** | Insert a dedicated **Auth-client wiring** concern (4A.2.AUTH) before the scaffold. Wires `@supabase/supabase-js` browser client, real `/signin` flow, session management. Then scaffold proceeds as drafted. | ~600 + ~880 | ~2 days + ~3 days = **5 days** | Medium | Honest, sequenced, durable. Auth becomes a real concern with its own directive and AC. |
| **α-devhack** | Scaffold ships with a **dev-only token injection** path (e.g., `NEXT_PUBLIC_DEV_BEARER` env var, or a dev-only `/dev/login` page that mints a Supabase magic-link session client-side). Production path remains 404 via the flag. | ~880 + ~80 | ~3 days | Medium-high | Fast, but creates a dev/prod split that has to be unwound later. Acceptable only if the scaffold is genuinely throwaway. |

### Recommendation: **α-prereq**

Three reasons:
1. **Auth is the foundational primitive every UI surface needs.** It will be required for `/vault/assignments`, `/vault/disputes`, every product surface after them, and the real `/signin` flow. Doing it right now amortizes across everything that follows.
2. **The scaffold concern stays honest.** It actually exercises the B2 server contract end-to-end, which is the whole point of replacing the mock.
3. **The 2-day cost is small relative to the lifetime cost of a dev/prod auth split or a second scaffold rewrite.**

α-mock is rejected: it produces no real progress against the goal of "unblock UI/feature work on a stable base." A mock is not a stable base.

α-devhack is rejected unless founder explicitly wants to bias for raw speed and accepts the cleanup debt; even then, it's only viable if 4A.2.AUTH ships within ~1 week so the dev path doesn't entrench.

### Decision required before Gate 1 closes

Pick one:

- **α-prereq** — pause this directive, draft `P4_CONCERN_4A_2_AUTH_DIRECTIVE.md`, execute, return. *(My recommendation.)*
- **α-devhack** — accept the dev-token compromise, append a §F0 (dev-token plumbing) and §F8 (dev-only `/dev/login` or equivalent) to this directive, proceed.
- **α-mock** — accept the mock-grade scaffold, rewrite §F3/§F4 to use fixture data, drop the GET endpoint and §F1 entirely. Fastest, weakest.
- **Other** — push back with a fork I haven't surfaced.

This audit memo is part of the directive's revision trail. Whatever is decided becomes R2.

---

## §AUDIT-2 — Prompt 2 baseline (post-AUTH, pre-GET-list)

Captured 2026-04-22 at start of Prompt 2 execution, superseding the
1248 / 67 numbers locked at directive draft time (AC10 / AC12 floor).

```
$ npm run test 2>&1 | tail -30
 Test Files  65 passed | 1 skipped (66)
      Tests  1264 passed | 10 skipped (1274)

$ npm run lint 2>&1 | tail -30
✖ 411 problems (67 errors, 344 warnings)
```

- **Tests:** 1264 passing, 10 skipped, 0 failing — baseline is green.
- **Lint:** 67 errors / 344 warnings — matches the draft-time errors floor; warnings delta is out of scope for this concern (§D9).

This becomes the verification floor for Prompt 7:
- AC10 — next verification run must show ≥ 1264 + 6 (new §F7 cases) = **1270 passing**, 0 failing.
- AC12 — next verification run must show ≤ 67 lint errors.

---

**End of directive.**
