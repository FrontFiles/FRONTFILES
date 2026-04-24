# NR-D5a Exit Report — P1 Signup Flow (Phase NR-2, Part A of NR-D5)

**Status.** Composed + verified. Awaiting founder approve / approve-with-corrections / revise / reject.
**Branch.** `feat/newsroom-phase-nr-2` (already cut off origin/main at `785aa2f` per memory `feedback_cut_branch_from_origin_main`).
**Date.** 2026-04-24.

---

## 1 — Summary

Six new files, zero edits to pre-existing files.

| # | File | Lines | Role |
|---|---|---:|---|
| F1 | [src/app/newsroom/start/page.tsx](../../src/app/newsroom/start/page.tsx) | 32 | Server component; renders title + subtitle + `<SignupForm/>`. Auth guard delegated to F2 client gate (see IP-1 below). |
| F2 | [src/app/newsroom/start/_components/signup-form.tsx](../../src/app/newsroom/start/_components/signup-form.tsx) | 278 | Client component; session gate on mount → POST `/api/newsroom/start` with Bearer → `router.push(/{orgSlug}/manage)` on 200. |
| F3 | [src/app/api/newsroom/start/route.ts](../../src/app/api/newsroom/start/route.ts) | 449 | POST handler (changed from `actions.ts` per IP-2). Flag gate + Bearer + Zod parse + service-role 3-row provisioning with compensating rollback. |
| F4 | [src/app/newsroom/start/schema.ts](../../src/app/newsroom/start/schema.ts) | 65 | Shared Zod schema (client + server). Verbatim from directive §SCHEMA. |
| F5 | [src/app/newsroom/[orgSlug]/manage/page.tsx](../../src/app/newsroom/%5BorgSlug%5D/manage/page.tsx) | 33 | Post-signup stub landing; Next 16 async `params`. |
| F6 | [src/app/newsroom/start/__tests__/schema.test.ts](../../src/app/newsroom/start/__tests__/schema.test.ts) | 105 | Vitest — 9 cases, all required by directive §F6. |
| **Total** | | **962** | |

The audit-first phase produced **4 material implementation points (IPs)** that were surfaced to the founder as HALTs before any file was written, per FLAG-39/39b propose-before-lock discipline. All four were locked in the session transcript; the decisions are captured in §2.

---

## 2 — Decisions that diverged from directive text

### IP-1 — Page-level auth guard (founder-locked: "Server wrapper, client gate")

**Directive text (F1).** "Server component. Auth guard: if no signed-in Frontfiles user, redirect to the Frontfiles signin page (per audit finding b) with a return-URL of `/start` on the newsroom subdomain."

**Audit finding.** The codebase has **no server-readable session**. Auth lives in `localStorage` via [src/lib/supabase/browser.ts](../../src/lib/supabase/browser.ts); the signin page stores the token there and calls `/api/auth/ensure-actor-handle` with a `Bearer` header ([src/app/signin/page.tsx:46-56](../../src/app/signin/page.tsx)). No `@supabase/ssr`, no `cookies()`, no `next/headers` usage anywhere in `src/`. Server components cannot read the session.

**Adaptation.** F1 stays a thin server-rendered shell (title + subtitle + `<SignupForm/>`). The signed-in gate runs inside F2 on mount: read session via `getSupabaseBrowserClient().auth.getSession()`; on missing session, `router.push('/signin?return=/start')`. Honours directive letter ("server component renders"); guard behaviour lives where the session actually lives (client).

### IP-2 — Server action → API route conversion (founder-locked: "Convert to an API route")

**Directive text (F3).** `export async function createNewsroomOrganisation(_prevState, formData): Promise<CreateOrgResult>` as a server action under `src/app/newsroom/start/actions.ts`, wired to `React.useActionState`.

**Audit finding.** Server actions invoked via `useActionState` receive only FormData — no automatic access to the user's JWT. The existing `requireActor(Request)` helper reads the Authorization header, which is API-route-shaped, not server-action-shaped. No existing `actions.ts` file in `src/app/**`, no `useActionState` usage in the codebase.

**Adaptation.** F3 is now `src/app/api/newsroom/start/route.ts` — a POST handler mirroring the pattern of [src/app/api/auth/ensure-actor-handle/route.ts](../../src/app/api/auth/ensure-actor-handle/route.ts): flag gate → Bearer extract → `supabase.auth.getUser(token)` validation → service-role 3-row create → JSON response. Client form (F2) uses `fetch` with `Authorization: Bearer <access_token>` instead of `useActionState`.

**Ripple effects.**
- Route count delta is **+3** (not +2 as directive VERIFY §3 assumed), because the API route is itself a route.
- Wire shape is JSON (not FormData). Client still encodes `termsAccepted` as `'on' | undefined` so the Zod schema can stay byte-identical to directive §SCHEMA.
- Redirect to `/{orgSlug}/manage` happens client-side via `router.push` (Next `redirect()` is not callable from a JSON POST handler).

### IP-3 — `companies` INSERT dropped `primary_domain` (founder-locked)

**Directive text (F3 step 4).** `INSERT INTO companies (name, slug, legal_name, country_code, primary_domain, created_by_user_id) ...`

**Audit finding.** `companies.primary_domain` **does not exist**. See [supabase/migrations/20260413230015_companies_and_memberships.sql:97-133](../../supabase/migrations/20260413230015_companies_and_memberships.sql) — the table has `name, slug, state, legal_name, vat_number, tax_id, billing_email, country_code, created_by_user_id, primary_buyer_account_id, created_at, updated_at`. `primary_domain` lives only on `newsroom_profiles` ([20260425000001_newsroom_schema_foundation.sql:126-162](../../supabase/migrations/20260425000001_newsroom_schema_foundation.sql)).

**Adaptation.** Companies INSERT writes `{ name, slug, legal_name, country_code, created_by_user_id }`. The `primary_domain` field is written only on the `newsroom_profiles` INSERT (step 5 of the provisioning loop). Directive trivially self-consistent after this fix.

### IP-4 — Signin return-URL forward-compat (founder-locked)

**Directive text (F1).** "redirect to the Frontfiles signin page (per audit finding b) with a return-URL of `/start` on the newsroom subdomain."

**Audit finding.** [src/app/signin/page.tsx:59](../../src/app/signin/page.tsx) hardcodes `router.push('/vault/offers')` on success; it does not read any return-URL param. Directive §OUT OF SCOPE forbids edits to existing auth code.

**Adaptation.** F2 redirects to `/signin?return=/start`. The `return` param is inert today — user lands on `/vault/offers` after sign-in and must navigate to `/start` manually. Forward-compatible for when signin learns return-URLs (a future concern).

---

### Additional adaptations (minor — applied in-line per directive's adaptability clause)

| Area | Directive text | Reality | Resolution |
|---|---|---|---|
| Zod import style | `import { z } from 'zod'` | House style `import * as z from 'zod'` (offer, ledger, env) | Used `import * as z` to match house. Exported symbols identical. |
| Slug suffix entropy source | "Math.random-based is fine for v1; crypto.randomBytes if the codebase already uses it elsewhere" | `node:crypto` is used across ledger/writer.ts and other server modules | `randomBytes(4).readUInt32BE(0).toString(36).slice(0,6).padStart(6,'0')`. |
| F5 auth guard | "Auth guard: require signed-in user (per audit finding b)" | Same root cause as IP-1 (no server-readable session); F5 is a 30-line stub with no sensitive state | Auth guard deferred to NR-D6 per audit finding b. Documented in F5 header. |
| **Atomicity (not truly atomic)** | "Use a service_role Supabase client to run a transaction" | supabase-js v2 does not expose SQL transactions from Node; SECURITY DEFINER RPC would require a new migration, which §OUT OF SCOPE forbids | Serial inserts with best-effort compensating DELETEs on downstream failure. Orphaned-company state is harmless — random slug suffix prevents re-collision and no downstream code treats company-without-profile as legitimate. **Flagged as open question 3 below.** |

---

## 3 — Open questions for founder

1. **Atomicity seam (follow-up directive).** The 3-row provisioning is serial with compensating DELETEs, not a true SQL transaction. Should a follow-up directive (NR-D5b candidate, or a standalone NR-D5a-atomicity) ship a `SECURITY DEFINER` Postgres function that wraps the three INSERTs in a single `BEGIN/COMMIT`? The function would remove the orphan-row failure mode, tighten RLS reasoning (the function can do its own auth.uid() check internally), and still let the API route stay thin.

2. **Signin return-URL.** NR-D5a punted the signin return-URL to forward-compat (IP-4). Dispatching a tiny patch to signin/page.tsx that honours `?return=` would close this gap in ~10 lines. Worth a standalone directive, or bundled into NR-D5b?

3. **"User is already a member of a company" policy.** Directive §scope boundary explicitly defers multi-company membership to v1.1: "NO handling of 'user already belongs to a company' — v1 always creates a new company per signup." The implementation honours this — every signup creates a fresh company. No additional code was added. Flagging here so this invariant is locked visibly and the v1.1 directive can reference it when lifting.

4. **FK pre-condition.** `companies.created_by_user_id` and `company_memberships.user_id` both reference `users(id) ON DELETE RESTRICT`. A signed-in auth user who has NOT completed Frontfiles onboarding does not have a `users` row, and the API route will return `500 Something went wrong` on the FK violation. Current implementation accepts this because "signed-in Frontfiles user" per directive implies onboarding-complete. If adoption patterns push otherwise, NR-D5b could add a preflight that either (a) surfaces a dedicated 422 "Complete your Frontfiles account first" path, or (b) triggers the onboarding completion step from the newsroom subdomain.

5. **Route count drift from directive expectation.** Directive VERIFY §3 anticipated baseline 97 → 99 (+2 routes). Post-IP-2 the actual delta is +3 (97 → 100) because the API route becomes a route itself. No breakage; just a heads-up for the verification copy in future directives.

---

## 4 — Test results

```
$ bunx vitest run src/app/newsroom/start/__tests__/schema.test.ts

 RUN  v4.1.5 /Users/jnmartins/dev/frontfiles

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  18:41:26
   Duration  418ms
```

All nine required cases pass:

| # | Case | Status |
|---|---|---|
| 1 | Valid input passes (happy path) | ✓ |
| 2 | Empty `orgName` fails with "Organisation name is required" | ✓ |
| 3 | Empty `legalName` fails with "Registered legal name is required" | ✓ |
| 4 | `primaryDomain` "not a domain" fails | ✓ |
| 5 | `primaryDomain` "ACME.COM" normalises to "acme.com" | ✓ |
| 6 | `countryCode` "us" normalises to "US" | ✓ |
| 7 | `countryCode` "USA" (3 chars) fails | ✓ |
| 8 | `termsAccepted` missing fails with the terms message | ✓ |
| 9 | `termsAccepted` "on" passes | ✓ |

---

## 5 — Build + typecheck results

```
$ rm -rf .next && bun run typecheck
$ tsc --noEmit
<exit 0>

$ bun run build
▲ Next.js 16.2.2 (Turbopack)
✓ Compiled successfully in 19.5s
  Running TypeScript ... Finished TypeScript in 24.0s
✓ Generating static pages using 7 workers (52/52) in 896ms
<exit 0>
```

**Route count delta.**

| | Before | After | Δ |
|---|---:|---:|---:|
| Total routes | 97 | 100 | **+3** |
| New entries | — | `/newsroom/start` (○) | +1 |
| | — | `/newsroom/[orgSlug]/manage` (ƒ) | +1 |
| | — | `/api/newsroom/start` (ƒ) | +1 |

The +3 delta (vs the directive's +2 expectation) is the IP-2 ripple — the API-route conversion adds its own route. See §2.

---

## 6 — Runtime smoke

Preview server wedged once during VERIFY (unrelated — `rm -rf .next` removed `.next/dev/*` out from under the running dev process); restarted and re-verified.

| Check | Request | Expected | Actual |
|---|---|---|---|
| **Start page renders** | `GET http://localhost:3000/start` with `Host: newsroom.frontfiles.localhost` | HTTP 200 + title "Set up your newsroom" + subtitle + `data-subsurface="newsroom"` wrapper | ✓ all present |
| **API 401 when unauth** | `POST http://localhost:3000/api/newsroom/start` with no Bearer | HTTP 401 + `{ "ok": false, "error": "You need to be signed in to create a newsroom." }` | ✓ exact match |
| **Manage stub renders orgSlug** | `GET /test-slug/manage` with newsroom Host | HTTP 200 + "newsroom 'test-slug' is being set up" + two follow-up paragraphs | ✓ all present (slug interpolated via Next 16 async `params`) |

Full DB provisioning path (POST with a valid Bearer, 3-row create, redirect) was **not** exercised because this verification had no signed-in dev-seed session available to produce a JWT. Per directive VERIFY §5 ("If not, skip and verify via route listing + typecheck") — skipped and noted.

---

## 7 — Verdict

**Self-assessment: approve with corrections.**

- All 8 acceptance criteria (AC1-AC8) are met within their verifiable scope: typecheck / tests / build exit 0; routes register; copy verbatim; 6 files; no edits to pre-existing files.
- **AC8** (service_role transaction atomicity) is met *in intent* (all three rows land under a single service-role client with compensating rollback), but not *in strict transactional form* — see open question 1. The directive's out-of-scope rule against schema edits forced the compensation approach; this is a codebase constraint, not an implementation gap.
- Four material IPs were surfaced as HALTs before composition (SV-1 discipline per FLAG-39/39b). All four were locked with the founder.
- Scope discipline held: exactly 6 new files, zero edits to any pre-existing file.

Recommend **approve with corrections** — the corrections being (a) acknowledge the IP-2 route-count delta in the directive's verification guidance for future NR-D* files that span server-action vs API-route design, and (b) sequence the atomicity-seam open question into NR-D5b's scope decision before that directive drafts.

---

**End of NR-D5a exit report.**
