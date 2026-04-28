/**
 * POST /api/v2/asset/[id]/proposal/accept — E6 §7.2
 *
 * Body: { fields: ProposalField[]; surface: AuditSurface }
 */

import { NextRequest, NextResponse } from 'next/server'
import { isRealUploadEnabled } from '@/lib/flags'
import { acceptProposal, type ProposalField } from '@/lib/ai-suggestions/proposal-mutations'

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

  let body: { fields?: string[]; surface?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'bad_request', detail: 'invalid JSON' }, { status: 400 })
  }

  const fields = (body.fields ?? []).filter((f) => VALID_FIELDS.has(f)) as ProposalField[]
  const surface = body.surface
  if (fields.length === 0) {
    return NextResponse.json(
      { code: 'bad_request', detail: 'fields required (caption | keywords | tags)' },
      { status: 400 },
    )
  }
  if (!surface || !VALID_SURFACES.has(surface)) {
    return NextResponse.json(
      { code: 'bad_request', detail: 'surface must be one of upload | vault_edit | bulk_action | system' },
      { status: 400 },
    )
  }

  try {
    await acceptProposal({
      assetId,
      creatorId,
      fields,
      surface: surface as 'upload' | 'vault_edit' | 'bulk_action' | 'system',
    })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not_found')) {
      return NextResponse.json({ code: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ code: 'persistence_failed', detail: msg }, { status: 500 })
  }
}
