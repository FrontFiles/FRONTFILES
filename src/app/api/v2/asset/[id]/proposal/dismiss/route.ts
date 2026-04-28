/**
 * POST /api/v2/asset/[id]/proposal/dismiss — E6 §7.4
 *
 * Body: { field?: ProposalField; surface: AuditSurface }
 */

import { NextRequest, NextResponse } from 'next/server'
import { isRealUploadEnabled } from '@/lib/flags'
import { dismissProposal, type ProposalField } from '@/lib/ai-suggestions/proposal-mutations'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_FIELDS: ReadonlySet<string> = new Set(['caption', 'keywords', 'tags'])
const VALID_SURFACES: ReadonlySet<string> = new Set([
  'upload',
  'vault_edit',
  'bulk_action',
  'system',
])

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isRealUploadEnabled()) {
    return NextResponse.json({ code: 'not_enabled' }, { status: 503 })
  }
  const { id: assetId } = await ctx.params
  if (!UUID_RE.test(assetId)) {
    return NextResponse.json({ code: 'bad_request' }, { status: 400 })
  }
  const creatorId = req.headers.get('x-creator-id')
  if (!creatorId) return NextResponse.json({ code: 'unauthenticated' }, { status: 401 })

  let body: { field?: string; surface?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'bad_request' }, { status: 400 })
  }

  const field = body.field && VALID_FIELDS.has(body.field) ? (body.field as ProposalField) : undefined
  if (body.field && !VALID_FIELDS.has(body.field)) {
    return NextResponse.json({ code: 'bad_request', detail: 'invalid field' }, { status: 400 })
  }
  if (!body.surface || !VALID_SURFACES.has(body.surface)) {
    return NextResponse.json({ code: 'bad_request', detail: 'invalid surface' }, { status: 400 })
  }

  await dismissProposal({
    assetId,
    creatorId,
    field,
    surface: body.surface as 'upload' | 'vault_edit' | 'bulk_action' | 'system',
  })
  return NextResponse.json({ ok: true }, { status: 200 })
}
