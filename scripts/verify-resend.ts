#!/usr/bin/env bun
/**
 * Resend pipeline smoke test.
 *
 * Verifies end-to-end:
 *   1. Resend SDK is installed and the client initialises
 *   2. RESEND_API_KEY_TRANSACTIONAL is valid (the send is accepted)
 *   3. Resend returns a message ID
 *   4. audit_log receives an 'email.transactional.sent' row with
 *      the Resend ID in metadata.resend_id
 *   5. The audit row is readable back by trace_id (service role
 *      bypasses RLS correctly)
 *
 * Run:
 *   bun scripts/verify-resend.ts <to-email>
 *
 * Example:
 *   bun scripts/verify-resend.ts joao@frontfiles.news
 *
 * If you haven't verified your sending domain in the Resend
 * dashboard, the `to` address MUST be the email you used to sign
 * up for Resend — that's the only recipient the free tier accepts
 * from the sandbox FROM address.
 *
 * Exit codes:
 *   0 — email sent, audit row written, round-trip verified
 *   1 — pipeline broken; see error output
 */

import { sendTransactionalEmail } from '../src/lib/email/send'
import { buildTestPingEmail } from '../src/lib/email/templates/test-ping'
import { newTraceId } from '../src/lib/logger'
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../src/lib/db/client'
import {
  isResendConfigured,
  getTransactionalFrom,
} from '../src/lib/email/client'

async function main() {
  console.log('═══ Frontfiles Resend pipeline smoke test ═══\n')

  const to = process.argv[2]
  if (!to || !to.includes('@')) {
    console.error('❌ Usage: bun scripts/verify-resend.ts <to-email>')
    console.error('   Example: bun scripts/verify-resend.ts joao@frontfiles.news\n')
    console.error('   Note: without a verified Resend domain, the recipient')
    console.error('         must be the email you signed up to Resend with.')
    process.exit(1)
  }

  // 1. Preflight env checks
  console.log('Preflight:')
  console.log(`  Resend configured:   ${isResendConfigured()}`)
  console.log(`  Supabase configured: ${isSupabaseConfigured()}`)
  console.log(`  FROM address:        ${getTransactionalFrom()}`)
  console.log(`  TO address:          ${to}\n`)

  if (!isResendConfigured()) {
    console.error('❌ Resend not configured. Set RESEND_API_KEY_TRANSACTIONAL in .env.local.')
    process.exit(1)
  }
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase not configured — can\'t verify audit_log round-trip.')
    process.exit(1)
  }

  const traceId = newTraceId()
  const stamp = new Date().toISOString()

  console.log(`Trace ID: ${traceId}`)
  console.log(`Stamp:    ${stamp}\n`)

  // 2. Render the template
  console.log('→ Rendering test-ping template …')
  const { subject, html, text } = buildTestPingEmail({ stamp, traceId })
  console.log(`  ✓  subject = "${subject}"\n`)

  // 3. Send via Resend
  console.log('→ Calling sendTransactionalEmail() …')
  const result = await sendTransactionalEmail({
    to,
    templateId: 'test-ping',
    subject,
    html,
    text,
    traceId,
    tags: {
      template: 'test-ping',
      env: process.env.NODE_ENV ?? 'development',
    },
  })

  if (!result.ok) {
    console.error(`  ❌ Send failed: ${result.error ?? 'unknown error'}`)
    process.exit(1)
  }
  if (result.mocked) {
    console.error('  ❌ Send was mocked — did RESEND_API_KEY_TRANSACTIONAL unset itself?')
    process.exit(1)
  }
  console.log(`  ✓  Resend message ID: ${result.messageId}\n`)

  // 4. Read the audit row back by trace_id
  console.log('→ Reading audit_log row back by trace_id …')
  // Small delay so the INSERT is visible — both calls go through
  // the same service-role client, but audit() writes asynchronously
  // in practice.
  await new Promise((r) => setTimeout(r, 400))

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('event_type, target_type, target_id, metadata, trace_id, created_at')
    .eq('trace_id', traceId)
    .single()

  if (error) {
    console.error(`  ❌ audit_log read failed: ${error.message}`)
    process.exit(1)
  }
  if (!data) {
    console.error('  ❌ No audit_log row found — audit() silently failed to persist.')
    process.exit(1)
  }

  console.log('  ✓  Audit row retrieved:')
  console.log(`     event_type:  ${data.event_type}`)
  console.log(`     target_type: ${data.target_type}`)
  console.log(`     target_id:   ${data.target_id}`)
  console.log(`     trace_id:    ${data.trace_id}`)
  console.log(`     created_at:  ${data.created_at}`)
  const meta = data.metadata as Record<string, unknown>
  console.log(`     metadata.template:  ${meta.template}`)
  console.log(`     metadata.resend_id: ${meta.resend_id}\n`)

  // 5. Field-by-field verification
  const checks: Array<[string, unknown, unknown]> = [
    ['event_type', data.event_type, 'email.transactional.sent'],
    ['target_type', data.target_type, 'email'],
    ['target_id (Resend ID)', data.target_id, result.messageId],
    ['metadata.template', meta.template, 'test-ping'],
    ['metadata.resend_id', meta.resend_id, result.messageId],
  ]

  let allOk = true
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) {
      console.log(`  ❌ ${field}: expected "${expected}", got "${actual}"`)
      allOk = false
    }
  }

  console.log()
  if (allOk) {
    console.log('✅  Resend pipeline fully working:')
    console.log('    template renders                ✓')
    console.log('    Resend SDK accepts send         ✓')
    console.log('    audit_log row written           ✓')
    console.log('    service-role read-back          ✓')
    console.log('    Resend ID round-trips           ✓')
    console.log('')
    console.log(`    Check your inbox at ${to} for the test email.`)
    console.log(`    Check your Resend dashboard for message ID ${result.messageId}.`)
    process.exit(0)
  } else {
    console.log('⚠️   Pipeline partially working — see mismatches above.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err)
  process.exit(1)
})
