# SCAFFOLD Prompt 4 — `OfferDetailClient` + pure-helper smoke tests

**Concern:** P4/4A.2/SCAFFOLD
**Directive:** `docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md`
**Branch:** `feat/p4-scaffold-offers`
**Predecessor commits:** P2 = `f34df12` · R5 = `abca34d` · R6 = `41fde76` · P3 = `7ee350c`
**Revisions in force:** §R3, §R4, §R5, §R6 (pure helper + `renderToString`, **no RTL, no jsdom, no `package.json` edit**)

---

## Mandatory reading (before any code)

1. `docs/audits/P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md`. Pay special attention to:
   - **§R5** — this is a leaf prompt. No `page.tsx` wrapper here; that lands in P5.
   - **§R6** — testing uses `react-dom/server.renderToString` + a pure render helper, not RTL. Do not propose installing any test-infra dep; that decision is closed.
   - **§F4** — behavior contract for `OfferDetailClient`.
   - **§F6** — brutalist styling constraints (non-negotiable per §D4).
   - **§D1, §D3, §D6, §D8, §D9** — governing constraints.
2. `src/app/api/offers/[id]/route.ts` — the GET handler you consume. On 200 returns:
   ```ts
   { data: { offer: OfferRow, assets: OfferAssetRow[] | null, briefs: OfferBriefRow[] | null } }
   ```
   - `assets` populated for `target_type === 'single_asset' | 'asset_pack'`; `briefs` is null in that branch.
   - `briefs` populated for `target_type === 'single_brief' | 'brief_pack'`; `assets` is null in that branch.
   - Error codes: `FEATURE_DISABLED` (404), `UNAUTHENTICATED` (401), `ACTOR_NOT_FOUND` (403), `OFFER_NOT_FOUND` (404), `INTERNAL` (500). The **`OFFER_NOT_FOUND` 404** is the only status/code combo that maps to the §F4 "Offer not found." branch. All other non-2xx map to the generic error branch.
3. `src/app/vault/offers/_components/OffersListClient.tsx` (shipped at P3, commit `7ee350c`) — your architectural precedent. Mirror the two-layer split (stateful default export + named-export pure helper), the header comment style, the `cancelled` flag pattern, and the template-literal workaround for `renderToString`'s comment insertion.
4. `src/hooks/useSession.ts` — session API surface. `{ session, accessToken, status }`; `status ∈ 'loading' | 'authenticated' | 'unauthenticated'`.
5. `src/lib/offer/` — import `OfferRow`, `OfferAssetRow`, `OfferBriefRow` types from `@/lib/offer`. Do not redeclare them.
6. `node_modules/next/dist/docs/` — read the relevant guide for `'use client'` before writing any component. This is not the Next.js you know.

---

## Scope — two files only

1. **Create:** `src/app/vault/offers/[id]/_components/OfferDetailClient.tsx`
2. **Create:** `src/app/vault/offers/[id]/_components/__tests__/OfferDetailClient.test.tsx`

Per §D8, **no other file** may be touched. In particular:

- Do **not** create `src/app/vault/offers/[id]/page.tsx`. That's P5's work per §R5.
- Do **not** touch the legacy `src/app/vault/offers/page.tsx`. That's P5.
- Do **not** touch the API route, `OffersListClient`, `package.json`, `vitest.config.ts`, or any setup file.

If you hit a real need to touch another file, stop and surface.

---

## Architecture — component + pure helper split (§R6, mirror of P3)

**Layer 1 — the component (`OfferDetailClient.tsx`, default export):**

- `'use client'` at top.
- Receives one prop: `{ id: string }` (injected by P5's server wrapper; for P4 purposes, test it in isolation).
- Owns hook wiring: `useSession()`, `useEffect`, `useState`.
- Owns the fetch call against `/api/offers/${id}` and the classification of its outcome into one of the view states below.
- Does **not** render JSX directly. Computes a view state, passes to the pure helper.

**Layer 2 — pure render helper (named export `renderOfferDetailBody`):**

- Pure function: `(view, selfUserId) → ReactElement`.
- No hooks, no network, no effects, no `window`, no `document`.
- All §F4 rendering lives here.

**View state shape** (recommended; adjust only with surfaced justification):

```ts
type OfferDetailView =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | {
      kind: 'loaded'
      offer: OfferRow
      assets: OfferAssetRow[] | null
      briefs: OfferBriefRow[] | null
    }
```

The component's reduction logic:

- `status === 'loading'` → `loading`
- `status === 'unauthenticated'` → `unauthenticated`
- `status === 'authenticated'` + fetch in flight → `loading`
- Fetch resolves non-2xx with body `{ error: { code: 'OFFER_NOT_FOUND' } }` or plain HTTP 404 → `not_found`
- Any other fetch failure (non-2xx that isn't a 404/OFFER_NOT_FOUND, network error, JSON parse failure) → `error`
- Fetch 200 → `loaded`

**Stale-data handling:** mirror P3's approach — `cancelled` flag inside `useEffect`, do **not** synchronously `setState` inside the effect body (the baseline `react-hooks/set-state-in-effect` rule will reject it; see P3's commit notes for context). If the `id` prop changes without a remount (rare — dynamic routes normally remount — but guard anyway), the cancelled flag prevents old-fetch writes and the new fetch's loading state takes over once the dep-change re-run fires. Brief continuity of previous `data` during the overlap is the accepted scaffold-grade trade, same as P3.

**Imports allowed:**
- `'use client'` pragma
- `react` (hooks, `ReactElement`, `ReactNode`)
- `@/hooks/useSession`
- Types from `@/lib/offer`: `OfferRow`, `OfferAssetRow`, `OfferBriefRow`

**Imports forbidden (§D1, §D3, §R6):**
- `@supabase/ssr`, `next/headers`, any Supabase client
- `@testing-library/*`, `jsdom`, `happy-dom`
- `notFound` from `next/navigation` (§F4 item 5 — do **not** call `notFound()` from a client component; render the `Offer not found.` string instead)
- `next/link` — the detail view has no in-component navigation. If a Back link is desired in future, that's a follow-up, not this prompt.

**LoC budget:** ~220 LoC total (component + helper + header comment). Bigger than P3 because the `loaded` branch has more structure.

---

## §F4 behavior contract (verbatim, expressed against the new architecture)

**Loaded branch — `renderOfferDetailBody` must render, in order, each as a plain text block (no cards, no section borders beyond §F6):**

1. **Header:** `Offer ${offer.id.slice(0, 8)}` — use `text-lg` per §F6.
2. **Counterparty + role line:**
   - If `offer.buyer_id === selfUserId` → `You are the buyer.`
   - Else if `offer.creator_id === selfUserId` → `You are the creator.`
   - Else (shouldn't happen under RLS; guard) → `You are not a party to this offer.`
3. **State line:** `State: ${offer.state}`
4. **Money line:** `${offer.gross_fee} ${offer.currency} · platform fee ${offer.platform_fee_bps / 100}%`
   - Collapse into a single template literal per the P3 `renderToString` lesson — do not split `{gross_fee} {currency}` across adjacent JSX expressions.
   - `platform_fee_bps / 100` emits the percentage (e.g., `1000 bps → 10%`). Scaffold-grade; if the percentage is fractional, render it as-is (no `.toFixed`).
5. **Expires line:** `Expires: ${offer.expires_at.slice(0, 10)}` (same `YYYY-MM-DD` slice as P3).
6. **Note block:** header `Note:` on one line, then a block of plain text below:
   - `offer.current_note ?? '—'`
   - Preserve newlines inside `current_note` (render inside a `<pre className="font-sans text-sm whitespace-pre-wrap">` or equivalent; do not use `<code>`, per §F6 "system sans only").
7. **Items section — branched on `offer.target_type`:**
   - `single_asset` or `asset_pack` → heading `Assets:` (text-base) + `<ol>` of `${asset.position}. ${asset.asset_id.slice(0, 8)}`
   - `single_brief` or `brief_pack` → heading `Briefs:` (text-base) + `<ol>` of `${brief.position}. ${brief.spec.title} — ${brief.spec.deliverable_format}, ${brief.spec.deadline_offset_days}d`
   - If the branch's expected array is `null` (shouldn't happen given the API contract), surface it by rendering `(missing)` as the section content — do not crash, do not fabricate rows.
   - If `brief.spec` is missing any of `title`, `deliverable_format`, `deadline_offset_days`, render `—` in that position. Spec shape is domain-data contract, not UI contract; tolerate gaps.
8. **Rights section:** heading `Rights:` (text-base) + `<pre className="font-sans text-xs whitespace-pre-wrap">` — wait, **§F6 forbids `text-xs`.** Use `text-sm`. Content is `JSON.stringify(offer.rights, null, 2)` — scaffold-grade; proper rights renderer lives in a follow-up concern. Add a source comment noting the compromise (mirror §D5's tone from P3).

**Other branches:**

- `loading` → `Loading offer…` (mirror P3's `Loading offers…` voice)
- `unauthenticated` → `Sign in to view this offer.`
- `not_found` → `Offer not found.` — do NOT call `next/navigation`'s `notFound()`.
- `error` → `Could not load this offer.`

All non-loaded branches render as a single `<p className="font-sans text-sm text-black px-6 py-4">` line, same shape as P3's empty/error/unauthenticated cases.

**Header comment block** on `OfferDetailClient.tsx` must document: §F4 contract summary, references to §R5 + §R6, the rights-stringify compromise, and the party-role guard.

---

## §F6 styling constraints (non-negotiable per §D4)

Same as P3, plus:
- Top-level container: `max-w-3xl mx-auto bg-white px-6 py-4 font-sans text-black`
- Between sections: `border-b border-black` where visual separation is useful; don't over-separate.
- No `<table>`, no icons, no images, no avatars, no animations, no transitions.
- Focus rings allowed; comment as intentional.

---

## Tests (§F7 as respecified by §R6) — 3 cases

**File:** `src/app/vault/offers/[id]/_components/__tests__/OfferDetailClient.test.tsx`

Boilerplate matches P3's file; keep import order and style parallel.

| # | Case | How to test |
|---|---|---|
| 1 | Pure helper, `loaded` with `target_type: 'asset_pack'`, 2 asset rows | `{ kind: 'loaded', offer: makeOffer({ target_type: 'asset_pack' }), assets: [makeAsset(1, idA), makeAsset(2, idB)], briefs: null }`. `renderToString` the helper. Assert: header `Offer ${offer.id.slice(0,8)}`, role line `You are the buyer.` (offer where `buyer_id === SELF_ID`), state line, money line `${gross_fee} ${currency} · platform fee ${bps/100}%` correctly concatenated, `YYYY-MM-DD` expires, `Assets:` heading, both ordered items present (`1. ${idA.slice(0,8)}` and `2. ${idB.slice(0,8)}`), `Rights:` heading + the stringified rights. `Briefs:` must NOT appear. |
| 2 | Pure helper, `loaded` with `target_type: 'brief_pack'`, 2 brief rows | Same shape as case 1, opposite branch: `briefs: [makeBrief(1, {title, format, days: 7}), makeBrief(2, {title, format, days: 14})]`, `assets: null`. Assert role line `You are the creator.` (offer where `creator_id === SELF_ID`), `Briefs:` heading, both briefs formatted `${position}. ${spec.title} — ${spec.deliverable_format}, ${spec.deadline_offset_days}d`. `Assets:` must NOT appear. |
| 3 | Pure helper, `not_found` branch | `{ kind: 'not_found' }`. Assert output contains `Offer not found.` |

Fixture helpers (`makeOffer`, `makeAsset`, `makeBrief`) live inline in the test file — do NOT export them, do NOT create a shared fixtures module (§D8).

Do **not** add a fourth case exercising the component-level loading branch. The loading-branch coverage from P3 already proves the pattern works under this architecture; replicating it here adds noise without new information. If Gate 1 review asks for it, add it in R-revision.

---

## §D directives that govern this prompt

- **§D1.** No `@supabase/ssr`. No `next/headers`. No Supabase client import.
- **§D3.** No new dependencies. Do not edit `package.json`.
- **§D4.** Brutalist baseline is non-negotiable.
- **§D5.** The rights-stringify rendering is a known scaffold-grade compromise — comment it. Role-detection is NOT a compromise (it's the real contract); only the counterparty-handle fallback from P3 was sanctioned, and that's an F3 concern, not F4.
- **§D6.** The fetch consumes `{ data: { offer, assets, briefs } }` exactly as documented above. `not_found` only maps from HTTP 404 + `OFFER_NOT_FOUND` code. Other errors → generic error branch.
- **§D8.** Two files only. Surface any other need.
- **§D9.** No collateral edits.

---

## Baselines (from §AUDIT-2 + §R4 + post-P3)

- **Tests floor:** 1273 passing (post-P3), 0 failing. Expected new total: **1273 + 3 = 1276**.
- **Lint floor:** 69 errors, 346 warnings. Expected new total: **≤ 69 / ≤ 346**.

---

## Done criteria

Before reporting done, verify:

- [ ] `npm run test` green, count is **1276** (floor + 3)
- [ ] `npm run lint` shows **≤ 69 / ≤ 346**
- [ ] `npm run build` is clean
- [ ] `git diff --stat HEAD` shows exactly 2 new files under `src/app/vault/offers/[id]/_components/`
- [ ] `git diff 7ee350c..HEAD -- package.json vitest.config.ts` — empty
- [ ] `git diff 7ee350c..HEAD | grep -E "supabase/ssr|next/headers|testing-library|jsdom|happy-dom|notFound"` — empty (the `notFound` grep catches accidental `next/navigation` imports in the client component)
- [ ] Header comment block present on the component
- [ ] `renderOfferDetailBody` is a named export (tests import it)
- [ ] Component is orphaned (no importer yet — expected, P5 wires it)

---

## Report shape

```
Files touched:
  - src/app/vault/offers/[id]/_components/OfferDetailClient.tsx                   (new, +X)
  - src/app/vault/offers/[id]/_components/__tests__/OfferDetailClient.test.tsx    (new, +Y)

Verification:
  - Tests: N tests (was 1273) — delta +3, all green
  - Lint:  K errors / J warnings (was 69 / 346) — delta 0 / ≤0
  - Build: clean
  - Orphan check: OfferDetailClient has no importer (expected per §R5; wired at P5)
  - package.json / vitest.config.ts: untouched
  - SSR/headers/RTL/jsdom/notFound grep on src/ diff: clean

Open items: [none | list]

Ready for Gate 1 verdict.
```

**Do not commit.** I review and stage the commit myself after verdict.
