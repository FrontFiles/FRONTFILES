# NR-D9c — Embargo Lift Worker + Subscriber Notifications

**Phase:** NR-2 (Distributor build)
**Predecessor:** NR-D9b (`ee78206`) — publish flow UI
**Branch:** `feat/newsroom-phase-nr-2`
**Expected scope:** ~6 new + 3 modified files; route count delta +1 (116 → 117)

---

## 1. Why this directive

NR-D9a/b shipped the synchronous publish path: distributor clicks Publish → P9 warranty modal → P10 confirmation → `transitionPack(draft → published)`. NR-D9c lights up the **asynchronous publish surfaces** that close NR-G2:

- **Embargo lift worker** — Vercel Cron pass that finds `newsroom_embargoes WHERE state='active' AND lift_at <= now()` and calls `transitionPack(scheduled → published, ...)` for each. The RPC handles atomic state flip (Pack `scheduled → published`, Embargo `active → lifted`).
- **Subscriber notification fanout** — second cron pass that finds Packs with `published_at` recently set AND `notification_sent_at IS NULL`, joins to `newsroom_beat_subscriptions` by `company_id`, sends notification emails via Resend, marks `notification_sent_at`.

**Locked architecture (per founder ratification):**

- **Single cron route** runs both passes per invocation (lift + notify). Reuses NR-D7b's hourly Free-tier schedule.
- **Schema change**: add `notification_sent_at timestamptz NULL` to `newsroom_packs` for idempotency.
- **Notification matching: per-company in v1** (no beat-level filtering — `newsroom_beat_subscriptions.notify_on='new_pack'` rows for the Pack's `company_id` get notified). PRD §3.2 BeatSubscription supports beat hierarchy as a v1.1 layer; v1 ships newsroom-wide.
- **Cron secret**: new env var `NEWSROOM_PUBLISH_CRON_SECRET` (mirrors NR-D7b's `SCANNER_CRON_SECRET` pattern; per-cron secrets accepted v1; v1.1 backlog: consolidate to one `NEWSROOM_CRON_SECRET`).

**Out of scope (deferred):**

- **Inline notifications on immediate publish** — NR-D9b's F7 transition route does NOT fire notifications inline. Up-to-1hr delay between immediate publish and subscriber notification is accepted v1 UX. v1.1 candidate: move notifications to a same-route side-effect or a faster-firing job queue.
- **Beat-level filtering** — per PRD note (line 433–436), v1 is company-wide; beat taxonomy is v1.1.
- **Per-recipient notification preferences** — bulk fanout in v1; preference granularity (digest, mute, frequency) is v1.1.
- **Recipient access tracking on embargo lift** — separate concern (NR-D11 consumer-side resolver).

---

## 2. Source-of-truth references

| Artefact | Path | Sections |
|---|---|---|
| PRD | `docs/public-newsroom/PRD.md` | §3.2 BeatSubscription, §3.3 transitions (lines 568–569: `scheduled → published (auto)`), §11 Analytics (notification surfaces, if present) |
| NR-D9a wrapper | `src/lib/newsroom/pack-transition.ts` | `transitionPack()` — sole state-mutation entry point |
| NR-D7b cron precedent | `src/app/api/cron/newsroom-scan/route.ts` + `vercel.json` | Cron route shape, secret check pattern, batch processing |
| Existing migrations | `supabase/migrations/20260425000005_*` (NR-D2c-ii) | `newsroom_beat_subscriptions` schema (line 450+), `notify_on` enum |
| Resend infra | `src/lib/email/client.ts` + `send.ts` | `sendTransactionalEmail` + `getTransactionalFrom()` |
| Existing schema.ts | `src/lib/db/schema.ts` | `NewsroomPackRow` (column add), `NewsroomBeatSubscriptionRow`, `NewsroomNotifyOn` enum |

---

## 3. AUDIT FIRST — MANDATORY

### Pre-audit findings (verified during drafting)

- (P1) **`newsroom_beat_subscriptions` exists** in NR-D2c-ii migration (line 450+). v1-thin: company-wide subscription grain.
- (P2) **`notify_on` enum** likely includes `'new_pack'`, `'embargo_lift'`, `'update'` (per migration §5 comment). Confirm exact values.
- (P3) **NR-D7b cron pattern** is the template: secret check → batched query → idempotent processing → per-item logging. Mirror exactly.
- (P4) **vercel.json exists** from NR-D7b with `/api/cron/newsroom-scan` entry. F8 appends a second cron entry.

### Audit checks to run

#### (a) `newsroom_beat_subscriptions` RLS + columns
- Confirm exact columns (`recipient_id, company_id, notify_on, created_at`) + indexes.
- Confirm RLS: SELECT for self (recipient), service-role bypass for cron worker. Cron uses service-role.

#### (b) `newsroom_beat_notify_on` enum values (audit-corrected name; was `newsroom_notify_on`)
- Confirmed values (3): `'new_pack'`, `'embargo_lift'`, `'update'`. TS type is `NewsroomBeatNotifyOn`.
- **v1 fanout match: `'new_pack'` ONLY (per IP-1 ratification — Option A).** Rationale: v1 has no J7 UI letting users opt into `'embargo_lift'` independently, so no organic `'embargo_lift'` rows exist. Conservative match keeps semantics honest about what's actually being shipped. v1.1 can broaden to `IN ('new_pack', 'embargo_lift')` when J7 surfaces wire up the per-event opt-in.

#### (c) `newsroom_packs.notification_sent_at` add
- Schema change: ALTER TABLE ADD COLUMN `notification_sent_at timestamptz NULL`. Migration 20260425000008.
- Idempotency: cron's notification pass UPDATEs `SET notification_sent_at = now() WHERE id = ? AND notification_sent_at IS NULL` — race-safe via the WHERE clause.

#### (d) Recipient identity for notification email
- `newsroom_beat_subscriptions.recipient_id` → `newsroom_recipients.email`. Confirm the JOIN works (recipient might be a pre-verified email-only stub vs. a verified user).
- v1: send to the recipient's email regardless of verification status. Document in exit report under "Decisions that diverged" if PRD specifies otherwise.

#### (e) Notification email template content
- PRD doesn't specify the publish-notification email body. Compose template:
  - Subject: `New from {OrgName}: {Pack.title}`
  - Body: `{OrgName} has published a new pack: {Pack.title}. View at {canonicalUrl}. Unsubscribe: {unsubscribeUrl}.`
  - Unsubscribe URL: `{NEWSROOM_BASE_URL}/subscriptions/manage?t={recipient_id}` (placeholder; NR-D14 implements the unsubscribe page)
- Surface as IP if a more elaborate template is specified anywhere.

#### (f) Cron secret env var
- Recommend new var: `NEWSROOM_PUBLISH_CRON_SECRET` (32+ chars HMAC-grade per NR-D7b precedent). Document in `.env.example`.
- v1.1 backlog: consolidate `SCANNER_CRON_SECRET` + `NEWSROOM_PUBLISH_CRON_SECRET` into single `NEWSROOM_CRON_SECRET`.

#### (g) Cron schedule
- Reuse hourly schedule (`"0 * * * *"`) — Vercel Free tier limit per NR-D7b. 1-hour latency on auto-lift IS a real UX concern: if `lift_at='14:30'`, the embargo doesn't lift until 15:00. Document as v1 acceptance; pre-NR-G5 upgrade decision deferred (v1.1 backlog item already logged from NR-D7b).
- Surface as IP if "embargo lift latency must be sub-hour for v1" — would require Pro tier upgrade or alternative scheduling (GitHub Actions every 5min, etc.).

#### (h) Two-pass ordering inside the cron
- Pass A (lift) MUST run before Pass B (notify) within a single cron invocation. Lift auto-fires `published_at` updates that Pass B picks up immediately. If reversed, lifted packs would wait an additional hour for notification.
- Implementation: serial passes inside the route handler. Failures in Pass A logged but don't abort Pass B (some embargoes might lift; some packs might be ready to notify regardless).

### Audit deliverable

Findings table + IPs + locked file list. HALT before composing.

---

## 4. Scope

| F# | File | Action | Est. lines |
|---|---|---|---|
| F1 | `supabase/migrations/20260425000008_newsroom_publish_notification_tracking.sql` | NEW — `ALTER TABLE newsroom_packs ADD COLUMN notification_sent_at timestamptz NULL` + index for cron query | ~30 |
| F2 | `supabase/migrations/_rollbacks/20260425000008_newsroom_publish_notification_tracking.DOWN.sql` | NEW — DROP INDEX + DROP COLUMN | ~10 |
| F3 | `src/lib/newsroom/publish-pipeline.ts` | NEW — `'server-only'`; pure orchestration: `processPendingLifts()` + `processPendingNotifications()` returning structured results; injection points for Supabase client + email send + transitionPack | ~220 |
| F4 | `src/lib/newsroom/__tests__/publish-pipeline.test.ts` | NEW — vitest cases: lift selection, notification dedup via `notification_sent_at`, recipient JOIN, error isolation | ~200 |
| F5 | `src/app/api/cron/newsroom-publish-pipeline/route.ts` | NEW — Vercel Cron endpoint: secret check → Pass A (lifts) → Pass B (notifications) → return aggregated result | ~200 |
| F6 | `src/lib/email/templates/newsroom-publish-notification.ts` | NEW — `buildPublishNotificationEmail({recipient, pack, orgName, canonicalUrl, unsubscribeUrl})` plain `.ts` | ~120 |
| F7 | `src/lib/db/schema.ts` | EDIT — append `notification_sent_at: string \| null` to `NewsroomPackRow` | +3 |
| F8 | `src/lib/env.ts` | EDIT — add `NEWSROOM_PUBLISH_CRON_SECRET` (optional in dev, required in production) | +10 |
| F9 | `vercel.json` | EDIT — append `/api/cron/newsroom-publish-pipeline` cron entry (`"0 * * * *"`) | +3 |

Totals: 6 NEW + 3 EDIT = 9 conceptual deliverables; +1 route (`/api/cron/newsroom-publish-pipeline`); 116 → 117.

---

## 5. F-specs

### F1 — `20260425000008_newsroom_publish_notification_tracking.sql` (NEW)

```sql
-- Add notification idempotency tracking on Pack rows.
-- Cron worker (NR-D9c) marks notification_sent_at when subscriber
-- fanout completes successfully. Re-runs are race-safe via the
-- WHERE clause `notification_sent_at IS NULL`.

ALTER TABLE newsroom_packs
  ADD COLUMN notification_sent_at timestamptz NULL;

COMMENT ON COLUMN newsroom_packs.notification_sent_at IS
  'When subscriber notifications were dispatched for this pack''s '
  'publish event. NULL = not yet sent. Set by NR-D9c cron worker. '
  'Race-safe UPDATE via WHERE notification_sent_at IS NULL.';

-- Partial index for the cron's hot query: find published packs not
-- yet notified. Tiny table for v1; index keeps cron fast at scale.
CREATE INDEX idx_newsroom_packs_unnotified_published
  ON newsroom_packs (published_at)
  WHERE published_at IS NOT NULL
    AND notification_sent_at IS NULL;
```

### F2 — Rollback

```sql
DROP INDEX IF EXISTS idx_newsroom_packs_unnotified_published;
ALTER TABLE newsroom_packs DROP COLUMN IF EXISTS notification_sent_at;
```

### F3 — `publish-pipeline.ts` (NEW, `'server-only'`)

Pure orchestration. No I/O of its own — caller (F5) injects Supabase client, email send function, and `transitionPack` reference.

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { TransitionResult } from './pack-transition'

export interface LiftPipelineInput {
  client: SupabaseClient
  transitionPack: (input: { packId: string; targetStatus: 'published'; callerUserId: string }) => Promise<TransitionResult>
  systemUserId: string  // for callerUserId; cron has no human; designate a system uuid
  batchSize?: number    // default 10
  now?: Date            // injected for tests
}

export interface LiftPipelineOutput {
  processed: number
  lifted: ReadonlyArray<{ embargoId: string; packId: string; result: TransitionResult }>
  errors: ReadonlyArray<{ embargoId: string; error: string }>
}

export async function processPendingLifts(input: LiftPipelineInput): Promise<LiftPipelineOutput> {
  // 1. SELECT id, pack_id FROM newsroom_embargoes
  //    WHERE state='active' AND lift_at <= now()
  //    ORDER BY lift_at ASC LIMIT batchSize
  // 2. For each: call transitionPack({ packId, targetStatus: 'published', callerUserId: systemUserId })
  //    The RPC's scheduled → published branch handles embargo state flip + pack publish atomically.
  // 3. Collect results; per-item errors logged + collected, do NOT abort batch.
}

export interface NotifyPipelineInput {
  client: SupabaseClient
  sendEmail: (input: { to: string; subject: string; html: string; text: string; traceId: string; actorId: string }) => Promise<{ ok: boolean; messageId?: string; error?: string }>
  buildNotificationEmail: (input: { /* see F6 */ }) => { subject: string; html: string; text: string }
  newsroomBaseUrl: string  // for canonical URL + unsubscribe URL construction
  batchSize?: number
  now?: Date
}

export interface NotifyPipelineOutput {
  processed: number
  notified: ReadonlyArray<{ packId: string; recipientCount: number; emailsSent: number }>
  errors: ReadonlyArray<{ packId: string; error: string }>
}

export async function processPendingNotifications(input: NotifyPipelineInput): Promise<NotifyPipelineOutput> {
  // 1. SELECT id, company_id, slug, title FROM newsroom_packs
  //    WHERE published_at IS NOT NULL AND notification_sent_at IS NULL
  //    ORDER BY published_at ASC LIMIT batchSize
  // 2. For each pack:
  //    a. JOIN: SELECT r.email FROM newsroom_beat_subscriptions s
  //       JOIN newsroom_recipients r ON r.id = s.recipient_id
  //       WHERE s.company_id = ? AND s.notify_on = 'new_pack'
  //    b. SELECT name FROM companies WHERE id = pack.company_id (for OrgName)
  //    c. canonicalUrl = packCanonicalUrl(orgSlug, pack.slug)
  //    d. unsubscribeUrl = `${newsroomBaseUrl}/subscriptions/manage?t=${recipient.id}` (placeholder; NR-D14)
  //    e. For each recipient: build email + send. Per-recipient failures logged but don't block batch.
  //    f. UPDATE newsroom_packs SET notification_sent_at = now()
  //       WHERE id = pack.id AND notification_sent_at IS NULL  (race-safe)
  // 3. Return aggregated result.
}
```

Failure isolation: per-pack and per-recipient errors are logged + collected; batch never aborts. The cron's UPDATE with `WHERE notification_sent_at IS NULL` ensures retry on the next run.

### F4 — `publish-pipeline.test.ts` (NEW)

Vitest cases (mock client + mock email + mock transitionPack):

**processPendingLifts:**
- 0 pending → returns `{processed: 0}`
- 1 pending lift → calls transitionPack with target='published'; result captured
- 3 pending → batch processes all 3
- transitionPack error on 2nd → 1st succeeds, 2nd error captured, 3rd still processes
- batchSize=2 → only 2 processed, 3rd remains for next run
- now injection → controls the `lift_at <= now()` selection

**processPendingNotifications:**
- 0 unnotified → returns `{processed: 0}`
- 1 pack with 3 subscribers → 3 emails sent + notification_sent_at set
- Pack with 0 subscribers → notification_sent_at set, 0 emails (no-subscribers is a successful "notify nobody" case)
- Email send error on 2/3 recipients → 2 errors captured, 3rd succeeds, notification_sent_at still set (best-effort)
- Race: notification_sent_at already set by another worker → skipped via WHERE
- Empty subscription table → all packs marked notified with 0 emails

Aim for 14–18 cases.

### F5 — `/api/cron/newsroom-publish-pipeline/route.ts` (NEW)

```ts
export const runtime = 'nodejs'

export async function GET(request: Request) {
  // 1. Cron secret check: Authorization: Bearer ${env.NEWSROOM_PUBLISH_CRON_SECRET}
  //    → 401 if missing or mismatched
  // 2. Service-role client + email infra
  // 3. Pass A: lifts
  //    const liftResult = await processPendingLifts({ client, transitionPack: realTransitionPack, systemUserId, batchSize: 10 })
  //    Log liftResult.processed + per-item outcomes
  // 4. Pass B: notifications (always runs, regardless of Pass A outcome)
  //    const notifyResult = await processPendingNotifications({ client, sendEmail: realSendEmail, buildNotificationEmail, newsroomBaseUrl, batchSize: 10 })
  //    Log notifyResult.processed + per-pack outcomes
  // 5. Return aggregated JSON: { ok: true, lifts: liftResult, notifications: notifyResult }
}
```

`systemUserId`: a designated UUID representing "system / cron" for `callerUserId` arg. Spec: literal `'00000000-0000-0000-0000-000000000000'` (zero UUID) — clearly distinguishes cron-fired transitions from user-fired ones in any future audit log.

### F6 — `newsroom-publish-notification.ts` (NEW)

```ts
export interface PublishNotificationInput {
  recipientEmail: string
  packTitle: string
  orgName: string
  canonicalUrl: string
  unsubscribeUrl: string
}

export function buildPublishNotificationEmail(input: PublishNotificationInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `New from ${input.orgName}: ${input.packTitle}`
  const text = [
    `${input.orgName} has published a new pack: ${input.packTitle}.`,
    ``,
    `View: ${input.canonicalUrl}`,
    ``,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join('\n')
  // HTML escapes + paragraph wraps the same text. Footer with unsubscribe link.
  const html = /* escaped + wrapped */
  return { subject, html, text }
}
```

Plain `.ts`, mirrors NR-D5b-ii / NR-D8 templates.

### F7 — `schema.ts` (EDIT)

Append to `NewsroomPackRow`:
```ts
notification_sent_at: string | null
```

### F8 — `env.ts` (EDIT)

```ts
NEWSROOM_PUBLISH_CRON_SECRET: z.string().min(32).optional(),  // required in production; dev allows missing
```

`.env.example` documents `openssl rand -base64 48` per established pattern.

### F9 — `vercel.json` (EDIT)

Append to `crons` array:
```json
{ "path": "/api/cron/newsroom-publish-pipeline", "schedule": "0 * * * *" }
```

Final `vercel.json` has 2 cron entries: `/api/cron/newsroom-scan` (NR-D7b) + `/api/cron/newsroom-publish-pipeline` (this directive). Vercel Free tier limit is 2 cron jobs — we are now at the cap. Future newsroom crons (none currently planned for NR-2) require Pro tier.

---

## 6. New env vars

`NEWSROOM_PUBLISH_CRON_SECRET` (optional in dev; required in production).

---

## 7. VERIFY block

1. Migration apply: `bun run supabase db reset` exits 0; column + index present.
2. `bun run typecheck` exit 0.
3. `bunx vitest run src/lib/newsroom/__tests__/publish-pipeline.test.ts` — green.
4. `bunx vitest run src/lib/newsroom/__tests__ src/lib/scanner/__tests__` — full suite green; prior 290/290 still passing.
5. `bun run build` exit 0; route count 116 → 117.
6. **Bounce dev server.**
7. Curl smoke: `GET /api/cron/newsroom-publish-pipeline` (no auth) → 401. `GET` with `Authorization: Bearer ${NEWSROOM_PUBLISH_CRON_SECRET}` → 200 with `{ok: true, lifts: {processed: 0, ...}, notifications: {processed: 0, ...}}` (no pending in fresh DB).
8. Visual smoke deferred (inherits .env.local JWT v1.1 backlog).
9. Schema inspect: `psql -c "\d newsroom_packs"` confirms `notification_sent_at` column + the new index.
10. Rollback smoke: apply DOWN migration, confirm column + index removed; re-apply UP.
11. Scope diff: `git status --porcelain` shows exactly 9 paths (3M + 6??).

---

## 8. Exit report mandate

`docs/audits/NR-D9c-lift-worker-notifications-EXIT-REPORT.md`. Standard sections.

---

## 9. Standing carry-forward checks

- Audit-first IP discipline.
- `transitionPack` from `@/lib/newsroom/pack-transition` is the SOLE state-mutation entry point — F3's `processPendingLifts` calls it; no direct UPDATE on pack.status.
- Service-role for cron writes.
- runtime='nodejs' on F5.
- Cron secret check via Bearer header (mirrors NR-D7b).
- Vercel Free tier hourly schedule (1-hr latency on auto-lift accepted v1; v1.1 backlog item already logged from NR-D7b).
- Subscriber match per company_id only in v1; beat-level filtering deferred.
- notification_sent_at race-safe UPDATE via WHERE NULL.
- New env var added to `.env.example` with comments.
- Tight per-directive commits; selective add of exactly 11 paths (9 deliverables + directive + exit report). DIRECTIVE_SEQUENCE.md updates if any new v1.1 items emerge.

---

## 10. Predecessor sequence

NR-D9b (`ee78206`) → **NR-D9c — this directive** → NR-D10 (signing keys + receipts + KMS) → NR-G2 phase gate.

After NR-D9c: distributor end-to-end functional in dev (publish + auto-lift + notification fanout). NR-G2 only blocked by signed-receipt requirement (NR-D10).

---

End of NR-D9c directive.
