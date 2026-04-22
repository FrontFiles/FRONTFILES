# P4 Concern 4A.2.AUTH — Browser auth substrate + actor_handles provisioning

**Status:** DRAFT — pending founder approval before execution
**Branch:** to be created from `main` post-B2-merge: `feat/p4-auth-substrate`
**Predecessor:** P4 Concern 4A.2 Part B2 (Stripe accept surface) — closed
**Successor (paused):** P4 Concern 4A.2.SCAFFOLD (`/vault/offers` scaffold), waiting on this concern to land

---

## §CONTEXT

The P4 server contract (concerns 3, 4A.1, 4A.2.B1, 4A.2.B2) ships behind two flags (`FFF_AUTH_WIRED`, `ECONOMIC_V1_UI`), both off in production. Server-side validates Bearer tokens via `requireActor()` → `auth.getUser(token)` → `actor_handles` lookup. Onboarding (Phase 0) already creates real Supabase auth users and Frontfiles `users` rows whose primary key equals `auth.users.id`.

**The gap:** the browser has no way to *produce* a Bearer token. Specifically:

1. **No browser Supabase client.** `@supabase/supabase-js` is installed but only used server-side (`src/lib/db/client.ts`). No `'use client'` instantiation anywhere.
2. **`/signin` is a declared visual mockup.** Submit handler is `router.push('/onboarding')`. No `signInWithPassword`, no session created.
3. **44 client pages contain zero `fetch(` calls.** No client component reads any session, anywhere.
4. **`actor_handles` rows are not provisioned during onboarding.** Phase 0 writes `users` (keyed on `auth.users.id`) but does not insert into `actor_handles`. A signed-in user therefore fails `requireActor()` with `ACTOR_NOT_FOUND` even with a valid JWT.

This concern closes both halves: client-side session production AND `actor_handles` provisioning. Together they make the B2 server contract reachable from the browser. Without both, the `/vault/offers` scaffold cannot read real data.

---

## §SCOPE

In scope:

1. **Browser Supabase client** — a singleton `'use client'` factory at `src/lib/supabase/browser.ts` returning a `SupabaseClient` configured for browser use (anon key, `persistSession: true`, `autoRefreshToken: true`).
2. **Real `/signin` flow** — replace the mock submit with `supabase.auth.signInWithPassword({ email, password })`. Surface error states. Keep current visual layout untouched (no design churn).
3. **Sign-out path** — a single `signOut()` call wired into a discoverable place (header dropdown if one exists; otherwise add a minimal `/signout` route that calls and redirects). Decision deferred to §OPEN-Q3.
4. **`useSession()` hook** — at `src/hooks/useSession.ts`, returns `{ session, accessToken, status: 'loading' | 'authenticated' | 'unauthenticated' }`. Consumer-friendly shape; abstracts the Supabase session shape.
5. **`actor_handles` provisioning** — a single Server Action `ensureActorHandle(authUserId)` at `src/lib/auth/ensure-actor-handle.ts` that idempotently inserts the row if absent (`ON CONFLICT (auth_user_id) DO NOTHING`). Called once after a successful sign-in (and once after Phase 0 onboarding completion as a safety net for users whose `actor_handles` row was missed).
6. **Flag posture changes** — keep `FFF_AUTH_WIRED=false` as production default. Document the dev/staging flip clearly. Do not flip in production env files in this concern.
7. **Tests** — Vitest coverage for `ensureActorHandle` (4 cases: idempotent insert, race-safe re-call, real vs. mock mode, malformed input rejection) and a lightweight smoke test for `useSession` (3 cases: loading → authenticated → unauthenticated). The mock `/signin` is not unit-tested (UI smoke is enough; full E2E is out of scope).

Out of scope (each is its own follow-up concern):

- **OAuth providers.** The Google/Apple/LinkedIn/Facebook buttons remain visual stubs. Wiring `signInWithOAuth` is a separate concern with its own callback-route work.
- **Magic-link / passwordless.** Password is what the existing UI collects; magic link is a different UX flow.
- **Password reset / forgot-password.** Currently no UI for it; deferred.
- **Email verification UX polish.** Onboarding already has `needsEmailVerification` plumbing (mock mode); real mode trusts Supabase's project-level email setting. No new UI.
- **Multi-factor auth, "remember me," device management, session listing.**
- **SSR auth / cookie-based session.** Explicitly out of scope (R2 of the scaffold directive). All auth stays browser-side; API routes consume Bearer.
- **`/signin` visual redesign.** Current layout is preserved.
- **Production flag flip.** This concern enables auth in dev/staging only. Production cutover is its own change.

---

## §NON-SCOPE — explicit denials

| Request | Refusal reason |
|---|---|
| "Wire the Google/Apple OAuth buttons too" | OAuth is a separate concern (callback routes, redirect URL config, provider setup). |
| "Add password-strength meter" | UI polish; not blocking auth. Add in a UX pass. |
| "Migrate to `@supabase/ssr` cookie-based sessions" | R2 explicit denial. Bearer-only stays the model. |
| "Add a session list / device management page" | Account-management surface is its own concern. |
| "Encrypt the access token in localStorage" | Default Supabase persistence is acceptable for this concern; hardening is a security concern. |
| "Wire email verification UX in `/signin`" | Onboarding owns verification; signin assumes verified. |
| "Auto-link existing `users` row to a new auth user via email matching" | Out of scope — onboarding already handles this idempotently. |

---

## §REVISIONS

R1 (initial draft, 2026-04-21) — Concern carved as α-prereq per scaffold directive R2. Scope: browser Supabase client, real `/signin`, `useSession`, `actor_handles` auto-provisioning. Auth provider strategy: email/password (matches existing UI fields). OAuth deferred.

R2 (2026-04-21, post Prompt 1) — Three sharpenings folded in from §AUDIT-1: (S1) F4 uses partial-index-aware `ON CONFLICT (auth_user_id) WHERE auth_user_id IS NOT NULL DO NOTHING RETURNING handle`; (S2) F8 creates `.env.example` from scratch (~30 LoC) instead of editing a non-existent file — adds onboarding value beyond this concern; (S3) F4 route header documents the re-signup tombstone semantic per §8.4 cascade design. AC8 unchanged. Total LoC budget revised from ~720 to ~750.

R3 (2026-04-21, mid Prompt 2) — Test-stack reality: repo has zero `.test.tsx` files, vitest env is `node`, and `@testing-library/react` + `jsdom` are not installed. Adding RTL + jsdom mid-concern would violate §D9 ("no new dependencies") and inflate scope. Refactor: extract the session subscription state machine as a pure colocated helper `subscribeToSession(client, onState)` exported from `src/hooks/useSession.ts`. Test the helper in pure Node (no React render). The React wrapper stays a thin composition — its three documented states are exercised by helper tests plus AC3 manual smoke. AC2 reworded; F7 hook-test target updated; D7 file set updated (`useSession.test.tsx` → `useSession.test.ts`). LoC budget unchanged at ~750.

---

## §F — Functional requirements

### §F1 — Browser Supabase client

**File:** `src/lib/supabase/browser.ts` (NEW directory, NEW file).

**Contract:**

```ts
'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Browser Supabase client requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,        // localStorage by default
      autoRefreshToken: true,
      detectSessionInUrl: false,   // not using OAuth callbacks in this concern
    },
  })
  return _client
}
```

**Why a singleton:** the browser Supabase client is event-emitter-backed (`onAuthStateChange`); recreating it would orphan listeners and double-fire callbacks.

**Why `'use client'`:** module is browser-only by construction. Server-side import attempts must error loudly — the file's first line enforces this.

**LoC budget:** ~30 LoC + ~25 LoC of header comment.

### §F2 — `useSession` hook

**File:** `src/hooks/useSession.ts` (NEW).

**Contract:**

```ts
'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type Status = 'loading' | 'authenticated' | 'unauthenticated'

export function useSession(): {
  session: Session | null
  accessToken: string | null
  status: Status
} {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setStatus(data.session ? 'authenticated' : 'unauthenticated')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setStatus(s ? 'authenticated' : 'unauthenticated')
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    accessToken: session?.access_token ?? null,
    status,
  }
}
```

Consumers (the scaffold's `OffersListClient`, future surfaces):

```tsx
const { accessToken, status } = useSession()
if (status === 'loading') return <p>Loading…</p>
if (status === 'unauthenticated') return <p>Please sign in.</p>
// fetch with `Authorization: Bearer ${accessToken}`
```

**LoC budget:** ~70 LoC including header.

### §F3 — Real `/signin` submit

**File:** `src/app/signin/page.tsx` (modify in place; preserve all visual JSX).

**Changes:**

1. Add `import { getSupabaseBrowserClient } from '@/lib/supabase/browser'`.
2. Add a local `error: string | null` state and a `submitting: boolean` state.
3. Replace `handleSubmit`:
   ```ts
   async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
     e.preventDefault()
     setSubmitting(true)
     setError(null)
     const supabase = getSupabaseBrowserClient()
     const { error: authError } = await supabase.auth.signInWithPassword({
       email,
       password,
     })
     setSubmitting(false)
     if (authError) {
       setError('Invalid email or password.')   // generic — never leak which side failed
       return
     }
     // Provision actor_handles if missing (idempotent server action).
     // F4 lives at /api/auth/ensure-actor-handle to keep service-role
     // access server-side. Not a Server Action because we'd lose flag
     // gating clarity.
     const session = (await supabase.auth.getSession()).data.session
     if (session) {
       await fetch('/api/auth/ensure-actor-handle', {
         method: 'POST',
         headers: { Authorization: `Bearer ${session.access_token}` },
       })
     }
     router.push('/vault/offers')
   }
   ```
4. Remove the existing author-comment block (L8-17) about the mockup. Replace with a 4-line comment that points at this directive.
5. Disable the social-login buttons (`<SocialButton>` becomes `<SocialButton disabled />`). Add a `title="Coming soon"` for hover affordance. **Do not delete them** — UI hierarchy is preserved.
6. Render the `error` line below the password input in the existing typography style. Render `Signing in…` instead of `Log in` while `submitting`.

**Constraints:**
- Zero changes to layout, typography classes, color tokens, or icon set.
- Zero new components. Use the existing inline JSX.
- Form action remains client-side; no Server Action conversion.

**LoC budget:** ~60 LoC of changes against the existing file.

### §F4 — `POST /api/auth/ensure-actor-handle`

**File:** `src/app/api/auth/ensure-actor-handle/route.ts` (NEW).

**Contract:**

- Method: POST. Empty body.
- Auth: same `requireActor`-style preamble, but **modified** — this route is the only one that runs *before* an `actor_handles` row exists. It must:
  1. Read flag `isAuthWired()` — 404 `FEATURE_DISABLED` if off.
  2. Extract Bearer token. 401 `UNAUTHENTICATED` if missing.
  3. Validate token via service-role `auth.getUser(token)`. 401 if invalid.
  4. **Skip** the `actor_handles` lookup. Instead, INSERT … ON CONFLICT DO NOTHING with `auth_user_id = userData.user.id`.
  5. Return `{ data: { provisioned: boolean } }` where `provisioned = true` iff the insert actually inserted.
- Uses the **service-role** client (`getSupabaseClient()`), not user-JWT — the row doesn't exist yet, so RLS would block it under user-JWT. This is the single sanctioned use of service-role in a user-facing route in this concern. Document the exception loudly.

**Reasoning:** keeping provisioning in a dedicated route (not inside `requireActor`) keeps the `requireActor` contract pure (read-only, fail-closed) and makes the provisioning event auditable in logs.

**LoC budget:** ~80 LoC including header + error envelope.

### §F5 — `requireActor` documentation update

**File:** `src/lib/auth/require-actor.ts` (modify L20-58 header only).

Append a §6 to the header documenting:

- `actor_handles` provisioning is now done by `POST /api/auth/ensure-actor-handle` after a successful sign-in.
- `requireActor` remains read-only and fail-closed on `ACTOR_NOT_FOUND`. A 403 from a real signed-in user means the post-signin provisioning call failed — the client should retry it before re-attempting the original API call.
- No code changes inside `requireActor` itself.

**LoC budget:** ~12 lines of comment.

### §F6 — Sign-out path (minimal)

**Files:**
- `src/app/api/auth/signout/route.ts` (NEW, ~30 LoC) — POST that calls nothing server-side (Supabase sessions are browser-side); just returns 204. The route exists so the future header sign-out button has a stable endpoint to ping for analytics/audit purposes; for now it's a no-op marker.
- **Wiring deferred** to scaffold concern. This concern only ensures `useSession()` consumers can call `supabase.auth.signOut()` directly when needed.

§OPEN-Q3 covers whether to add a visible sign-out affordance now or defer.

### §F7 — Tests

**Files:**

- `src/app/api/auth/ensure-actor-handle/__tests__/post.route.test.ts` (NEW) — Vitest, ~5 cases:
  1. Flag off → 404.
  2. No Bearer → 401.
  3. Invalid token → 401.
  4. Valid token, no row exists → inserts, returns `{ provisioned: true }`.
  5. Valid token, row exists → no-op, returns `{ provisioned: false }`.

- `src/hooks/__tests__/useSession.test.ts` (NEW) — Vitest pure-Node, targets the exported `subscribeToSession` helper, ~3 cases:
  1. Initial `getSession()` → authenticated state emission.
  2. Initial `getSession()` → unauthenticated state emission.
  3. `onAuthStateChange` callback fires after mount and emits the new state.
  The React `useSession` wrapper itself is a thin `useEffect` composition over the helper; its observable behavior is fully covered by the helper tests plus AC3 manual smoke. No `.tsx` test, no RTL, no jsdom. See R3.

- `src/lib/supabase/__tests__/browser.test.ts` (NEW) — ~2 cases: singleton behavior, env-var-missing throws.

The 1248-test baseline plus the new tests becomes the new floor.

### §F8 — `.env.example` update

**File:** `.env.example` (modify).

Add a comment block under the existing Supabase vars:

```
# After concern 4A.2.AUTH:
#   - Set FFF_AUTH_WIRED=true in dev/staging to enable real authentication.
#   - Production cutover is a separate change.
```

No new env vars introduced.

---

## §AC — Acceptance criteria (for exit report)

| # | Criterion | Verification |
|---|---|---|
| AC1 | `getSupabaseBrowserClient()` exists and returns a singleton | unit test |
| AC2 | Session subscription helper covers loading→authenticated, loading→unauthenticated, and on-change transitions; `useSession` is the React-glue thin wrapper over it | unit test (helper) + AC3 manual smoke (hook) |
| AC3 | `/signin` submits via `signInWithPassword` and persists a session | manual smoke (real Supabase env) |
| AC4 | `/signin` shows generic error on failure (no enumeration) | manual smoke |
| AC5 | After successful signin, `/api/auth/ensure-actor-handle` is called and returns 200 | manual smoke + curl |
| AC6 | `ensure-actor-handle` is idempotent (second call returns `provisioned: false`) | unit test |
| AC7 | `ensure-actor-handle` is the only new user-facing route using service-role; documented in header | grep + manual review |
| AC8 | `requireActor` source unchanged; only header comment expanded | git diff |
| AC9 | OAuth buttons remain present but disabled | manual visual |
| AC10 | No SSR auth code added (`@supabase/ssr` still 0 imports; `next/headers` still 0) | grep |
| AC11 | Vitest baseline + new tests pass; 1248 still green | `npm run test` |
| AC12 | `npm run build` clean | local + CI |
| AC13 | No new lint errors beyond pre-existing 67 | `npm run lint` |
| AC14 | `signout/route.ts` exists, returns 204, no other wiring | curl |
| AC15 | `useSession` and `getSupabaseBrowserClient` are both `'use client'`-marked | grep |
| AC16 | File-set freeze (see §D7) honored | git diff |

---

## §D — Directives

- **§D1.** **Bearer-only.** No `@supabase/ssr`, no `next/headers`, no cookie-based session reading on the server. The Bearer-token model from B2 is the contract.
- **§D2.** **Service-role escape hatch is single-use.** `POST /api/auth/ensure-actor-handle` is the **only** new user-facing route allowed to use the service-role client. Any other route attempting it requires a documented R-revision.
- **§D3.** **`requireActor` contract preservation.** No code inside `requireActor` changes. Only the module-header comment expands. The contract stays read-only / fail-closed.
- **§D4.** **No design churn on `/signin`.** Layout, typography, colors, icons preserved. Only the submit logic + error state + disabled OAuth buttons change.
- **§D5.** **Production flag default unchanged.** `FFF_AUTH_WIRED=false` remains the production default. Dev/staging flip is documented in `.env.example`. Production cutover is a separate concern.
- **§D6.** **Generic error messages on signin.** Never tell a user *which* field was wrong (no enumeration). One generic line: "Invalid email or password."
- **§D7.** **AC16 freeze — mutable file set:**
  - `src/lib/supabase/browser.ts` (new)
  - `src/lib/supabase/__tests__/browser.test.ts` (new)
  - `src/hooks/useSession.ts` (new — also exports `subscribeToSession` helper per R3)
  - `src/hooks/__tests__/useSession.test.ts` (new — pure-Node, targets the helper)
  - `src/app/signin/page.tsx` (modify in place per §F3)
  - `src/app/api/auth/ensure-actor-handle/route.ts` (new)
  - `src/app/api/auth/ensure-actor-handle/__tests__/post.route.test.ts` (new)
  - `src/app/api/auth/signout/route.ts` (new)
  - `src/lib/auth/require-actor.ts` (header comment only)
  - `.env.example` (comment only)
  - This directive (revisions only)
  - `P4_CONCERN_4A_2_AUTH_EXIT_REPORT.md` (new at conclusion)
  Anything else requires R-revision + founder ack.
- **§D8.** **No onboarding-flow modifications.** Phase 0 stays intact. `actor_handles` provisioning is post-signin only; if needed, a follow-up can backfill onboarding completion to also call `ensureActorHandle` — out of scope here.
- **§D9.** **No new dependencies.** `@supabase/supabase-js` is already installed.

---

## §PROMPTS — execution sequence

| # | Title | Output | LoC est. |
|---|---|---|---|
| 1 | **Pre-flight audit** — confirm `actor_handles` provisioning truly absent in onboarding; confirm no other consumer needs the browser client first; verify `auth.users` cascade behavior. Append findings as `§AUDIT-1`. | docs only | 0 |
| 2 | **F1 + F2** — browser client + `useSession` hook + their tests | new files | ~180 |
| 3 | **F4** — `POST /api/auth/ensure-actor-handle` + tests | new route + test | ~180 |
| 4 | **F3** — wire real `/signin` submit; disable OAuth buttons | modified page | ~60 |
| 5 | **F5 + F6 + F8** — `requireActor` header expansion, `signout` no-op route, `.env.example` comment | header edits + new route | ~50 |
| 6 | **Verification pass** — full test suite, build, lint; manual smoke against a dev Supabase project (founder runs this) | text-only report | 0 |
| 7 | **Exit report** — `P4_CONCERN_4A_2_AUTH_EXIT_REPORT.md` mirroring B2's structure | new doc | ~250 |

**Total LoC budget:** ~720 (close to original AUTH estimate of ~600; +120 for the explicit `signout` no-op route + slightly more thorough tests).

**Total prompts:** 7.

**Wall-clock estimate:** 2 days solo, plus ~30 minutes of founder-run smoke against a real Supabase dev project for AC3–AC5.

---

## §APPROVAL GATES

- **Gate 0 (now):** founder verdict on this directive.
- **Gate 1:** after Prompt 1 audit — if any audit finding is material, pause for ack (just like the scaffold concern triggered Gate 1 here).
- **Gate 2:** after Prompt 6 verification — manual smoke has to pass before exit report is written. If it fails, pause and triage.

---

## §OPEN QUESTIONS (for founder before Gate 0)

1. **Email/password vs magic link.** I'm proposing email/password because the existing `/signin` UI has password fields and matches what the onboarding flow already collects. Magic link is faster to implement (no password storage, Supabase handles delivery) but changes the UX flow and orphans the password fields in the existing UI. **My rec: stick with email/password.** Override only if you want to deliberately move toward passwordless and re-pattern the signin UI in a follow-up.
2. **`actor_handles` provisioning — where to call from.** Three options:
   - (a) Client-side after signin (the current §F3 design): one extra round-trip but explicit and easy to retry.
   - (b) Inside `requireActor` on miss: zero round-trips for the user but breaks `requireActor`'s read-only contract and complicates audit logs.
   - (c) Database trigger on `auth.users` insert: zero application-layer overhead but couples app logic to DB triggers and is harder to test.
   **My rec: (a).** Explicit, traceable, single-purpose, doesn't bend any other contract.
3. **Sign-out affordance now or in the scaffold concern.** This concern adds the no-op `/api/auth/signout` route. The visible sign-out button (somewhere in the header or vault chrome) is small but needs a placement decision. **My rec: defer the visible button to the scaffold concern**; this concern just ships the wiring substrate.
4. **Branch name.** Proposing `feat/p4-auth-substrate`. Confirm or override.
5. **Smoke test responsibility.** AC3-AC5 require a real Supabase dev project to verify. Do you have one configured (env vars in your `.env.local`), or should I add a Prompt 6.5 to walk you through provisioning a Supabase free-tier project?

---

## §AUDIT-1 — Pre-flight audit findings (Prompt 1, 2026-04-21)

### Confirmed

| Check | Result |
|---|---|
| `actor_handles` writes from `account-creation.ts` | **Zero.** Confirmed line-by-line: Step 1 calls auth provider, Step 2 calls `getUserById`/`grantUserType` against the `users` table, Step 3 calls `createUser`. `actor_handles` never appears. The gap is real. |
| Other consumers of a browser Supabase client | **Zero.** Only `src/lib/auth/provider.ts` calls `supabase.auth.*`, and that file is `'use server'` (admin API via service-role). No client component anywhere needs the browser client today. Safe to introduce. |
| `actor_handles.auth_user_id` cascade | `ON DELETE SET NULL` (DDL L86). Auth-user deletion preserves the handle row but nulls the FK — a tombstone semantic that protects ledger references downstream. |
| `actor_handles_auth_user_id_unique` index shape | **Partial unique index** (DDL L92-94): `(auth_user_id) WHERE auth_user_id IS NOT NULL`. Multiple NULLs allowed (post-deletion tombstones); a single live row per `auth_user_id`. |
| OQ5: Supabase dev project configured? | **Yes.** `.env.development` (committed) has a real `NEXT_PUBLIC_SUPABASE_URL` (`kxlromxyhgirdetudrvu.supabase.co`) and a publishable anon key. AC3-AC5 smoke test is feasible without a provisioning detour. |
| `.env.example` exists? | **No.** F8 needs adjustment. |

### Three sharpenings to the directive (R2)

**S1 — F4 SQL specifics.** The partial unique index must be targeted explicitly in the upsert. Two equivalent forms; pick one:

```sql
-- Form A: index inference via WHERE clause (requires Postgres ≥ 9.5)
INSERT INTO public.actor_handles (auth_user_id)
VALUES ($1)
ON CONFLICT (auth_user_id) WHERE auth_user_id IS NOT NULL
DO NOTHING
RETURNING handle;
```

```sql
-- Form B: explicit constraint name (more brittle if the index is ever renamed)
INSERT INTO public.actor_handles (auth_user_id)
VALUES ($1)
ON CONFLICT ON CONSTRAINT actor_handles_auth_user_id_unique
DO NOTHING
RETURNING handle;
```

Recommendation: **Form A.** Decouples from index-name churn; the `WHERE` clause is self-documenting.

The `RETURNING handle` lets the route distinguish provisioned-now from already-present (the response shape `{ provisioned: boolean }` keys on whether `RETURNING` produced a row).

**S2 — F8 file target.** `.env.example` doesn't exist. Two options:
- **(a)** Create `.env.example` from scratch listing every var (mirroring `.env.development`'s shape, but with placeholder values). ~30 LoC. Worthwhile in its own right — onboarding new devs to the codebase is hard without it.
- **(b)** Add the comment to the existing `.env.development` instead.

Recommendation: **(a).** Creating `.env.example` is a tiny investment with cross-concern value. Option (b) makes the doc less discoverable for future devs.

**S3 — Re-provisioning semantics after auth-user deletion.** Because of the `ON DELETE SET NULL` cascade, if a user deletes their account and then re-signs-up with the same email, Supabase creates a new `auth.users.id`, and `ensureActorHandle` will create a *new* `actor_handles` row (different `handle`). The old row persists with `auth_user_id = NULL`, frozen as a ledger tombstone. This is correct behavior per the §8.4 pseudonymization design — but worth a one-line comment in the F4 route so future maintainers don't read it as a bug.

### Decision required before Gate 1 closes

S1 and S3 are documentation-only sharpenings — I'll fold them into the F4 implementation and the route's header comment with no extra approval needed.

S2 is a small directive change: adopt option (a) — create `.env.example`. Adds ~30 LoC to Prompt 5's budget. Recommend approving by silence (proceed) unless you'd rather defer the file creation to a hygiene pass.

OQ5 is closed: dev Supabase project exists, no provisioning detour needed.

### Verdict request

If you reply "go" or "proceed," I'll:
1. Apply S1/S2/S3 as R2 to the directive (small edit).
2. Move to Prompt 2 (F1 + F2 implementation).

If you want to discuss any of the sharpenings, surface them and we'll debate before R2.

---

**End of directive.**
