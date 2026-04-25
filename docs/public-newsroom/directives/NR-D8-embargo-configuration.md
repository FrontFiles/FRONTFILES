# NR-D8 — Embargo Configuration + Recipient Management

**Phase:** NR-2 (Distributor build)
**Predecessor:** NR-D7b (`1b29368`) — AV scanning pipeline
**Branch:** `feat/newsroom-phase-nr-2`
**Expected scope:** ~9 new + 1 modified file; route count delta +4 (110 → 114)

---

## 1. Why this directive

NR-D7a/D7b shipped the assets surface; the third Pack-editor tab (Embargo) is still a disabled placeholder. NR-D8 lights it up per **PRD §5.1 P8**:

- Toggle: "Release under embargo" (off = publish immediately or at `publish_at`; on = embargo with lift time + policy)
- Fields: lift time (datetime + timezone), policy text, auto-notify on lift
- Approved recipients: list with add/remove/revoke + per-recipient access tracking placeholder
- Invite email via Resend (mirrors NR-D5b-ii email pattern)
- Pre-lift access token generation (HMAC, reuses `NEWSROOM_VERIFICATION_HMAC_SECRET`)

**Out of scope (deferred):**

- **Embargo lift worker** (active → lifted transition at lift_at, simultaneous Pack publish) — NR-D9 owns the state machine RPC + worker
- **Pre-lift preview page** (the resolver that consumes the token URL) — NR-D11 (consumer-side, Phase NR-3)
- **Per-recipient access logging** (`access_count` increments, `accessed_at_first` / `accessed_at_last`) — Phase NR-3 when the resolver fires
- **Early-lift flow** ("Lift now" before lift_at) — NR-D9 (state-transition territory)
- **Cancellation flow** (scheduled → draft pulls back the embargo) — NR-D9

NR-D8 is the **distributor-side configuration surface only**. The recipient-side experience and the lift mechanics ship downstream.

---

## 2. Source-of-truth references

| Artefact | Path | Sections |
|---|---|---|
| PRD | `docs/public-newsroom/PRD.md` | §3.2 Embargo (line 386), EmbargoRecipient (line 401), §3.3 transitions (line 562), **§5.1 P8 Toggle + fields + recipients + invite email + revoke (lines 877–915, verbatim)** |
| Existing migrations | `supabase/migrations/20260425000003_*` (NR-D2b) | `newsroom_embargoes`, `newsroom_embargo_recipients` tables; `newsroom_embargo_state` enum (`active`/`lifted`/`cancelled`) |
| Existing schema.ts | `src/lib/db/schema.ts` | Confirm `NewsroomEmbargoRow`, `NewsroomEmbargoState`, `NewsroomEmbargoRecipientRow` types |
| Existing email infra | `src/lib/email/client.ts` + `send.ts` (NR-D5b-ii precedent) | `sendTransactionalEmail({to, subject, html, text, ...})`, `getTransactionalFrom()` |
| Existing HMAC infra | `src/lib/newsroom/verification.ts` | Secret loading via `NEWSROOM_VERIFICATION_HMAC_SECRET`. Reuse the same secret for embargo tokens (single rotation point). |
| NR-D6b precedent | `src/app/.../packs/[packSlug]/_components/pack-editor-shell.tsx` | Tab nav placeholder for Embargo tab — F1 EDIT activates it |

PRD §5.1 P8 is verbatim authority for: toggle copy, field labels, recipient column headers, invite email subject + body template, revoke confirmation copy, early-lift confirmation copy.

---

## 3. AUDIT FIRST — MANDATORY

### Pre-audit findings (verified during drafting)

- (P1) **Embargo + recipient tables exist** in NR-D2b migration (20260425000003).
- (P2) **HMAC secret reuse** — established in NR-D5b-i / NR-D5b-ii / verification.ts pattern. Embargo tokens derive from same secret.
- (P3) **Resend client exists** — `sendTransactionalEmail` from NR-D5b-ii. Mock-mode when `RESEND_API_KEY_TRANSACTIONAL` absent.
- (P4) **Pack-editor shell** has the Embargo tab as a disabled `<span>` from NR-D6b; NR-D7a's pattern (Assets tab activation) provides the exact mechanical edit shape.

### Audit checks to run

#### (a) `newsroom_embargoes` schema + RLS
- Confirm columns: `id, pack_id, lift_at, policy_text, state, lifted_at, cancelled_at, notify_on_lift, created_at, updated_at`. Match PRD §3.2 verbatim.
- Confirm RLS posture: SELECT for org admins (mirrors `newsroom_packs`); INSERT/UPDATE/DELETE policies for admins of parent pack's company.
- Service-role bypasses; standing decision (service-role write) holds. Surface as IP if any policy diverges.

#### (b) `newsroom_embargo_recipients` schema + RLS
- Confirm columns: `id, embargo_id, email, outlet, status (enum: invited / accessed), access_count, accessed_at_first, accessed_at_last, token_hash, revoked_at, created_at, updated_at`.
- Confirm `(embargo_id, email)` UNIQUE constraint.
- Confirm RLS — admin-self for the parent embargo's pack's company.

#### (c) Schema.ts row types
- Confirm `NewsroomEmbargoRow`, `NewsroomEmbargoState`, `NewsroomEmbargoRecipientRow`, `NewsroomEmbargoRecipientStatus` are exported. If any missing, surface as IP (no schema.ts edit expected — types likely landed in NR-D2b).

#### (d) Pack-status guard
- Embargo CRUD only permitted while `pack.status === 'draft'` (mirrors NR-D6b PATCH guard, NR-D7a asset CRUD guard). Once Pack transitions to `scheduled` or beyond, embargo is locked. Confirm this is the right v1 posture vs. allowing edits to scheduled-state embargoes (PRD §5.1 P8 includes "Early lift" and "Revoke access" actions which fire post-schedule — note these are out-of-scope for NR-D8 but worth flagging).

**Decision in this directive:** NR-D8 permits embargo configuration AND recipient add/remove only on `draft` packs. "Revoke access" (PRD §5.1 P8 says permitted post-schedule) is deferred to NR-D9 (alongside the early-lift flow). Document in exit report under "Decisions that diverged" — minor PRD divergence justified by directive boundary.

#### (e) Token-URL pattern
- Read PRD §9 (URL namespace). Confirm the consumer-side preview URL shape. Default expectation: `https://frontfiles.com/preview/{token}` (consumer subdomain, token-only, no slug leakage).
- Surface as IP if PRD specifies a different shape. The URL string itself is generated by F8's helper and embedded in the invite email; the resolver lives in NR-D11.

#### (f) Resend FROM address
- Reuse `getTransactionalFrom()` from NR-D5b-ii. Same pattern as the OTP email. No new env vars; no new sender identity.

#### (g) Embargo-recipient access token shape
- Token = HMAC-SHA256(NEWSROOM_VERIFICATION_HMAC_SECRET, `${recipient_id}:${embargo_id}:${lift_at_iso}`) → base64url, 32 chars.
- Stored as `token_hash` (SHA-256 of the token, 64 hex chars) for constant-time verify in NR-D11.
- Surface as IP if codebase has a different token-hashing convention.

### Audit deliverable

After running checks (a)–(g), report:
- Findings table.
- IPs requiring sign-off.
- Locked file list.

---

## 4. Scope

| F# | File | Action | Est. lines |
|---|---|---|---|
| F1 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/_components/pack-editor-shell.tsx` | EDIT — flip Embargo tab from disabled span to active link | +5 / -3 |
| F2 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/embargo/page.tsx` | NEW — server component; fetches Pack + Embargo + Recipients; renders embargo form + recipients list | ~140 |
| F3 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/embargo/_components/embargo-form.tsx` | NEW — `'use client'` toggle + lift_at + timezone + policy_text + auto-notify; POST/PATCH on submit | ~250 |
| F4 | `src/app/newsroom/[orgSlug]/manage/packs/[packSlug]/embargo/_components/recipients-list.tsx` | NEW — `'use client'` add-recipient form + recipient table; per-row revoke action | ~220 |
| F5 | `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo/route.ts` | NEW — POST (create) + PATCH (update) + DELETE (cancel) | ~280 |
| F6 | `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo/recipients/route.ts` | NEW — POST (add recipient + send invite) | ~220 |
| F7 | `src/app/api/newsroom/orgs/[orgSlug]/packs/[packSlug]/embargo/recipients/[recipientId]/route.ts` | NEW — DELETE (revoke recipient) | ~140 |
| F8a | `src/lib/newsroom/embargo-form-constants.ts` | NEW — client-safe constants: `EMBARGO_POLICY_MAX`, `EMBARGO_RECIPIENT_EMAIL_MAX`, timezone list, datetime formatting helpers | ~70 |
| F8b | `src/lib/newsroom/embargo.ts` | NEW — `'server-only'` zod schemas (createEmbargoSchema, updateEmbargoSchema, addRecipientSchema), `deriveRecipientToken()`, `hashRecipientToken()`, `buildPreviewUrl()` | ~140 |
| F9 | `src/lib/email/templates/newsroom-embargo-invite.ts` | NEW — `buildEmbargoInviteEmail({ recipient, pack, embargo, senderOrg, previewUrl }) → { subject, html, text }` | ~120 |
| F10 | `src/lib/newsroom/__tests__/embargo.test.ts` | NEW — vitest cases: token derive, hash, schema validation, preview-URL build | ~160 |

Totals: 10 NEW + 1 EDIT = 11 conceptual deliverables; +4 routes (1 page + 3 API). 110 → 114.

Note on F8 split: applies the established constants/zod split pattern from NR-D6b IP-1 / NR-D7a IP-2 preemptively. F3 + F4 (client) need `EMBARGO_POLICY_MAX` and the timezone list for client-side validation hints.

---

## 5. F-specs

### F1 — `pack-editor-shell.tsx` (EDIT)

Locate the Embargo tab placeholder span. Replace with `<Link href={\`/${orgSlug}/manage/packs/${pack.slug}/embargo\`}>`. Active state styling for `/embargo` route. Disabled-in-create-mode handling matches F2 of NR-D7a (no pack.slug yet).

### F2 — `/manage/packs/[packSlug]/embargo/page.tsx` (NEW)

Server component. Fetches:
1. Company → 404 if missing
2. Newsroom profile → 404 if missing
3. Pack by `(company_id, slug)` → 404 if missing
4. Status guard: `pack.status !== 'draft'` → render stub "This pack is no longer editable. Status: {status}." (mirrors NR-D6b page.tsx pattern)
5. Embargo by `pack_id` (LEFT JOIN; embargo may not exist yet)
6. Recipients by `embargo_id` (only if embargo exists)

Renders:

```tsx
<PackEditorShell orgSlug={...} orgName={...} pack={...} saveState="saved">
  <EmbargoForm
    orgSlug={orgSlug}
    packSlug={pack.slug}
    embargo={embargo}  // null if not yet configured
  />
  {embargo && (
    <RecipientsList
      orgSlug={orgSlug}
      packSlug={pack.slug}
      embargoId={embargo.id}
      recipients={recipients}
    />
  )}
</PackEditorShell>
```

If embargo is null and toggle is off, only the EmbargoForm renders (no recipients section). RecipientsList only mounts after the embargo exists.

### F3 — `embargo-form.tsx` (NEW, `'use client'`)

The toggle + fields. Three modes:

- **No embargo** (initial): toggle off, fields hidden, button "Set up embargo"
- **Editing draft embargo** (embargo exists, state='active', recipients possibly attached): toggle on, fields populated, button "Save changes"
- **Removing embargo** (toggle flipped off when embargo exists): confirmation modal "Removing this embargo will release the pack on publish without a hold. Recipients lose pre-lift access. Continue?" → DELETE on confirm

**Field copy (PRD §5.1 P8 verbatim):**

| Field | Label | Helper |
|---|---|---|
| Toggle | "Release under embargo" | (off = publish immediately or at `publish_at`) |
| Lift at | "Lift at" | datetime + timezone (default Org country canonical TZ; UTC offset always rendered) |
| Policy text | "Embargo policy" | "Tell recipients what they can and cannot do before lift. Shown on the preview page and in invite emails." |
| Auto-notify | "Notify subscribers when embargo lifts." | (default on) |

Submit:
- Create: POST `/api/newsroom/orgs/{orgSlug}/packs/{packSlug}/embargo`
- Update: PATCH same endpoint
- Delete: DELETE same endpoint

Auth: `getSupabaseBrowserClient()` → session → Bearer fetch. Mirrors NR-D6b / NR-D7a precedent.

### F4 — `recipients-list.tsx` (NEW, `'use client'`)

Two parts:

**Add-recipient form** (above the table):
- Email input
- "Add recipient" button → POST to recipients endpoint → on 201, optimistically prepends row + clears form

**Recipients table:**

| Column | Source | Render |
|---|---|---|
| Email | `newsroom_recipients.email` (joined) | (text) |
| Outlet | `deriveOutletFromEmail(email)` client-side derived | (text; not from `newsroom_outlets` table — IP-4 deferral) |
| Status | **Derived from columns** (no `status` enum exists per IP-3 schema audit): `revoked_at IS NOT NULL` → "Revoked {date}"; `access_count === 0 AND revoked_at IS NULL` → "Invited"; `access_count >= 1` → "Last accessed {rel}" | (PRD §5.1 P8 strings used) |
| Access count | `newsroom_embargo_recipients.access_count` | Always 0 in NR-D8 since resolver isn't built |
| Actions | "Resend invite" (deferred to v1.1) / "Revoke access" | |

**Two-query merge in F2** to populate the table: F2 fetches `newsroom_embargo_recipients` filtered by `embargo_id`, then a second query against `newsroom_recipients` filtered by the resolved `recipient_id` set, then JS-merges by `recipient_id`. Mirrors NR-D7a's embargo-on-pack-list pattern.

**Revoke confirmation:**
> "Revoke access for {email}? Their token will return 410 Gone. They can be re-invited later by adding them again."

→ DELETE `/api/.../embargo/recipients/[recipientId]` → on 204, optimistically marks row revoked.

In NR-D8 v1: revoked recipients render with strikethrough + "(revoked {date})". Re-add is allowed; the unique constraint `(embargo_id, email)` is enforced by re-using the existing row (UPDATE clear `revoked_at`) — surface as IP if the API decides on a different re-add semantic.

### F5 — `/api/.../packs/[packSlug]/embargo/route.ts` (NEW)

Three methods, single file. All require Bearer auth → admin membership query → pack-status='draft' guard → service-role write.

- **POST** — create embargo. Body: `{ lift_at, policy_text, notify_on_lift }`. Validate via `createEmbargoSchema`. INSERT row with `state='active'`. Return 201 with embargo row.
- **PATCH** — update existing embargo. Body: partial. Validate via `updateEmbargoSchema`. UPDATE. Return 200 with updated row.
- **DELETE** — cancel embargo. Refuse if embargo has any recipients with `accessed_at_first IS NOT NULL` (PRD §3.3 transition rule: "scheduled → draft, Embargo cancellable when no recipient has accessed"). In NR-D8 this is always true (no resolver yet → no accesses) so the guard is structural. UPDATE `state='cancelled'`, `cancelled_at=now()`. CASCADE handled by FK. Return 204.

### F6 — `embargo/recipients/route.ts` (NEW, POST)

**Post-IP-3 corrections applied.** Two-table flow: `newsroom_recipients` (canonical identity by email) + `newsroom_embargo_recipients` (junction with token).

Add a recipient. Body: `{ email }`. Validates via `addRecipientSchema`.

Steps:
1. Auth → admin → resolve pack via slug → status='draft' guard
2. Verify embargo exists for pack → 404 if not
3. Validate email format via `addRecipientSchema`
4. **Upsert recipient identity** in `newsroom_recipients`:
   ```sql
   SELECT id FROM newsroom_recipients WHERE email = ?
   -- if not found:
   INSERT INTO newsroom_recipients (email, outlet_id, name, verified)
     VALUES (?, NULL, NULL, false) RETURNING id
   ```
   `outlet_id = NULL` per IP-4 (outlet table writes deferred). Display label derived client-side via `deriveOutletFromEmail`.
5. Check uniqueness: `SELECT 1 FROM newsroom_embargo_recipients WHERE embargo_id = ? AND recipient_id = ?`. If exists AND `revoked_at IS NULL` → 409 with `reason: 'already-invited'`. If exists AND `revoked_at IS NOT NULL` → re-add semantic: UPDATE to clear `revoked_at` + rotate `access_token` to a fresh value (skip step 6's INSERT, jump to step 7).
6. Generate token: `generateRecipientToken()` → 32-char base64url random.
7. INSERT into `newsroom_embargo_recipients` with `recipient_id`, `access_token`, `access_count = 0`, `accessed_at_first = NULL`, `accessed_at_last = NULL`, `revoked_at = NULL`.
8. Build preview URL: `buildPreviewUrl(orgSlug, packSlug, token)` → PRD §5.3 J5 shape.
9. Send invite via `sendTransactionalEmail({ to: email, ...buildEmbargoInviteEmail({ recipientEmail, packTitle, senderOrgName, liftAtFormatted, policyText, previewUrl }) })`.
10. If email send fails: log + continue. Recipient row persists; admin can re-add for retry. Accept v1.
11. Return 201 with `{ recipient: { id, email, ... }, embargoRecipient: { id, recipient_id, ... }, previewUrl }`. Client uses this for optimistic table append.

**Two-INSERT atomicity caveat applies** (recipient row + embargo_recipient row). Sequential, accept orphan `newsroom_recipients` row on step 7 failure. Already in v1.1 backlog; new instance documented in exit report under "Decisions that diverged".

### F7 — `embargo/recipients/[recipientId]/route.ts` (NEW, DELETE)

Revoke a recipient. Auth → admin → resolve pack → status='draft' guard.

UPDATE `revoked_at = now()`. Return 204.

### F8a — `embargo-form-constants.ts` (NEW, client-safe)

```ts
export const EMBARGO_POLICY_MAX = 5000
export const EMBARGO_RECIPIENT_EMAIL_MAX = 320

// Common timezone list (subset; users with exotic TZs can't yet pick — v1.1).
// Format: { value: 'IANA/Zone', label: 'Display Name (UTC offset)' }
export const COMMON_TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'Eastern Time (US/Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US/Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Lisbon', label: 'Lisbon' },
  // ...etc
]

export function deriveOutletFromEmail(email: string): string {
  // Extract domain, strip 'www.', title-case the second-to-last segment
  // ('reuters.com' → 'Reuters', 'nytimes.com' → 'Nytimes' — admin can edit)
}
```

### F8b — `embargo.ts` (NEW, `'server-only'`)

**Post-IP-1 + IP-2 corrections applied.** Token is RANDOM (not HMAC-derived); URL pattern is PRD §5.3 J5 verbatim.

```ts
import 'server-only'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'

import { NEWSROOM_BASE_URL } from '@/lib/newsroom/canonical-url'
import {
  EMBARGO_POLICY_MAX,
  EMBARGO_RECIPIENT_EMAIL_MAX,
} from './embargo-form-constants'

const RECIPIENT_TOKEN_BYTES = 24  // base64url-encoded → 32 chars, ≥192 bits entropy

export const createEmbargoSchema = z.object({
  lift_at: z.string().datetime(),  // ISO 8601 with TZ
  policy_text: z.string().min(1).max(EMBARGO_POLICY_MAX),
  notify_on_lift: z.boolean().default(true),
})

export const updateEmbargoSchema = createEmbargoSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one field must be provided.' },
)

export const addRecipientSchema = z.object({
  email: z.string().email().max(EMBARGO_RECIPIENT_EMAIL_MAX),
})

/**
 * Generate a per-recipient access token.
 *
 * Schema-locked: stored directly in `newsroom_embargo_recipients.access_token`
 * (UNIQUE column, ≥32 chars, no token_hash column). Random base64url of 24
 * bytes = 32 chars = ≥192 bits entropy. Per the migration column comment:
 * "Opaque URL-safe secret; NEVER client-authored. Generated server-side by
 * the NR-D8 invite RPC."
 *
 * The schema design is "access_token IS the secret" (like an API key).
 * HMAC-derivation rejected per IP-2 audit: less unguessable to insiders
 * + schema-incompatible (no token_hash column).
 *
 * Does NOT use NEWSROOM_VERIFICATION_HMAC_SECRET. NR-D8 has no HMAC reuse.
 */
export function generateRecipientToken(): string {
  return randomBytes(RECIPIENT_TOKEN_BYTES).toString('base64url')
}

/**
 * Build the per-recipient preview URL embedded in the invite email.
 *
 * URL pattern locked by PRD §5.3 J5 (line 1136) verbatim:
 *   `https://newsroom.frontfiles.com/{org-slug}/{pack-slug}/preview?t={access_token}`
 *
 * - Domain: newsroom subdomain (NOT main frontfiles.com).
 * - Path: `/{org-slug}/{pack-slug}/preview`.
 * - Token placement: query param `?t=` (NOT path segment).
 *
 * NR-D11 (consumer-side) implements the resolver that parses `?t=` from the
 * query, looks up the recipient by access_token, and serves the preview page.
 *
 * NEWSROOM_BASE_URL imported from canonical-url.ts:13 — single source of
 * truth for the newsroom subdomain origin. No env-var dependency.
 */
export function buildPreviewUrl(
  orgSlug: string,
  packSlug: string,
  token: string,
): string {
  return `${NEWSROOM_BASE_URL}/${orgSlug}/${packSlug}/preview?t=${token}`
}
```

### F9 — `email/templates/newsroom-embargo-invite.ts` (NEW)

Plain `.ts`, mirrors `test-ping.ts` and `newsroom-domain-otp.ts` shape (no JSX).

```ts
export interface EmbargoInviteInput {
  recipientEmail: string
  packTitle: string
  senderOrgName: string
  liftAtFormatted: string  // pre-formatted in recipient's TZ + UTC offset
  policyText: string
  previewUrl: string
}

export function buildEmbargoInviteEmail(input: EmbargoInviteInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `Embargoed: ${input.packTitle} from ${input.senderOrgName}`
  // Body verbatim from PRD §5.1 P8 invite email block.
  const text = [
    `${input.senderOrgName} has granted you embargoed access to: ${input.packTitle}.`,
    ``,
    `Lifts: ${input.liftAtFormatted}.`,
    ``,
    `Policy from ${input.senderOrgName}: ${input.policyText}`,
    ``,
    `Access the pack here: ${input.previewUrl}`,
    ``,
    `By accessing this pack before lift, you accept the embargo terms above.`,
  ].join('\n')
  // HTML escapes + paragraph wraps the same text. No styling beyond default.
  const html = /* escaped + wrapped */
  return { subject, html, text }
}
```

### F10 — `embargo.test.ts` (NEW)

Vitest cases:
- `generateRecipientToken`: returns 32-char base64url string; multiple calls yield distinct values; cryptographic randomness (no determinism)
- `buildPreviewUrl`: correct shape per PRD §5.3 J5 — `https://newsroom.frontfiles.com/{orgSlug}/{packSlug}/preview?t={token}`. Test cases: standard slug; URL-special chars in slug (escaped); empty token rejected at type level
- `createEmbargoSchema`: valid passes; missing lift_at fails; lift_at non-ISO fails; policy_text too long fails
- `updateEmbargoSchema`: empty fails; partial passes
- `addRecipientSchema`: valid email passes; bad format fails; over-length fails
- `deriveOutletFromEmail`: standard domains; subdomains; case normalization

Aim for 14–18 cases.

---

## 6. New env vars

None. Reuses `NEWSROOM_VERIFICATION_HMAC_SECRET`, `RESEND_API_KEY_TRANSACTIONAL`, `RESEND_FROM_TRANSACTIONAL`, `NEXT_PUBLIC_SITE_URL` — all already in env.ts.

---

## 7. VERIFY block

1. `bun run typecheck` exit 0.
2. `bunx vitest run src/lib/newsroom/__tests__/embargo.test.ts` — green.
3. `bunx vitest run src/lib/newsroom/__tests__ src/lib/scanner/__tests__` — full suite green; prior 233/233 still passing.
4. `bun run build` exit 0; route count 110 → 114 (+4: page + 3 API routes).
5. **Bounce dev server.**
6. Curl smoke (no auth) — 5 surfaces:
   - `GET /{orgSlug}/manage/packs/[any-slug]/embargo` → 200 (AdminGate Loading)
   - `POST /api/newsroom/orgs/{orgSlug}/packs/[any-slug]/embargo` → 401
   - `PATCH /api/newsroom/orgs/{orgSlug}/packs/[any-slug]/embargo` → 401
   - `POST /api/newsroom/orgs/{orgSlug}/packs/[any-slug]/embargo/recipients` → 401
   - `DELETE /api/newsroom/orgs/{orgSlug}/packs/[any-slug]/embargo/recipients/[any-id]` → 401
7. Visual smoke deferred (fixture-dependence; mirrors NR-D5b-i posture).
8. Scope diff: `git status --porcelain` shows exactly 11 paths (1M + 10??).

---

## 8. Exit report mandate

`docs/audits/NR-D8-embargo-configuration-EXIT-REPORT.md`. Standard sections. Founder ratifies before commit + push.

---

## 9. Standing carry-forward checks

- Audit-first IP discipline.
- Service-role for newsroom_embargoes + newsroom_embargo_recipients writes.
- Direct membership query for admin check (NOT the broken RPC).
- Client form (`'use client'`) + Bearer fetch via `getSupabaseBrowserClient`.
- `runtime = 'nodejs'` on F5 + F6 + F7.
- Inline auth helpers (no extraction).
- Preemptive constants/zod split (F8a + F8b) — applies the NR-D6b/D7a IP pattern at composition time.
- **No HMAC secret reuse** (corrected by IP-2 audit). Embargo tokens are random `base64url(randomBytes(24))`, stored directly per schema design. `NEWSROOM_VERIFICATION_HMAC_SECRET` is NOT used in NR-D8.
- Reuse Resend client + FROM helper — no new sender identity.
- PRD §5.1 P8 verbatim for all UI strings + invite email body.
- **CSAM-irrelevant** — embargo data is text + recipient emails; no asset-scan interaction.
- Tight per-directive commits; selective add of exactly 13 paths (11 deliverables + directive + exit report).

---

## 10. Predecessor sequence

NR-D7a → **NR-D7b (`1b29368`)** → **NR-D8 — this directive** → NR-D9 (rights warranty + publish + state machine RPC; ships the embargo lift worker) → NR-G2.

---

End of NR-D8 directive.
