// ═══════════════════════════════════════════════════════════════
// Frontfiles — /api/v2/batch (PR 1.2, dormant behind flag)
//
// POST /api/v2/batch
//
// Creates a new upload_batches row with state='open' and returns
// the generated id plus server-authoritative metadata.
//
// Request body (optional):
//   { "newsroom_mode": boolean }   // defaults to false when absent
//
// Headers:
//   X-Creator-Id — placeholder session (see route.ts §2 in
//                  /api/upload); real session resolver lands ahead
//                  of the PR 5 cutover.
//
// Behavior while FFF_REAL_UPLOAD=false (default): returns 503
// immediately. No body is read, no auth check runs. Matches the
// posture of PR 2's /api/upload — the one flag gates the whole
// pipeline.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

import { isRealUploadEnabled } from '@/lib/flags'
import { createBatch } from '@/lib/upload/batch-service'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Flag gate — nothing else runs while the feature is off.
  if (!isRealUploadEnabled()) {
    return NextResponse.json(
      { code: 'not_enabled', detail: 'real upload pipeline is disabled' },
      { status: 503 },
    )
  }

  // 2. Placeholder session. A real session resolver replaces this
  //    before PR 5's cutover.
  const creatorId = req.headers.get('x-creator-id')
  if (!creatorId) {
    return NextResponse.json(
      { code: 'unauthenticated' },
      { status: 401 },
    )
  }

  // 3. Parse optional JSON body. An empty body is valid —
  //    newsroom_mode defaults to false.
  let newsroomMode = false
  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > 0) {
    let body: unknown
    try {
      body = await req.json()
    } catch (err) {
      return NextResponse.json(
        { code: 'bad_request', detail: `malformed JSON: ${toErrorMessage(err)}` },
        { status: 400 },
      )
    }

    if (body !== null && body !== undefined) {
      if (typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json(
          { code: 'bad_request', detail: 'body must be a JSON object' },
          { status: 400 },
        )
      }
      const raw = (body as Record<string, unknown>).newsroom_mode
      if (raw !== undefined) {
        if (typeof raw !== 'boolean') {
          return NextResponse.json(
            { code: 'bad_request', detail: 'newsroom_mode must be a boolean' },
            { status: 400 },
          )
        }
        newsroomMode = raw
      }
    }
  }

  // 4. Create the batch.
  const result = await createBatch({ creatorId, newsroomMode })
  if (!result.ok) {
    return NextResponse.json(
      { code: result.code, detail: result.detail },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      id: result.batch.id,
      state: result.batch.state,
      newsroom_mode: result.batch.newsroomMode,
      created_at: result.batch.createdAt,
    },
    { status: 201 },
  )
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
