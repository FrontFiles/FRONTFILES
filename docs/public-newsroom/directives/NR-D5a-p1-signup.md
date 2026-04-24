# NR-D5a — P1 Signup Flow (Phase NR-2, Part A of NR-D5)

**Status.** Drafted 2026-04-24 on top of Phase NR-1 (merged to main at `785aa2f`). First directive of Phase NR-2. First of two parts splitting the original NR-D5. Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single Claude Code session. Ships the P1 signup page at `newsroom.frontfiles.com/start` and the atomic create flow that provisions a Newsroom organisation:

- Page: `src/app/newsroom/start/page.tsx` (server component)
- Form client component: `src/app/newsroom/start/_components/signup-form.tsx`
- Server action: creates `companies` row + `newsroom_profiles` row + `company_memberships` row (role `admin`) in a single transaction
- Zod validation schema matching PRD P1 field copy verbatim
- Auth guard: require signed-in Frontfiles user
- Stub `/newsroom/{orgSlug}/manage/page.tsx` — the post-signup redirect target; real distributor dashboard lands in NR-D6
- Vitest for the validation schema

**Scope boundary.** Signup only. No verification flows. No email delivery. No DNS TXT challenges. No OTP. No P2 dashboard content. No real distributor dashboard.

**Explicit assumption (v1).** P1 is for signed-in Frontfiles users creating a new company for Newsroom distribution. v1 does NOT support "add newsroom profile to an existing company" (deferred to v1.1). Claude Code must enforce this: if the signed-in user is already a member of any company, the signup form still creates a new company — it does not attach to an existing one.

**Deliverables.**

- `src/app/newsroom/start/page.tsx` — server component; auth guard; renders signup form
- `src/app/newsroom/start/_components/signup-form.tsx` — client component; form fields, validation, submit
- `src/app/api/newsroom/start/route.ts` — POST API route (Bearer auth via existing `requireActor(request)`; returns JSON) — **revised from the original `actions.ts` server-action spec per IP-2 audit finding, 2026-04-24**
- `src/app/newsroom/start/schema.ts` — Zod schema shared between client + server
- `src/app/newsroom/[orgSlug]/manage/page.tsx` — stub landing (minimal, under 30 lines; real dashboard is NR-D6)
- `src/app/newsroom/start/__tests__/schema.test.ts` — vitest for the Zod schema

Total: 6 new files. Zero edits to pre-existing files.

**IP resolutions (ratified 2026-04-24 post-audit, before composition).**

1. **IP-1 (page auth guard).** Frontfiles has no server-readable session; auth is in the browser Supabase client's localStorage. F1 is now a server-component shell only; F2 (client) handles the auth check. If not signed in, F2 renders a "Sign in to continue" CTA linking to `/signin?returnTo=/start`. No server-side redirect.
2. **IP-2 (server action → API route).** Server actions can't easily read the Bearer token `requireActor(Request)` expects. F3 is restructured as a POST API route at `src/app/api/newsroom/start/route.ts`. Client posts JSON with `Authorization: Bearer` header (matches the existing `/api/auth/ensure-actor-handle` pattern).
3. **IP-3 (`companies.primary_domain` drift).** `primary_domain` does not exist on the `companies` table. Drop from the companies INSERT; keep on `newsroom_profiles`.
4. **IP-4 (signin return-URL).** Signin page hardcodes `/vault/offers` post-auth. Include `?returnTo=/start` in the signin CTA for forward-compat; users manually re-navigate to `/start` post-signin in v1. Do NOT edit signin/page.tsx.

**Cross-references.**

- **`docs/public-newsroom/PRD.md`** — Part 5 §5.1 P1 (exact copy, field labels, helper text, CTA, terms checkbox wording — **verbatim match required**), §5.2 P5 (mentions `/manage` as the distributor dashboard — stub landing points here).
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §4 primitive-reuse mapping (Newsroom Organization = companies + `newsroom_profiles` 1:1 extension; Newsroom membership = `company_memberships` with role `admin`).
- **Phase NR-1 migrations** — `companies`, `company_memberships`, `newsroom_profiles`, `newsroom_verification_records` tables; `buyer_company_role` enum; RLS policies on `newsroom_profiles`.
- **AGENTS.md** — binding Next.js 16 rules.
- **Existing codebase patterns to audit before writing** (listed in directive body §AUDIT FIRST):
  - `src/lib/auth/*` or `src/lib/identity/*` for server-side auth / session checks
  - `src/lib/onboarding/*` for existing signup patterns
  - `src/lib/db/client.ts` (or similar) for the user-JWT Supabase client + service-role client
  - How Next 16 server actions are authored in this codebase (look at `src/app/**/actions.ts` if any exist)
  - How Zod + form-state are wired in existing forms
  - How existing pages are chromed (for the `newsroom/start` layout)

**Relationship to Phase NR-2.** NR-D5a is the first of two parts. Sequence: **NR-D5a (this) → NR-D5b → NR-D6 → NR-D7 → NR-D8 → NR-D9 → NR-D10 → NR-G2**. Closure of NR-G2 requires that a verified company can create, embargo, and publish a Pack in dev with signed receipts; NR-D5a contributes the "a company exists" primitive.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear. Treat every line as governing.

```
PHASE: Newsroom v1, Phase NR-2 — P1 Signup Flow
       (page + client form + server action + Zod schema +
       atomic create of companies + newsroom_profiles +
       company_memberships; stub /manage landing; vitest
       for schema; NO verification flows; NO email; NO
       dashboard; NO paid-FF edits)

GOVERNING DOCS
  docs/public-newsroom/PRD.md                (authority — §5.1 P1 verbatim copy)
  docs/public-newsroom/BUILD_CHARTER.md      (primitive-reuse mapping)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md (place in sequence)
  AGENTS.md                                  (Next.js rules — binding)

AUDIT FIRST — MANDATORY

Before writing any code, read the following and adapt to the
codebase's current conventions. The directive's §SCHEMA and
§COPY blocks below are binding. Everything else (how to wire
server actions, how to init Supabase clients, how to handle
forms) is auditable and adaptable.

  (a) Next.js 16.2.2 server actions. Read
      `node_modules/next/dist/docs/01-app/03-building-your-
      application/03-rendering/...` or equivalent for the
      current API. Confirm 'use server' placement, FormData
      handling, and error return shape.

  (b) Existing auth / session pattern. Look at `src/lib/auth/*`
      and `src/lib/identity/*`. Identify the canonical way to
      (i) require a signed-in user at a page boundary (redirect
      to signin if not), and (ii) get the current user's id
      inside a server action.

  (c) Supabase client factories. Look at `src/lib/db/client.ts`
      (or wherever clients are constructed). Identify:
      - the user-JWT client (RLS applies under auth.uid())
      - the service_role client (bypasses RLS)
      We will use the user-JWT client where possible; service_role
      is only for the atomic-transaction path (see §D3 below).

  (d) Existing onboarding flow. `src/lib/onboarding/*` or any
      existing `/onboarding` routes. Don't replicate; just note
      the pattern so the newsroom signup fits naturally.

  (e) Zod schema + form-state conventions. Look at any existing
      Zod schemas (likely under `src/lib/*` colocated with
      domain modules). Follow the same shape: transforms, error
      messages, refinements.

  (f) Existing vitest conventions for server actions (if any).
      If the project tests server actions as pure functions
      with a harness, follow that pattern. If not, just test
      the Zod schema in this directive (schema.test.ts).

Surface any audit finding that MATERIALLY changes the approach
as an exit-report open question BEFORE writing code. Minor
pattern mismatches can be adapted in-line.

SCOPE

Exactly 6 new files. Zero edits to any pre-existing file.

The P1 signup flow: signed-in Frontfiles user lands at
`newsroom.frontfiles.com/start`, fills a form (org name,
legal name, primary domain, country, terms checkbox), submits.
Server action creates three rows atomically (companies +
newsroom_profiles + company_memberships), then redirects to
`newsroom.frontfiles.com/{orgSlug}/manage` (stub page in
this directive).

No verification flow runs. The newsroom_profiles row is
created with verification_tier = 'unverified'; user must
complete verification (NR-D5b) before they can create Packs.
That gate is enforced at NR-D6 (distributor dashboard and
Pack-creation entry points); NR-D5a does not gate it.

DELIVERABLES

(F1) src/app/newsroom/start/page.tsx

  Server component. Auth guard: if no signed-in Frontfiles
  user, redirect to the Frontfiles signin page (per audit
  finding b) with a return-URL of `/start` on the newsroom
  subdomain. If signed in, render:
    - Title: "Set up your newsroom"
    - Subtitle: "Your organisation becomes a verified source on Frontfiles."
    - <SignupForm /> (client component, F2)

  Layout inherits from `src/app/newsroom/layout.tsx` (NR-D3).
  No additional chrome. No styling beyond minimum (a wrapper
  element, a title, the form). Real design lands later.

(F2) src/app/newsroom/start/_components/signup-form.tsx

  Client component (`'use client'`). Form with five fields
  (exact labels + helper text per §COPY below):

    - Organisation name       — text, required
    - Registered legal name    — text, required
    - Primary domain          — text, required, FQDN validated
    - Country of incorporation — ISO-3166-alpha-2, required
    - Terms acceptance         — checkbox, required

  Field layout: vertical stack, labels above inputs, helper
  text below each input, errors below helper text.

  Form state: use whichever pattern the codebase already uses
  (per audit finding e). If nothing exists, use
  React.useActionState() (Next 16 native hook) wired to the
  server action. Submit invokes createNewsroomOrganisation().
  On server-action success, Next 16 will redirect from the
  server side; client does nothing. On failure, render the
  error message(s) returned from the action.

  Primary CTA label: "Create newsroom"
  Disabled state: when submitting, when any required field is
  empty, or when terms checkbox unchecked.

  Client-side validation SHOULD mirror the Zod schema (F4) —
  import from `../schema.ts` and call `.safeParse` on each
  change. But the server action re-validates; the client-side
  check is UX only, never a trust boundary.

(F3) src/app/newsroom/start/actions.ts

  Server actions file. `'use server'` at the top.

  Exports:
    export async function createNewsroomOrganisation(
      _prevState: unknown,
      formData: FormData
    ): Promise<CreateOrgResult>

  CreateOrgResult type:
    type CreateOrgResult =
      | { ok: true; orgSlug: string }
      | { ok: false; error: string; fieldErrors?: Record<string, string> }

  Implementation flow:

    1. Get current user from session (per audit finding b).
       If no user, return { ok: false, error: 'Not signed in' }
       and let the page-level auth guard handle the redirect.

    2. Parse FormData through the Zod schema (F4). On parse
       failure, return { ok: false, error: 'Invalid input',
       fieldErrors: {...} } with per-field messages.

    3. Generate a slug from the organisation name:
       - lowercase
       - replace non-alphanumeric runs with '-'
       - collapse consecutive hyphens
       - trim leading/trailing hyphens
       - truncate to 60 chars
       - append a 6-char random suffix (base36) to avoid
         collisions (companies.slug is UNIQUE)
       Example: "Nike, Inc." → "nike-inc-ab12cd"

    4. Use a service_role Supabase client to run a transaction:
         INSERT INTO companies (name, slug, legal_name,
                                country_code, primary_domain,
                                created_by_user_id)
         VALUES (...)
         RETURNING id;

         INSERT INTO newsroom_profiles
                (company_id, primary_domain)
         VALUES (...)      -- verification_tier defaults to 'unverified'

         INSERT INTO company_memberships
                (company_id, user_id, role, status,
                 invited_by, activated_at)
         VALUES (<co_id>, auth.uid(), 'admin', 'active',
                 auth.uid(), now());

       Why service_role: newsroom_profiles INSERT policy
       requires is_newsroom_admin(company_id), which queries
       company_memberships — but the company_memberships row
       doesn't exist yet at the moment we'd INSERT the profile.
       The three inserts are chicken-and-egg under RLS; the
       atomic service_role transaction is the clean seam.

    5. Return { ok: true, orgSlug }.

    6. The calling page uses Next 16 redirect() to navigate
       to `/${orgSlug}/manage`. (redirect() must be called
       OUTSIDE try/catch per Next 16 convention — per audit
       finding a.)

  Error handling:
    - Slug collision on the 6-char suffix (astronomically
      unlikely but possible): retry up to 3 times with fresh
      suffixes; after 3 retries, return { ok: false,
      error: 'Could not allocate a unique slug, please retry' }.
    - Unique-constraint violation on primary_domain (if another
      verified company already claims the same domain — NR-D1
      partial unique index `idx_newsroom_profiles_primary_
      domain_verified`): not applicable at creation because
      new profiles are 'unverified'. If it still fires, surface
      as { ok: false, error: 'This domain is already registered
      by a verified organisation' }.
    - Any other DB error: log via whatever logger the codebase
      uses (audit; `pino` per package.json); return a generic
      'Something went wrong' error.

  Do NOT trust client-sent slug. Always server-compute.

(F4) src/app/newsroom/start/schema.ts

  Zod schema shared between client + server.

  import { z } from 'zod'

  export const SignupSchema = z.object({
    orgName:
      z.string().trim().min(1, 'Organisation name is required')
       .max(120, 'Organisation name is too long'),
    legalName:
      z.string().trim().min(1, 'Registered legal name is required')
       .max(200, 'Legal name is too long'),
    primaryDomain:
      z.string().trim().toLowerCase()
       .regex(
         /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
         'Enter a valid domain (e.g. acme.com)'
       ),
    countryCode:
      z.string().trim().toUpperCase()
       .regex(/^[A-Z]{2}$/, 'Select a country'),
    termsAccepted:
      z.literal('on', {
        errorMap: () => ({
          message: 'You must accept the Distributor Terms and Content Standards',
        }),
      }),
  })

  export type SignupInput = z.infer<typeof SignupSchema>

  Rationale for `z.literal('on')`: HTML checkbox FormData
  value is 'on' when checked, undefined when not. If the
  codebase has a different idiom (e.g. transforming to
  boolean first), follow that convention.

(F5) src/app/newsroom/[orgSlug]/manage/page.tsx

  Stub landing. Real distributor dashboard lands in NR-D6.
  Under 30 lines. Content:
    - Params: `{ params }: { params: Promise<{ orgSlug: string }> }`
    - Await params (Next 16 async params)
    - Server component
    - Auth guard: require signed-in user (per audit finding b)
    - Optional: show "Welcome, your newsroom '{orgSlug}' is
      being set up. Complete verification to publish your
      first pack. (Dashboard UI coming soon — NR-D6.)"
    - No link to verification yet (NR-D5b adds that)
    - No DB query; static render

  NO membership check in this stub. Membership + role gating
  land in NR-D6 proper.

(F6) src/app/newsroom/start/__tests__/schema.test.ts

  vitest. Minimum cases:
    - Valid input passes (happy path)
    - Empty orgName fails with 'required' message
    - Empty legalName fails
    - primaryDomain 'not a domain' fails
    - primaryDomain 'ACME.COM' normalises to 'acme.com'
    - countryCode 'us' normalises to 'US'
    - countryCode 'USA' (3 chars) fails
    - termsAccepted missing fails with the terms message
    - termsAccepted='on' passes

COPY — §5.1 P1 VERBATIM (BINDING)

Paste into the page/form exactly as spelled below. Do not
paraphrase. Do not reorder.

  Page title:        "Set up your newsroom"
  Subtitle:          "Your organisation becomes a verified source on Frontfiles."

  Field 1 label:     "Organisation name"
  Field 1 helper:    "As it should appear on your newsroom page"

  Field 2 label:     "Registered legal name"
  Field 2 helper:    "Used on licence terms and legal notices"

  Field 3 label:     "Primary domain"
  Field 3 helper:    "The domain you will verify ownership of. Example: acme.com"

  Field 4 label:     "Country of incorporation"
  (No helper. A select element. v1: any ISO-3166-alpha-2 code
   is valid; no curated list. Use a <input type="text"> with
   inline help "Two-letter country code (e.g. US, GB, FR)" —
   UX polish comes in NR-D6.)

  Field 5 label:     "I accept the Frontfiles Distributor Terms and the Content Standards."
  (Standalone checkbox. No helper.)

  Primary CTA:       "Create newsroom"

  Validation error — domain already claimed by verified org:
    "This domain is already registered by a verified organisation."

  Validation error — not signed in:
    "You need to be signed in to create a newsroom."

COMPANY SLUG GENERATION

From the `orgName` input, generate the `companies.slug`:

  - Lowercase
  - Normalise Unicode to NFKD
  - Replace any non-alphanumeric run with '-'
  - Collapse consecutive '-' into one
  - Strip leading/trailing '-'
  - Truncate to 60 chars
  - Append '-' + 6 random base36 chars (Math.random-based is
    fine for v1; crypto.randomBytes if the codebase already
    uses it elsewhere)

Example: "Nike, Inc." → "nike-inc-a3k7xy"

The result must satisfy `companies.slug_format` CHECK:
  ^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$

If the generated slug fails the regex (e.g. starts with '-'
after normalisation), prepend 'org-'. If it still fails,
return an error — this is a bug to investigate.

OUT OF SCOPE (hard boundaries)

- NO verification flows. No DNS TXT challenge issuance, no
  email OTP send, no domain-email verification — all NR-D5b.
- NO email delivery. No Resend import. No email template.
- NO P2 verification dashboard. The stub /manage landing does
  NOT link to a verification page; NR-D5b adds that link.
- NO real distributor dashboard. /manage is a stub.
- NO Pack creation entry point. NR-D6 adds that gated on
  verification_tier >= 'verified_source'.
- NO edits to src/lib/db/schema.ts, src/middleware.ts (or
  src/proxy.ts), src/app/newsroom/page.tsx (J2 stub), any
  existing src/lib/* module, package.json, tsconfig,
  next.config, or supabase/**.
- NO new dependencies. If the audit surfaces that
  `React.useActionState` isn't available (it is in React 19
  but verify), halt.
- NO changes to existing auth / session code. Read-only
  consumers.
- NO admin/security role logic. This is a distributor signup;
  admin surfaces come much later (NR-D17).
- NO handling of "user already belongs to a company" — v1
  always creates a new company per signup. v1.1 concern.

If you find you need something outside this list, STOP and
surface it as an exit-report open question.

VERIFY

Run these in order. Each must pass before moving on.

  # 1. TypeScript type-check
  rm -rf .next
  bun run typecheck
  # expected: exit 0

  # 2. Vitest — the new schema test
  bun test src/app/newsroom/start/__tests__/schema.test.ts
  bunx vitest run src/app/newsroom/start/__tests__/schema.test.ts
  # expected: all cases pass, 0 failures

  # 3. Full build
  bun run build
  # expected: exit 0
  # Route count: +2 routes (the /start page and the
  # /[orgSlug]/manage stub). Baseline 97 → 99.

  # 4. Route listing
  grep -E 'newsroom(/(start|\[orgSlug\](/(manage)?)?))' /tmp/nrd5a_build.log
  # expected: 3+ matches (start, [orgSlug] dynamic parent,
  # [orgSlug]/manage, plus existing ones). Confirm two NEW
  # entries appear.

  # 5. Runtime smoke (dev server; requires signed-in user
  #    in a dev session — if not available, skip and note
  #    in exit report).
  # If you can sign in via a dev seed:
  #   curl -sS -H 'Host: newsroom.frontfiles.localhost' \
  #        http://localhost:3000/start > /tmp/nrd5a_start.html
  #   grep -q 'Set up your newsroom' /tmp/nrd5a_start.html
  # If not, skip and verify via route listing + typecheck.

  # 6. Scope diff
  git status --short
  # expected: exactly 6 new files. No edits elsewhere.

EXIT REPORT

Required sections:

1. Summary — 6 files with line counts; note any audit
   finding that shaped the implementation.

2. Decisions that diverged — any Next 16 / codebase
   adaptation. Use halt protocol from NR-D1 for blurb/copy
   drift; use the audit-first discipline for pattern
   adaptations.

3. Open questions for founder — notably: any pattern the
   codebase enforces that the directive didn't anticipate.

4. Test results — vitest output.

5. Build + typecheck results — exit codes + route-count
   delta.

6. Runtime smoke — signup page renders for signed-in user
   (or skipped with reason).

7. Verdict — self-assessment.

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — Signup is for signed-in Frontfiles users.** The Newsroom subsystem layers on top of existing Frontfiles identity. Frontfiles already has auth (Supabase). Newsroom onboarding = creating a company + profile + membership under an existing user. Journalist signup (J1) is a separate flow that lands in NR-D14.

**D2 — New company per signup.** v1 does not support "add newsroom capability to an existing company" because that introduces a second decision point (which company?) and multi-company membership UX. Clean v1: one signup → one new company.

**D3 — Service_role for the atomic create.** The RLS policies on `newsroom_profiles` require `is_newsroom_admin(company_id)` which reads `company_memberships` — a row that doesn't exist yet. Three-row atomic create under RLS is structurally impossible without a bootstrap. The service_role transaction is the only safe path; an RPC function under `SECURITY DEFINER` would work too but is more surface for NR-D5a (prefer server action + service_role client already in the codebase).

**D4 — Slug generation is server-side, with a random suffix.** Clients never provide the slug. Random suffix prevents collision on near-identical org names ("Acme" and "Acme, Inc." would collide without it). Retry up to 3x on collision (astronomically unlikely at 6 chars base36 ≈ 2 billion).

**D5 — Stub `/manage` page.** Post-signup redirect needs a landing. Real distributor dashboard (P5) lands in NR-D6. Stub here is deliberately thin.

**D6 — Terms copy is bound.** PRD P1 includes "I accept the Frontfiles Distributor Terms and the Content Standards." Verbatim. The legal pages these link to are NR-D21 (launch hardening); the checkbox is legally meaningful at NR-G5 time. For v1, the checkbox exists and is required; the link targets exist but may be stubs.

**D7 — Audit-first discipline.** NR-D5a is the first Phase NR-2 directive and the first one that integrates with existing Frontfiles infrastructure (auth, Supabase clients, form patterns). Claude Code must audit before writing; this prevents pattern drift. Bindings are narrow: PRD copy verbatim, schema semantics, 3-row atomic create. Everything else (server-action wiring, form-state library, client creation) is adaptable.

---

## C — Acceptance criteria

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Typecheck exits 0 | VERIFY 1 |
| **AC2** | Zod schema test passes (minimum 9 cases) | VERIFY 2 |
| **AC3** | Build exits 0; route count = 97 + 2 = 99 | VERIFY 3 |
| **AC4** | `/start` and `/[orgSlug]/manage` appear in build output | VERIFY 4 |
| **AC5** | Signup page renders for signed-in user (or skip with reason) | VERIFY 5 |
| **AC6** | Exactly 6 new files; no edits to any pre-existing file | VERIFY 6 |
| **AC7** | PRD §5.1 P1 copy matches verbatim | Inspection of F1/F2 |
| **AC8** | Service_role transaction creates all three rows atomically | Code review; manual test if feasible |

---

## D — Dispatch conditions

| # | Condition | How to check |
|---|---|---|
| **DC1** | Phase NR-1 merged to main; `feat/newsroom-phase-nr-2` branched from the merge commit | Confirmed — main at `785aa2f`; branch exists |
| **DC2** | Current branch is `feat/newsroom-phase-nr-2` | `git branch --show-current` |
| **DC3** | Build green | `bun run build` exit 0; `bun run typecheck` clean |
| **DC4** | Dev Supabase DB is in Phase NR-1 up-state (19 newsroom_* tables) | `\dt newsroom_*` |
| **DC5** | A dev-seed Frontfiles user account exists (for optional runtime smoke) | Check project seed scripts |
| **DC6** | `.claude/agents/` reference present | `ls .claude/agents/` |

When all conditions are green, paste the entire §A block into Claude Code as a single message. No preamble. No paraphrase.

---

**End of NR-D5a.** After this directive clears, NR-D5b adds the P2 verification dashboard, DNS TXT method, domain-email OTP method, and Resend email template.
