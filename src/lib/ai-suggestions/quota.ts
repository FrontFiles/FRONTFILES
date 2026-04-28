/**
 * Frontfiles — Pre-call platform spend-cap check
 *
 * Per E1.5 §7 + E3-DIRECTIVE.md §14.
 *
 * Sums recent ai_analysis.cost_cents via the sum_ai_cost_cents_since RPC
 * (added by migration 20260428000002) and throws QuotaExceededError if
 * either the daily or monthly cap is reached.
 *
 * Race condition note: the check is not transactional with the call.
 * Under concurrent burst, the worker can briefly exceed the cap by ~the
 * parallelism factor. Acceptable: caps are platform-protective, not
 * transaction-strict; founder alert fires within seconds; auto-recovery
 * at next-period boundary.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient } from '@/lib/db/client'
import { audit } from '@/lib/logger'
import { getEffectiveSettings } from './settings'

export class QuotaExceededError extends Error {
  constructor(public readonly scope: 'daily' | 'monthly') {
    super(`platform_quota_exceeded_${scope}`)
    this.name = 'QuotaExceededError'
  }
}

/**
 * Pre-call check. Throws QuotaExceededError if daily or monthly cap reached.
 * Returns silently otherwise.
 *
 * Audits the breach event so founder is alerted via the audit_log → Sentry
 * pipeline.
 */
export async function checkSpendOrFail(): Promise<void> {
  const settings = await getEffectiveSettings()
  const supabase = getSupabaseClient()

  // Daily check
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const dailyCents = await sumSince(supabase, startOfDay)
  if (dailyCents >= settings.daily_cap_cents) {
    await audit({
      event_type: 'ai.gemini.quota_exceeded',
      target_type: 'platform',
      target_id: null,
      metadata: { scope: 'daily', cents: dailyCents, cap: settings.daily_cap_cents },
    })
    throw new QuotaExceededError('daily')
  }

  // Monthly check
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)
  const monthlyCents = await sumSince(supabase, startOfMonth)
  if (monthlyCents >= settings.monthly_cap_cents) {
    await audit({
      event_type: 'ai.gemini.quota_exceeded',
      target_type: 'platform',
      target_id: null,
      metadata: { scope: 'monthly', cents: monthlyCents, cap: settings.monthly_cap_cents },
    })
    throw new QuotaExceededError('monthly')
  }
}

async function sumSince(supabase: ReturnType<typeof getSupabaseClient>, since: Date): Promise<number> {
  const { data, error } = await supabase.rpc('sum_ai_cost_cents_since', {
    since: since.toISOString(),
  })
  if (error) {
    throw new Error(`sum_ai_cost_cents_since RPC failed: ${error.message}`)
  }
  // RPC returns bigint; supabase-js surfaces as number-or-string depending on version
  return typeof data === 'string' ? parseInt(data, 10) : ((data as number) ?? 0)
}
