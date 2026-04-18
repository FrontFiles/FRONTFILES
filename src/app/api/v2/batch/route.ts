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
import * as z from 'zod' // namespace import — see src/lib/env.ts comment

import { isRealUploadEnabled } from '@/lib/flags'
import { createBatch } from '@/lib/upload/batch-service'
import { parseBody } from '@/lib/api/validation'
import {
  checkWriteActionRate,
  buildWriteRateLimitResponse,
} from '@/lib/rate-limit'

// ─── Request schema ──────────────────────────────────────────────
//
// POST /api/v2/batch accepts an optional body. When a body is
// provided, the only honoured field is `newsroom_mode: boolean`.
// An empty body is valid — newsroom_mode defaults to false.

const CreateBatchBody = z
  .object({
    newsroom_mode: z.boolean().optional().default(false),
  })
  .default({ newsroom_mode: false })

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

  // 3. Rate limit — protect against upload-batch storms.
  const rate = checkWriteActionRate({
    actorId: creatorId,
    actionType: 'upload.batch.create',
  })
  if (!rate.allowed) {
    return buildWriteRateLimitResponse(rate.retryAfterSeconds ?? 30, rate.exceededLimit)
  }

  // 4. Parse optional JSON body. Empty body is valid — we pass an
  //    empty object to parseBody, and the schema's `.default` fills
  //    in newsroom_mode: false.
  const contentLength = req.headers.get('content-length')
  const hasBody = Boolean(contentLength) && Number(contentLength) > 0

  let newsroomMode = false
  if (hasBody) {
    const [parsed, parseErr] = await parseBody(
      req,
      CreateBatchBody,
      'POST /api/v2/batch',
    )
    if (parseErr) return parseErr
    newsroomMode = parsed.newsroom_mode
  }

  // 5. Create the batch.
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
