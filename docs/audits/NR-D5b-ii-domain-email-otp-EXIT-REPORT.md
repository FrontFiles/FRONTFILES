# NR-D5b-ii Exit Report — Domain-Email OTP Method

**Directive:** `docs/public-newsroom/directives/NR-D5b-ii-domain-email-otp.md`
**Branch:** `feat/newsroom-phase-nr-2`
**Date:** 2026-04-24
**Verdict (self-assessment):** Pass.

---

## 1. Summary

7 new files + 4 modified + 1 deletion on disk. Total source lines added ≈ 2,213 (counted across all 9 source files; F3 + F5 + F8 edits not counted in the per-file totals since they're appends/diffs to pre-existing files).

| # | File | Lines | Action | Role |
|---|---|---|---|---|
| F1 | `supabase/migrations/20260425000006_newsroom_email_otps.sql` | 225 | NEW | Table + 5 CHECKs + 2 indexes + trigger + RLS |
| F2 | `supabase/migrations/_rollbacks/20260425000006_newsroom_email_otps.DOWN.sql` | 53 | NEW | Symmetric rollback |
| F3 | `src/lib/db/schema.ts` | +14 | EDIT | Append `NewsroomEmailOtpRow` interface |
| F4 | `src/lib/newsroom/verification.ts` | 307 (was 209; +98) | EDIT | Append `generateOtpCode` / `hashOtpCode` / `verifyOtpCode` + add `randomInt` / `timingSafeEqual` to existing `node:crypto` import |
| F5 | `src/lib/newsroom/__tests__/verification.test.ts` | 210 (was 116; +94) | EDIT | Append 12 OTP-helper test cases |
| F6 | `src/app/newsroom/[orgSlug]/manage/verification/_components/email-card.tsx` | 452 | NEW | Real card replacing the stub |
| F7 | `src/app/newsroom/[orgSlug]/manage/verification/_components/email-card-stub.tsx` | -19 | DELETE | NR-D5b-i artefact removed |
| F8 | `src/app/newsroom/[orgSlug]/manage/verification/_components/verification-shell.tsx` | 82 (was 67; +15) | EDIT | Swap `<EmailCardStub />` for `<EmailCard />`, derive `emailRecord`, pass `orgSlug` |
| F9 | `src/app/api/newsroom/orgs/[orgSlug]/verifications/email/send-otp/route.ts` | 352 | NEW | POST — issue OTP + send email |
| F10 | `src/app/api/newsroom/orgs/[orgSlug]/verifications/email/verify/route.ts` | 387 | NEW | POST — verify OTP + insert record + recompute tier |
| F11 | `src/lib/email/templates/newsroom-domain-otp.ts` | 145 | NEW | Resend template (HTML + plaintext) |
| ~~F12~~ | ~~templates `__tests__`/...~~ | — | **SKIPPED** | No codebase pattern (per IP-2 ratification) |

**Audit findings that shaped the implementation** (per `§AUDIT FIRST — MANDATORY` HALT before composing; all four IPs ratified by founder pre-composition):

| Finding | Resolution |
|---|---|
| **(a) Resend helper API.** `sendTransactionalEmail({to, templateId, subject, html, text, traceId, actorId, tags?})` from [send.ts](src/lib/email/send.ts). Auto-mocks when `RESEND_API_KEY_TRANSACTIONAL` absent (logs + audit, doesn't throw). | F9 calls the helper directly. No raw `Resend` SDK usage. |
| **(a') Env var name.** `RESEND_API_KEY_TRANSACTIONAL` (split per-lane), not plain `RESEND_API_KEY`. Already in [env.ts](src/lib/env.ts:129) per Phase 3. | No new env var needed. Directive's audit-prediction was off but functionally equivalent. |
| **(b) Email template convention.** Plain `.ts` (not `.tsx`); pattern `buildXxxEmail(input): {subject, html, text}` returning inline HTML strings + plaintext fallback. Mirrors [test-ping.ts](src/lib/email/templates/test-ping.ts). React Email is not in use. | **IP-1 ratified:** F11 written as `.ts` with `buildNewsroomDomainOtpEmail` shape mirroring `test-ping.ts`. |
| **(c) FROM address.** `getTransactionalFrom()` reads `env.RESEND_FROM_TRANSACTIONAL` with safe dev fallback `'Frontfiles <onboarding@resend.dev>'`. | No new env var. F9 leans on the helper. |
| **(d) Migration sequencing.** Latest pre-dispatch was `20260425000005_newsroom_schema_d2c_ii.sql` (Phase NR-1 close). | F1 lands as `20260425000006_newsroom_email_otps.sql`. |
| **(e) RLS pattern.** `newsroom_signing_keys` (NR-D2c-i §4): `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + zero policies = service-role-only. | F1 applies the same posture. `\d+ newsroom_email_otps` confirms `Policies (row security enabled): (none)`. |
| **(f) PRD §5.1 P2 copy.** Verified verbatim: 7 elements (Title, Instruction, Email label, Send CTA, Code label, Verify CTA, Errors). PRD does NOT include "Resend code" link copy; directive does. | **IP-3 ratified Option B:** "Resend code" link added — PRD silent (not restrictive); the link is what makes PRD's expired-error copy ("Request a new one.") actionable. All other 7 PRD elements verbatim. |
| **(g) Dev-server bounce.** No new required env vars in this directive. Bounce not required for env-schema reasons. | Confirmed. |
| **(extra) F12 template-test pattern.** No `src/lib/email/templates/__tests__/` directory exists; `test-ping.ts` itself has no template-specific test. | **IP-2 ratified:** F12 SKIPPED per directive's own conditional. |
| **(extra) F6/F8 `orgSlug` prop.** Directive omitted `orgSlug` from F6 props and F8 swap; both API routes need it for the path. [dns-txt-card.tsx:48](src/app/newsroom/[orgSlug]/manage/verification/_components/dns-txt-card.tsx:48) precedent takes `orgSlug` first. | **IP-4 ratified:** F6 props include `orgSlug: string` (first), F8 threads it through. |

---

## 2. Decisions that diverged

All four IPs were ratified pre-composition before any file was written. None diverged in implementation; the table above is the audit trail.

**No mid-session IPs surfaced.** Composition followed the ratified plan exactly. The "Resend code" link reconciliation (IP-3) is the only PRD-vs-directive drift in scope and is logged here for auditability per the founder's instruction:

> PRD §5.1 P2 lists 7 card elements (Title, Instruction, Email label, Send CTA, Code label, Verify CTA, Errors). The "Resend code" link is added as the action target for PRD's expired-error copy ("Request a new one."). All other 7 PRD elements remain verbatim. Treat PRD as silent rather than restrictive on the resend affordance.

---

## 3. Open questions for founder

- **Tier-promotion runtime smoke not attempted.** VERIFY 8 was skipped per directive's "if no Resend dev mode is configured, skip and note" provision. Tier promotion (`unverified` → `verified_source`) fires inside [verify/route.ts](src/app/api/newsroom/orgs/[orgSlug]/verifications/email/verify/route.ts) via the existing `recomputeTier(client, companyId)` helper from NR-D5b-i. The pure `computeTier` covers the `dns_txt + domain_email → verified_source` transition (vitest case at [verification.test.ts:92-96](src/lib/newsroom/__tests__/verification.test.ts:92), passing in 25/25 run). End-to-end firing requires a signed-in admin session + a real domain + a configured Resend test inbox; not in this directive's reach.

- **Dev-server bounce after `rm -rf .next` (carry-forward observation).** VERIFY 2's `rm -rf .next && bun run typecheck` clobbered the running dev server's `.next/dev/server/pages-manifest.json` and friends, causing all subsequent route requests to return HTTP 500 ("Internal Server Error" plain text, not a JSON response). Affects existing routes equally (`/api/newsroom/orgs/.../me`, `.../dns-txt/recheck`); not specific to NR-D5b-ii code. NR-D5b-i carry-forward called out a dev-server bounce for env-var changes; this directive surfaces an analogous case for cache wipes. **Suggested addition to the directive template:** if a dev server is running, VERIFY 2's `rm -rf .next` should be paired with a dev-server bounce, OR moved before VERIFY 4's build (which writes a fresh `.next`). Not blocking — the build artifact is correct, vitest covers helpers, DB-side smoke covers the schema.

- **OTP plaintext logging policy.** Confirmed in implementation: F9 generates the OTP, hashes it, INSERTs the hash, embeds the plaintext in the email body, returns nothing about the plaintext to the API caller. No logging path captures the plaintext. `audit_log` rows from [send.ts:108-120](src/lib/email/send.ts:108) capture `subject` and recipient list but not body content. Worth re-confirming this posture if NR-D5b-iii (TTL cleanup) or NR-D17 (admin surfaces) ever exposes OTP-related diagnostics — the rule should remain "plaintext OTP exists in memory long enough to hash + email, then is GC'd".

- **F5 test-case count overshoot.** Directive's spec listed 9 OTP-helper cases (~22 total). Final: 12 OTP-helper cases + 13 existing = 25 total. Extras are defensive: (a) `hashOtpCode` env-secret-missing throw (mirrors existing `deriveDnsTxtToken` test pattern); (b) `verifyOtpCode` short-`storedHash` short-circuit (prevents `timingSafeEqual` length-mismatch throw from leaking); (c) `verifyOtpCode` non-string `storedHash` throw (split from "throws on type mismatch" to cover both inputs). All passing, all consistent with NR-D5b-i precedent. Within tilde tolerance.

---

## 4. Test results

```
$ bunx vitest run src/lib/newsroom/__tests__/verification.test.ts
 RUN  v4.1.5 /Users/jnmartins/dev/frontfiles
 Test Files  1 passed (1)
      Tests  25 passed (25)
   Start at  20:05:58
   Duration  699ms
```

25/25 passed. Breakdown:

| Group | Count | Notes |
|---|---|---|
| `deriveDnsTxtToken` | 4 | NR-D5b-i existing |
| `expectedDnsTxtRecord` | 2 | NR-D5b-i existing |
| `computeTier` | 7 | NR-D5b-i existing |
| `generateOtpCode` | 2 | New: 6-digit numeric, distribution sanity |
| `hashOtpCode` | 4 | New: deterministic, differs across inputs, 64 hex chars, throws on missing env |
| `verifyOtpCode` | 6 | New: matches, differs by one char, empty input, wrong-length storedHash, non-string code, non-string storedHash |
| **Total** | **25** | |

---

## 5. Build + typecheck + migration apply

| Step | Command | Result |
|---|---|---|
| Migration apply | `bun run supabase db reset` | exit 0; all 6 newsroom migrations apply cleanly (20260425000001 through 20260425000006); 20 newsroom_* tables in up-state |
| Typecheck | `rm -rf .next && bun run typecheck` | exit 0 (`tsc --noEmit` silent) |
| Vitest | `bunx vitest run src/lib/newsroom/__tests__/verification.test.ts` | 25/25 pass |
| Build | `bun run build` | exit 0; route count 100 → 102 (+2 new: `email/send-otp` + `email/verify`) |
| Schema inspect | `psql -c "\d+ newsroom_email_otps"` | All 9 columns + 2 indexes (lookup + cleanup partial) + 5 CHECKs + FK CASCADE + RLS enabled with **zero policies** + `set_updated_at` trigger |
| Rollback symmetry | DOWN apply → `\dt newsroom_email_otps` (gone) → `\dt newsroom_*` (19 NR-1 tables remain) → reset → 20 in up-state | All four assertions hold |
| CHECK constraint smoke (DO block) | `INSERT ... attempts = 6` | `ERROR: ... violates check constraint "newsroom_email_otps_attempts_max"` ✓ |

**Route count delta:** baseline 100 (NR-D5b-i close) → 102 (+2 for `email/send-otp` and `email/verify`). Final build counts 35 static + 68 dynamic − 1 Proxy (Middleware) = 102 routes, matching the directive's prediction exactly.

---

## 6. Runtime smoke

VERIFY 8 (unauthed 401 gate check on both new routes — the NR-D5b-i precedent for lightweight runtime smoke; independent of Resend availability) ran in two phases:

**Phase 1 (pre-bounce) — failed.** Initial curl returned HTTP 500 with plain "Internal Server Error" body across ALL routes (existing `/api/newsroom/orgs/.../me`, `.../dns-txt/recheck` AND new `email/send-otp`, `email/verify`). Dev-server stderr showed `ENOENT: no such file or directory, open '.next/dev/server/pages-manifest.json'` — root cause was VERIFY 2's `rm -rf .next` clobbering the running dev server's compiled artifacts. Not a code-quality signal; not specific to NR-D5b-ii.

**Phase 2 (post-bounce) — green.** Stopped + restarted the dev server (analogous to NR-D5b-i's post-env-edit bounce), waited for the dev-server compile pass on `/api/health`, then re-ran the 401 smoke:

```
$ curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com"}' \
    http://localhost:3000/api/newsroom/orgs/some-test-org/verifications/email/send-otp
401 {"ok":false,"reason":"unauthenticated"}

$ curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","code":"123456"}' \
    http://localhost:3000/api/newsroom/orgs/some-test-org/verifications/email/verify
401 {"ok":false,"reason":"unauthenticated"}
```

Both new routes fail-closed at 401 with the expected JSON shape, matching the NR-D5b-i `dns-txt/recheck` precedent in [exit report §6](docs/audits/NR-D5b-i-verification-dashboard-dns-EXIT-REPORT.md). The `runtime = 'nodejs'` declaration + `isAuthWired()` first-check + Bearer-token extraction + `unauthenticated` reason code are all wired correctly.

**End-to-end OTP send/verify with a real Bearer token + admin session + verified DNS** was NOT smoked — that's the NR-D5b-i-equivalent gap (would require a signed-in admin session token + a real domain we control + a configured Resend test inbox). Not in this directive's reach. Coverage delivered without that:

- Helpers: vitest 25/25 (incl. all OTP cases)
- State machine: typecheck clean on F6 (5 state variants, all transitions exhaustively covered by TypeScript discriminated unions)
- DB writes: VERIFY 1 (apply) + VERIFY 5 (schema) + VERIFY 6 (rollback) + VERIFY 7 (CHECK fires) all green
- Email pipeline: F9 calls `sendTransactionalEmail` which mock-mode-passes when `RESEND_API_KEY_TRANSACTIONAL` is absent; the helper has its own dual-mode coverage from Phase 3

Dev-server-bounce-after-`rm -rf .next` carry-forward logged in §3 and §7.

---

## 7. Verdict

**Pass.** Directive scope met as ratified: 7 new + 4 modified + 1 deletion (within ±2 of directive's "~12 + 2 + 1" — IP-2 SKIP of F12 and the lack of `.tsx` boundary for F11 collapse the new-file count). All four IPs honoured. PRD §5.1 P2 copy verbatim in F6 (7 elements as specified) plus the IP-3-ratified "Resend code" link reconciliation. F4 helpers (`generateOtpCode`/`hashOtpCode`/`verifyOtpCode`) reuse the existing `NEWSROOM_VERIFICATION_HMAC_SECRET` (no new env var). F1 schema enforces the 5-attempts cap + email format + temporal CHECKs. F2 rollback symmetric. F9 + F10 declare `runtime = 'nodejs'` (NR-D5b-i precedent). Tier promotion infrastructure is wired and ready to fire on the first end-to-end run with both methods active.

NR-D5b-ii is ready for commit. Next directive in sequence: **NR-D6** (P6 Pack editor, Details tab — gated on `verified_source`).

**Carry-forward observations for future directives:**

1. **Pair every `rm -rf .next` step with an explicit dev-server bounce instruction in the VERIFY block — same posture as NR-D5b-i's env-var bounce. Update the directive template accordingly.** When a dev server is running, the cache wipe leaves it serving 500s on every route until bounced; this surfaced mid-VERIFY here and was resolved with a stop+start of the running preview before re-running the 401 smoke (now green, see §6).

2. **Email template convention is plain `.ts`, not React Email.** `buildXxxEmail(input): {subject, html, text}` shape from `test-ping.ts` is the reference pattern. Future directives that touch transactional email (NR-D8 embargo invites, NR-D17 admin notifications) should mirror this rather than introduce React Email.

3. **Manage-surface card components require `orgSlug` as a prop.** `dns-txt-card.tsx` + `email-card.tsx` both lead with `orgSlug: string`; future cards (e.g. authorised-signatory in v1.1) should follow.

4. **PRD-silent ≠ PRD-restrictive.** Where PRD does not list an affordance the directive needs (e.g. "Resend code" link) and PRD's own copy implies its existence (e.g. "Request a new one.") — ratify pre-composition rather than guess. IP-3 is the reference precedent.
