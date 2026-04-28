/**
 * Frontfiles — AI Suggestions: Field-grain audit-log writer
 *
 * Writes proposal events to asset_proposal_audit_log. Events:
 *   proposal_generated | proposal_accepted | proposal_overridden |
 *   proposal_dismissed | cluster_proposed | cluster_accepted |
 *   cluster_dismissed
 *
 * System-grain events (ai.gemini.call, ai.gemini.cache_hit, etc.) go
 * through the existing src/lib/logger.ts audit() function to the
 * shipped audit_log table — different table, different query patterns.
 *
 * Validates input via Zod before insert. Throws on validation failure
 * — audit-log writes should fail loud, not silently drop. Service-role
 * client required.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient } from '@/lib/db/client'
import { AuditEventSchema, type AuditEvent } from './schema'

export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  const validated = AuditEventSchema.parse(event)
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('asset_proposal_audit_log')
    .insert(validated)
  if (error) {
    throw new Error(
      `Failed to write proposal audit event: ${error.message}`,
    )
  }
}
