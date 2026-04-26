// ═══════════════════════════════════════════════════════════════
// Frontfiles — Newsroom publish-pipeline cron worker (NR-D9c, F5)
//
// Vercel Cron-driven worker. Runs two passes per invocation:
//
//   Pass A — embargo lifts: find active embargoes whose lift_at
//            has passed; call transitionPack(scheduled →
//            published) for each.
//   Pass B — subscriber notification fanout: find packs published
//            but not yet notified; send one email per matching
//            beat-subscriber; mark notification_sent_at.
//
// Pass A runs FIRST so embargoes lifted in this tick produce
// `published_at` updates that Pass B picks up immediately —
// recipients don't wait an extra hour for notification.
//
// Schedule: hourly (vercel.json `"0 * * * *"`). 1-hour worst-case
// latency on embargo lift is accepted v1 per Vercel Free tier
// 2-cron limit (NR-D7b precedent). Pre-NR-G5 upgrade decision
// already in v1.1 backlog.
//
// Auth: Vercel Cron requests carry an `Authorization: Bearer
// ${NEWSROOM_PUBLISH_CRON_SECRET}` header. The secret is required
// in production; dev allows missing for local testing (route
// returns 401, manual curl with the env var set passes through).
//
// Service-role for all writes. transitionPack uses the same
// service-role client; the RPC's REVOKE ALL FROM PUBLIC means
// only service-role can call it.
//
// Per-item errors are logged and the batch continues — one bad
// embargo or one bad pack doesn't poison subsequent items in
// the same tick.
//
// Spec cross-references:
//   - directives/NR-D9c-lift-worker-notifications.md §F5
//   - src/lib/newsroom/publish-pipeline.ts (F3 — orchestrator)
//   - src/lib/newsroom/pack-transition.ts (NR-D9a — RPC wrapper)
//   - src/lib/email/templates/newsroom-publish-notification.ts (F6)
//   - migration 20260425000008 — notification_sent_at column
// ═══════════════════════════════════════════════════════════════

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/db/client'
import { sendTransactionalEmail } from '@/lib/email/send'
import { buildPublishNotificationEmail } from '@/lib/email/templates/newsroom-publish-notification'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { NEWSROOM_BASE_URL } from '@/lib/newsroom/canonical-url'
import { transitionPack } from '@/lib/newsroom/pack-transition'
import {
  processPendingLifts,
  processPendingNotifications,
} from '@/lib/newsroom/publish-pipeline'

export const runtime = 'nodejs'

const ROUTE = 'GET /api/cron/newsroom-publish-pipeline'
const BATCH_SIZE = 10

/**
 * Zero UUID — designates "system / cron" in `callerUserId` for
 * the transitionPack invocation. Distinguishes cron-fired
 * transitions from human-fired ones in any future audit log.
 */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  // ── Auth: Bearer NEWSROOM_PUBLISH_CRON_SECRET ──
  const cronSecret = env.NEWSROOM_PUBLISH_CRON_SECRET
  if (!cronSecret) {
    logger.warn(
      { route: ROUTE },
      '[newsroom.publish-pipeline.cron] NEWSROOM_PUBLISH_CRON_SECRET not set; rejecting',
    )
    return NextResponse.json(
      { ok: false, reason: 'unconfigured' },
      { status: 401 },
    )
  }
  const token = extractBearerToken(request)
  if (!token || token !== cronSecret) {
    return NextResponse.json(
      { ok: false, reason: 'unauthenticated' },
      { status: 401 },
    )
  }

  const supabase = getSupabaseClient()

  // ── Pass A: lifts ─────────────────────────────────────────────
  // Per the directive's two-pass ordering: lifts BEFORE
  // notifications inside the same tick. A lifted pack's
  // notification eligibility is picked up immediately by Pass B.
  const liftResult = await processPendingLifts({
    client: supabase,
    transitionPack: (input) => transitionPack(supabase, input),
    systemUserId: SYSTEM_USER_ID,
    batchSize: BATCH_SIZE,
  })

  logger.info(
    {
      route: ROUTE,
      pass: 'A_lifts',
      processed: liftResult.processed,
      lifted: liftResult.lifted.length,
      errors: liftResult.errors.length,
    },
    '[newsroom.publish-pipeline.cron] pass A complete',
  )

  for (const e of liftResult.errors) {
    logger.error(
      {
        route: ROUTE,
        pass: 'A_lifts',
        embargoId: e.embargoId,
        rawMessage: e.error,
      },
      '[newsroom.publish-pipeline.cron] lift error',
    )
  }

  // ── Pass B: notifications ─────────────────────────────────────
  // Always runs, regardless of Pass A outcome. Some embargoes
  // might fail to lift; some other packs (immediate publishes
  // from prior ticks) might still be ready to notify.
  //
  // sendEmail adapter narrows `sendTransactionalEmail` to the
  // subset the pipeline needs. templateId = 'newsroom-publish-
  // notification' for Resend dashboard tagging.
  const notifyResult = await processPendingNotifications({
    client: supabase,
    sendEmail: async (input) => {
      const result = await sendTransactionalEmail({
        to: input.to,
        templateId: 'newsroom-publish-notification',
        subject: input.subject,
        html: input.html,
        text: input.text,
        traceId: input.traceId ?? null,
        actorId: SYSTEM_USER_ID,
        tags: { surface: 'newsroom', kind: 'publish-notification' },
      })
      return {
        ok: result.ok,
        messageId: result.messageId,
        error: result.error,
      }
    },
    buildNotificationEmail: buildPublishNotificationEmail,
    newsroomBaseUrl: NEWSROOM_BASE_URL,
    batchSize: BATCH_SIZE,
  })

  logger.info(
    {
      route: ROUTE,
      pass: 'B_notify',
      processed: notifyResult.processed,
      notified: notifyResult.notified.length,
      errors: notifyResult.errors.length,
      totalEmailsSent: notifyResult.notified.reduce(
        (acc, n) => acc + n.emailsSent,
        0,
      ),
    },
    '[newsroom.publish-pipeline.cron] pass B complete',
  )

  for (const e of notifyResult.errors) {
    logger.error(
      {
        route: ROUTE,
        pass: 'B_notify',
        packId: e.packId,
        rawMessage: e.error,
      },
      '[newsroom.publish-pipeline.cron] notification error',
    )
  }

  // ── Aggregated response ───────────────────────────────────────
  return NextResponse.json(
    {
      ok: true,
      lifts: {
        processed: liftResult.processed,
        lifted: liftResult.lifted.length,
        errors: liftResult.errors.length,
      },
      notifications: {
        processed: notifyResult.processed,
        notified: notifyResult.notified.length,
        emailsSent: notifyResult.notified.reduce(
          (acc, n) => acc + n.emailsSent,
          0,
        ),
        errors: notifyResult.errors.length,
      },
    },
    { status: 200 },
  )
}
