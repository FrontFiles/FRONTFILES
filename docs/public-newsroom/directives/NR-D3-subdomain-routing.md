# NR-D3 — Newsroom Subdomain Routing + Middleware (Phase NR-1)

**Status.** Drafted 2026-04-24 on top of the Phase NR-1 schema substrate (NR-D1 / D2a / D2b / D2c-i / D2c-ii, all committed on `feat/newsroom-phase-nr-1`). Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single Claude Code session. Introduces the subdomain-routing seam for the Newsroom subsystem: requests to `newsroom.frontfiles.com/*` are rewritten internally to the `src/app/newsroom/*` route group. Requests to `/newsroom/*` on the main domain return 404 (the URL namespace is distinct per PRD Locked Decision #13). Existing `frontfiles.com` behaviour is preserved.

**Scope boundary.** Routing only. No real page content. No auth / session logic. No Supabase client on the newsroom surface. No domain libraries (`src/lib/newsroom/` beyond a tiny `host.ts` utility — the full domain-library barrel lands in NR-D4). No admin console (`admin.frontfiles.com` is a later phase — NR-D17). No DNS / Vercel production config (that is NR-H6, a human prerequisite, done out-of-band).

**Deliverables.**

- `src/middleware.ts` — new or edited; host-based rewrite + main-domain `/newsroom/*` deny
- `src/app/newsroom/layout.tsx` — minimal layout wrapper (real chrome lands in NR-D11)
- `src/app/newsroom/page.tsx` — directory placeholder (real J2 in NR-D13)
- `src/app/newsroom/[orgSlug]/page.tsx` — organisation-page placeholder (real J3 in NR-D13)
- `src/app/newsroom/[orgSlug]/[packSlug]/page.tsx` — pack-page placeholder (real J4 in NR-D11)
- `src/lib/newsroom/host.ts` — host-detection utility (`isNewsroomHost`, `NEWSROOM_HOST_PATTERN`)
- `src/lib/newsroom/__tests__/host.test.ts` — vitest unit tests for the utility

**Non-deliverables (hard out-of-scope).** Listed explicitly in §OUT OF SCOPE of the directive body below. Notably: no migrations, no `src/lib/db/schema.ts` edits, no API routes, no Supabase client init, no cookie/session scoping beyond Next.js defaults.

**Cross-references.**

- **AGENTS.md** — `<!-- BEGIN:nextjs-agent-rules -->` block: "This is NOT the Next.js you know … Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." **Binding. The session MUST read the Next.js 16.2.2 middleware docs before authoring `src/middleware.ts`.** Do not copy middleware patterns from training data. Confirm the current API shape against the installed Next version.
- **`docs/public-newsroom/PRD.md`** — Part 4 §9.1 (canonical URL pattern `newsroom.frontfiles.com/{org-slug}/{pack-slug}`), §9.3 (separation from paid Frontfiles: cookies, analytics, identity, chrome, sitemap — **this directive lays the route-namespace isolation; cookie/analytics isolation is deferred**), Part 1 Locked Decision #13.
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §2 *Positioning inside Frontfiles* ("Subdomain `newsroom.frontfiles.com` routed via Next.js middleware; separate page chrome; distinct nav; no paid-FF inventory exposed here; no newsroom Packs in paid-FF surfaces").
- **`docs/public-newsroom/DIRECTIVE_SEQUENCE.md`** — NR-D3 row. Also NR-H6 (DNS prerequisite, human task, done out-of-band).
- **`next.config.ts`** — no edits expected. If Claude Code finds that subdomain rewriting requires `experimental.middleware.*` or similar Next 16 config, surface as an open question and do NOT silently edit.
- **`.claude/agents/frontfiles-context.md`** — review for any project-specific middleware or routing conventions before authoring.
- **Existing middleware (if any).** If `src/middleware.ts` already exists, audit before editing. If a different matcher or unrelated behaviour is present, extend rather than replace. If extending conflicts with the scope of this directive, halt and surface as an open question.

**Relationship to Phase NR-1.** NR-D3 is the second-to-last Phase NR-1 directive. Sequence: **NR-D1 ✓ → NR-D2a ✓ → NR-D2b ✓ → NR-D2c-i ✓ → NR-D2c-ii ✓ → NR-D3 (this) → NR-D4 → NR-G1**. After NR-D4 (domain libraries), NR-G1 closes Phase NR-1 and Phase NR-2 (distributor path) begins.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: Newsroom v1, Phase NR-1 — Subdomain Routing + Middleware
       (middleware + route group + host-detection util;
       no migrations; no app business logic; no Supabase
       client on newsroom surface; no cookie/session
       scoping beyond Next defaults; no admin subdomain;
       no DNS / Vercel config)

GOVERNING DOCS
  docs/public-newsroom/PRD.md                (authority)
  docs/public-newsroom/BUILD_CHARTER.md      (scope)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md (place in sequence)
  AGENTS.md                                  (Next.js rules — BINDING)

BEFORE YOU WRITE ANY CODE — MANDATORY

Per AGENTS.md `<!-- BEGIN:nextjs-agent-rules -->` block:
"This is NOT the Next.js you know. This version has breaking
changes — APIs, conventions, and file structure may all differ
from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code."

Confirm the following against the installed Next.js 16.2.2 BEFORE
authoring `src/middleware.ts`:

  (a) Middleware export signature (`export function middleware`
      vs default export; `NextRequest` / `NextResponse` import
      path; any runtime config).
  (b) Matcher config syntax (`export const config = { matcher }`).
  (c) Host extraction (`request.nextUrl.host` vs
      `request.headers.get('host')`; which is authoritative in
      Next 16).
  (d) Rewrite API (`NextResponse.rewrite(newUrl)` vs any new
      method); cloning patterns.
  (e) Whether there is an existing `src/middleware.ts`.

If the current API shape differs materially from what this
directive sketches in §Middleware design, ADAPT to the current
API. Do NOT copy patterns from older Next versions. Surface
any change that meaningfully alters scope as an exit-report
open question.

SCOPE

This migration is code-layer, not DB-layer. Exactly seven
files (or six if an existing `src/middleware.ts` already
exists and only needs editing). Three placeholder pages + one
layout + one middleware + one utility + one test.

No DB migration. No edits to `src/lib/db/schema.ts`. No API
routes. No Supabase client init on the newsroom surface. No
cookie-scoping beyond what Next.js defaults produce (proper
cookie isolation across subdomains is a later-phase concern;
v1 accepts that users authenticate separately per subdomain).

DELIVERABLES

(F1) src/middleware.ts (new or edited)

  Intent:
    - Detect `newsroom.*` host (case-insensitive)
    - Rewrite internally so `/{path}` on the newsroom
      subdomain resolves to `/newsroom/{path}` in the app
      router (route-group namespacing)
    - Return 404 for any `/newsroom/*` path received on the
      main (non-newsroom) domain — PRD §9.3 separation
    - Do NOT run on static assets (_next/static, _next/image,
      favicon, files with extensions)

  Do not:
    - Inspect request body
    - Read cookies (route group inherits auth from
      whichever Supabase client each page uses)
    - Issue redirects (rewrites only — the URL in the
      address bar stays `newsroom.frontfiles.com/...`,
      never `/newsroom/...`)

  If an existing `src/middleware.ts` is present with unrelated
  behaviour, EXTEND it (compose both behaviours). Do not
  replace. If the existing middleware's matcher conflicts
  with the newsroom rewrite, halt and surface.

(F2) src/app/newsroom/layout.tsx

  Minimal layout wrapper. Single div with
  `data-subsurface="newsroom"` attribute and children. No
  chrome, no nav, no fonts beyond the root. Real chrome
  ships in NR-D11. Keep this file under 30 lines.

(F3) src/app/newsroom/page.tsx

  Placeholder for the directory root (J2). Static content:
    - <h1> "Frontfiles Newsroom"
    - One paragraph describing the surface (Public press
      distribution for verified organisations.)
    - A note indicating the real directory lands in NR-D13
  Keep under 30 lines. No client-side state. No data
  fetching.

(F4) src/app/newsroom/[orgSlug]/page.tsx

  Placeholder for the organisation page (J3). Reads
  `params.orgSlug`. Static content:
    - <h1> "Newsroom: {orgSlug}"
    - Paragraph explaining this is the placeholder (real J3
      lands in NR-D13)
  No DB queries. `params.orgSlug` is treated as a string
  echo; no validation, no slug-format check at this layer
  (that is NR-D13 concern).

  If Next.js 16.2.2 has changed the route-handler signature
  for dynamic segments (params being a Promise in newer
  versions), ADAPT accordingly — do not ship a signature that
  mismatches the installed Next version.

(F5) src/app/newsroom/[orgSlug]/[packSlug]/page.tsx

  Placeholder for the pack page (J4). Reads `params.orgSlug`
  and `params.packSlug`. Static content similar to F4 but
  with both slugs echoed. Real J4 lands in NR-D11.

(F6) src/lib/newsroom/host.ts

  Tiny utility, ~20 lines. Exports:

    export const NEWSROOM_HOST_PATTERN: RegExp
      // Matches any host beginning with 'newsroom.'
      // case-insensitively. Allows newsroom.frontfiles.com,
      // newsroom.frontfiles.localhost, newsroom.example.test
      // (for dev/test).

    export function isNewsroomHost(
      host: string | null | undefined
    ): boolean
      // Returns true iff host matches NEWSROOM_HOST_PATTERN.
      // Returns false for null/undefined/empty.

  No external imports. No side effects. Pure module.

(F7) src/lib/newsroom/__tests__/host.test.ts

  Vitest unit tests for `isNewsroomHost`. Minimum:
    - matches 'newsroom.frontfiles.com' → true
    - matches 'newsroom.frontfiles.com:443' → true
    - matches 'NEWSROOM.FRONTFILES.COM' → true (case-insensitive)
    - matches 'newsroom.frontfiles.localhost:3000' → true
    - rejects 'frontfiles.com' → false
    - rejects 'www.frontfiles.com' → false
    - rejects 'not-newsroom.frontfiles.com' → false
    - rejects '' / null / undefined → false

  Use the existing vitest setup. Follow existing test
  convention in `src/lib/offer/tests/` for structure.

No other files are touched. Do not edit tsconfig, next.config,
package.json, eslint.config, supabase/*, or any pre-existing
`src/app/**` file outside the new `newsroom/` route group.

MIDDLEWARE DESIGN (D1)

High-level flow on every request that matches the matcher:

  1. Extract host. Prefer `request.nextUrl.host` if Next 16
     exposes it authoritatively; otherwise
     `request.headers.get('host')`.

  2. If isNewsroomHost(host):
     a. If pathname already starts with `/newsroom`, pass
        through (defensive — shouldn't happen but prevents
        double-rewrite loops).
     b. Else: rewrite to `/newsroom${pathname}` (if pathname
        is `/`, rewrite to `/newsroom`). Preserve query
        string unchanged.
     c. Return NextResponse.rewrite(newUrl).

  3. Else (main domain):
     a. If pathname starts with `/newsroom`, return
        `new NextResponse(null, { status: 404 })` —
        the namespace is reserved for subdomain traffic.
     b. Else: pass through.

Matcher should exclude:
  - `/_next/static`
  - `/_next/image`
  - `/favicon.ico`
  - Files with extensions (e.g. `*.png`, `*.js`, `*.css`)
  - API routes if they should always be main-domain-only
    (discuss in exit report if Claude Code believes API
    routes need subdomain awareness — they do NOT in v1)

Standard Next.js matcher pattern (verify exact syntax
against Next 16 docs):
  '/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)'

If Next 16 supports `missing: [{ type: 'header', key: 'next-action' }]`
or similar for excluding server actions, leave default — we
don't need special handling for NR-D3.

ROUTE GROUP STRUCTURE (D2)

All placeholder pages MUST:
  - Be async or sync server components (no 'use client' unless
    strictly required — which it isn't for these stubs)
  - Export a default function (named after the file concept,
    e.g. `NewsroomDirectoryPlaceholder`, `NewsroomOrgPlaceholder`,
    `NewsroomPackPlaceholder`)
  - Be under 30 lines each
  - Render simple HTML (h1 + paragraphs); no Tailwind classes
    beyond absolute minimum (a container div, if anything)
  - NOT import from src/lib/db/* (no Supabase queries)
  - NOT import from src/lib/identity/* (no auth)
  - NOT import from shared paid-FF UI components

The `layout.tsx` MUST:
  - Be a sync server component
  - Accept { children }: { children: React.ReactNode }
  - Render a single wrapper div with
    `data-subsurface="newsroom"` and render children inside
  - NOT import the root paid-FF layout's chrome
  - NOT depend on any font, script, or theme currently loaded
    at the root

HOST UTIL (D3)

`src/lib/newsroom/host.ts`:

  const NEWSROOM_HOST_PATTERN = /^newsroom\./i

  export { NEWSROOM_HOST_PATTERN }

  export function isNewsroomHost(
    host: string | null | undefined
  ): boolean {
    if (!host) return false
    return NEWSROOM_HOST_PATTERN.test(host)
  }

Exactly that shape. No additional exports in NR-D3. The
`newsroomCanonicalUrl(orgSlug, packSlug)` helper and all other
newsroom-domain utilities land in NR-D4.

VITEST (D4)

Eight test cases in `src/lib/newsroom/__tests__/host.test.ts`
covering the enumerated positive and negative cases in F7.
Use `describe('isNewsroomHost', () => { ... })` + individual
`it` blocks. One assertion per `it`. Follow the existing
convention in `src/lib/offer/tests/*.test.ts` for imports and
structure.

OUT OF SCOPE (hard boundaries)

- NO DB migration. NO edits to supabase/**.
- NO edits to src/lib/db/schema.ts.
- NO edits to src/lib/types.ts, src/lib/identity/*, src/lib/auth/*,
  src/lib/company-roles.ts, or any existing paid-FF source file.
- NO API routes under src/app/newsroom/api or anywhere else.
- NO Supabase client init on the newsroom surface (the stub
  pages do NOT read the DB).
- NO cookie-scoping logic. Supabase auth cookies continue
  to behave per default Supabase config. Cross-subdomain
  session semantics are a later-phase concern.
- NO `admin.*` subdomain handling. NR-D17.
- NO DNS / Vercel production config changes. NR-H6.
- NO analytics, metrics, or telemetry wiring.
- NO domain libraries beyond the tiny `host.ts` utility. All
  other `src/lib/newsroom/*` files land in NR-D4.
- NO licence-class config, embed-snippet generator, receipt-
  terms generator, state-machine validator, invariants helpers.
  NR-D4.
- NO package.json changes (no new dependencies). If Claude Code
  finds a dependency is strictly required to implement the
  middleware per Next 16 conventions, halt and surface.
- NO changes to any pre-existing `src/middleware.ts` beyond
  extending with newsroom behaviour; do not remove or replace
  other middleware logic.
- NO edits to root layout.tsx or any pre-existing layout.
- NO fix of the PUBLIC-EXECUTE grant on NR-D1 helpers.

If you find you need something outside this list to make the
rewrite work, STOP and surface the blocker as an exit-report
open question.

VERIFY

Run these in order. Each must pass before moving to the next.

  # 1. TypeScript type-check
  bun run typecheck
  # If you hit a stale .next/types cache, rm -rf .next and retry.
  # expected: tsc --noEmit exit 0

  # 2. Vitest unit tests (host.ts)
  bun test src/lib/newsroom/__tests__/host.test.ts
  # expected: 8 tests pass, 0 fail

  # 3. Full build
  bun run build
  # expected: Next.js build exit 0
  # Route count: should INCREASE by exactly 3 routes (the
  # three new newsroom pages: directory root, org, pack).
  # Prior baseline 90 → expected 93.

  # 4. Route listing inspection
  # Confirm the three new newsroom routes appear in the build
  # output. Search the build log:
  grep -E 'newsroom(/\[orgSlug\])?' /tmp/nrd3_build.log
  # expected: 3 matching lines (or equivalent per Next 16
  # output format). If Next 16 formats the build table
  # differently, adapt the grep but confirm 3 newsroom
  # entries exist.

  # 5. Middleware smoke — newsroom host rewrites
  # Start dev server in background (port 3000 assumed).
  # Test via curl with Host header override.
  bun run dev &
  DEV_PID=$!
  sleep 6  # wait for Next dev server to start

  # 5a. Newsroom root
  curl -sS -o /tmp/nrd3_root.html \
    -H 'Host: newsroom.frontfiles.localhost' \
    http://localhost:3000/
  grep -q 'Frontfiles Newsroom' /tmp/nrd3_root.html
  # expected: grep matches (exit 0) — directory placeholder served

  # 5b. Newsroom org
  curl -sS -o /tmp/nrd3_org.html \
    -H 'Host: newsroom.frontfiles.localhost' \
    http://localhost:3000/acme
  grep -q 'Newsroom: acme' /tmp/nrd3_org.html
  # expected: grep matches

  # 5c. Newsroom pack
  curl -sS -o /tmp/nrd3_pack.html \
    -H 'Host: newsroom.frontfiles.localhost' \
    http://localhost:3000/acme/hello
  grep -q 'acme' /tmp/nrd3_pack.html
  grep -q 'hello' /tmp/nrd3_pack.html
  # expected: both grep matches

  # 5d. Main domain /newsroom/* denied
  curl -sS -o /dev/null -w '%{http_code}' \
    -H 'Host: frontfiles.localhost' \
    http://localhost:3000/newsroom
  # expected: 404

  # 5e. Main domain root still works (no regression)
  curl -sS -o /dev/null -w '%{http_code}' \
    -H 'Host: frontfiles.localhost' \
    http://localhost:3000/
  # expected: 200 (or whatever the pre-existing behaviour is;
  # must be identical to baseline)

  kill $DEV_PID

  # 6. No regression on existing routes
  # Re-run full build and confirm total route count equals
  # prior baseline + 3.
  bun run build 2>&1 | tee /tmp/nrd3_final_build.log
  # count newsroom-related routes:
  grep -c 'newsroom' /tmp/nrd3_final_build.log
  # expected: matches increase aligning with 3 new routes

  # 7. No unintended file edits
  git status --short
  # expected: exactly the seven files listed in DELIVERABLES.
  # If anything else appears — root layout, schema.ts, any
  # paid-FF source — halt and surface. Do NOT commit.

EXIT REPORT

Required sections:

1. Summary — files created/edited with line counts. Note
   whether `src/middleware.ts` was new or edited. If edited,
   describe what pre-existing behaviour was preserved.

2. Decisions that diverged — include any API-shape
   adaptations required by Next 16.2.2 that differ from this
   directive's sketch in §Middleware design. Document the
   current-version API you used.

3. Open questions for founder — anything ambiguous. Minimum:
   flag any existing middleware behaviour that competed with
   the newsroom rewrite; flag any new dependency introduced.

4. Build + test results — exit codes + outputs for VERIFY
   steps 1, 2, 3, 6. Route-count delta (baseline → post).

5. Middleware smoke results — outputs for VERIFY 5a–5e.
   Redact any host/IP details that might be environment-
   specific.

6. Scope-diff verification — output of VERIFY 7. Confirm
   only the seven deliverable files changed.

7. Verdict — self-assessment.

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — Subdomain rewriting via middleware, not DNS or Vercel config.** Keeps the routing logic colocated with the Next.js app. DNS points both `frontfiles.com` and `newsroom.frontfiles.com` at the same Vercel deployment (that is NR-H6, a human task); middleware does the app-layer demultiplexing. Trade-off: every request hits the middleware; acceptable given matcher exclusions for static assets.

**D2 — Rewrite, not redirect.** The URL in the address bar stays `newsroom.frontfiles.com/...`, never `/newsroom/...`. This is load-bearing for PRD §9.1 (canonical URL stability). A redirect would leak the internal route-group path; a rewrite is invisible.

**D3 — Reserve `/newsroom/*` on the main domain.** PRD §9.3 says "distinct URL namespace." If a user visits `frontfiles.com/newsroom/acme` directly, they should not hit the newsroom route group — that would defeat the isolation. Return 404.

**D4 — Placeholder pages, not empty routes.** Build must succeed and the route table must include the new routes; placeholders also let VERIFY step 5 smoke-test the rewrite end to end. Placeholders are trivial — under 30 lines each — so they can be replaced in NR-D11/D13 without conflicting with meaningful work.

**D5 — `host.ts` utility is tiny and pure.** One regex, one function. The directive intentionally does NOT include `newsroomCanonicalUrl` here (it belongs to NR-D4's domain-library barrel). Keeping NR-D3 narrow prevents scope creep.

**D6 — Vitest required, not optional.** Host detection will be reused by middleware, future embed generators, server-side URL computation, and any place that needs "is this a newsroom request?" logic. Eight cases covers the canonical positive and negative branches including dev/test hosts.

**D7 — Next 16 API adaptation is expected.** The directive's middleware sketch is idiomatic for older Next versions; Claude Code is explicitly instructed to verify against the installed Next 16.2.2 docs and adapt. This is the same discipline as NR-D1's SQLSTATE 42P17 lesson: if the docs contradict the directive, follow the docs and document the divergence in the exit report.

---

## C — Acceptance criteria expansion

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Typecheck exits 0 | VERIFY 1 |
| **AC2** | `host.ts` vitest passes all 8 cases | VERIFY 2 |
| **AC3** | Build exits 0 with route count = baseline + 3 | VERIFY 3 |
| **AC4** | Build output lists the three new newsroom routes | VERIFY 4 |
| **AC5** | Newsroom root/org/pack served on `newsroom.frontfiles.localhost` | VERIFY 5a–c |
| **AC6** | `/newsroom/*` on main domain returns 404 | VERIFY 5d |
| **AC7** | Main domain root still works | VERIFY 5e |
| **AC8** | No regression on pre-existing routes; delta is +3 | VERIFY 6 |
| **AC9** | Only the seven deliverable files changed | VERIFY 7 |

---

## D — Dispatch conditions

| # | Condition | How to check |
|---|---|---|
| **DC1** | NR-D2c-ii exit report approved; commit on `feat/newsroom-phase-nr-1` | Confirmed 2026-04-24 — `1b8a0ba` |
| **DC2** | `feat/newsroom-phase-nr-1` is current branch | `git branch --show-current` |
| **DC3** | Build green | `bun run build` exit 0; `bun run typecheck` clean |
| **DC4** | Dev server port 3000 is free | Confirm before dispatch |
| **DC5** | `newsroom.frontfiles.localhost` resolvable for curl-with-Host smoke | Does not require `/etc/hosts` edit — curl `-H 'Host:'` overrides; resolvable via `localhost` target |
| **DC6** | `.claude/agents/` reference present | `ls .claude/agents/` |
| **DC7** | Next.js 16.2.2 is installed (matches AGENTS.md assumption) | `cat package.json | grep '"next"'` |

When all conditions are green, paste the entire §A block into Claude Code as a single message. No preamble. No paraphrase.

---

**End of NR-D3.**
