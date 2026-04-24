# NR-D5b-i — Verification Dashboard + DNS TXT Method (Phase NR-2, Part B-i of NR-D5)

**Status.** Drafted 2026-04-24 on top of NR-D5a (commit `04a92c4` on `feat/newsroom-phase-nr-2`). Second Phase NR-2 directive. First of two parts splitting the original NR-D5b. Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single Claude Code session. Ships:

- `/newsroom/{orgSlug}/manage/*` layout with auth + admin-membership gating
- P2 verification dashboard at `/newsroom/{orgSlug}/manage/verification`
- DNS TXT verification method end-to-end: HMAC-derived challenge token, recheck via Node `dns/promises`, atomic INSERT into `newsroom_verification_records`
- Tier-promotion helper that recomputes `newsroom_profiles.verification_tier` after every successful verification (no promotion in NR-D5b-i since `verified_source` requires both DNS + email; promotion fires once NR-D5b-ii lands)
- Email card stubbed in the dashboard ("Coming soon — NR-D5b-ii") so the layout is complete
- Vitest for the pure helpers

**Scope boundary.** DNS TXT method only. No email OTP. No Resend. No new schema migration (uses existing `newsroom_verification_records` and `newsroom_profiles`). No new dependency. One new env var (`NEWSROOM_VERIFICATION_HMAC_SECRET`).

**Deliverables.**

Source (10 new + 1 edit):

- (F1) `src/app/newsroom/[orgSlug]/manage/layout.tsx` — manage layout; auth gate; admin-membership check; redirect non-members to `/`
- (F2) `src/app/newsroom/[orgSlug]/manage/page.tsx` — **EDIT** the NR-D5a stub; show org name, current verification tier, link to `/verification`
- (F3) `src/app/newsroom/[orgSlug]/manage/verification/page.tsx` — server component; fetches `newsroom_profiles` + active `newsroom_verification_records` for the company; passes data to client shell
- (F4) `src/app/newsroom/[orgSlug]/manage/verification/_components/verification-shell.tsx` — client wrapper; renders tier header + DNS card + email-stub card
- (F5) `src/app/newsroom/[orgSlug]/manage/verification/_components/tier-header.tsx` — small client component; tier badge + next-tier instruction copy from PRD §5.1 P2
- (F6) `src/app/newsroom/[orgSlug]/manage/verification/_components/dns-txt-card.tsx` — DNS TXT method card; instruction text + record value with copy button + recheck CTA + state display
- (F7) `src/app/newsroom/[orgSlug]/manage/verification/_components/email-card-stub.tsx` — stub email card; copy: "Coming soon — domain-email verification ships in NR-D5b-ii"
- (F8) `src/app/api/newsroom/orgs/[orgSlug]/verifications/dns-txt/issue/route.ts` — POST returns the deterministic challenge token
- (F9) `src/app/api/newsroom/orgs/[orgSlug]/verifications/dns-txt/recheck/route.ts` — POST does DNS TXT lookup, on match inserts a `newsroom_verification_records` row + recomputes tier
- (F10) `src/lib/newsroom/verification.ts` — pure helpers: HMAC token derivation, expected-record formatter, tier computation
- (F11) `src/lib/newsroom/__tests__/verification.test.ts` — vitest for the pure helpers

Total: 11 files. Existing code edits limited to F2 (the NR-D5a stub).

**Cross-references.**

- **`docs/public-newsroom/PRD.md`** — Part 5 §5.1 P2 (verification dashboard — exact tier-header copy, DNS TXT method-card copy, instruction strings, error messages — **verbatim match required**).
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §3.1 (verification tiers and methods), §4 (primitive-reuse: `newsroom_profiles`, `newsroom_verification_records`).
- **`docs/public-newsroom/directives/NR-D1-schema-foundation.md`** — schema for `newsroom_verification_records` (method enum, value_checked, verified_at, expires_at) + RLS helper `is_newsroom_admin(uuid)`.
- **`docs/public-newsroom/directives/NR-D5a-p1-signup.md`** — direct predecessor; provides `/manage/page.tsx` stub, `requireActor()` Bearer-auth pattern (audit finding b), `getSupabaseClient()` service-role factory.
- **`src/lib/newsroom/host.ts`** — host detection helper (NR-D3); not modified.
- **`src/lib/env.ts`** — codebase env-var pattern; this directive adds `NEWSROOM_VERIFICATION_HMAC_SECRET`.
- **AGENTS.md** — Next.js 16 binding rules (still apply for the new API route handlers).

**IP resolutions (none yet).** This directive's audit-first phase will surface IPs as needed; ratify before composition per the established pattern.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear.

```
PHASE: Newsroom v1, Phase NR-2 — Verification Dashboard + DNS TXT
       (manage layout + admin gate + P2 dashboard + DNS TXT
       method end-to-end + tier-promotion helper; email card
       stubbed; no migration; no Resend; one new env var)

GOVERNING DOCS
  docs/public-newsroom/PRD.md                        (authority — §5.1 P2 verbatim)
  docs/public-newsroom/BUILD_CHARTER.md              (scope)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md         (place in sequence)
  docs/public-newsroom/directives/NR-D5a-p1-signup.md (predecessor; auth + Supabase patterns)
  AGENTS.md                                          (Next.js rules)

AUDIT FIRST — MANDATORY

Before composing, confirm:

  (a) `requireActor(Request)` and Bearer-token API-route pattern
      established in NR-D5a — reuse identically.
  (b) `getSupabaseClient()` service-role factory and
      `getSupabaseClientForUser(token)` user-JWT factory at
      `src/lib/db/client.ts` — reuse.
  (c) Env-var pattern at `src/lib/env.ts`. Identify the
      canonical way to add a new server-side secret. Add
      `NEWSROOM_VERIFICATION_HMAC_SECRET` to:
        - the env schema if there is one
        - `.env.example` (documented)
        - `.env.local` (the founder will populate the real
          value out-of-band; for the directive, just declare
          the variable's existence and the required generation
          method — `openssl rand -base64 48` or equivalent)
      If the env-schema enforcement is strict (per CCP3
      observation) and the codebase will fail to build with a
      missing env var, halt and surface — the founder must
      populate `.env.local` before the build can pass.
  (c.bis) DNS resolution in Next 16. `node:dns/promises` is a
      Node-only API; the API route must run on the Node
      runtime, not Edge. Confirm the codebase's existing
      pattern for `export const runtime = 'nodejs'` (or
      whatever the current convention is). If the API routes
      need an explicit runtime declaration, add it.
  (d) PRD §5.1 P2 copy (in `docs/public-newsroom/PRD.md`):
      tier-header copy variants for `unverified` /
      `verified_source` / `verified_publisher`, DNS TXT card
      title, instruction string with `{domain}` interpolation,
      record-display format, recheck CTA label, pending /
      success / error state copy. Reproduce verbatim. If any
      string in this directive drifts from the PRD, the PRD
      wins — surface the drift before composing.
  (e) Existing layout pattern under `src/app/newsroom/`. The
      manage layout (F1) sits inside the route group already
      provided by NR-D3's `src/app/newsroom/layout.tsx`; F1
      adds a NESTED layout under `[orgSlug]/manage/` that
      handles auth + admin checks. Confirm Next 16's nested-
      layout semantics if uncertain.

Surface any audit finding that materially changes the
implementation as an exit-report open question BEFORE writing
code.

SCOPE

Exactly 10 new files + 1 edit (F2 — the NR-D5a /manage stub).

User flow:
  1. Signed-in admin navigates to /newsroom/{orgSlug}/manage
  2. Manage layout (F1) verifies session + admin membership
     (via newsroom_profiles + company_memberships RLS-helper
     `is_newsroom_admin`). Non-admin → redirect to /.
  3. /manage shows org name, tier, "Verify your domain" link.
  4. /manage/verification shows tier header + DNS TXT card
     + email-stub card.
  5. DNS TXT card flow:
     a. On mount, client fetches POST /verifications/dns-txt/issue
        which returns the deterministic challenge token.
     b. Client renders the TXT record instruction:
        "Add this TXT record to your DNS for {domain}:
         frontfiles-verify={token}"
     c. User adds DNS, clicks "Recheck DNS".
     d. Client fetches POST /verifications/dns-txt/recheck.
     e. Server resolves TXT records on {domain}, checks for
        the expected `frontfiles-verify={token}` value.
     f. On match: INSERT newsroom_verification_records,
        recompute tier, return success. Client re-fetches
        state.
     g. On no match / DNS error: return error JSON. Client
        renders error copy.

DELIVERABLES

(F1) src/app/newsroom/[orgSlug]/manage/layout.tsx

  Server component layout. Per audit finding (e), nested
  inside the existing `src/app/newsroom/layout.tsx`.

  Auth gate flow:
    1. Reads the orgSlug param (Next 16 async params).
    2. Looks up the company by slug via service_role client
       (orgSlug → company.id).
    3. If company not found → redirect('/') (or 404; pick
       per codebase convention from audit).
    4. Resolves the current user from the session. Per IP-1
       in NR-D5a, server components don't have native session
       access. Two options to handle:
         A. Render a client-only auth gate inside the layout
            (similar to NR-D5a's signup-form pattern). The
            page-level server component renders a thin shell;
            the gate runs on the client and redirects if not
            an admin.
         B. Use service_role to look up membership server-side
            and pass the userId via request headers.
       Per the NR-D5a precedent, OPTION A is consistent.
       Implement: render a `<AdminGate orgSlug={orgSlug}
       companyId={companyId}>{children}</AdminGate>` client
       wrapper that checks the browser session, then verifies
       admin membership via a thin API endpoint (or by
       passing the membership data through props after a
       service_role fetch — pick the simpler one based on
       how RLS gates this read).

  Important: the `is_newsroom_admin(company_id)` RLS helper
  reads company_memberships under auth.uid(). To verify
  membership client-side, the simplest path is a tiny API
  endpoint:
      GET /api/newsroom/orgs/{orgSlug}/me  -> { isAdmin: boolean, role: string | null }
  If you decide to add this small helper endpoint, count it
  as part of F1 (the layout's gate); do NOT add it as a
  separate deliverable. Update the deliverable list in your
  exit report.

  Children rendered only when admin check passes. Otherwise
  redirect to '/' (or to a "no access" stub — pick per
  audit).

(F2) src/app/newsroom/[orgSlug]/manage/page.tsx (EDIT)

  Replace the NR-D5a stub. New content:
    - Title: "{Organization name}"
    - Tier badge ("Unverified" / "Verified source" /
      "Verified publisher") — use NR-D4 LICENCE_CLASSES /
      verification-tier display naming convention if it
      exists; otherwise pure inline.
    - Brief paragraph: "Complete verification to publish
      your first pack."
    - CTA button → /newsroom/{orgSlug}/manage/verification
    - Under 60 lines.

(F3) src/app/newsroom/[orgSlug]/manage/verification/page.tsx

  Server component. Reads orgSlug from async params. Fetches:
    - newsroom_profiles row for this company (verification_tier)
    - active newsroom_verification_records for this company
      (active = expires_at IS NULL OR expires_at > now())

  Both reads via service_role (admin gate is enforced by F1
  layout; the layout already gated on admin membership).

  Passes data to <VerificationShell />:
    - tier: NewsroomVerificationTier
    - records: NewsroomVerificationRecordRow[]
    - orgSlug: string
    - primaryDomain: string

  Layout: simple wrapper with title "Verification status",
  then <VerificationShell />.

(F4) src/app/newsroom/[orgSlug]/manage/verification/_components/verification-shell.tsx

  Client component. Receives props from F3. Renders:
    - <TierHeader />
    - <DnsTxtCard />
    - <EmailCardStub />

  Manages refetch state. After a successful DNS recheck, the
  card calls a refetch handler to update the records list and
  the tier header. Use whatever data-fetching pattern the
  codebase already has (audit finding e — likely react.use
  for promises or a useState+fetch pattern); follow it.

(F5) src/app/newsroom/[orgSlug]/manage/verification/_components/tier-header.tsx

  Per PRD §5.1 P2 verbatim:

    if tier === 'unverified':
      "Verification status: Unverified. Complete one DNS TXT
       check and one domain-email check to become a Verified
       source."

    if tier === 'verified_source':
      "Verification status: Verified source. Add an authorised
       signatory attestation to become a Verified publisher."
      (For v1, also append a "Coming soon" tag for the
       authorised-signatory upgrade since it's NR-1.1.)

    if tier === 'verified_publisher':
      "Verification status: Verified publisher."

  Stylistically: a single block at the top of the page.

(F6) src/app/newsroom/[orgSlug]/manage/verification/_components/dns-txt-card.tsx

  Client component. Receives:
    - primaryDomain: string
    - currentRecord: NewsroomVerificationRecordRow | null
       (an active dns_txt record, if any)
    - onChange: () => void  (refetch handler)

  States:
    - idle (no token issued yet) → on mount, fetch
      /verifications/dns-txt/issue to get the token; show
      pending state
    - showing-instruction → display the DNS TXT record value
      with copy button + "Recheck DNS" CTA
    - rechecking → CTA disabled, "Checking…" copy
    - verified → "Verified on {timestamp}" success state
    - error → error copy from the recheck response

  Card body per PRD §5.1 P2:
    - Title: "Domain ownership — DNS TXT"
    - Instruction: "Add this TXT record to your DNS for {domain}:"
    - Record display (monospaced, copy button):
        "frontfiles-verify={token}"
    - Subtext: "Propagation usually completes within 10
       minutes."
    - CTA: "Recheck DNS"
    - Error states: "We could not find the TXT record. Wait
       10 minutes after adding it and retry." / "The record
       value does not match."

(F7) src/app/newsroom/[orgSlug]/manage/verification/_components/email-card-stub.tsx

  Stub. Single block:
    - Title: "Domain email"
    - Body: "Domain-email verification ships in NR-D5b-ii."
    - Disabled-style render (greyed out or similar).

(F8) src/app/api/newsroom/orgs/[orgSlug]/verifications/dns-txt/issue/route.ts

  POST. Bearer auth via requireActor(request). Path-param
  orgSlug.

  Flow:
    1. requireActor → user.id
    2. service_role client: SELECT companies WHERE slug=orgSlug
       → company_id, primary_domain (via newsroom_profiles)
    3. Verify the user is an admin of company_id
       (SELECT FROM company_memberships WHERE user_id=user.id
        AND company_id=co AND role='admin' AND status='active')
       — if not, return 403.
    4. Compute token = deriveDnsTxtToken(company_id) (helper
       from F10).
    5. Return JSON: { token, recordName: '{domain}',
       recordValue: 'frontfiles-verify={token}' }

  No DB write. Token is deterministic.

(F9) src/app/api/newsroom/orgs/[orgSlug]/verifications/dns-txt/recheck/route.ts

  POST. Same auth + admin check as F8.

  Flow:
    1. Auth + admin check (as above).
    2. company_id, primary_domain via service_role.
    3. expectedToken = deriveDnsTxtToken(company_id)
    4. expectedRecord = `frontfiles-verify=${expectedToken}`
    5. Resolve TXT records on primary_domain via Node's
       `dns/promises` `resolveTxt(primary_domain)`.
       NOTE: resolveTxt returns string[][] (each TXT record
       is an array of string fragments to be joined).
       Flatten with `chunks.map(c => c.join(''))`.
    6. If any flattened value === expectedRecord:
       - INSERT newsroom_verification_records
         (company_id, method='dns_txt', value_checked=expectedToken,
          verified_at=now(), expires_at=null)
         via service_role, ON CONFLICT (company_id, method)
         DO UPDATE SET verified_at = now(), expires_at = null.
         (Wait — NR-D1 schema didn't put a unique constraint on
         (company_id, method). Verify; if no constraint, just
         INSERT a fresh row each time, which is fine since the
         active-records query handles duplicates.)
       - Call recomputeTier(company_id) (helper from F10).
       - Return JSON: { ok: true, verified_at: <iso> }
    7. If no match: return JSON: { ok: false,
       reason: 'not-found' | 'value-mismatch' }
    8. If DNS lookup fails (NXDOMAIN, DNS error, timeout):
       return JSON: { ok: false, reason: 'dns-error',
       detail: <safe message> }

  IMPORTANT: `export const runtime = 'nodejs'` if Next 16
  needs an explicit runtime declaration. Edge runtime does
  not have `dns/promises`.

(F10) src/lib/newsroom/verification.ts

  Pure helpers (no DB). Tested in F11.

  Exports:

    // HMAC-SHA256 of `${companyId}:dns-txt` with the env
    // secret. Truncate to first 32 hex chars (128 bits;
    // sufficient since this is a public DNS record anyway).
    export function deriveDnsTxtToken(companyId: string): string

    // Returns: { recordName: domain, recordValue: 'frontfiles-verify=...' }
    export function expectedDnsTxtRecord(
      companyId: string,
      domain: string
    ): { recordName: string; recordValue: string }

    // Computes verification_tier from a list of active
    // verification records. Pure logic.
    //  - has dns_txt + domain_email + authorized_signatory
    //    → 'verified_publisher'
    //  - has dns_txt + domain_email
    //    → 'verified_source'
    //  - else → 'unverified'
    export function computeTier(
      activeRecords: ReadonlyArray<{ method: NewsroomVerificationMethod }>
    ): NewsroomVerificationTier

    // Server-side helper that recomputes and persists the
    // tier. Takes a service_role client + company_id; reads
    // active records, computes tier, updates newsroom_profiles
    // if changed.
    //
    // ASYNC, has a DB seam via Supabase client. Test in
    // an integration test (or skip and rely on F11 testing
    // computeTier) — directive does NOT require integration
    // tests for this helper in NR-D5b-i.
    export async function recomputeTier(
      client: SupabaseClient,
      companyId: string
    ): Promise<{ before: NewsroomVerificationTier; after: NewsroomVerificationTier }>

  Internal:
    - HMAC uses `node:crypto` createHmac('sha256', secret).
    - Secret loaded from env (NEWSROOM_VERIFICATION_HMAC_SECRET).
      Throw if missing — fail-fast.

(F11) src/lib/newsroom/__tests__/verification.test.ts

  Vitest. Tests for pure helpers:
    - deriveDnsTxtToken: deterministic for the same companyId
      (call twice, same output)
    - deriveDnsTxtToken: differs across companyIds
    - deriveDnsTxtToken: returns 32 hex chars (regex match)
    - deriveDnsTxtToken: throws if env secret is missing
      (use vi.stubEnv to remove it temporarily)
    - expectedDnsTxtRecord: returns { recordName: domain,
      recordValue: 'frontfiles-verify=<token>' }
    - computeTier: empty records → 'unverified'
    - computeTier: only dns_txt → 'unverified'
    - computeTier: only domain_email → 'unverified'
    - computeTier: dns_txt + domain_email → 'verified_source'
    - computeTier: all three → 'verified_publisher'

  Set NEWSROOM_VERIFICATION_HMAC_SECRET in test setup if
  vitest.config doesn't already wire it. If the codebase has
  an existing `vitest.config.ts` env-loader pattern (per
  earlier audit), follow it.

NEW ENV VAR (D8)

  NEWSROOM_VERIFICATION_HMAC_SECRET

  - Server-only (NEVER ship to client)
  - Used to derive deterministic challenge tokens
  - 256+ bits of entropy. Generate with:
      openssl rand -base64 48
  - Add to .env.example with documentation comment
  - Add to .env.local (founder populates the real value
    out-of-band; for dev, any random value works)
  - If `src/lib/env.ts` enforces a schema, add the var to
    the schema with required = true

  In dev/test, vitest setup must populate this var or the
  HMAC throw will break tests. Audit the test-env config
  and adapt.

OUT OF SCOPE (hard boundaries)

- NO new schema migration. Use existing
  newsroom_verification_records and newsroom_profiles.
- NO domain-email OTP. NR-D5b-ii.
- NO Resend integration. NR-D5b-ii.
- NO admin-side queue surfaces (those land in NR-D17).
- NO authorised-signatory verification (v1.1).
- NO edits to existing schema, RLS policies, or migrations.
- NO edits to src/proxy.ts.
- NO edits to NR-D3 host.ts or NR-D4 newsroom libraries.
- NO new dependencies. `node:crypto` and `node:dns/promises`
  are stdlib.
- NO modifications to signin/page.tsx (still IP-4 backlog).

If you need anything outside this list, halt and surface.

VERIFY

  # 1. Typecheck
  rm -rf .next
  bun run typecheck
  # expected: exit 0

  # 2. Vitest
  bun test src/lib/newsroom/__tests__/verification.test.ts
  bunx vitest run src/lib/newsroom/__tests__/verification.test.ts
  # expected: all helper tests pass

  # 3. Build
  bun run build
  # expected: exit 0
  # Route count: previous baseline 100 (NR-D5a). New routes:
  #   /newsroom/[orgSlug]/manage/verification (page)
  #   /api/newsroom/orgs/[orgSlug]/verifications/dns-txt/issue
  #   /api/newsroom/orgs/[orgSlug]/verifications/dns-txt/recheck
  # Plus possibly /api/newsroom/orgs/[orgSlug]/me (if added
  # per F1 per audit option). Count delta: +3 or +4.
  # Confirm in exit report.

  # 4. Runtime smoke (if dev session is available)
  bun run dev &
  DEV_PID=$!
  sleep 6

  # 4a. Manage layout — auth gate
  curl -sS -o /tmp/nrd5bi_manage.html \
    -H 'Host: newsroom.frontfiles.localhost' \
    http://localhost:3000/some-test-org/manage
  # expected: layout loads (auth gate fires client-side)

  # 4b. Verification page
  # If you have a signed-in admin session token, post the
  # issue endpoint:
  # curl -X POST -H 'Authorization: Bearer <token>' \
  #   http://localhost:3000/api/newsroom/orgs/some-test-org/verifications/dns-txt/issue
  # If no test session, skip and note.

  kill $DEV_PID

  # 5. Scope diff
  git status --short
  # expected: 10 new files + 1 modified (F2) + possibly
  # the /me API route per F1 audit option

EXIT REPORT

Required sections:

1. Summary — files with line counts; F1 audit decision
   (which option chosen for the auth gate); whether the
   /me API route was added.

2. Decisions that diverged — including any IP raised mid-
   session and how it was resolved.

3. Open questions for founder — notably any audit finding
   on env-schema enforcement, runtime declaration, or DNS-
   resolver setup.

4. Test results — vitest output.

5. Build + typecheck — exit codes; route-count delta.

6. Runtime smoke — auth gate and DNS recheck end-to-end if
   feasible; skip with reason if not.

7. Verdict — self-assessment.

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — HMAC for challenge token.** Stateless, deterministic, rotatable via the secret. No "pending challenges" table needed. Tokens are public anyway (they go on a public DNS record). 128 bits is more than sufficient since the threat model is "cannot guess by collision," not "cannot brute force."

**D2 — Token derived from companyId only.** Same company always gets the same token. Means re-issuance is idempotent. If the token is compromised (leaked in logs etc.), rotating the env secret invalidates all tokens — operationally sound.

**D3 — DNS lookup via Node's `dns/promises`.** Node-native, no new dependency. Required `runtime: 'nodejs'` declaration on the recheck route since Edge runtime lacks DNS APIs.

**D4 — Auth gate is client-side, consistent with NR-D5a IP-1.** Server-side session reading would require `@supabase/ssr` (rejected as v1.1 backlog). Client-side gate matches the existing pattern. F1 may add a small `/me` API endpoint to read the membership server-side via service_role — that's a deliberate seam for the gate, not scope creep.

**D5 — `recomputeTier` does the DB write atomically.** Called immediately after a successful verification record insert. The pure `computeTier(records)` is the testable core; `recomputeTier(client, companyId)` is the DB-bound wrapper.

**D6 — Email card stubbed.** Keeps the dashboard layout complete in NR-D5b-i. NR-D5b-ii replaces the stub with a real card. UI work is incremental.

**D7 — Tier promotion gated on both methods.** In NR-D5b-i, no one will reach `verified_source` because `domain_email` doesn't ship until NR-D5b-ii. The infrastructure is ready; the promotion just won't fire yet. Test coverage for `computeTier` confirms it works for the eventual two-method case.

**D8 — New env var with fail-fast load.** `NEWSROOM_VERIFICATION_HMAC_SECRET` is required; HMAC derivation throws if missing. This is the correct posture for crypto secrets.

---

## C — Acceptance criteria

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Typecheck exits 0 | VERIFY 1 |
| **AC2** | Vitest passes for `verification.ts` helpers (10+ cases) | VERIFY 2 |
| **AC3** | Build exits 0; route count delta is +3 or +4 | VERIFY 3 |
| **AC4** | Manage layout enforces auth + admin (redirect non-admin to /) | VERIFY 4a + code review |
| **AC5** | DNS TXT card renders the deterministic record value | VERIFY 4b or code review |
| **AC6** | Recheck endpoint resolves DNS and inserts a verification record on match | Manual test if seed available; code review otherwise |
| **AC7** | `recomputeTier` updates `newsroom_profiles.verification_tier` after a successful insert | Code review + smoke if feasible |
| **AC8** | PRD §5.1 P2 copy verbatim in tier header + DNS card | Inspection |
| **AC9** | New env var documented in .env.example + threshold-loaded in HMAC helper | Code review |
| **AC10** | Exactly 10 new files + 1 edit (F2); no other pre-existing file touched | VERIFY 5 |

---

## D — Dispatch conditions

| # | Condition | How to check |
|---|---|---|
| **DC1** | NR-D5a exit report approved; commit `04a92c4` on `feat/newsroom-phase-nr-2` | Confirmed |
| **DC2** | Branch is `feat/newsroom-phase-nr-2` | `git branch --show-current` |
| **DC3** | Build green | `bun run build` exit 0 |
| **DC4** | Dev Supabase has a test company + admin user (or seed scripts can create one) | Audit / confirm |
| **DC5** | `NEWSROOM_VERIFICATION_HMAC_SECRET` set in `.env.local` | `grep NEWSROOM_VERIFICATION_HMAC_SECRET .env.local` |
| **DC6** | `.claude/agents/` reference present | `ls .claude/agents/` |

When all conditions are green, paste §A into Claude Code as a single message.

**DC5 is a human prerequisite.** Before dispatching, run:

```bash
echo "NEWSROOM_VERIFICATION_HMAC_SECRET=$(openssl rand -base64 48)" >> .env.local
```

(Or set the env var via your existing secrets workflow.)

---

**End of NR-D5b-i.** After this clears, NR-D5b-ii adds the email OTP method (with a small migration for OTP storage), Resend template, and replaces the email-card stub with a real card.
