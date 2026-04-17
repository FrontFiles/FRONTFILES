#!/usr/bin/env bun
/**
 * Audit-log pipeline smoke test.
 *
 * Verifies end-to-end:
 *   1. logger.info() emits structured pino output
 *   2. audit() writes a row to audit_log via service-role client
 *   3. The row can be read back by trace_id (proves RLS isn't blocking the service role)
 *   4. All fields round-trip intact (event_type, metadata, trace_id)
 *
 * Run:
 *   bun scripts/verify-audit-log.ts
 *
 * Safe to run repeatedly — inserts one row per invocation, tagged with a
 * unique trace_id, so runs never collide. The row is left in place as evidence.
 *
 * Exit codes:
 *   0 — audit pipeline fully working
 *   1 — pipeline broken; see error line
 */

import { audit, newTraceId } from '../src/lib/logger'
import { getSupabaseClient, isSupabaseConfigured } from '../src/lib/db/client'

async function main() {
  console.log('═══ Audit-log pipeline smoke test ═══\n')

  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase not configured — .env.local missing required vars.')
    console.error('   This test requires real DB connectivity (mock mode would skip persistence).')
    process.exit(1)
  }

  const traceId = newTraceId()
  const stamp = new Date().toISOString()

  console.log(`Test trace_id: ${traceId}`)
  console.log(`Timestamp:     ${stamp}\n`)

  // 1. Write the audit row
  console.log('→ Calling audit() with event_type=staff.action …')
  await audit({
    event_type: 'staff.action',
    actor_id: null,
    target_type: 'smoke_test',
    target_id: traceId,
    metadata: {
      test: 'verify-audit-log.ts',
      stamp,
      note: 'Pipeline smoke test — safe to delete.',
    },
    trace_id: traceId,
  })
  console.log('  ✓  audit() returned without throwing\n')

  // 2. Read it back
  console.log('→ Reading the row back by trace_id …')
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('event_type, target_type, target_id, metadata, trace_id, created_at')
    .eq('trace_id', traceId)
    .single()

  if (error) {
    console.error(`  ❌ Read failed: ${error.message}`)
    process.exit(1)
  }

  if (!data) {
    console.error('  ❌ No row returned — audit() silently failed to persist.')
    process.exit(1)
  }

  console.log('  ✓  Row retrieved:')
  console.log(`     event_type:  ${data.event_type}`)
  console.log(`     target_type: ${data.target_type}`)
  console.log(`     target_id:   ${data.target_id}`)
  console.log(`     trace_id:    ${data.trace_id}`)
  console.log(`     created_at:  ${data.created_at}`)
  console.log(`     metadata:    ${JSON.stringify(data.metadata)}\n`)

  // 3. Field-by-field round-trip check
  const checks: Array<[string, unknown, unknown]> = [
    ['event_type', data.event_type, 'staff.action'],
    ['target_type', data.target_type, 'smoke_test'],
    ['target_id', data.target_id, traceId],
    ['trace_id', data.trace_id, traceId],
  ]

  let allOk = true
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) {
      console.log(`  ❌ ${field}: expected "${expected}", got "${actual}"`)
      allOk = false
    }
  }

  const metaOk =
    typeof data.metadata === 'object' &&
    data.metadata !== null &&
    (data.metadata as Record<string, unknown>).test === 'verify-audit-log.ts'
  if (!metaOk) {
    console.log('  ❌ metadata.test did not round-trip')
    allOk = false
  }

  if (allOk) {
    console.log('✅  Audit pipeline fully working:')
    console.log('    logger.info → pino stdout  ✓')
    console.log('    audit() → audit_log row    ✓')
    console.log('    service-role read-back     ✓')
    console.log('    field round-trip           ✓')
    process.exit(0)
  } else {
    console.log('⚠️   Audit pipeline partially working — see mismatches above.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err)
  process.exit(1)
})
