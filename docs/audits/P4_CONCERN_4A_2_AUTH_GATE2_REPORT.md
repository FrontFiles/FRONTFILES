# P4 Concern 4A.2.AUTH — Gate 2 verification report

**Directive:** `docs/audits/P4_CONCERN_4A_2_AUTH_DIRECTIVE.md`
**Branch:** `feat/p4-auth-substrate`
**Date:** 2026-04-21
**Reporter:** Claude (sandbox)
**Gate:** 2 of 2 — pre-exit-report checkpoint (directive §APPROVAL GATES).

## Verdict

**Approve with one manual smoke pass.** All sandbox-verifiable criteria are green. Four ACs require a real Supabase dev project (AC3/AC4/AC5/AC9) and one requires a clean build host (AC12) — neither is runnable inside this sandbox. Runbook below; once it passes locally, the exit report (Prompt 7) is unblocked.

---

## AC matrix

| AC | Criterion | Source of truth | Status |
|---|---|---|---|
| AC1 | `getSupabaseBrowserClient()` exists, singleton | `src/lib/supabase/__tests__/browser.test.ts` | ✅ Verified — 4 cases green |
| AC2 | `subscribeToSession` helper covers 3 transitions; `useSession` thin wrapper | `src/hooks/__tests__/useSession.test.ts` | ✅ Verified — 4 cases green (helper is the unit under test; hook manually covered by AC3 smoke) |
| AC3 | `/signin` submits via `signInWithPassword` and persists a session | real Supabase | ⏳ **Manual smoke — see runbook §1** |
| AC4 | `/signin` shows generic error on failure | real Supabase | ⏳ **Manual smoke — see runbook §2** |
| AC5 | `POST /api/auth/ensure-actor-handle` returns 200 post-signin | real Supabase + curl | ⏳ **Manual smoke — see runbook §3** |
| AC6 | `ensure-actor-handle` idempotent (2nd call → `provisioned: false`) | `src/app/api/auth/ensure-actor-handle/__tests__/post.route.test.ts` | ✅ Verified — 23505 case green |
| AC7 | `ensure-actor-handle` is the only new user-facing route using service-role | `grep -rln "getSupabaseClient\b" src/app/ --include="route.ts"` | ✅ Verified — sole match: `src/app/api/auth/ensure-actor-handle/route.ts` |
| AC8 | `requireActor` source unchanged; header only | `git diff src/lib/auth/require-actor.ts` | ✅ Verified — `30 insertions(+), 0 deletions(-)`, entirely inside the JSDoc block |
| AC9 | OAuth buttons present but disabled | visual on `/signin` | ⏳ **Manual smoke — see runbook §4** |
| AC10 | No SSR auth code (`@supabase/ssr` and `next/headers` still 0 imports) | `grep -rn "@supabase/ssr\|from ['\"]next/headers['\"]" src/` | ✅ Verified — 0 hits |
| AC11 | Baseline + new tests pass; 1248+ green | `npx vitest run` | ✅ Verified — **1264 pass, 10 skipped** (baseline 1248 + 16 new: 4 browser, 4 useSession, 6 ensure-actor-handle, 2 signout) |
| AC12 | `npm run build` clean | local / CI | ⏳ **Local only — see runbook §5.** Sandbox blocks `.next` clear (EPERM on existing build artefacts from prior runs) |
| AC13 | No new lint errors beyond pre-existing 67 | `npx eslint . --quiet` | ✅ Verified — **67 errors, delta 0** |
| AC14 | `signout/route.ts` exists, returns 204 | `src/app/api/auth/signout/__tests__/post.route.test.ts` | ✅ Verified — 2 cases green (204 on flag-on, 404 on flag-off) |
| AC15 | `useSession` and `getSupabaseBrowserClient` are `'use client'`-marked | `head -3 …` | ✅ Verified — both L1 is `'use client'` |
| AC16 | File-set freeze (§D7) honored | `git status --short` | ✅ Verified — see §File-set audit below |

---

## File-set audit (§D7 freeze)

Every file listed in §D7 is touched; nothing outside it is.

| Planned (directive §D7) | Observed (`git status --short`) |
|---|---|
| `src/lib/supabase/browser.ts` (new) | `?? src/lib/supabase/` → `browser.ts` present |
| `src/lib/supabase/__tests__/browser.test.ts` (new) | `?? src/lib/supabase/` → `__tests__/browser.test.ts` present |
| `src/hooks/useSession.ts` (new) | `?? src/hooks/useSession.ts` |
| `src/hooks/__tests__/useSession.test.ts` (new) | `?? src/hooks/__tests__/` |
| `src/app/signin/page.tsx` (modify) | ` M src/app/signin/page.tsx` |
| `src/app/api/auth/ensure-actor-handle/route.ts` (new) | `?? src/app/api/auth/` |
| `src/app/api/auth/ensure-actor-handle/__tests__/post.route.test.ts` (new) | `?? src/app/api/auth/` |
| `src/app/api/auth/signout/route.ts` (new) | `?? src/app/api/auth/` |
| `src/app/api/auth/signout/__tests__/post.route.test.ts` (new) | `?? src/app/api/auth/` |
| `src/lib/auth/require-actor.ts` (header only) | ` M src/lib/auth/require-actor.ts` (30+ / 0-, all JSDoc) |
| `.env.example` (new per §AUDIT-1 S2) | present at repo root (concern-directive path `.env.example`) |
| `P4_CONCERN_4A_2_AUTH_DIRECTIVE.md` (revisions only) | `?? docs/audits/P4_CONCERN_4A_2_AUTH_DIRECTIVE.md` (this is the directive itself, authored by this concern) |
| `P4_CONCERN_4A_2_AUTH_EXIT_REPORT.md` (Prompt 7) | Not yet — blocked on this Gate 2 approval |

No out-of-freeze writes. `.claude/settings.local.json` is a sandbox-local artefact, not a repo change. `P4_CONCERN_4A_2_SCAFFOLD_DIRECTIVE.md` belongs to the next concern and is already staged per its own workflow.

---

## Sharpenings vs. the directive (flagged explicitly)

1. **`signout` route is flag-gated** even though §F6 described it as "just returns 204". Gate matches the surface-invisibility posture of every other auth-wired route: flag-off returns 404 `FEATURE_DISABLED`, flag-on returns 204. Rationale in the route header (`src/app/api/auth/signout/route.ts` lines 38-50). Test coverage added for both branches.
2. **No `request` parameter on `POST /api/auth/signout`.** The handler ignores headers and body by contract; omitting the param is the cleanest signal of that and avoids an `_request unused` lint warning. Documented in the file header.
3. **`.env.example` created fresh** (rather than "modified"). §AUDIT-1 S2 flagged that the file was absent; rebuilt from the Zod schema at `src/lib/env.ts` so it documents every `z.*` key the app validates at boot. `FFF_AUTH_WIRED` block explicitly calls out 4A.2.AUTH behavior.
4. **Test-file lint exception documented inline.** Two `SUPABASE_SERVICE_ROLE_KEY` literals in `src/app/api/auth/ensure-actor-handle/__tests__/post.route.test.ts` (the `scopeEnvVars` list at L33 and the `vi.stubEnv` call at L99) carry `eslint-disable-next-line no-restricted-syntax` comments with an explanation — the `src/app/**` ban exists to catch service-role leaks into the client bundle, and this is a test file driving the route under test. Same pattern as every other route test under `src/app/api/**/__tests__/`.

---

## Manual smoke runbook (for founder)

All steps assume:
- You are on branch `feat/p4-auth-substrate`, pulled fresh.
- A Supabase dev project is reachable (use the one seeded for P4; if none exists, provision a free-tier project and apply the migrations in `supabase/migrations/` in order).
- `.env.local` contains real values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and **`FFF_AUTH_WIRED=true`** (the last is the whole point of this smoke — without it every auth route 404s).
- `npm run dev` is running on `http://localhost:3000`.
- The Supabase dev project has at least one `auth.users` row you know the credentials for. If not: go to Supabase dashboard → Authentication → Add user → create one with email+password (do NOT use "magic link only").

### §1. AC3 — `/signin` signs you in and persists a session

1. Open a fresh incognito window at `http://localhost:3000/signin`.
2. Enter the test user's email + password, submit.
3. Expected:
   - Submit button reads "Signing in…" briefly, then navigates to `/vault/offers`.
   - Open devtools → Application → Local Storage → `http://localhost:3000`. Expect one `sb-*-auth-token` key with a non-empty JSON value containing `access_token`, `refresh_token`, `expires_at`.
   - Reload the page — you should still be authenticated (the session persists from localStorage on boot).
4. **Fail triggers:** redirect doesn't happen (→ likely `auth.signInWithPassword` rejected; check network tab for the POST to `https://<ref>.supabase.co/auth/v1/token?grant_type=password`); no localStorage key (→ browser client misconfiguration; re-check env vars).

### §2. AC4 — generic error on failure (no enumeration)

1. Back on `/signin`, submit with an email that doesn't exist in `auth.users`.
2. Expected: the red error block shows exactly `Invalid email or password.` — not "user not found", not "email does not exist".
3. Submit with a valid email and a wrong password.
4. Expected: same error string. The two failure modes must be indistinguishable.
5. **Fail trigger:** anything revealing which field failed (→ re-check `src/app/signin/page.tsx` `handleSubmit`; it should set the same hardcoded string for every non-null `authError`).

### §3. AC5 — `POST /api/auth/ensure-actor-handle` returns 200 after signin

1. Complete the signin flow in §1. Immediately after redirect to `/vault/offers`, open devtools → Network → filter `ensure-actor-handle`.
2. Expected: one `POST /api/auth/ensure-actor-handle` with status 200 and response body `{"data":{"provisioned": <true|false>}}`.
   - On a brand-new auth user this should be `true` (first provisioning).
   - On a re-signin for the same user, the same POST fires again; status 200, body `{"data":{"provisioned":false}}` (idempotent — AC6 sandbox-verified).
3. Database check: in Supabase SQL editor run
   ```sql
   select handle, auth_user_id, tombstoned_at
   from actor_handles
   where auth_user_id = '<your-test-user-auth-uuid>';
   ```
   Expect exactly one row, live (`tombstoned_at IS NULL`).
4. Curl path (optional — same result without the browser):
   ```bash
   ACCESS_TOKEN=<paste from localStorage>
   curl -sS -X POST http://localhost:3000/api/auth/ensure-actor-handle \
     -H "Authorization: Bearer $ACCESS_TOKEN" | jq
   ```
5. **Fail triggers:** 404 (→ `FFF_AUTH_WIRED` isn't `true` in dev); 401 (→ token expired, re-signin); 500 (→ service-role key wrong or migrations not applied — check `actor_handles` table exists).

### §4. AC9 — OAuth buttons visible but disabled

1. On `/signin`, scroll to the OAuth row.
2. Expected: Google and Apple buttons render with their icons and hover styles muted. Hovering shows a `Coming soon` tooltip. Clicking does nothing (no navigation, no network request).
3. **Fail trigger:** either button triggers a real OAuth redirect (→ re-check `disabled={true}` and `aria-disabled` on the `SocialButton` instances in `src/app/signin/page.tsx`).

### §5. AC12 — `npm run build` clean

Run locally (not in sandbox — `.next` ownership blocks the clear there):
```bash
rm -rf .next
npm run build
```
Expected:
- No TypeScript errors.
- No ESLint errors (build-time lint uses the same config as `npm run lint`).
- Route inventory includes `/api/auth/ensure-actor-handle`, `/api/auth/signout`, `/signin`.
- No "use server"/"use client" boundary warnings referencing the new files.

---

## If every smoke passes

Reply with "Gate 2 approved, proceed to Prompt 7" and I'll generate the exit report.

## If a smoke fails

Paste the failure symptom (console output, screenshot, network panel row) and I'll triage before moving to the exit report. The file-set freeze remains in force — fixes land only in §D7 files unless an R-revision is appended.
