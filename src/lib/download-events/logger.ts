/**
 * Frontfiles — Download Event Audit Logger
 *
 * Fire-and-forget Supabase insert for download_events.
 *
 * SAFETY CONTRACT:
 *   This function NEVER throws. If the insert fails, it logs
 *   to console.error and returns silently. A failed audit write
 *   must not turn a successful download into a failed response.
 *
 * IMPORT SAFETY:
 *   This module does NOT statically import @/lib/db/client.
 *   The Supabase client is loaded via dynamic import() inside
 *   the async function body. This prevents Turbopack from
 *   tracing into @supabase/supabase-js at build time, so the
 *   app compiles even when the package is not installed.
 *
 * BOUNDARY:
 *   This module writes audit records. It does not read them,
 *   query them, or use them for authorization. It is the sole
 *   write path for download_events.
 */

import type { DownloadEventInsert } from './types'

const USER_AGENT_MAX_LENGTH = 1000

/**
 * Log a download event to the download_events audit table.
 *
 * Fire-and-forget: returns void, never throws.
 * Call with `void logDownloadEvent(...)` in route handlers
 * to make the fire-and-forget intent explicit.
 */
export async function logDownloadEvent(
  event: DownloadEventInsert,
): Promise<void> {
  try {
    // Dynamic import avoids Turbopack tracing into @supabase/supabase-js
    // at build time. The module is only loaded when this function is
    // actually called AND Supabase is configured.
    const { isSupabaseConfigured, getSupabaseClient } = await import('@/lib/db/client')

    if (!isSupabaseConfigured()) {
      // Dev/mock mode: no DB to write to. Silent skip.
      return
    }

    const row = {
      ...event,
      // Truncate user_agent at write time — the DB has no length
      // constraint because truncation policy belongs here.
      user_agent: event.user_agent
        ? event.user_agent.slice(0, USER_AGENT_MAX_LENGTH)
        : null,
    }

    const { error } = await getSupabaseClient()
      .from('download_events')
      .insert(row)

    if (error) {
      console.error(
        '[download-events] Audit insert failed:',
        error.message,
        { channel: event.delivery_channel, outcome: event.outcome, userId: event.user_id },
      )
    }
  } catch (err) {
    // Catch everything — network failures, client init errors, etc.
    console.error(
      '[download-events] Unexpected error in audit logger:',
      err instanceof Error ? err.message : err,
    )
  }
}
