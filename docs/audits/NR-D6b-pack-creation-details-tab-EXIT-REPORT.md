# NR-D6b Exit Report — Pack Creation Flow + Details Tab

**Directive:** `docs/public-newsroom/directives/NR-D6b-pack-creation-details-tab.md`
**Branch:** `feat/newsroom-phase-nr-2`
**Predecessor:** `95c5f7d` (NR-D6a — distributor dashboard P5)
**Date:** 2026-04-25
**Verdict (self-assessment):** Pass.

---

## 1. Summary

Locked scope after IP-1 split: **8 NEW + 1 EDIT = 9 deliverables** (was 7 NEW + 1 EDIT in directive header — F7 split into F7a + F7b per IP-1). Total source lines added ≈ 1,643 (counted across 9 source files).

| F# | File | Lines | Action | Role |
|---|---|---|---|---|
| F1 | `src/app/newsroom/[orgSlug]/manage/packs/new/page.tsx` | 90 | EDIT (replace placeholder) | Server-component shell — tier gate + create-mode editor |
| F2 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/page.tsx` | 115 | NEW | Server-component shell — fetch existing draft + tier gate + status guard |
| F3 | `…/[packSlug]/_components/pack-editor-shell.tsx` | 112 | NEW | Top bar + tab nav (Details active; Assets/Embargo disabled with tooltips) |
| F4 | `…/[packSlug]/_components/details-form.tsx` | 382 | NEW | `'use client'` form: 6 fields + slug auto-derive + Bearer fetch + redirect/refresh |
| F5 | `src/app/api/newsroom/orgs/[orgSlug]/packs/route.ts` | 287 | NEW | POST — auth + admin gate + tier gate + zod + slug uniqueness + service-role INSERT |
| F6 | `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/route.ts` | 306 | NEW | PATCH — same auth shape + status guard + slug-rename uniqueness + service-role UPDATE |
| **F7a** | **`src/lib/newsroom/pack-form-constants.ts`** | 81 | **NEW (client-safe)** | Constants + SLUG_FORMAT regex + slugify (no `'server-only'`) |
| **F7b** | **`src/lib/newsroom/pack-form.ts`** | 88 | **NEW (`'server-only'`)** | zod schemas (createPackSchema, updatePackSchema) |
| F8 | `src/lib/newsroom/__tests__/pack-form.test.ts` | 182 | NEW | 21 vitest cases (slugify + createPackSchema + updatePackSchema) |

**Audit findings that shaped the implementation** (per §3 of the directive; all five IPs ratified by founder pre-composition):

| Audit | Resolution |
|---|---|
| **(a) Placeholder at `/manage/packs/new`** | Confirmed: 29-line NR-D6a F10 placeholder. F1 REPLACE in place. |
| **(b) `newsroom_packs` INSERT/UPDATE RLS** | `newsroom_packs_insert_editor` (line 617) + `newsroom_packs_update_editor` (line 622) both gate via `is_newsroom_editor_or_admin(company_id)` — RLS permits admin + editor. Service-role bypasses. |
| **(c) Schema row type + enums** | `NewsroomPackRow`, `NewsroomPackStatus`, `NewsroomLicenceClass` already exported from NR-D1. Imports clean. |
| **(d) Slug constraints** | UNIQUE `(company_id, slug)` at [migration:304](supabase/migrations/20260425000001_newsroom_schema_foundation.sql:304); CHECK regex at line 309 — F7a SLUG_FORMAT mirrors exactly. |
| **(e) Bearer extraction precedent** | 10 routes use inline `extractBearerToken`. F5 + F6 inline the same shape (no central helper). |
| **(f) AdminGate inheritance** | [`/manage/layout.tsx`](src/app/newsroom/[orgSlug]/manage/layout.tsx) wraps via `<AdminGate>`. `/manage/packs/**` inherits. ✓ |
| **(g–j) Locked behaviours** | Client redirect, no server actions, tab placeholders with tooltips, disabled Publish CTA — all locked, no IPs. |
| **(extra) `is_newsroom_editor_or_admin` SQL function** | Defined at [migration:524](supabase/migrations/20260425000001_newsroom_schema_foundation.sql:524) with arg `p_company_id`. Internally checks `auth.uid()`; service-role's `auth.uid()` is `NULL`. **Driving IP-3:** RPC approach is broken under service-role; use direct membership query. |
| **(extra) `buyer_company_role` enum** | `'admin' | 'content_commit_holder' | 'editor'` ([migration:142](supabase/migrations/20260408230001_assignment_engine_enums.sql:142)). RLS policy permits editor; existing routes + AdminGate use admin-only. **Driving IP-3:** match precedent (admin-only at API). |
| **(extra) Browser client path** | `@/lib/supabase/browser` (NOT `browser-client`). **Driving IP-2.** |

---

## 2. Audit findings — IPs surfaced and resolved

All five IPs were ratified pre-composition before any file was written. None diverged in implementation.

| IP | Verdict | Implementation |
|---|---|---|
| **IP-1** Split F7 into client-safe constants + server-only zod | APPROVE | F7a (`pack-form-constants.ts`, no marker, exports values) + F7b (`pack-form.ts`, `'server-only'`, exports zod). F4 imports values from F7a; F5/F6 import zod from F7b; F8 tests both. Final scope 8 NEW + 1 EDIT = 9 deliverables. |
| **IP-2** Browser client import path | APPROVE | F4 uses `import { getSupabaseBrowserClient } from '@/lib/supabase/browser'`. |
| **IP-3** Direct membership query, admin-only | APPROVE | F5 + F6 inline the same `company_memberships`-table query as NR-D5b-i routes. `role !== 'admin' \|\| status !== 'active'` → 403 forbidden. RLS policy is the floor (broader); the route is the policy enforcer (admin-only). |
| **IP-4** Ship full 5-licence selector | APPROVE | F4 renders all 5 licence radios. PRD's "Coming soon" hedge state defers to NR-D21. |
| **IP-5** Inline auth helpers | APPROVE | F5 + F6 inline `extractBearerToken` per existing precedent. No helper extraction in this directive. |

**No mid-session IPs surfaced.** Composition followed the ratified plan exactly. One small directive-vs-codebase drift surfaced silently (canonical-URL pattern in F4's slug helper text — see §3.1 below) and was fixed in composition.

---

## 3. Decisions that diverged

Three small directive-vs-implementation reconciliations, all benign:

1. **F4 slug helper text uses `newsroom.frontfiles.com/{orgSlug}/{slug}` (no `/p/` segment).** Directive's F4 spec line 234 had `newsroom.frontfiles.com/{orgSlug}/p/{slug}`. The actual canonical URL pattern from [`src/lib/newsroom/canonical-url.ts:21`](src/lib/newsroom/canonical-url.ts:21) is `${NEWSROOM_BASE_URL}/${orgSlug}/${packSlug}` — no `/p/` separator. Build Charter §1's scope sentence (`newsroom.frontfiles.com/{org-slug}/{pack-slug}`) agrees. Codebase is the source of truth on URL shape; F4 helper text matches the canonical URL.

2. **F5 + F6 use direct `company_memberships`-table query, not the `is_newsroom_editor_or_admin` RPC.** Directive's F5 pseudo-code suggested `client.rpc('is_newsroom_editor_or_admin', { company_id_arg: company.id })`. Two issues, both ratified under IP-3: (a) the SQL function arg is `p_company_id`, not `company_id_arg`; (b) the function checks `auth.uid()` internally, but service-role's `auth.uid()` is `NULL`, so the RPC always returns `false`. Direct membership query mirrors all existing newsroom API routes and avoids the broken-as-written RPC pattern.

3. **F4 saveIndicator state machine has 4 values (`idle | unsaved | saving | saved`), not 3 as the directive's `'idle' | 'saving' | 'saved'` triple suggested.** The directive's §F4 prose mentions "Unsaved changes while the form is dirty" and "Saved after successful PATCH" — implying 4 states. The 4-state machine is the natural fit. F3 takes `'idle' | 'saving' | 'saved'` for the static initial top-bar render only; F4 manages its own live indicator with the 4-state model.

---

## 4. Open questions for founder

- **Visual smoke (VERIFY 7) deferred.** Requires a signed-in admin session + a real verified-source company in fixtures. Same posture as NR-D5b-i / NR-D6a. Coverage delivered via VERIFY 6 (curl smoke confirms server response shape) + F8 unit tests (21/21 pass). The same fixture-seed strategy logged as an open question for NR-D6a still applies — would unblock both NR-D6a and NR-D6b visual smoke.

- **PRD §5.1 P6 "Coming soon" hedge state for FF-* classes (IP-4 follow-on).** When BUILD_CHARTER §3.5's launch hedge gets activated at NR-D21, FF-* classes (`press_release_verbatim`, `editorial_use_only`, `promotional_use`) need to render with a "Coming soon" inline indicator and be selection-disabled. NR-D6b ships them as full citizens. NR-D21 will need to revisit F4's licence radio group + F7b's zod enum (which currently allows all 5).

- **NR-D6b adds no `/manage/packs/[slug]/page.tsx` placeholder for missing packs.** Same defensive-placeholder gap NR-D6a flagged for the dashboard's title links. With F2 now landed, missing packs render `notFound()` → Next.js default 404 page. Worth confirming whether a custom 404 with "Back to dashboard" link is desired in v1.1; not blocking.

- **Editor role at API layer (IP-3 follow-on).** RLS permits role IN ('admin', 'editor'); F5/F6 enforce admin-only at the route. AdminGate also filters editors out of the UI surface. v1.1 may want to widen one or both — would unblock the existing `'editor'` enum value and align UI/API/RLS into a single posture.

- **F4 slug auto-derive heuristic.** In create mode, slug auto-derives from title until the user manually edits the slug field. Once flipped, it never re-engages even if the user clears the slug. Worth confirming: if the user clears the slug (back to empty), should auto-derive re-engage? Current behaviour: no — manual edit is sticky. Conservative; v1.1 can refine if user-test data shows confusion.

---

## 5. Test results

```
$ bunx vitest run src/lib/newsroom/__tests__/pack-form.test.ts
 RUN  v4.1.5 /Users/jnmartins/dev/frontfiles
 Test Files  1 passed (1)
      Tests  21 passed (21)
   Duration  289ms
```

21/21 passed. Breakdown:

| Group | Count | Notes |
|---|---|---|
| `slugify` | 7 | simple, NFKD/accents, whitespace collapse, all-symbols fallback, 100→60 truncate, idempotent, property-check across 9 inputs |
| `createPackSchema` | 10 | valid, missing title, empty title, missing description, invalid licence, slug-too-long, bad slug format, leading hyphen, null subtitle, all-5-licences |
| `updatePackSchema` | 4 | empty rejected, single-field, invalid field rejected, multi-field |
| **Total** | **21** | (directive estimated 12–15; extras are defensive but consistent with NR-D5b-ii / NR-D6a density) |

Full newsroom suite (VERIFY 3): **162/162 across 10 files** — NR-D5b-i (verification: 25), NR-D6a (dashboard: 16), NR-D4 (licence-classes + embed-snippet + receipt-terms: 100), and NR-D6b (pack-form: 21) all green.

---

## 6. Build + typecheck

| Step | Command | Result |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 (`tsc --noEmit` silent) |
| Vitest (pack-form) | `bunx vitest run src/lib/newsroom/__tests__/pack-form.test.ts` | 21/21 pass |
| Vitest (full newsroom) | `bunx vitest run src/lib/newsroom/__tests__` | 162/162 across 10 files |
| Build | `bun run build` | exit 0; **route count 103 → 106 (+3)** — `/api/newsroom/orgs/[orgSlug]/packs` (POST), `/api/newsroom/orgs/[orgSlug]/packs/[packSlug]` (PATCH), `/newsroom/[orgSlug]/manage/packs/[packSlug]` (page) |
| Scope diff | `git status --porcelain` | 1 modified (F1) + 8 untracked (F2–F8 split into 8 paths) + directive file; zero strays |

**Route count delta confirmed:** baseline 103 (NR-D6a close) → 106 with the 3 new routes. All visible in the build output route table.

---

## 7. Runtime smoke

Two-phase smoke per the standing carry-forward (dev-server bounce before curl smoke after `bun run build`).

**VERIFY 6 — three new routes (no auth):**

```
$ curl -s -H "Host: newsroom.frontfiles.localhost" \
    http://localhost:3000/some-test-org/manage/packs/some-pack
HTTP 200 — body 31 230 bytes; AdminGate "Loading…" placeholder present

$ curl -s -X POST -H "Content-Type: application/json" -d '{}' \
    http://localhost:3000/api/newsroom/orgs/some-test-org/packs
HTTP 401 {"ok":false,"reason":"unauthenticated"}

$ curl -s -X PATCH -H "Content-Type: application/json" -d '{}' \
    http://localhost:3000/api/newsroom/orgs/some-test-org/packs/any-slug
HTTP 401 {"ok":false,"reason":"unauthenticated"}
```

All three new routes fail-closed at the auth boundary. The page route returns 200 with the AdminGate `Loading…` placeholder (auth gate fires client-side; same pattern as every NR-D5b/NR-D6 page).

**End-to-end create → redirect → edit smoke** was NOT executed — would require a signed-in admin Bearer token + a real verified-source company. Same fixture-dependence as VERIFY 5 in prior directives. Coverage delivered via:
- F8 unit tests for slugify + zod (21/21)
- typecheck on F4's discriminated state machine + F2's status guard
- VERIFY 6 confirms server response shape

---

## 8. Verdict

**Pass.** Directive scope met as ratified: 8 NEW + 1 EDIT (post-IP-1 F7 split); +3 routes (103 → 106). All five IPs honoured. PRD §5.1 P6 copy verbatim in F4 (6 field labels + helper text). F5/F6 admin gate uses direct membership query mirroring existing route precedent (IP-3); RPC approach correctly skipped as it's broken under service-role. F4 client form uses Bearer fetch via `getSupabaseBrowserClient` (IP-2 corrected path). F7a/F7b split keeps client/server module-graph boundaries clean. Slug auto-derivation works in create mode and respects manual edits. Status guard in F2 + F6 prevents non-draft edits.

NR-D6b is ready for commit + push + founder ratification.

**Next directive in sequence:** NR-D7 (Asset upload + scanning pipeline + rendition generation; per directive §10, candidate for further split). NR-D7 will populate the Assets tab placeholder shipped here in F3.

---

## 9. Carry-forward observations for NR-D7

1. **`'server-only'` + client-component value imports → split into two files.** IP-1's F7a/F7b split is the reference pattern. NR-D7's asset-upload client form will likely need similar constants (max file size, accepted MIME types) shared with server-side validators. Pre-empt the split rather than waiting for the typecheck error.

2. **`is_newsroom_editor_or_admin` RPC is broken under service-role posture.** The function checks `auth.uid()`, which is `NULL` when called via service-role. NR-D7's asset-upload route should follow F5/F6's pattern: direct `company_memberships` query, role check at the application layer. Document this as a standing pattern; future RPCs that read `auth.uid()` should be flagged as user-JWT-only at definition time.

3. **Newsroom subdomain Host header for curl smoke.** Same as NR-D6a's carry-forward — `Host: newsroom.frontfiles.localhost` is required for the proxy rewrite. Worth folding into the directive template's VERIFY block as an explicit step.

4. **Canonical URL pattern is `/{orgSlug}/{packSlug}` — no `/p/` segment.** [`canonical-url.ts:21`](src/lib/newsroom/canonical-url.ts:21) is the source of truth. Future surfaces that display Pack URLs (embed snippet, receipt body, etc.) should derive from this helper, not hardcode the URL shape.

5. **Pack save indicator state machine — 4 states (`idle | unsaved | saving | saved`).** F4's pattern. NR-D7's asset-upload form will have its own progress states; consider unifying via a shared `useFormState` hook in v1.1 if more than two surfaces need it.

6. **Slug auto-derive: manual edit is sticky (no re-engage on clear).** F4's heuristic. If product wants different behaviour, lift this into a shared hook before NR-D7 adds another auto-derived field (e.g., asset filename → caption?).
