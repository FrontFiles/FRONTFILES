/**
 * Frontfiles — Embargo lift + notification fanout pipeline (NR-D9c, F3)
 *
 * Pure orchestration for the NR-D9c cron worker. Two passes:
 *
 *   Pass A — `processPendingLifts`
 *     Finds `newsroom_embargoes WHERE state='active' AND lift_at
 *     <= now()`. For each, calls the injected `transitionPack`
 *     (NR-D9a wrapper) targeting `'published'`. The RPC's
 *     `scheduled → published` branch atomically flips the pack
 *     status, sets `published_at`, and lifts the embargo
 *     (`embargo.state='lifted'`). Per-embargo errors are captured
 *     and the batch never aborts.
 *
 *   Pass B — `processPendingNotifications`
 *     Finds packs with `published_at IS NOT NULL AND
 *     notification_sent_at IS NULL` (the partial index from
 *     migration 20260425000008 makes this fast). For each pack,
 *     joins `newsroom_beat_subscriptions` × `newsroom_recipients`
 *     by `(company_id, notify_on='new_pack')`, sends one email
 *     per recipient via the injected `sendEmail`, then marks
 *     `notification_sent_at = now()` race-safely (`WHERE id = ?
 *     AND notification_sent_at IS NULL`).
 *
 * The two passes are intentionally independent functions.
 * Pass-ordering (lift then notify) is the cron route's
 * responsibility (F5) — running both in one tick means embargoes
 * lifted in Pass A are eligible for Pass B's fanout immediately,
 * not on the next hourly tick.
 *
 * Server-only — no client component imports types from here.
 *
 * IP-1 ratification (2026-04-25): v1 fanout matches `notify_on =
 * 'new_pack'` ONLY. The schema enum supports `'embargo_lift'` and
 * `'update'` but no v1 UI surfaces let users opt in to them
 * independently. v1.1 (NR-D14, journalist J7 subscription mgmt)
 * promotes the WHERE clause to `IN ('new_pack', 'embargo_lift')`.
 *
 * Spec cross-references:
 *   - directives/NR-D9c-lift-worker-notifications.md §F3
 *   - PRD §3.3 (scheduled → published auto transition rules)
 *   - PRD §3.2 BeatSubscription (newsroom-wide v1; beat-level v1.1)
 *   - src/lib/newsroom/pack-transition.ts — `transitionPack`
 *   - migration 20260425000008 — `notification_sent_at` column
 */

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { TransitionResult } from './pack-transition'

// ── Default batch size ─────────────────────────────────────────

/**
 * Default per-pass batch ceiling. Hourly cron, small v1 closed
 * beta volume — 10 keeps each tick well under cron deadline budget
 * even with email retries. Configurable via input override for
 * tests + future tuning.
 */
const DEFAULT_BATCH_SIZE = 10

// ── Pass A — embargo lifts ─────────────────────────────────────

/**
 * Injected dependencies. The cron route (F5) wires the real
 * Supabase service-role client + the real `transitionPack` from
 * `pack-transition.ts`. Tests inject mocks.
 */
export interface LiftPipelineInput {
  client: SupabaseClient
  /**
   * Reference to the NR-D9a `transitionPack` wrapper. Injected so
   * tests can mock without spinning up the real RPC stack.
   */
  transitionPack: (input: {
    packId: string
    targetStatus: 'published'
    callerUserId: string
    overrideEmbargoCancel?: boolean
  }) => Promise<TransitionResult>
  /**
   * Caller-id stamped on each cron-fired transition. Convention:
   * the zero UUID `'00000000-0000-0000-0000-000000000000'`
   * distinguishes cron-driven transitions from human-driven ones
   * in any future audit log.
   */
  systemUserId: string
  batchSize?: number
  /** Injection point for "now" in tests; defaults to `new Date()`. */
  now?: Date
}

export interface LiftPipelineEntry {
  embargoId: string
  packId: string
  result: TransitionResult
}

export interface LiftPipelineError {
  embargoId: string
  /** Human-readable error string for log lines + aggregated response. */
  error: string
}

export interface LiftPipelineOutput {
  /** Total embargoes considered (= entries.length + errors.length). */
  processed: number
  lifted: ReadonlyArray<LiftPipelineEntry>
  errors: ReadonlyArray<LiftPipelineError>
}

/**
 * Find active embargoes whose `lift_at` has passed and run each
 * through `transitionPack(scheduled → published)`. Per-embargo
 * errors are collected; the batch never aborts.
 */
export async function processPendingLifts(
  input: LiftPipelineInput,
): Promise<LiftPipelineOutput> {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()

  const { data: rows, error: selectError } = await input.client
    .from('newsroom_embargoes')
    .select('id, pack_id, lift_at')
    .eq('state', 'active')
    .lte('lift_at', nowIso)
    .order('lift_at', { ascending: true })
    .limit(batchSize)

  if (selectError) {
    // Hard transport error — return as a single batch-level error
    // so the cron logs a meaningful failure and the next tick
    // retries.
    return {
      processed: 0,
      lifted: [],
      errors: [
        {
          embargoId: '<select>',
          error: `embargo SELECT failed: ${selectError.message ?? String(selectError)}`,
        },
      ],
    }
  }

  const items = (rows ?? []) as Array<{
    id: string
    pack_id: string
    lift_at: string
  }>

  const lifted: LiftPipelineEntry[] = []
  const errors: LiftPipelineError[] = []

  for (const row of items) {
    try {
      const result = await input.transitionPack({
        packId: row.pack_id,
        targetStatus: 'published',
        callerUserId: input.systemUserId,
      })
      lifted.push({
        embargoId: row.id,
        packId: row.pack_id,
        result,
      })
    } catch (err) {
      errors.push({
        embargoId: row.id,
        error:
          err instanceof Error
            ? err.message
            : `transitionPack threw: ${String(err)}`,
      })
    }
  }

  return {
    processed: items.length,
    lifted,
    errors,
  }
}

// ── Pass B — subscriber notification fanout ────────────────────

/**
 * Email send injection — adapter signature kept narrow so the
 * route handler can plug in `sendTransactionalEmail` or a stub.
 */
export interface NotifySendEmailInput {
  to: string
  subject: string
  html: string
  text: string
  traceId?: string
}

export interface NotifySendEmailResult {
  ok: boolean
  messageId?: string | null
  error?: string
}

/**
 * Builder injection — F6's `buildPublishNotificationEmail`
 * narrowed to the shape the pipeline needs.
 */
export interface NotifyBuildInput {
  recipientEmail: string
  packTitle: string
  orgName: string
  canonicalUrl: string
  unsubscribeUrl: string
}

export interface NotifyBuiltEmail {
  subject: string
  html: string
  text: string
}

export interface NotifyPipelineInput {
  client: SupabaseClient
  sendEmail: (input: NotifySendEmailInput) => Promise<NotifySendEmailResult>
  buildNotificationEmail: (input: NotifyBuildInput) => NotifyBuiltEmail
  /**
   * Newsroom subdomain root. Caller passes `NEWSROOM_BASE_URL`
   * from `canonical-url.ts` so v1 stays consistent with the
   * publish UI.
   */
  newsroomBaseUrl: string
  batchSize?: number
}

export interface NotifyPipelineEntry {
  packId: string
  recipientCount: number
  emailsSent: number
}

export interface NotifyPipelineError {
  packId: string
  error: string
}

export interface NotifyPipelineOutput {
  processed: number
  notified: ReadonlyArray<NotifyPipelineEntry>
  errors: ReadonlyArray<NotifyPipelineError>
}

/**
 * Find packs published but not yet notified, fanning out one
 * email per matching subscriber. Best-effort: per-recipient
 * failures don't block the batch; the pack's
 * `notification_sent_at` is still set so retries don't
 * double-spam (PRD §3.2 BeatSubscription's at-most-once-ish
 * v1 posture).
 *
 * Edge cases:
 *   - 0 packs pending → returns processed=0
 *   - pack with 0 subscribers → notification_sent_at set, 0 emails
 *     (explicit "notify nobody is also a successful notify")
 *   - all email sends fail → notification_sent_at still set; PRD
 *     §3.2 v1 favours predictability over delivery-retry
 *     complexity (NR-D14 may revisit)
 *   - race: another worker already set notification_sent_at →
 *     the WHERE clause causes 0 rows updated, current worker
 *     skips emails for that pack
 */
export async function processPendingNotifications(
  input: NotifyPipelineInput,
): Promise<NotifyPipelineOutput> {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE

  // ── Step 1: select packs ──
  const { data: packRows, error: packError } = await input.client
    .from('newsroom_packs')
    .select('id, company_id, slug, title, published_at')
    .not('published_at', 'is', null)
    .is('notification_sent_at', null)
    .order('published_at', { ascending: true })
    .limit(batchSize)

  if (packError) {
    return {
      processed: 0,
      notified: [],
      errors: [
        {
          packId: '<select>',
          error: `pack SELECT failed: ${packError.message ?? String(packError)}`,
        },
      ],
    }
  }

  const packs = (packRows ?? []) as Array<{
    id: string
    company_id: string
    slug: string
    title: string
    published_at: string
  }>

  const notified: NotifyPipelineEntry[] = []
  const errors: NotifyPipelineError[] = []

  for (const pack of packs) {
    try {
      // ── Step 2: race-safe claim ──
      // UPDATE first with the WHERE-NULL guard; if the update
      // touches 0 rows another worker (or a previous successful
      // run) already claimed this pack — skip it.
      const claimedAt = new Date().toISOString()
      const { data: claimed, error: claimError } = await input.client
        .from('newsroom_packs')
        .update({ notification_sent_at: claimedAt })
        .eq('id', pack.id)
        .is('notification_sent_at', null)
        .select('id')
      if (claimError) {
        errors.push({
          packId: pack.id,
          error: `claim failed: ${claimError.message ?? String(claimError)}`,
        })
        continue
      }
      if (!claimed || claimed.length === 0) {
        // Another worker already took this one. Not an error;
        // continue silently.
        continue
      }

      // ── Step 3: company lookup (for OrgName) ──
      const { data: companyRow, error: companyError } = await input.client
        .from('companies')
        .select('name, slug')
        .eq('id', pack.company_id)
        .maybeSingle()
      if (companyError || !companyRow) {
        errors.push({
          packId: pack.id,
          error: `company lookup failed: ${
            companyError?.message ?? 'company missing'
          }`,
        })
        continue
      }
      const orgName = companyRow.name as string
      const orgSlug = companyRow.slug as string

      // ── Step 4: subscriber JOIN ──
      // Per IP-1 (Option A): match notify_on='new_pack' only.
      // Schema enum supports 'embargo_lift' and 'update' but no
      // v1 UI surfaces opt-in for them; v1.1 promotes WHERE.
      //
      // Two-step: pull subscriptions, then JOIN to recipients in
      // a second query (Supabase JS multi-line SELECT relationship
      // embedding has been flaky in prior NR directives — keep it
      // explicit and stable).
      const { data: subRows, error: subError } = await input.client
        .from('newsroom_beat_subscriptions')
        .select('recipient_id')
        .eq('company_id', pack.company_id)
        .eq('notify_on', 'new_pack')
      if (subError) {
        errors.push({
          packId: pack.id,
          error: `subscription lookup failed: ${subError.message}`,
        })
        continue
      }
      const recipientIds = ((subRows ?? []) as Array<{ recipient_id: string }>).map(
        (r) => r.recipient_id,
      )

      let emailsSent = 0
      let recipientCount = 0

      if (recipientIds.length > 0) {
        const { data: recipientRows, error: recipientError } = await input.client
          .from('newsroom_recipients')
          .select('id, email')
          .in('id', recipientIds)
        if (recipientError) {
          errors.push({
            packId: pack.id,
            error: `recipient lookup failed: ${recipientError.message}`,
          })
          // notification_sent_at already set; do not retry.
          continue
        }
        const recipients = (recipientRows ?? []) as Array<{
          id: string
          email: string
        }>
        recipientCount = recipients.length

        // ── Step 5: build URLs + per-recipient send ──
        const canonicalUrl = `${input.newsroomBaseUrl}/${orgSlug}/${pack.slug}`
        for (const r of recipients) {
          const unsubscribeUrl = `${input.newsroomBaseUrl}/subscriptions/manage?t=${r.id}`
          let built: NotifyBuiltEmail
          try {
            built = input.buildNotificationEmail({
              recipientEmail: r.email,
              packTitle: pack.title,
              orgName,
              canonicalUrl,
              unsubscribeUrl,
            })
          } catch (err) {
            errors.push({
              packId: pack.id,
              error: `build failed for ${r.email}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            })
            continue
          }
          try {
            const sendResult = await input.sendEmail({
              to: r.email,
              subject: built.subject,
              html: built.html,
              text: built.text,
            })
            if (sendResult.ok) {
              emailsSent += 1
            } else {
              errors.push({
                packId: pack.id,
                error: `send failed for ${r.email}: ${
                  sendResult.error ?? 'unknown'
                }`,
              })
            }
          } catch (err) {
            errors.push({
              packId: pack.id,
              error: `send threw for ${r.email}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            })
          }
        }
      }

      notified.push({
        packId: pack.id,
        recipientCount,
        emailsSent,
      })
    } catch (err) {
      errors.push({
        packId: pack.id,
        error: `unexpected: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  return {
    processed: packs.length,
    notified,
    errors,
  }
}
