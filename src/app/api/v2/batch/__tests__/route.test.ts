import { describe, it, expect, beforeEach } from 'vitest'

import { POST } from '../route'
import { __testing as storeTesting } from '@/lib/upload/batch-store'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode: unset the 3 Supabase env vars so Pattern-a's
// live-read isSupabaseConfigured() returns false. The route still
// gates on FFF_REAL_UPLOAD (toggled per-test via local withEnv),
// but downstream batch-store calls route through the in-memory Map
// branches. See KD-9-audit.md §Phase 4.A §KD-9.1.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

const CREATOR_A = '11111111-1111-4111-8111-111111111111'

function withEnv(
  mutations: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(mutations)) saved[key] = process.env[key]
  const restore = () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  for (const [key, value] of Object.entries(mutations)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return fn().finally(restore)
}

function makeRequest(opts: {
  headers?: Record<string, string>
  body?: string
}): Request {
  const headers = new Headers(opts.headers ?? {})
  if (opts.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  if (opts.body && !headers.has('content-length')) {
    headers.set('content-length', String(Buffer.byteLength(opts.body)))
  }
  return new Request('http://localhost/api/v2/batch', {
    method: 'POST',
    headers,
    body: opts.body,
  })
}

beforeEach(() => {
  storeTesting.reset()
})

describe('POST /api/v2/batch — flag gate', () => {
  it('returns 503 when FFF_REAL_UPLOAD is unset', async () => {
    await withEnv({ FFF_REAL_UPLOAD: undefined }, async () => {
      const res = await POST(makeRequest({}) as unknown as Parameters<typeof POST>[0])
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.code).toBe('not_enabled')
    })
  })

  it('returns 503 when FFF_REAL_UPLOAD=false', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'false' }, async () => {
      const res = await POST(makeRequest({}) as unknown as Parameters<typeof POST>[0])
      expect(res.status).toBe(503)
    })
  })
})

describe('POST /api/v2/batch — auth', () => {
  it('returns 401 when X-Creator-Id is missing', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await POST(makeRequest({}) as unknown as Parameters<typeof POST>[0])
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.code).toBe('unauthenticated')
    })
  })
})

describe('POST /api/v2/batch — body validation', () => {
  it('returns 400 for malformed JSON', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await POST(
        makeRequest({
          headers: { 'x-creator-id': CREATOR_A },
          body: '{ this is not json',
        }) as unknown as Parameters<typeof POST>[0],
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toMatch(/not valid JSON/i)
    })
  })

  it('returns 400 when body is a JSON array', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await POST(
        makeRequest({
          headers: { 'x-creator-id': CREATOR_A },
          body: '[]',
        }) as unknown as Parameters<typeof POST>[0],
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      // Top-level type mismatch (array vs object). parseBody strips Zod's
      // formErrors before responding, so the literal "expected object"
      // message doesn't reach the body — empty `fields` is the remaining
      // signal distinguishing a top-level rejection from a per-field one.
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toMatch(/failed validation/i)
      expect(Object.keys(body.error.fields)).toHaveLength(0)
    })
  })

  it('returns 400 when newsroom_mode is not boolean', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await POST(
        makeRequest({
          headers: { 'x-creator-id': CREATOR_A },
          body: JSON.stringify({ newsroom_mode: 'yes' }),
        }) as unknown as Parameters<typeof POST>[0],
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.fields.newsroom_mode?.[0]).toMatch(/boolean/i)
    })
  })
})

describe('POST /api/v2/batch — happy path', () => {
  it('returns 201 with the created batch on empty body', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await POST(
        makeRequest({ headers: { 'x-creator-id': CREATOR_A } }) as unknown as Parameters<typeof POST>[0],
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/i)
      expect(body.state).toBe('open')
      expect(body.newsroom_mode).toBe(false)
      expect(body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  it('persists newsroom_mode=true when provided', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await POST(
        makeRequest({
          headers: { 'x-creator-id': CREATOR_A },
          body: JSON.stringify({ newsroom_mode: true }),
        }) as unknown as Parameters<typeof POST>[0],
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.newsroom_mode).toBe(true)
      const stored = storeTesting.get(body.id)
      expect(stored?.newsroomMode).toBe(true)
    })
  })

  it('accepts a body with extra fields by ignoring them', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'true' }, async () => {
      const res = await POST(
        makeRequest({
          headers: { 'x-creator-id': CREATOR_A },
          body: JSON.stringify({ newsroom_mode: false, future_flag: 42 }),
        }) as unknown as Parameters<typeof POST>[0],
      )
      expect(res.status).toBe(201)
    })
  })
})
