# SCAFFOLD Prompt 5 — Server-component flag-gate wrappers (§F2)

You are Claude Code executing Prompt 5 of P4 concern 4A.2.SCAFFOLD. This
is the prompt that **wires up** the two client leaves shipped at P3
(`OffersListClient`, commit `7ee350c`) and P4 (`OfferDetailClient`,
commit `b665a2d`). Both are currently orphaned by design (§R5) — your
job is to land the server-component page wrappers that mount them
behind the `ECONOMIC_V1_UI` flag.

This prompt is also the **retirement step** for the legacy 561-LoC
mock at `src/app/vault/offers/page.tsx` — you overwrite it in place
(§R5 / §F5). Do **not** open the `/api/special-offer/*` route
handlers; their retirement is concern 4A.2.C, explicitly separate
(§D7).

---

## MANDATORY READING (in order, before you touch any file)

1. **`docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md`** — read the
   whole thing, but anchor especially on:
   - §F2 (canonical server-component flag-gate pattern — lines 171-189)
   - §F5 (legacy page removal — lines 235-243)
   - §D1 (no SSR auth infrastructure — line 300)
   - §D2 (server components are flag gates only; zero data reads —
     line 301)
   - §D8 (file mutability list — lines 307-318; P5 is allowed to
     touch `src/app/vault/offers/page.tsx` and
     `src/app/vault/offers/[id]/page.tsx` and nothing else in `src/`)
   - AC4, AC5, AC6, AC7, AC8, AC9, AC11 (acceptance criteria this
     prompt is principally responsible for satisfying — lines 283-290)
2. **`src/lib/flags.ts` L85-117** — the `isEconomicV1UiEnabled()`
   accessor and its documented canonical usage pattern. The docblock
   at L98-105 is effectively a copy-paste template for your two
   wrappers; use it verbatim in spirit.
3. **`src/app/vault/offers/_components/OffersListClient.tsx`** — the
   default export you are mounting in the list wrapper. Confirms
   zero-prop signature: `OffersListClient(): ReactElement`.
4. **`src/app/vault/offers/[id]/_components/OfferDetailClient.tsx`**
   — the default export you are mounting in the detail wrapper.
   Confirms prop signature: `OfferDetailClient({ id }: { id: string })`.
5. **`src/app/vault/offers/page.tsx`** (the existing 561-LoC legacy
   mock) — **read it so you know what you are overwriting**. Do
   **not** port any of its code. Do not preserve `mockThreads`, do
   not preserve `ThreadCard`, do not preserve `NegotiationEvent`, do
   not preserve `VaultLeftRail` integration. All of that belongs to
   a different product concept and is being retired here. Imports
   into `@/lib/types`, `@/lib/mock-data`, and
   `@/components/platform/*` disappear with the file; any orphaned
   symbols in those files are P6's concern, not yours.
6. **`src/app/asset/[id]/page.tsx`** — reference for Next 16
   async-params shape. **Important caveat:** that file is a `'use
   client'` page, so it uses `use(params)`. Your detail wrapper is a
   **server component**, so it must `await params` instead. The
   `params` type annotation (`Promise<{ id: string }>`) is the same
   in both cases.
7. **`CLAUDE.md` and `AGENTS.md`** — Next 16 has breaking changes
   from your training data. `params` is a `Promise`; you must
   await/use it. No synchronous `.id` access on `params`.

---

## SCOPE — exactly two files

### File A — overwrite in place

**Path:** `src/app/vault/offers/page.tsx`

**Action:** full rewrite. The existing 561-LoC mock is deleted by
virtue of the overwrite. Do not preserve any legacy imports, types,
constants, components, or JSX.

**Final content shape** (follow this exactly — it is the §F2
canonical pattern applied to the list route, and it is the entirety
of the file):

```tsx
// ═══════════════════════════════════════════════════════════════
// Frontfiles — /vault/offers server-component flag gate (§F2)
//
// Replaces the legacy 561-LoC "Special Offers" mock that predated
// the spec-canonical offer contract shipped at P4 Part B1/B2. See
// P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md §F5 for the retirement
// rationale and §F2 for the canonical pattern this file implements.
//
// This page is a pure server component. It does zero data work
// (§D2): the only server-side responsibility is the ECONOMIC_V1_UI
// flag check; when on, it hands off to the client leaf for
// session-gated fetch and rendering.
// ═══════════════════════════════════════════════════════════════

import { notFound } from 'next/navigation'

import { isEconomicV1UiEnabled } from '@/lib/flags'
import OffersListClient from './_components/OffersListClient'

export default function Page() {
  if (!isEconomicV1UiEnabled()) notFound()
  return <OffersListClient />
}
```

**Hard constraints:**

- **No `'use client'` directive.** This is a server component (AC5).
- **No Supabase imports** of any kind (AC6, §D1). No
  `@supabase/ssr`. No `@supabase/supabase-js`. No
  `src/lib/supabase/…`.
- **No `next/headers` imports** (§D1, AC9).
- **No data reads.** Do not fetch, do not query, do not touch
  cookies, do not read env vars other than via
  `isEconomicV1UiEnabled()` (§D2).
- **No `generateStaticParams`, no `metadata` export, no `revalidate`
  export.** Out of scope — the scaffold is auth-gated and dynamic.
- **No chrome** (VaultLeftRail, Panel, EmptyPanel, headers, filters,
  banners). None of it. The client leaf owns its own rendering;
  this wrapper is thin on purpose.

### File B — pure-create

**Path:** `src/app/vault/offers/[id]/page.tsx`

**Action:** new file. The `[id]/` directory already exists (holds
`_components/`), but there is no `page.tsx` in it today.

**Final content shape** (follow this exactly — it is the §F2
canonical pattern applied to the detail route, with Next 16
async-params unwrapping):

```tsx
// ═══════════════════════════════════════════════════════════════
// Frontfiles — /vault/offers/[id] server-component flag gate (§F2)
//
// Detail-route counterpart to the list wrapper at
// ../page.tsx. Same server-component + flag-gate-only
// architecture (§D2); the only addition is the Next 16
// async-`params` unwrap needed to hand the `id` to the client
// leaf.
//
// The client leaf consumes GET /api/offers/[id] and maps its
// 404 → a `not_found` view-state branch; there is no
// notFound() call from the client side. notFound() in this
// file is reserved for the flag-off case only.
// ═══════════════════════════════════════════════════════════════

import { notFound } from 'next/navigation'

import { isEconomicV1UiEnabled } from '@/lib/flags'
import OfferDetailClient from './_components/OfferDetailClient'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!isEconomicV1UiEnabled()) notFound()
  const { id } = await params
  return <OfferDetailClient id={id} />
}
```

**Hard constraints:** identical to File A, plus:

- **`params` is a `Promise` in Next 16.** Type it as
  `Promise<{ id: string }>` and `await` it. Do not access `.id`
  synchronously. Do not use `use(params)` — that is the client-page
  shape; this is a server page.
- **Order:** flag check first, params unwrap second. Matches §F2's
  documented pattern and ensures flag-off returns 404 without even
  awaiting the params promise.
- **No validation of `id`** (UUID shape, length, etc.). That is the
  API route's job. Pass the raw string to the client leaf.
- **No `searchParams` prop.** Not needed for v1.

---

## FORBIDDEN PATTERNS (verbatim)

Hard rejections — if Claude Code drafts any of these, self-correct
before surfacing a report:

1. `'use client'` anywhere in either wrapper.
2. `import { cookies } from 'next/headers'` or any `next/headers`
   symbol.
3. `import { createServerClient } from '@supabase/ssr'` or any
   `@supabase/ssr` symbol.
4. `import … from '@/lib/supabase/server'` or any Supabase client
   import.
5. `await fetch(…)` or any data read inside the server wrappers.
6. `export const revalidate`, `export const runtime`, `export async
   function generateStaticParams`, or `export const metadata`.
   (Note: `export const dynamic = 'force-dynamic'` is REQUIRED on
   both wrappers — see correction applied at Gate 1 review —
   because `isEconomicV1UiEnabled()` is a build-time constant to
   Next's static analysis, and a static 404 prerender would defeat
   the env-change flip semantic at Deploy 2.)
7. `use(params)` in the detail wrapper (that is the client-page
   shape; you are a server page, use `await`).
8. Any preservation of the legacy mock's symbols: `mockThreads`,
   `mockEvents`, `STATUS_STYLES`, `EVENT_LABELS`, `ThreadCard`,
   `NegotiationEvent`, `handleThreadUpdate`, or any `/api/special-
   offer/*` reference.
9. `import Link from 'next/link'`, `useState`, `useEffect`, or any
   React hook in either wrapper.
10. Any chrome import: `VaultLeftRail`, `Panel`, `EmptyPanel`,
    `AssetViewer`, etc.

---

## DONE CRITERIA

Before surfacing your report, verify each item locally. Report
actual numbers, not claims.

### Files

1. `src/app/vault/offers/page.tsx` matches the shape above. Line
   count ≤ 25 including the header comment block. No `'use
   client'`. No Supabase. No data reads.
2. `src/app/vault/offers/[id]/page.tsx` matches the shape above.
   Line count ≤ 35 including the header comment block. Same
   constraints.

### Baselines (AC10, AC11, AC12)

3. `npm run test` — **1276 tests passing** (= 1273 pre-concern +
   3 P3 + 3 P4 — and **no new tests** land at P5, so the floor is
   exactly 1276, not 1279). Zero failures. Zero new skips.
4. `npm run lint` — **≤ 69 errors / ≤ 346 warnings**. Ideal is
   ≤ 69/≤ 346 since the legacy 561-LoC file is being deleted; if
   the delta is negative (fewer errors/warnings) that is a bonus
   and should be reported explicitly. **Do not manually fix any
   pre-existing lint error that happens to disappear or appear with
   this overwrite** — report the delta and leave it to founder
   review.
5. `npm run build` — clean. Zero errors, zero warnings. Both
   `/vault/offers` and `/vault/offers/[id]` should appear in the
   route table, and both should be dynamic (ƒ, not static — they
   contain `notFound()`). This is the first prompt in the concern
   that actually wires the client leaves into the route table; a
   build failure here almost certainly means a module-resolution
   bug in one of the wrappers.

### Grep checks (AC7, AC8, AC9)

Run and paste the exact output (or "no matches") of each:

6. `git grep -n mockThreads -- 'src/**'` — should return **no
   matches** inside `src/` (all references died with the
   overwrite). If anything remains, surface it; do not delete —
   P6's orphan-audit owns that.
7. `git grep -n 'api/special-offer' -- 'src/app/vault/**'` —
   should return **no matches** inside `src/app/vault/`.
8. `git grep -n '@supabase/ssr\|next/headers' -- 'src/**'` —
   should return **no matches** anywhere in `src/`.
9. `git grep -n "'use client'" -- 'src/app/vault/offers/page.tsx'
   'src/app/vault/offers/[id]/page.tsx'` — should return **no
   matches** (AC5).

### Sanity on the client-leaf wiring

10. `git grep -n 'OffersListClient\|OfferDetailClient' -- 'src/**'`
    — each leaf should now have **at least one importer** in
    `src/app/vault/offers/` alongside its own file and its test.
    This closes the P3/P4 orphan window.

---

## ARCHITECTURAL CONTEXT (why this prompt is this small)

The scaffold's architecture deliberately splits the server/client
boundary at one single place: the flag gate. Everything the user
sees (list rows, detail blocks, loading states, error states, note
rendering, rights rendering) lives in the client leaves shipped at
P3/P4. Everything the route does at the server (flag check only,
per §D2) lives in these two wrappers. This is the only sanctioned
bridge between server and client in this concern (§F2).

Consequences for you:

- The wrappers are each ~8 / ~15 lines of code (excluding comment
  blocks). There is nothing else to add. If your draft exceeds ~25
  and ~35 lines respectively, you are doing something §F2 forbids.
- There is no "while I'm here" opportunity (§D9). The lint baseline
  is 69/346; do not improve it.
- The wrappers must be orphan-killers for the client leaves but
  must not introduce any new orphans themselves. The grep check
  at item 10 is the bidirectional proof.

---

## REPORT FORMAT

Surface exactly these sections; no more, no less:

```
### Files touched
- src/app/vault/offers/page.tsx (overwritten: 561 → <N> LoC, delta -<561-N>)
- src/app/vault/offers/[id]/page.tsx (new, +<M> LoC)

### Verification
- Tests: <actual>/<actual skipped> across <file count> files (floor 1276) — delta <+/-0>
- Lint:  <errors> errors / <warnings> warnings (floor 69/346) — delta <+/-0>/<+/-0>
- Build: <clean | errors reported below>
  Route table entries (if reported): <paste if build reports them>

### Grep evidence
- mockThreads in src/: <no matches | listing>
- api/special-offer in src/app/vault/: <no matches | listing>
- @supabase/ssr or next/headers in src/: <no matches | listing>
- 'use client' in the two wrappers: <no matches | listing>
- OffersListClient / OfferDetailClient importers in src/: <listing — must show the new wrappers>

### Open items
<anything unexpected, including any negative-delta lint improvements — leave to founder review>

### Not committed — awaiting review
```

Do not commit. Do not push. Surface the report and wait.
