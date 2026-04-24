# NR-D5b-ii — Domain-Email OTP Method (Phase NR-2, Part B-ii of NR-D5)

**Status.** Drafted 2026-04-24 on top of NR-D5b-i (commit `96a7cc2` + exit-report follow-up `c0b8e96`). Closes the original NR-D5b split. Not yet dispatched. Dispatch readiness in §D.

**Governs.** A single Claude Code session. Ships the second verification method:

- New schema migration for OTP storage (`newsroom_email_otps` table + rollback)
- Email-card real implementation (replaces NR-D5b-i `email-card-stub.tsx`)
- POST `/api/newsroom/orgs/[orgSlug]/verifications/email/send-otp` — generate + email an OTP
- POST `/api/newsroom/orgs/[orgSlug]/verifications/email/verify` — verify OTP, insert verification record, recompute tier
- Resend email template for OTP delivery
- Pure helpers (OTP generation, code hashing) + tests
- TS row type for `newsroom_email_otps`

When this lands, tier auto-promotion fires for the first time: a company that has completed DNS TXT *and* domain-email verification gets bumped from `unverified` to `verified_source`.

**Scope boundary.** Domain-email method only. No authorised-signatory (v1.1). No rate-limiting beyond per-row attempt counter + TTL. No multi-recipient or bulk OTP. No SMS fallback.

**Deliverables (target ~12 new + 2 modified).** Final count subject to audit-first findings.

Source (provisional):

- (F1) `supabase/migrations/20260425000006_newsroom_email_otps.sql` — new table + RLS
- (F2) `supabase/migrations/_rollbacks/20260425000006_newsroom_email_otps.DOWN.sql` — symmetric rollback
- (F3) `src/lib/db/schema.ts` (EDIT) — append `NewsroomEmailOtpRow` interface
- (F4) `src/lib/newsroom/verification.ts` (EDIT) — add OTP helpers (`generateOtpCode`, `hashOtpCode`, `verifyOtpCode`)
- (F5) `src/lib/newsroom/__tests__/verification.test.ts` (EDIT) — append OTP-helper tests (deterministic hash, time-safe compare, etc.)
- (F6) `src/app/newsroom/[orgSlug]/manage/verification/_components/email-card.tsx` — real component (replaces stub at runtime; stub file deleted as part of this directive)
- (F7) `src/app/newsroom/[orgSlug]/manage/verification/_components/email-card-stub.tsx` — **DELETE** (NR-D5b-i artefact, now replaced)
- (F8) `src/app/newsroom/[orgSlug]/manage/verification/_components/verification-shell.tsx` (EDIT) — swap `<EmailCardStub />` for `<EmailCard />`
- (F9) `src/app/api/newsroom/orgs/[orgSlug]/verifications/email/send-otp/route.ts` — issue OTP + send email
- (F10) `src/app/api/newsroom/orgs/[orgSlug]/verifications/email/verify/route.ts` — verify OTP + insert record + recompute tier
- (F11) `src/lib/email/templates/newsroom-domain-otp.tsx` (or path determined by audit) — Resend email template
- (F12) `src/lib/email/templates/__tests__/newsroom-domain-otp.test.ts` (optional, depends on codebase pattern) — render snapshot test

Likely modifications:

- `.env.example` — document any new env var if surfaced (e.g. dedicated FROM address)
- `docs/public-newsroom/DIRECTIVE_SEQUENCE.md` — closure log entry (founder writes after exit report)

**Cross-references.**

- **`docs/public-newsroom/PRD.md`** — Part 5 §5.1 P2 (domain-email card copy: title, instruction, email field label, "Send code" CTA, code field label, "Verify email" CTA, "Resend code" link, error copy variants) — **verbatim match required**.
- **`docs/public-newsroom/BUILD_CHARTER.md`** — §3.1 verification tiers; tier promotion fires when both DNS + email are active.
- **`docs/public-newsroom/directives/NR-D5b-i-verification-dashboard-dns.md`** — predecessor; `recomputeTier`, `verification.ts` helpers, `requireActor` Bearer pattern, `node:dns/promises` runtime declaration, env-schema fail-fast pattern, dev-server-bounce lesson.
- **`src/lib/newsroom/verification.ts`** — extended in this directive with OTP helpers.
- **`docs/audits/NR-D5b-i-verification-dashboard-dns-EXIT-REPORT.md`** — known v1.1 gap on `recomputeTier` swallow-on-error; not changed here, just inherited.
- **`AGENTS.md`** — Next.js 16 binding rules.
- **`package.json`** — Resend dependency (`^6.12.0`); React Email may or may not be present (audit confirms).

**IP resolutions (none yet).** Audit-first phase will surface IPs per the established pattern.

---

## A — Directive body

The text below is the directive as it will be pasted into Claude Code when dispatch conditions in §D clear.

```
PHASE: Newsroom v1, Phase NR-2 — Domain-Email OTP Method
       (1 migration + email card + OTP helpers + 2 API routes
       + Resend template + tier-promotion firing for the first
       time; ~12 new + 2 modified files; closes NR-D5b split)

GOVERNING DOCS
  docs/public-newsroom/PRD.md                                          (authority — §5.1 P2 verbatim)
  docs/public-newsroom/BUILD_CHARTER.md                                (scope)
  docs/public-newsroom/DIRECTIVE_SEQUENCE.md                           (place in sequence)
  docs/public-newsroom/directives/NR-D5b-i-verification-dashboard-dns.md (predecessor)
  AGENTS.md                                                            (Next.js rules)

AUDIT FIRST — MANDATORY

Surface IPs as HALTs before composing. Items to verify:

  (a) Resend setup location and helper API.
      - Where is the Resend client initialized?
        Likely `src/lib/email/*` or similar.
      - What's the canonical send function signature?
        (e.g. `sendEmail({ to, subject, react }) => Promise`)
      - Is `RESEND_API_KEY` already in `src/lib/env.ts`?
        Almost certainly yes given Phase 3 partial landing
        (commit 5e652df). Reuse without modification.

  (b) Email template convention.
      - React Email components, or raw HTML strings, or
        plain-text templates?
      - Existing template directory?
        Possibly `src/lib/email/templates/*`.
      - If React Email is in use, follow that pattern;
        if not, simpler HTML/text is acceptable for v1.

  (c) FROM address policy.
      - Is there a hardcoded sender or a per-template
        override? PRD does not specify; default to
        whatever the existing Resend config uses.
      - If a dedicated newsroom-related FROM is needed,
        flag as a v1.1 backlog item rather than introducing
        a new env var here.

  (d) Migration sequencing.
      - Latest migration is currently `20260425000005`
        (Phase NR-1 schema closer). NR-D5b-ii's migration
        becomes `20260425000006_newsroom_email_otps.sql`.
      - Confirm by `ls supabase/migrations/ | tail -3`.
      - If a different migration has landed in between
        (e.g. another team's work merged to main), bump
        the timestamp accordingly.

  (e) RLS pattern for service-role-only tables.
      - `newsroom_signing_keys` (NR-D2c-i) is the precedent:
        RLS enabled, zero authenticated policies, only
        service_role can read/write. Apply the same pattern
        to `newsroom_email_otps`.

  (f) PRD §5.1 P2 email-card copy — verbatim. Email-card
      copy strings:
        - Title: "Domain email"
        - Instruction: "Enter an email address at **{domain}**.
                       We will send a one-time code."
        - Email field label: "Your email at {domain}"
        - Send CTA: "Send code"
        - Code field label: "Six-digit code"
        - Verify CTA: "Verify email"
        - Resend link: "Resend code"
        - Error states:
          - "That address is not at {domain}."
          - "Incorrect code."
          - "This code has expired. Request a new one."

      If anything in this directive drifts from the PRD,
      halt and surface — PRD wins.

  (g) Dev-server bounce. NR-D5b-i carry-forward: directives
      that change required env vars must call out a dev-
      server bounce. This directive does NOT add a required
      env var (RESEND_API_KEY already exists per audit).
      Confirm; if a new var is actually needed, halt and
      surface.

SCOPE

Roughly 12 new + 2 modified files. Final count after audit
may shift by ±2 (e.g. F12 test may not exist in codebase
convention). Surface the actual file list in the exit report.

User flow (from a verified-DNS company):
  1. Admin lands on /manage/verification.
  2. DNS TXT card is green (verified).
  3. Email card is now real (NOT stub):
     a. Idle state: email input, "Send code" button.
     b. Submit → POST /verifications/email/send-otp.
     c. Server validates email is at primary_domain;
        generates 6-digit numeric OTP; hashes it; INSERTs
        newsroom_email_otps (company_id, email,
        code_hash, expires_at = now()+10min, attempts=0);
        sends OTP email via Resend.
     d. Client shows code-input state.
  4. User enters code, clicks "Verify email":
     a. POST /verifications/email/verify with email + code.
     b. Server SELECTs latest unconsumed OTP for
        (company_id, email); verifies code via constant-
        time HMAC compare; checks attempts < 5 and not
        expired.
     c. On match: UPDATE newsroom_email_otps SET
        consumed_at = now(); INSERT newsroom_verification_records
        (method='domain_email', value_checked=email);
        call recomputeTier(company_id) — TIER PROMOTION
        FIRES for the first time when DNS is also active.
     d. On mismatch: UPDATE attempts = attempts+1; if
        attempts >= 5, mark consumed_at = now() to
        invalidate. Return error.
     e. Client refetches verification state; tier updates
        to "Verified source" if both methods are now active.

DELIVERABLES

(F1) supabase/migrations/20260425000006_newsroom_email_otps.sql

  CREATE TABLE newsroom_email_otps (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email         text NOT NULL,
    code_hash     text NOT NULL,
    attempts      integer NOT NULL DEFAULT 0,
    expires_at    timestamptz NOT NULL,
    consumed_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
  );

  Constraints:
    CONSTRAINT newsroom_email_otps_email_format
      CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')

    CONSTRAINT newsroom_email_otps_attempts_nonneg
      CHECK (attempts >= 0)

    CONSTRAINT newsroom_email_otps_attempts_max
      CHECK (attempts <= 5)

    CONSTRAINT newsroom_email_otps_consumed_after_created
      CHECK (consumed_at IS NULL OR consumed_at >= created_at)

    CONSTRAINT newsroom_email_otps_expires_after_created
      CHECK (expires_at > created_at)

  Indexes:
    idx_newsroom_email_otps_lookup
      ON newsroom_email_otps (company_id, email, consumed_at)
      -- Fast lookup of "active OTP for (company, email)"
      -- (consumed_at IS NULL filter applied at query time)

    idx_newsroom_email_otps_cleanup
      ON newsroom_email_otps (expires_at)
      WHERE consumed_at IS NULL
      -- Drives the TTL cleanup job (NR-D5b-iii or similar
      -- v1.1 housekeeping; not in scope here)

  Trigger:
    BEFORE UPDATE → set_updated_at() (existing helper)

  RLS:
    ALTER TABLE newsroom_email_otps ENABLE ROW LEVEL SECURITY;
    -- NO authenticated policies. Service-role only.
    -- Same posture as newsroom_signing_keys (NR-D2c-i).

  NOTE on code_hash:
    - Stores HMAC-SHA256(NEWSROOM_VERIFICATION_HMAC_SECRET, otp_code)
    - Plaintext OTP code is NEVER stored or logged
    - Verification path re-hashes user input and compares
      via timing-safe equality

(F2) supabase/migrations/_rollbacks/20260425000006_newsroom_email_otps.DOWN.sql

  Symmetric DOWN. Reverse dependency order:
    1. ALTER TABLE newsroom_email_otps DISABLE ROW LEVEL SECURITY;
    2. DROP TABLE newsroom_email_otps CASCADE;

  Comment block at top: inverse of 20260425000006 up
  migration; does NOT touch any prior Newsroom table.

(F3) src/lib/db/schema.ts (EDIT)

  Append at the end of the file (preserve NR-D2c-ii's
  closing block):

    export interface NewsroomEmailOtpRow {
      id: string
      company_id: string
      email: string
      code_hash: string
      attempts: number
      expires_at: string
      consumed_at: string | null
      created_at: string
      updated_at: string
    }

  Place inside the NEWSROOM section. No re-import; types are
  flat.

(F4) src/lib/newsroom/verification.ts (EDIT)

  Add three exported helpers (and required imports):

    /**
     * Generates a 6-digit numeric OTP.
     * Uses crypto.randomInt for unbiased selection in [0, 1_000_000).
     */
    export function generateOtpCode(): string

    /**
     * HMAC-SHA256 of the OTP code with the existing
     * NEWSROOM_VERIFICATION_HMAC_SECRET. Returns hex digest.
     * Same secret as deriveDnsTxtToken (no new env var).
     */
    export function hashOtpCode(code: string): string

    /**
     * Constant-time comparison of a plaintext code against
     * a stored hash. Returns boolean.
     * Implementation: hashOtpCode(code) === storedHash via
     * crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)).
     */
    export function verifyOtpCode(code: string, storedHash: string): boolean

  No changes to existing exports. recomputeTier already
  handles the email case implicitly via computeTier (which
  reads method='domain_email' from active records).

(F5) src/lib/newsroom/__tests__/verification.test.ts (EDIT)

  Append cases:
    - generateOtpCode: returns 6 digits, all numeric
    - generateOtpCode: distribution sanity (10 calls produce
      at least 5 distinct values — astronomically certain)
    - hashOtpCode: deterministic for same input
    - hashOtpCode: differs across inputs
    - hashOtpCode: returns 64 hex chars (SHA-256 hex)
    - verifyOtpCode: matches when input matches
    - verifyOtpCode: rejects when input differs by one char
    - verifyOtpCode: rejects empty input
    - verifyOtpCode: throws on type mismatch (extra defensive)

(F6) src/app/newsroom/[orgSlug]/manage/verification/_components/email-card.tsx

  Client component. Replaces email-card-stub.tsx.

  Props:
    primaryDomain: string
    currentRecord: NewsroomVerificationRecordRow | null
       (an active domain_email record, if any)
    onChange: () => void  (refetch handler)

  State machine:
    - idle: email input, "Send code" disabled until valid format
    - sending: spinner on Send CTA, inputs disabled
    - code-sent: email read-only, code input + "Verify email" + "Resend code"
    - verifying: spinner on Verify CTA
    - verified: green "Verified on {timestamp}" + email shown
    - error-sent / error-verify: error copy from server response

  PRD §5.1 P2 copy verbatim (per audit finding f).

  Email validation client-side: same regex as the server
  uses (export from verification.ts? Or repeat here? Audit
  decision based on whether the regex already lives in F10/F11.)

(F7) DELETE src/app/newsroom/[orgSlug]/manage/verification/_components/email-card-stub.tsx

  NR-D5b-i artefact. Removed. F8 swaps the import.

(F8) src/app/newsroom/[orgSlug]/manage/verification/_components/verification-shell.tsx (EDIT)

  Single change: replace
    import { EmailCardStub } from './email-card-stub'
    ...
    <EmailCardStub />
  with
    import { EmailCard } from './email-card'
    ...
    <EmailCard primaryDomain={primaryDomain}
               currentRecord={emailRecord}
               onChange={refetch} />

  Where emailRecord is filtered from records:
    const emailRecord = records.find(r => r.method === 'domain_email') ?? null

(F9) src/app/api/newsroom/orgs/[orgSlug]/verifications/email/send-otp/route.ts

  POST. Bearer auth via requireActor. Path-param orgSlug.
  Runtime: 'nodejs' (Resend client may use Node APIs).

  Body: { email: string }

  Flow:
    1. requireActor → user.id
    2. Resolve company_id + primary_domain from orgSlug.
    3. Verify user is admin of company_id.
    4. Validate email is at primary_domain:
       - Lowercase the input email
       - Split on '@'
       - Right-side === primary_domain
       - If not: return 400 { ok: false, reason: 'wrong-domain',
         message: 'That address is not at {domain}.' }
    5. Invalidate any prior unconsumed OTP for (company_id,
       email) by setting consumed_at = now() — prevents
       multiple active codes per email.
    6. Generate 6-digit OTP via generateOtpCode().
    7. Hash via hashOtpCode().
    8. INSERT newsroom_email_otps (company_id, email,
       code_hash, expires_at = now()+'10 minutes', attempts=0).
    9. Send email via Resend (audit-derived helper):
       - Subject: "Your Frontfiles verification code"
       - Body: 6-digit OTP + 10-min expiry note + verification
         context
       - From: existing Resend FROM address (no new env var)
    10. Return JSON: { ok: true, expiresAt: <iso> }
    11. Plaintext OTP NEVER returned in response, NEVER
        logged. Only emailed.

  Error handling:
    - 401 if not authenticated
    - 403 if not admin
    - 400 if wrong-domain
    - 500 on Resend failure (with safe error message; log
      detail server-side via the codebase's pino logger)

(F10) src/app/api/newsroom/orgs/[orgSlug]/verifications/email/verify/route.ts

  POST. Bearer auth + admin check (same pattern). Runtime:
  'nodejs'.

  Body: { email: string, code: string }

  Flow:
    1. Auth + admin check.
    2. Resolve company_id from orgSlug.
    3. SELECT latest newsroom_email_otps WHERE
       company_id=co AND email=normalized_email
       AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1.
    4. If no row: return 400 { ok: false, reason: 'no-active-otp',
       message: 'No active code. Send a new one.' }
    5. If row.expires_at <= now(): return 400 { ok: false,
       reason: 'expired', message: 'This code has expired.
       Request a new one.' }
    6. If row.attempts >= 5: mark consumed_at = now();
       return 400 { ok: false, reason: 'too-many-attempts',
       message: 'Too many failed attempts. Send a new code.' }
    7. Verify code via verifyOtpCode(code, row.code_hash).
    8. If mismatch: UPDATE attempts = attempts+1; if new
       attempts >= 5, mark consumed_at = now() to invalidate.
       Return 400 { ok: false, reason: 'wrong-code',
       message: 'Incorrect code.', attemptsRemaining: 5 - attempts }.
    9. If match:
       a. UPDATE newsroom_email_otps SET consumed_at = now()
          WHERE id = row.id.
       b. INSERT newsroom_verification_records
          (company_id, method='domain_email',
           value_checked=normalized_email,
           verified_at=now()).
       c. Call recomputeTier(client, company_id).
       d. Return JSON: { ok: true, verified_at: <iso> }.
    10. Errors: 401, 403 same as send-otp; 500 with safe
        message + server log on unexpected DB error.

(F11) src/lib/email/templates/newsroom-domain-otp.tsx
       (or whatever the existing email template path is — audit
        finding b)

  Template per codebase convention. Must include:
    - Subject: "Your Frontfiles verification code"
    - Recipient salutation (audit decides; can be neutral)
    - Body: explains they (or someone with admin access to
      their company on Frontfiles Newsroom) requested a
      verification code; show the 6-digit code prominently;
      note 10-minute expiry; advise to ignore if they didn't
      request it
    - Footer: standard Frontfiles email footer per existing
      templates (audit)

  Plain-text fallback: required if existing templates ship
  both HTML and plaintext.

  IMPORTANT: do NOT include the company slug, primary domain,
  or email address as a clickable link. The OTP is the only
  action the recipient takes; phishing-resistance demands the
  email be link-light.

(F12) src/lib/email/templates/__tests__/newsroom-domain-otp.test.ts
       (only if codebase pattern exists; otherwise skip)

  Snapshot or rendering test of the template output. Verifies
  the OTP digits appear in the output. If the codebase has no
  template-test pattern, omit this file and note in the exit
  report.

OUT OF SCOPE (hard boundaries)

- NO changes to NR-D5b-i tier-promotion logic (recomputeTier
  works as-is; this directive simply adds a second method
  that triggers it).
- NO changes to DNS TXT method or its tests.
- NO changes to authorised-signatory verification (v1.1).
- NO new env vars. NEWSROOM_VERIFICATION_HMAC_SECRET (NR-D5b-i)
  is reused for OTP hashing. RESEND_API_KEY already exists.
- NO TTL cleanup job (deferred; the partial unique index on
  (company_id, email, consumed_at) makes lookups fast even
  with stale rows).
- NO multi-recipient OTP. Only one OTP per (company, email)
  is active at a time.
- NO SMS or alternative delivery. Email-only.
- NO admin surfaces (NR-D17).
- NO edits to signin/page.tsx (still IP-4 backlog).

If you need anything outside this list, halt and surface.

VERIFY

Run in order. Each must pass before moving to the next.

  # 1. Migration apply + rollback symmetry
  bun run supabase db reset
  # expected: all 6 newsroom migrations apply cleanly

  # 2. Typecheck
  rm -rf .next
  bun run typecheck
  # expected: exit 0

  # 3. Vitest — verification.test.ts (existing 13 + new ~9)
  bunx vitest run src/lib/newsroom/__tests__/verification.test.ts
  # expected: all cases pass; ~22 total

  # 4. Build
  bun run build
  # expected: exit 0
  # Route count: previous baseline 100 (NR-D5b-i). New routes:
  #   /api/newsroom/orgs/[orgSlug]/verifications/email/send-otp
  #   /api/newsroom/orgs/[orgSlug]/verifications/email/verify
  # Delta: +2. Final: 102.

  # 5. Schema inspection
  psql "$SUPABASE_DB_URL" -c "\d+ newsroom_email_otps"
  # expected: table present with all columns, constraints,
  # indexes, RLS enabled, zero policies (service_role only)

  # 6. Rollback smoke
  psql "$SUPABASE_DB_URL" -f supabase/migrations/_rollbacks/20260425000006_newsroom_email_otps.DOWN.sql
  psql "$SUPABASE_DB_URL" -c "\dt newsroom_email_otps"
  # expected: 0 rows
  psql "$SUPABASE_DB_URL" -c "\dt newsroom_*"
  # expected: 19 newsroom tables remain (all of Phase NR-1)
  bun run supabase db reset
  # restore to up-state: 20 newsroom tables

  # 7. CHECK constraint smoke (DO block per NR-D2a/D2b precedent)
  psql "$SUPABASE_DB_URL" -c "
    DO \$\$
    DECLARE
      v_user_id    uuid;
      v_company_id uuid;
    BEGIN
      INSERT INTO users (id, username, display_name, email)
      VALUES (gen_random_uuid(), 'nrd5bii-smoke',
              'NR-D5b-ii Smoke', 'nrd5bii-smoke@example.com')
      RETURNING id INTO v_user_id;
      INSERT INTO companies (name, slug, created_by_user_id)
      VALUES ('NR-D5b-ii Smoke Co', 'nrd5bii-smoke-co', v_user_id)
      RETURNING id INTO v_company_id;

      -- Should FAIL: attempts > 5 violates the cap CHECK
      INSERT INTO newsroom_email_otps
        (company_id, email, code_hash, attempts, expires_at)
      VALUES (v_company_id, 'admin@example.com',
              repeat('a', 64), 6, now() + interval '10 minutes');

      RAISE EXCEPTION 'nrd5bii-smoke-attempts-didnotfail';
    END
    \$\$;
  "
  # expected: ERROR mentioning newsroom_email_otps_attempts_max

  # 8. Runtime smoke (best-effort; requires Resend dev mode
  #    or a test inbox)
  # If a test admin session token + company are available:
  # curl -X POST -H 'Authorization: Bearer <token>' \
  #   -H 'Content-Type: application/json' \
  #   -d '{"email":"admin@<orgs-primary-domain>"}' \
  #   http://localhost:3000/api/newsroom/orgs/<orgSlug>/verifications/email/send-otp
  # expected: 200 { ok: true, expiresAt: ... }, email arrives
  # in Resend dashboard / test inbox
  # Verify path:
  # curl -X POST -H 'Authorization: Bearer <token>' \
  #   -H 'Content-Type: application/json' \
  #   -d '{"email":"admin@<domain>","code":"<code-from-email>"}' \
  #   http://localhost:3000/api/newsroom/orgs/<orgSlug>/verifications/email/verify
  # expected: 200 { ok: true, verified_at: ... }
  # Then: GET /manage/verification → tier shows "Verified
  # source" if DNS TXT was already verified.
  # If no Resend dev mode is configured, skip and note in
  # exit report; the helpers + state machine + DB writes
  # are covered by typecheck + unit tests + DB smoke.

  # 9. Scope diff
  git status --short
  # expected: ~12 new files, ~2 modified (schema.ts + shell.tsx
  # + verification.ts), 1 deletion (email-card-stub.tsx)

  # 10. Save exit report on disk (precedent from NR-D5a +
  #     NR-D5b-i)
  # Write the exit report to:
  #   docs/audits/NR-D5b-ii-domain-email-otp-EXIT-REPORT.md
  # Include sections 1–7 per the EXIT REPORT block below.
  # This is mandatory per directive template starting with
  # NR-D5b-ii (carry-forward from NR-D5b-i).

EXIT REPORT

Required sections. Save on disk as
docs/audits/NR-D5b-ii-domain-email-otp-EXIT-REPORT.md.

1. Summary — files with line counts; audit findings that
   shaped the implementation (Resend helper path, template
   convention, FROM address policy).

2. Decisions that diverged — including any IP raised mid-
   session.

3. Open questions for founder — including whether tier
   promotion fired correctly in runtime smoke (if attempted).

4. Test results — vitest output (existing + new cases).

5. Build + typecheck + migration apply — exit codes;
   route-count delta.

6. Runtime smoke — send-otp + verify + tier promotion if
   attempted; skip with reason if not.

7. Verdict — self-assessment.

END OF DIRECTIVE BODY.
```

---

## B — Decisions rationale

**D1 — New table for OTP, not column on existing.** OTPs have lifecycle (issued → consumed/expired) distinct from VerificationRecord (which is the verified result). Mixing them would require nullable verified_at, attempts column, etc. on `newsroom_verification_records` — schema drift. Clean separation: `newsroom_email_otps` for the issuance lifecycle, `newsroom_verification_records` for the durable result.

**D2 — HMAC for OTP hashing, reusing the NR-D5b-i secret.** No new env var. SHA-256 HMAC is appropriate for OTP storage (codes are random and short-lived; rainbow tables irrelevant). Constant-time comparison for verification.

**D3 — 5-attempt cap.** Defensible against online code guessing. 1-in-10⁶ per attempt; 5 attempts = 5-in-10⁶ ≈ negligible. Plus 10-min TTL further reduces the brute-force window.

**D4 — No TTL cleanup job in this directive.** The partial index on `(expires_at) WHERE consumed_at IS NULL` makes the cleanup query cheap when v1.1 housekeeping lands. For v1, stale rows are harmless because the lookup query filters on `consumed_at IS NULL AND expires_at > now()`.

**D5 — One active OTP per (company, email).** On send-otp, invalidate any prior unconsumed OTP for the same (company, email) before issuing the new one. Prevents code-confusion if the user requests resends.

**D6 — Phishing-resistance: link-light email.** OTP-only, no clickable links to click into the platform. Mitigates "OTP email contains a link to a fake login page" attack vector.

**D7 — Tier-promotion fires for the first time.** This directive is the moment a company can reach `verified_source`. NR-D5b-i shipped the promotion infrastructure; NR-D5b-ii fires it.

**D8 — `runtime = 'nodejs'` on both routes.** Resend client may use Node-only APIs; explicit declaration is consistent with NR-D5b-i precedent.

---

## C — Acceptance criteria

| AC | Description | Verification step |
|---|---|---|
| **AC1** | Migration applies clean, rollback symmetric | VERIFY 1 + 6 |
| **AC2** | Typecheck exits 0 | VERIFY 2 |
| **AC3** | Vitest passes (existing 13 + new ~9 cases) | VERIFY 3 |
| **AC4** | Build exits 0; route count 100 → 102 | VERIFY 4 |
| **AC5** | `newsroom_email_otps` schema matches spec; RLS enabled, 0 policies | VERIFY 5 |
| **AC6** | CHECK constraints reject invalid inserts (attempts cap) | VERIFY 7 |
| **AC7** | Send-otp + verify + tier promotion end-to-end (if smoke feasible) | VERIFY 8 |
| **AC8** | PRD §5.1 P2 email-card copy verbatim | Inspection |
| **AC9** | Exit report on disk at `docs/audits/NR-D5b-ii-...EXIT-REPORT.md` | VERIFY 10 |
| **AC10** | Scope diff matches the deliverable list (±2) | VERIFY 9 |

---

## D — Dispatch conditions

| # | Condition | How to check |
|---|---|---|
| **DC1** | NR-D5b-i exit report approved; commits `96a7cc2` + `c0b8e96` on `feat/newsroom-phase-nr-2` | Confirmed |
| **DC2** | Branch is `feat/newsroom-phase-nr-2` | `git branch --show-current` |
| **DC3** | Build green | `bun run build` exit 0 |
| **DC4** | `RESEND_API_KEY` set in `.env.local` (already populated per Phase 3 earlier work) | `grep RESEND_API_KEY .env.local` |
| **DC5** | `NEWSROOM_VERIFICATION_HMAC_SECRET` set in `.env.local` (NR-D5b-i populated this) | Confirmed |
| **DC6** | Dev Supabase DB is in NR-D5b-i up-state (19 newsroom_* tables) | `\dt newsroom_*` |
| **DC7** | `.claude/agents/` reference present | `ls .claude/agents/` |

When all conditions are green, paste §A into Claude Code as a single message.

---

**End of NR-D5b-ii.** This closes the NR-D5 family. NR-D6 (distributor dashboard P5 + Pack creation entry point gated on `verified_source`) is next.
