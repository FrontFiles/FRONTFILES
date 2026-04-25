# NR-D6a Exit Report — Distributor Dashboard (P5) + Tier-Gate Read

**Directive:** `docs/public-newsroom/directives/NR-D6a-distributor-dashboard-tier-gate.md`
**Branch:** `feat/newsroom-phase-nr-2`
**Predecessor:** `e7e7767` (governance-docs inheritance merge)
**Date:** 2026-04-25
**Verdict (self-assessment):** Pass.

---

## 1. Summary

Locked scope after audit IP ratification: **8 NEW + 1 EDIT** (was 9 NEW + 2 EDIT in directive header — F1 SKIPPED per IP-1). Total source lines added ≈ 1,238 (counted across the 9 source files).

| F# | File | Lines | Action | Role |
|---|---|---|---|---|
| ~~F1~~ | ~~`src/lib/db/schema.ts`~~ | — | **SKIPPED** | `NewsroomPackRow` + 4 enum types already present from NR-D1 (audit IP-1) |
| F2 | `src/app/newsroom/[orgSlug]/manage/page.tsx` | 253 | EDIT (replace) | Server-component dashboard composing F3–F7 |
| F3 | `_components/dashboard-header.tsx` | 63 | NEW | Org name + tier badge + "New pack" CTA with disabled-state tooltip |
| F4 | `_components/verification-banner.tsx` | 112 | NEW | Conditional 3-state banner (PRD §5.2 P5 verbatim) |
| F5 | `_components/pack-list.tsx` | 199 | NEW | Table + 2 empty-state branches; embargo-cell derivation |
| F6 | `_components/pack-list-filters.tsx` | 115 | NEW | Server-rendered `<form method="GET">` filters |
| F7 | `_components/kpi-strip.tsx` | 57 | NEW | 5-tile KPI strip (Downloads (30d) = "—" placeholder) |
| F8 | `src/lib/newsroom/dashboard.ts` | 201 | NEW | Pure helpers: `deriveBannerState` / `canCreatePack` / `parseFilterParams` |
| F9 | `src/lib/newsroom/__tests__/dashboard.test.ts` | 209 | NEW | 16 vitest cases |
| F10 | `src/app/newsroom/[orgSlug]/manage/packs/new/page.tsx` | 29 | NEW | Placeholder until NR-D6b ships the real Pack-creation form |

**Audit findings that shaped the implementation** (per §3 of the directive; all three IPs ratified by founder pre-composition):

| Audit | Resolution |
|---|---|
| **(a) `/manage/page.tsx`** | Confirmed 53-line NR-D5b-i F2 stub. F2 REPLACE in place. |
| **(b) `newsroom_packs` shape** | Confirmed at [migration:271](supabase/migrations/20260425000001_newsroom_schema_foundation.sql:271). Index `idx_newsroom_packs_company_status` at line 370 drives F2's filter query. |
| **(c) RLS posture** | `newsroom_packs_select_public` includes `OR is_newsroom_editor_or_admin(company_id)` at [migration:614](supabase/migrations/20260425000001_newsroom_schema_foundation.sql:614). Both service-role and user-JWT reads work. Directive locks service-role; F2 uses `getSupabaseClient()` consistent with NR-D5b-i F3. |
| **(d) Verification-records shape** | `(method, value_checked, verified_at, expires_at, company_id)` confirmed. F8 `deriveBannerState` consumes the snapshot. |
| **(e) Schema.ts row type** | **DRIFT** — `NewsroomPackRow` already exists at [schema.ts:657](src/lib/db/schema.ts:657) with the exact shape and migration-matched enum members. **IP-1 → F1 SKIP.** |
| **(f) Filter convention** | Server-rendered URL-param-driven matches existing codebase (9 server-component files use `searchParams`). No client-state precedent. F6 form locked. |
| **(g) `/manage/packs/new`** | Glob returns no files; F10 placeholder is net-new. |
| **(extra) Embargo audit** | `newsroom_embargoes` confirmed with `lift_at`, `state` (`active`/`lifted`/`cancelled` enum). RLS permits org-member reads. F2 does a separate batched query rather than PostgREST relationship-resolution to avoid the dual-FK ambiguity (`newsroom_packs.embargo_id` and `newsroom_embargoes.pack_id` are both FKs between the two tables). |

---

## 2. Audit findings — IPs surfaced and resolved

All three IPs were ratified pre-composition before any file was written. None diverged in implementation.

| IP | Verdict | Implementation |
|---|---|---|
| **IP-1** F1 SKIP (schema.ts already has row type + 4 enums) | APPROVE | F1 not written; F2/F5/F6/F7/F8 import from `@/lib/db/schema` directly. |
| **IP-2** Directive's F1 enum drift (`editorial_extended` etc. ≠ migration members) | APPROVE — directive corrected in place | No action in NR-D6a; F1 SKIPPED moot the issue. Components iterate `LICENCE_CLASSES` from `src/lib/newsroom/licence-classes.ts` rather than hardcoded enum lists. |
| **IP-3** Scope reduction: 8 NEW + 1 EDIT = 9 deliverables; commit = 11 paths | APPROVE | Final stage matches: 9 deliverables + directive + exit report. |

**No mid-session IPs surfaced.** Composition followed the ratified plan exactly. One implementation detail surfaced via typecheck (Supabase JS multi-line string-concat select dropping to `GenericStringError[]`) and was fixed by switching to `.select('*')` — documented inline in F2; not a directive-vs-implementation drift, just a TypeScript-inference workaround.

---

## 3. Decisions that diverged

Three small directive-vs-implementation reconciliations, all benign:

1. **F2 packs query uses `.select('*')` instead of an explicit column list.** Multi-line string-concat select silently dropped Supabase JS's row-type inference to `GenericStringError[]`, breaking the `as NewsroomPackRow[]` cast. `.select('*')` resolves the row type from the table schema directly. `NewsroomPackRow` already covers all columns 1:1 with the migration. Documented inline in F2.

2. **Embargo `'cancelled'` state collapses into "None" in F5 (founder-ratified post-VERIFY).** PRD §5.1 P5 enumerates exactly three embargo cell states: "None" / "Lifts {rel}" / "Lifted". The schema's `newsroom_embargo_state` enum has a fourth value: `cancelled`. Original composition rendered "Cancelled" as a fourth string (citing NR-D5b-ii IP-3 PRD-silent ≠ PRD-restrictive). Founder corrected post-VERIFY: per the standing "PRD wins on drift" posture (NR-D6a §9), cancelled embargoes render as "None" — matches the column's user-impact purpose ("is publish blocked by an active embargo?"), and a cancelled embargo no longer blocks. F5 collapses the no-embargo and cancelled branches into a single return path; comment block updated. VERIFY 1+2+3 re-run green after the fix (typecheck silent; dashboard.test.ts 16/16; full newsroom suite 141/141).

3. **F2 fetches embargoes via separate batched query rather than PostgREST relationship-embed.** `newsroom_packs ↔ newsroom_embargoes` has two FKs (one each direction). Auto-relationship resolution is ambiguous; explicit FK-name hints work but couple component code to PostgREST internals. Two queries + JS merge is unambiguous and easier to test. Performance impact negligible at v1 scale.

---

## 4. Open questions for founder

- **Visual smoke (VERIFY 5) deferred.** Requires a signed-in admin session + a verified-source company in fixtures. Same posture as NR-D5b-i. Coverage delivered via VERIFY 6 (curl-smoke confirms server response shape) + F9 unit tests + typecheck. Worth confirming whether NR-D6b should land a fixture-seed strategy (admin user + company + a few packs) so visual smoke becomes routinely executable.

- **Title link routes to `/manage/packs/{slug}` which doesn't exist yet.** F5 row titles link to `/${orgSlug}/manage/packs/${pack.slug}` per directive §F5. That route is a placeholder until NR-D6b lands the Pack editor. Clicking will 404 in the NR-D6a → NR-D6b window. Mitigation: in this window, the dashboard has zero rows (Pack creation is NR-D6b), so the placeholder-link gap is not user-facing in practice. Worth confirming whether NR-D6b should also land a `/packs/[slug]/page.tsx` placeholder for the same defensive reason F10 ships now.

- ~~**Embargo `'cancelled'` rendering.**~~ Resolved post-VERIFY: founder ratified "None" per PRD-wins-on-drift. See §3.2.

- **`LICENCE_CLASSES.humanLabel` consumed by F5 + F6.** Both components import `LICENCE_CLASSES` from [licence-classes.ts](src/lib/newsroom/licence-classes.ts). The current values (`Press release (verbatim)`, `Editorial use only`, `Promotional use`, `CC Attribution 4.0`, `CC0 Public Domain`) are NR-D4-locked. If marketing/legal want different display strings, the change lands in licence-classes.ts and propagates to both surfaces with no further work in NR-D6a.

---

## 5. Test results

```
$ bunx vitest run src/lib/newsroom/__tests__/dashboard.test.ts
 RUN  v4.1.5 /Users/jnmartins/dev/frontfiles
 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  357ms
```

16/16 passed. Breakdown:

| Group | Count | Notes |
|---|---|---|
| `deriveBannerState` | 6 | unverified-wins, none, expiring (+method), soonest-pick, null-expiry, empty-records |
| `canCreatePack` | 3 | unverified=false, verified_source=true, verified_publisher=true |
| `parseFilterParams` | 7 | empty, pass-through valid, drop invalid status, drop invalid licence, drop bad date, empty-string, whitespace-trim |
| **Total** | **16** | (directive estimated 8–10; extras are defensive but consistent with NR-D5b-i / NR-D5b-ii density) |

Full newsroom suite (VERIFY 3): **141/141 across 9 files** — NR-D5b-i (verification.test.ts) and NR-D5b-ii (OTP cases) remain green.

---

## 6. Build + typecheck + migration apply

| Step | Command | Result |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 (`tsc --noEmit` silent) — second pass after `.select('*')` fix |
| Vitest (dashboard) | `bunx vitest run src/lib/newsroom/__tests__/dashboard.test.ts` | 16/16 pass |
| Vitest (full newsroom) | `bunx vitest run src/lib/newsroom/__tests__` | 141/141 across 9 files |
| Build | `bun run build` | exit 0; **route count 102 → 103 (+1 = `/newsroom/[orgSlug]/manage/packs/new`)** |
| Scope diff | `git status --porcelain` | 1 modified (F2) + 9 untracked (F3–F10 + directive); zero strays |

**Route count delta confirmed:** baseline 102 (NR-D5b-ii close + governance-docs merge) → 103 with the new placeholder route. Build output: 35 static + 69 dynamic − 1 Proxy (Middleware) = 103.

---

## 7. Runtime smoke

Two-phase smoke: dev-server-bounce-before-curl posture per the NR-D5b-i / NR-D5b-ii / pre-merge-dirty-status carry-forward (`rm -rf .next` was NOT run this directive — the bounce was preventative, ensuring no stale `.next/dev/` from prior builds).

**VERIFY 6 — unauthed curl smoke (no Bearer):**

```
$ curl -s -o /tmp/manage.html -w "%{http_code}" \
    -H "Host: newsroom.frontfiles.localhost" \
    http://localhost:3000/some-test-org/manage
200

# body content matches:
- AdminGate
- Loading…
- admin-gate

$ curl -s -o /tmp/new.html -w "%{http_code}" \
    -H "Host: newsroom.frontfiles.localhost" \
    http://localhost:3000/some-test-org/manage/packs/new
200

# body content matches:
- New pack
- Pack creation ships
- NR-D6b
- Back to dashboard
```

Both routes return 200 with the expected SSR-rendered HTML. AdminGate's `Loading…` placeholder appears on `/manage` (auth gate fires client-side; same pattern as NR-D5b-i). F10 placeholder copy is verbatim.

**Initial smoke quirk:** first attempt without `Host: newsroom.frontfiles.localhost` returned 404 — which is **correct** behaviour per the proxy at [src/proxy.ts](src/proxy.ts): main-domain requests to `/newsroom/*` are denied with 404 per PRD §9.3 separation. Adding the newsroom-subdomain Host header triggered the rewrite path. Worth flagging for the directive template — the curl-smoke step should explicitly call out the `Host` header requirement (NR-D5b-i exit report mentioned "newsroom Host" but didn't show the literal header).

**VERIFY 5 (visual smoke) — deferred.** Requires a signed-in admin session + a real org with `tier='unverified'` and verification records. Same posture as NR-D5b-i exit report §6 (end-to-end DNS recheck not smoke-tested for the same fixture-dependence reason). Coverage delivered via VERIFY 6 + F9 unit tests + typecheck on F2's discriminated-union state machine.

---

## 8. Verdict

**Pass.** Directive scope met as ratified: 8 NEW + 1 EDIT (post-IP-1 F1 SKIP); +1 route (102 → 103). All three IPs honoured. PRD §5.2 P5 copy verbatim in F4 (3 banner states), F5 (column headers, empty state), F6 (filter labels), F7 (KPI tile titles). F8 helpers are pure and deterministic (16/16 vitest pass, time injected for testability). F2 service-role posture matches NR-D5b-i F3 manage-surface convention (audit (c)-confirmed RLS permits both, but consistency wins). F10 placeholder closes the "click 'New pack' before NR-D6b" UX gap.

NR-D6a is ready for commit + push + founder ratification.

**Next directive in sequence:** NR-D6b (Pack creation flow + Details tab) — replaces F10 placeholder with the real form, lands the `draft`-state RPC, and wires slug generation. Tier-promotion logic (NR-D5b-i `recomputeTier`) is invoked by NR-D5b-ii but NOT by NR-D6a; NR-D6b's draft-create flow runs through `canCreatePack` (NR-D6a F8) which gates on tier already.

---

## 9. Carry-forward observations for future directives

1. **Supabase JS string-concat select breaks row-type inference.** Multi-line `.select('a, b, ' + 'c, d, ...')` collapses the row type to `GenericStringError[]` because Supabase's TypeScript inference walks string-literal types. Use `.select('*')` (when the row type covers all columns) or single-line literals with explicit columns. Inline-documented in F2.

2. **Newsroom subdomain curl smoke needs explicit Host header.** Both NR-D5b-i and NR-D6a runtime smokes require `Host: newsroom.frontfiles.localhost` (or any `newsroom.*`) to trigger the proxy rewrite from [src/proxy.ts](src/proxy.ts). Without it, main-domain `/newsroom/*` 404s by design (PRD §9.3 separation). Future directives' VERIFY blocks should call out the Host-header requirement explicitly rather than implying it via "newsroom Host".

3. **Dual-FK relationship ambiguity in PostgREST embeds.** When two tables have FKs in both directions (`newsroom_packs.embargo_id` ↔ `newsroom_embargoes.pack_id`), the auto-relationship resolution is ambiguous. Two batched queries + JS merge is the simpler, more testable, and more explicit alternative — F2 uses this pattern. NR-D6b / NR-D7 should adopt the same approach for any similar pairs.

4. **Display labels live in the domain library, not in components.** F5 (table) and F6 (filter dropdown) both import `LICENCE_CLASSES` from `src/lib/newsroom/licence-classes.ts`. Future surfaces with the same data should follow the same import — no per-component label maps, no enum-string hardcoding. Standing constraint already enforced this; documenting the pattern for NR-D6b to inherit when it adds the licence-class selector to the Pack editor.

5. **Server-component `searchParams` typing.** In Next 16, `searchParams` is `Promise<Record<string, string | string[] | undefined>>`. F2 wraps this with a `flattenSearchParams` helper that picks the first entry of array values — standard "scalar filter" semantic that avoids a typescript footgun when URLs are hand-edited (`?status=draft&status=scheduled`).
