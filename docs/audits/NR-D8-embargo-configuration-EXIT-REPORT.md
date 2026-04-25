# NR-D8 Exit Report — Embargo Configuration + Recipient Management

**Directive:** `docs/public-newsroom/directives/NR-D8-embargo-configuration.md`
**Branch:** `feat/newsroom-phase-nr-2`
**Predecessor:** `1b29368` (NR-D7b — AV scanning pipeline)
**Date:** 2026-04-25
**Verdict (self-assessment):** Pass.

---

## 1. Summary

Locked scope: **10 NEW + 1 EDIT = 11 deliverables** (unchanged from directive header). Total source ≈ 2,984 lines across 11 files.

| F# | File | Lines | Action | Role |
|---|---|---|---|---|
| F1 | `pack-editor-shell.tsx` | 149 (+22 net) | EDIT | Embargo tab → active link |
| F2 | `embargo/page.tsx` | 176 | NEW | Server component; two-query recipient merge |
| F3 | `_components/embargo-form.tsx` | 376 | NEW (`'use client'`) | Toggle + lift_at + TZ + policy + auto-notify; create/update/delete |
| F4 | `_components/recipients-list.tsx` | 315 | NEW (`'use client'`) | Add form + table; status derived from columns; revoke |
| F5 | `embargo/route.ts` | 533 | NEW | POST + PATCH + DELETE (single file, three methods) |
| F6 | `embargo/recipients/route.ts` | 514 | NEW | POST: upsert recipient → INSERT/UPDATE embargo_recipient → invite email |
| F7 | `embargo/recipients/[recipientId]/route.ts` | 286 | NEW | DELETE: UPDATE revoked_at |
| F8a | `embargo-form-constants.ts` | 120 | NEW (client-safe) | Caps + COMMON_TIMEZONES + deriveOutletFromEmail |
| F8b | `embargo.ts` | 134 | NEW (`'server-only'`) | zod schemas + **generateRecipientToken (random)** + **buildPreviewUrl (PRD shape)** |
| F9 | `newsroom-embargo-invite.ts` | 158 | NEW | Plain `.ts` email template (PRD §5.1 P8 verbatim body) |
| F10 | `embargo.test.ts` | 223 | NEW | 26 vitest cases |

**Audit findings that shaped the implementation:**

| Audit | Finding | Resolution |
|---|---|---|
| **(a)** `newsroom_embargoes` | Columns match PRD/directive verbatim ([d2b:259](supabase/migrations/20260425000003_newsroom_schema_d2b.sql:259)). | ✓ Service-role write posture holds. |
| **(b)** `newsroom_embargo_recipients` | **🚩 Schema diverges from directive's pseudo-code.** UNIQUE is `(embargo_id, recipient_id)` not `(embargo_id, email)`. No `email` / `status` / `outlet` columns. `access_token` stored DIRECTLY (UNIQUE; ≥32 chars). | **IP-2 + IP-3 ratified** — see §2. |
| **(c)** Schema row types | All present. No `NewsroomEmbargoRecipientStatus` enum (and shouldn't — status is derived). | ✓ |
| **(d)** Pack-status guard | Directive pre-decides draft-only for v1. PRD §5.1 P8 permits revoke post-schedule (deferred to NR-D9). | ✓ Documented under §3. |
| **(e)** URL pattern — CRITICAL | **🚩 PRD §5.3 J5 line 1136: `newsroom.frontfiles.com/{org-slug}/{pack-slug}/preview?t={token}`**. Directive default (`frontfiles.com/preview/{token}`) wrong on 3 dimensions. | **IP-1 ratified** — buildPreviewUrl uses PRD shape with `NEWSROOM_BASE_URL` from canonical-url.ts. |
| **(f)** Resend FROM | NR-D5b-ii precedent. ✓ | No IP. |
| **(g)** Token shape | Schema COMMENT: "base64url of 24 random bytes = 32 chars". Random, not HMAC. | **IP-2 ratified.** |

---

## 2. IPs surfaced and resolved

All four IPs ratified pre-composition. None diverged in implementation.

| IP | Verdict | Implementation |
|---|---|---|
| **IP-1** Preview URL pattern (PRD §5.3 J5) | APPROVE | F8b `buildPreviewUrl(orgSlug, packSlug, token)` returns `${NEWSROOM_BASE_URL}/${orgSlug}/${packSlug}/preview?t=${token}`. Reuses `NEWSROOM_BASE_URL` from [`canonical-url.ts:13`](src/lib/newsroom/canonical-url.ts:13). No env-var dependency. F10 tests assert exact shape + URL-encoding. |
| **IP-2** Random token, not HMAC (schema-locked) | APPROVE | F8b `generateRecipientToken()` returns `randomBytes(24).toString('base64url')` (32 chars, ≥192 bits). No `hashRecipientToken`. Token stored directly in `access_token` column per schema. F10 tests assert randomness (20 distinct values across 20 calls). |
| **IP-3** Two-table flow (newsroom_recipients + embargo_recipients) | APPROVE | F6: lookup by email → INSERT if missing → INSERT/UPDATE embargo_recipient. F2 two-query merge. F4 status derived from `(revoked_at, access_count, last_accessed_at)` columns. |
| **IP-4** Outlet table writes deferred | APPROVE | F4 displays `deriveOutletFromEmail()` label client-side. `newsroom_recipients.outlet_id` stays NULL on creation. v1.1 wires outlet management. |

**No mid-session IPs surfaced.** Composition followed the ratified plan exactly.

---

## 3. Decisions that diverged

Four small directive-vs-implementation reconciliations:

1. **F5 DELETE corrected to UPDATE state='cancelled' + clear pack.embargo_id per PRD §3.2/§3.3 state-machine semantics. Hard-delete was an unintended unilateral divergence; corrected pre-commit per founder ratification.** The schema's `newsroom_embargo_state` enum includes `'cancelled'` with `cancelled_at` timestamp; PRD §3.3 specifies cancellation as a state transition, not row removal. NR-D9's state-machine work depends on cancelled rows existing for state-machine reasoning + audit history. Recipients remain attached to the cancelled embargo as historical record; their tokens become moot once state ≠ 'active' (NR-D11 resolver treats cancelled the same as revoked_at IS NOT NULL → 410 Gone). Two-INSERT atomicity caveat applies (embargo UPDATE + pack UPDATE) — same shape as NR-D7a/D8 recipient creation; v1 acceptance per existing DIRECTIVE_SEQUENCE.md backlog. Detection: newsroom_packs.embargo_id pointing at a state='cancelled' row is the orphan signal.

2. **Pack-status='draft' guard on ALL embargo + recipient mutations.** PRD §5.1 P8 includes "Revoke access" and "Early lift" as post-schedule actions; NR-D8 defers both to NR-D9 alongside the state-machine RPC. This matches the directive's pre-decision ([§3 audit (d)](docs/public-newsroom/directives/NR-D8-embargo-configuration.md)) but is worth re-asserting here as a PRD-divergence we accept consciously.

3. **F6 invite-email failure is non-fatal but creates an awkward retry UX.** If the email send fails, the embargo_recipient row persists with `revoked_at IS NULL` (active). A subsequent re-add for the same email hits the 409 'already-invited' branch, not the re-add UPDATE branch. Workaround: admin manually revokes, then re-adds. Logged inline in F6 + worth a v1.1 backlog item (e.g. dedicated "Resend invite" button — PRD §5.1 P8 mentions it as a column action; deferred per directive).

4. **F6 UTC lift_at fallback for invite emails — recipient TZ unknown at invite time.** PRD §5.1 P8 says "recipient's local TZ" but that data isn't available pre-access. UTC + offset rendered (e.g. "2026-05-01 14:00 UTC"). v1.1: derive from first-access timezone, or sender-specified recipient TZ. Logged in DIRECTIVE_SEQUENCE.md v1.1 backlog ("Embargo invite TZ rendering").

---

## 4. Open questions for founder

- **Visual smoke (VERIFY 7) deferred** — same fixture-dependence as every prior directive. Coverage delivered via VERIFY 6 (5 surfaces × 401 fail-closed) + F10 unit tests + typecheck.

- **F6 invite-email-failed retry path is awkward** (see §3.3). Worth confirming whether v1.1 should add either (a) a "Resend invite" button surfaced in F4's actions column, or (b) the email-send failure path automatically rolling back the embargo_recipient INSERT. Option (a) is simpler and matches PRD §5.1 P8's column spec; option (b) adds two-INSERT atomicity concerns.

- **lift_at TZ-conversion uses Intl.DateTimeFormat's `longOffset`** — works for almost every IANA zone but has known edge cases on DST transition boundaries (the wall-clock during the "spring forward" hour is undefined; "fall back" hours are ambiguous). v1 acceptable — admins picking lift times are unlikely to hit these (they choose "Tuesday 9am" not "Sunday 2:30am during spring-forward"). v1.1 polish via Temporal API when stable.

- **PRD §3.3 cancel precondition** ("Embargo cancellable when no recipient has accessed") is implemented in F5 DELETE. In NR-D8 this is structural — no resolver yet → no `first_accessed_at` rows. NR-D11's preview resolver will start populating those, at which point the DELETE 409 'accessed' shape becomes user-facing. Verify NR-D11 dispatch revisits whether the F5 guard wording ("accessed") and HTTP status (409) match the resolved-state UX.

- **Two-INSERT atomicity caveat (recipient + embargo_recipient)** is the same shape as NR-D7a's asset+scan_result. v1 acceptance per existing DIRECTIVE_SEQUENCE.md backlog entry. NR-D8's variant: orphan `newsroom_recipients` row possible if step 2 (embargo_recipient INSERT) fails after step 1 (recipient INSERT). Detection via `LEFT JOIN newsroom_embargo_recipients USING (recipient_id)` returning NULL — deferred cleanup sweep.

- **Re-add token rotation** — F6's UPDATE branch on revoked rows resets `access_count = 0`, both `*_accessed_at` NULL, and `invited_at = now()`. The schema's CHECK constraint enforces (count=0 ⇔ both timestamps NULL); the UPDATE satisfies it. Worth confirming this satisfies the audit-trail intent — the previous invite's access_count is lost on re-add. v1.1 may want a separate `embargo_invites` audit table if access-history persistence becomes a requirement.

---

## 5. Test results

```
$ bunx vitest run src/lib/newsroom/__tests__/embargo.test.ts
 Test Files  1 passed (1)
      Tests  26 passed (26)
   Duration  384ms
```

26/26 passed. Breakdown:

| Group | Count | Notes |
|---|---|---|
| `generateRecipientToken` | 3 | 32-char base64url shape, distinctness across calls, no-arg (random not HMAC) |
| `buildPreviewUrl` | 4 | PRD shape, newsroom subdomain, query-param token, URL-encode reserved chars |
| `createEmbargoSchema` | 6 | valid, missing lift_at, lift_at no-offset, empty policy, oversized policy, notify default |
| `updateEmbargoSchema` | 3 | empty rejected, single-field, invalid-field rejected |
| `addRecipientSchema` | 3 | valid, malformed, oversized |
| `deriveOutletFromEmail` | 7 | simple .com, multi-part TLD (.co.uk), www. prefix, case fold, malformed (3 cases) |
| **Total** | **26** | (directive estimated 14–18; extras are defensive — IP-1/IP-2 invariants merit explicit assertions) |

Full newsroom + scanner suite (VERIFY 3): **259/259 across 15 files** — NR-D5b-i + NR-D5b-ii + NR-D4 + NR-D6a + NR-D6b + NR-D7a + NR-D7b + NR-D8 all green.

---

## 6. Build + typecheck

| Step | Command | Result |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 (silent) |
| Vitest (embargo) | `bunx vitest run src/lib/newsroom/__tests__/embargo.test.ts` | 26/26 |
| Vitest (full suite) | `bunx vitest run src/lib/newsroom/__tests__ src/lib/scanner/__tests__` | 259/259 across 15 files |
| Build | `bun run build` | exit 0; **route count 110 → 114 (+4)** — embargo page + 3 API routes |
| Scope diff | `git status --porcelain` | 1M (F1) + 7 untracked entries expanding to 10 files; zero strays |

**Route count delta confirmed:** baseline 110 (NR-D7b close) → 114 with the 4 new routes:
- `/newsroom/[orgSlug]/manage/packs/[packSlug]/embargo` (page)
- `/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo` (POST + PATCH + DELETE)
- `/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo/recipients` (POST)
- `/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo/recipients/[recipientId]` (DELETE)

---

## 7. Runtime smoke

Two-phase smoke per the standing carry-forward (dev-server bounce after build).

**VERIFY 6 — five surfaces (no auth):**

```
$ curl -s -H "Host: newsroom.frontfiles.localhost" \
    http://localhost:3000/some-test-org/manage/packs/some-pack/embargo
HTTP 200 — body 31 846 bytes; AdminGate "Loading…" placeholder

$ curl -s -X POST -H "Content-Type: application/json" -d '{}' \
    http://localhost:3000/api/newsroom/orgs/some-test-org/packs/some-pack/embargo
HTTP 401 {"ok":false,"reason":"unauthenticated"}

$ curl -s -X PATCH -H "Content-Type: application/json" -d '{}' \
    http://localhost:3000/api/newsroom/orgs/some-test-org/packs/some-pack/embargo
HTTP 401 {"ok":false,"reason":"unauthenticated"}

$ curl -s -X POST -H "Content-Type: application/json" -d '{}' \
    http://localhost:3000/api/newsroom/orgs/some-test-org/packs/some-pack/embargo/recipients
HTTP 401 {"ok":false,"reason":"unauthenticated"}

$ curl -s -X DELETE \
    http://localhost:3000/api/newsroom/orgs/some-test-org/packs/some-pack/embargo/recipients/some-id
HTTP 401 {"ok":false,"reason":"unauthenticated"}
```

✓ All 4 mutating routes fail-closed at the auth boundary. Page route returns 200 with the AdminGate `Loading…` placeholder (consistent with every prior NR-D6/D7/D8 page).

**End-to-end embargo + recipient + invite-email smoke** was NOT executed — would require a signed-in admin Bearer token + a real verified-source company + a real Resend dev key + a test inbox. Same fixture-dependence as prior directives (NR-D5b-ii's email-OTP smoke had the same gap). Coverage delivered via:
- F10 unit tests (26 cases incl. token randomness + PRD URL shape)
- typecheck on F3/F4 client state machines + F2 server-side merge logic
- VERIFY 6 confirms all 4 mutating routes fail-closed

---

## 8. Verdict

**Pass.** Directive scope met as ratified: 10 NEW + 1 EDIT = 11 deliverables; +4 routes (110 → 114). All four IPs honoured. PRD §5.1 P8 verbatim copy in F3 (toggle/fields/helpers) + F4 (revoke confirm + status labels) + F9 (invite email subject + body). PRD §5.3 J5 URL shape locked in `buildPreviewUrl` (IP-1). Random tokens stored directly per schema (IP-2). Two-table flow with re-add semantic per founder ratification (IP-3). Outlet table writes deferred to v1.1 (IP-4).

NR-D8 is ready for commit + push + founder ratification.

**Phase NR-2 progress: 8 of 9 directives done (89%).** **One directive left to close NR-G2: NR-D9 (rights warranty + publish + state machine RPC).** NR-D9 lights up: (a) the publish CTA in `pack-editor-shell.tsx`'s top bar (currently disabled with NR-D9 tooltip), (b) the embargo lift worker (active → lifted at lift_at, simultaneous Pack publish), (c) cancel-embargo post-schedule, (d) early-lift confirmation, (e) revoke-recipient post-schedule (relaxes NR-D8's draft-only guard).

---

## 9. Carry-forward observations

1. **Two-INSERT atomicity caveat now applies to TWO directive shapes**: NR-D7a's asset+scan_result and NR-D8's recipient+embargo_recipient. DIRECTIVE_SEQUENCE.md backlog item already exists; this directive adds the concrete second instance worth flagging when the v1.1 RPC wrapper lands.

2. **`Intl.DateTimeFormat` `longOffset` for IANA-zone TZ math** — works in modern Node + browsers; v1.1 should swap to Temporal API when stable. F3's `localToUtcIso` helper is the reference pattern; future surfaces with TZ-aware datetime inputs (NR-D9 publish_at?) can copy.

3. **Random tokens stored directly are simpler than HMAC + hash columns**. Per IP-2, the schema's `access_token UNIQUE NOT NULL` design is correct — random base64url(24) gives ≥192 bits, UNIQUE enforces no-collision, no hash column needed for constant-time verify (UNIQUE index lookup IS the verify). Future directives that need URL-secret tokens (J5 access, J6 share links?) should mirror this pattern unless the threat model specifically demands HMAC derivation.

4. **PRD-vs-directive URL drift** is a recurring audit finding (NR-D6b had `/p/{slug}` drift; NR-D8 has 3-dimension drift). Worth adding to the directive template's audit checklist: "verify any consumer-facing URL string against PRD §9 / canonical-url.ts before composition".

5. **Re-add semantic with token rotation** is a clean pattern for "soft-delete + re-engage" workflows. Future directives with similar shapes (subscription resubscribe? watermark-profile re-link?) can follow F6's branch pattern.

6. **`pack-editor-shell.tsx` is now the central tab-activation file** — all three tabs are wired through it. NR-D9 doesn't add a new tab but does activate the disabled Publish CTA; same shell file gets a small EDIT in NR-D9.

7. **F6's email-failed retry awkwardness is a v1.1 polish item** — not a structural defect. The simplest fix is a "Resend invite" button (already a PRD §5.1 P8 column action, deferred). Consider sequencing: Resend invite + admin-side audit lands in NR-D17, not NR-D9. Document the gap in the v1.1 backlog if it surfaces in beta usage.
