/**
 * Frontfiles — AI proposal mutation helpers (E6)
 *
 * Per E6-DIRECTIVE.md §7 + §10.
 *
 * Each mutation: writes vault_assets canonical metadata (where applicable)
 * + writes asset_proposal_audit_log per E2's audit table + returns the
 * shape the API route surfaces. NO direct creator-session check here —
 * route handlers wrap with creator validation upstream.
 *
 * SERVER-ONLY.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/client'
import { writeAuditEvent } from './audit'
import type { AuditSurface } from './types'

export type ProposalField = 'caption' | 'keywords' | 'tags'

// ── accept ─────────────────────────────────────────────────────

export interface AcceptProposalOpts {
  assetId: string
  creatorId: string
  fields: ProposalField[]
  surface: AuditSurface
}

export async function acceptProposal(opts: AcceptProposalOpts): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = getSupabaseClient()

  // 1. Read proposal values + current canonical for the audit before/after
  const { data: prop } = await supabase
    .from('asset_proposals')
    .select('caption, keywords, tags')
    .eq('asset_id', opts.assetId)
    .maybeSingle()

  const { data: asset } = await supabase
    .from('vault_assets')
    .select('description, tags')
    .eq('id', opts.assetId)
    .maybeSingle()

  if (!prop || !asset) {
    throw new Error('proposal_or_asset_not_found')
  }

  const propRow = prop as { caption: string | null; keywords: string[] | null; tags: string[] | null }
  const assetRow = asset as { description: string | null; tags: string[] | null }

  // 2. Build the canonical update + audit events per field
  const update: Record<string, unknown> = {}
  const auditEvents: Array<{ field: ProposalField; before: unknown; after: unknown }> = []

  for (const field of opts.fields) {
    if (field === 'caption' && propRow.caption !== null) {
      update.description = propRow.caption // V4 store maps caption → description
      auditEvents.push({ field, before: assetRow.description, after: propRow.caption })
    }
    if (field === 'tags' && propRow.tags !== null) {
      update.tags = propRow.tags
      auditEvents.push({ field, before: assetRow.tags, after: propRow.tags })
    }
    // 'keywords' has no canonical column on vault_assets in v1; the
    // accept event is logged for audit but doesn't write to vault_assets.
    if (field === 'keywords') {
      auditEvents.push({ field, before: null, after: propRow.keywords })
    }
  }

  // 3. Apply canonical update if anything changed
  if (Object.keys(update).length > 0) {
    await supabase.from('vault_assets').update(update).eq('id', opts.assetId)
  }

  // 4. Audit per accepted field
  for (const ev of auditEvents) {
    await writeAuditEvent({
      asset_id: opts.assetId,
      creator_id: opts.creatorId,
      event_type: 'proposal_accepted',
      field_name: ev.field,
      before_value: ev.before as never,
      after_value: ev.after as never,
      surface: opts.surface,
    })
  }
}

// ── override ───────────────────────────────────────────────────

export interface OverrideProposalOpts {
  assetId: string
  creatorId: string
  field: ProposalField
  value: unknown
  surface: AuditSurface
  overrideReason?: string
}

export async function overrideProposal(opts: OverrideProposalOpts): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = getSupabaseClient()

  const { data: prop } = await supabase
    .from('asset_proposals')
    .select('caption, keywords, tags')
    .eq('asset_id', opts.assetId)
    .maybeSingle()
  const propRow = (prop as { caption: string | null; keywords: string[] | null; tags: string[] | null } | null)

  // Apply canonical update for caption/tags; keywords has no canonical column.
  const update: Record<string, unknown> = {}
  if (opts.field === 'caption') update.description = opts.value
  if (opts.field === 'tags') update.tags = opts.value
  if (Object.keys(update).length > 0) {
    await supabase.from('vault_assets').update(update).eq('id', opts.assetId)
  }

  // Audit before = the proposed value (what the user diverged from)
  const beforeValue =
    opts.field === 'caption'
      ? (propRow?.caption ?? null)
      : opts.field === 'tags'
        ? (propRow?.tags ?? null)
        : (propRow?.keywords ?? null)

  await writeAuditEvent({
    asset_id: opts.assetId,
    creator_id: opts.creatorId,
    event_type: 'proposal_overridden',
    field_name: opts.field,
    before_value: beforeValue as never,
    after_value: opts.value as never,
    surface: opts.surface,
    override_reason: opts.overrideReason ?? null,
  })
}

// ── dismiss ────────────────────────────────────────────────────

export interface DismissProposalOpts {
  assetId: string
  creatorId: string
  /** Optional — omit to dismiss all unaccepted fields for the asset. */
  field?: ProposalField
  surface: AuditSurface
}

export async function dismissProposal(opts: DismissProposalOpts): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = getSupabaseClient()

  // Audit-log only — proposal row stays for idempotency. UI hides
  // dismissed fields by reading the audit log on hydration (or by
  // tracking dismiss state client-side; either approach works).
  const fieldsToDismiss: Array<ProposalField | null> = opts.field ? [opts.field] : [null]

  // Read current proposed values to record as before_value
  const { data: prop } = await supabase
    .from('asset_proposals')
    .select('caption, keywords, tags')
    .eq('asset_id', opts.assetId)
    .maybeSingle()
  const propRow = (prop as { caption: string | null; keywords: string[] | null; tags: string[] | null } | null)

  for (const field of fieldsToDismiss) {
    let beforeValue: unknown = null
    if (field === 'caption') beforeValue = propRow?.caption
    if (field === 'tags') beforeValue = propRow?.tags
    if (field === 'keywords') beforeValue = propRow?.keywords

    await writeAuditEvent({
      asset_id: opts.assetId,
      creator_id: opts.creatorId,
      event_type: 'proposal_dismissed',
      field_name: field,
      before_value: beforeValue as never,
      after_value: null,
      surface: opts.surface,
    })
  }
}

// ── regenerate ─────────────────────────────────────────────────

export interface RegenerateProposalOpts {
  assetId: string
  creatorId: string
  surface: AuditSurface
}

export async function regenerateProposal(opts: RegenerateProposalOpts): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = getSupabaseClient()

  // Reset row to pending; clear retry_count + fields. The next worker tick
  // (or a fire-and-forget dispatch from the route) re-runs the engine.
  await supabase
    .from('asset_proposals')
    .update({
      generation_status: 'pending',
      retry_count: 0,
      caption: null,
      caption_confidence: null,
      keywords: null,
      keywords_confidence: null,
      tags: null,
      tags_confidence: null,
      error: null,
    })
    .eq('asset_id', opts.assetId)

  // Field-grain dismiss event for the prior proposal (if any)
  await writeAuditEvent({
    asset_id: opts.assetId,
    creator_id: opts.creatorId,
    event_type: 'proposal_dismissed',
    field_name: null,
    before_value: null,
    after_value: null,
    surface: opts.surface,
    override_reason: 'regenerate',
  })
}
