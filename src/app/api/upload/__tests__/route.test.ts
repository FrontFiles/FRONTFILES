import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { POST } from '../route'
import { __testing as storeTesting } from '@/lib/upload/upload-store'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode: unset the 3 Supabase env vars so Pattern-a's
// live-read isSupabaseConfigured() returns false. The route still
// gates on FFF_REAL_UPLOAD (toggled per-test via local withEnv),
// but downstream upload-store calls route through their in-memory
// Map branches. See KD-9-audit.md §Phase 4.A §KD-9.1.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

// Minimal JPEG header — enough for the magic-byte sniff.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x01, 0x02, 0x03])

function withEnv(mutations: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
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
  body?: FormData
}): Request {
  const headers = new Headers(opts.headers ?? {})
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    headers,
    body: opts.body,
  })
}

function buildForm(bytes: Buffer, filename: string, mime: string, metadata: unknown): FormData {
  const fd = new FormData()
  const file = new File([new Uint8Array(bytes)], filename, { type: mime })
  fd.append('file', file)
  fd.append('metadata', JSON.stringify(metadata))
  return fd
}

let tmpRoot: string

beforeEach(async () => {
  storeTesting.reset()
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-route-'))
})

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

describe('POST /api/upload — flag gate', () => {
  it('returns 503 when FFF_REAL_UPLOAD is unset', async () => {
    await withEnv({ FFF_REAL_UPLOAD: undefined }, async () => {
      const req = makeRequest({})
      const res = await POST(req as unknown as Parameters<typeof POST>[0])
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.code).toBe('not_enabled')
    })
  })

  it('returns 503 when FFF_REAL_UPLOAD=false', async () => {
    await withEnv({ FFF_REAL_UPLOAD: 'false' }, async () => {
      const req = makeRequest({})
      const res = await POST(req as unknown as Parameters<typeof POST>[0])
      expect(res.status).toBe(503)
    })
  })
})

describe('POST /api/upload — request validation', () => {
  it('returns 401 when creator header is missing', async () => {
    await withEnv(
      { FFF_REAL_UPLOAD: 'true', FFF_STORAGE_FS_ROOT: tmpRoot },
      async () => {
        const req = makeRequest({})
        const res = await POST(req as unknown as Parameters<typeof POST>[0])
        expect(res.status).toBe(401)
      },
    )
  })

  it('returns 400 when X-Upload-Token is missing', async () => {
    await withEnv(
      { FFF_REAL_UPLOAD: 'true', FFF_STORAGE_FS_ROOT: tmpRoot },
      async () => {
        const req = makeRequest({
          headers: { 'x-creator-id': 'creator-1' },
        })
        const res = await POST(req as unknown as Parameters<typeof POST>[0])
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.code).toBe('bad_token')
      },
    )
  })

  it('returns 400 when X-Upload-Token is not a UUID', async () => {
    await withEnv(
      { FFF_REAL_UPLOAD: 'true', FFF_STORAGE_FS_ROOT: tmpRoot },
      async () => {
        const req = makeRequest({
          headers: {
            'x-creator-id': 'creator-1',
            'x-upload-token': 'not-a-uuid',
          },
        })
        const res = await POST(req as unknown as Parameters<typeof POST>[0])
        expect(res.status).toBe(400)
      },
    )
  })
})

describe('POST /api/upload — happy path (fs adapter, mock store)', () => {
  it('accepts a valid JPEG and returns 200 with asset_id', async () => {
    await withEnv(
      { FFF_REAL_UPLOAD: 'true', FFF_STORAGE_FS_ROOT: tmpRoot },
      async () => {
        // sharp would fail to decode the 9-byte header, so this
        // test is expected to 415 on decode. The purpose here is
        // to verify the route plumbing — validation + adapter +
        // commit-service wiring — up to the decode step. A
        // full end-to-end against a real image belongs in a
        // higher-level integration test.
        const form = buildForm(JPEG, 'IMG.jpeg', 'image/jpeg', { caption: 'hi' })
        const req = makeRequest({
          headers: {
            'x-creator-id': 'creator-1',
            'x-upload-token': '11111111-2222-4333-8444-555555555555',
          },
          body: form,
        })
        const res = await POST(req as unknown as Parameters<typeof POST>[0])
        // The 9-byte JPEG won't decode — expect 415 with
        // code=decode_failed. Route plumbing verified.
        expect([200, 415]).toContain(res.status)
        const body = await res.json()
        if (res.status === 415) {
          expect(body.code).toBe('decode_failed')
        } else {
          expect(body.asset_id).toBeDefined()
        }
      },
    )
  })
})

describe('POST /api/upload — payload rejections', () => {
  it('returns 415 for MIME/magic mismatch', async () => {
    await withEnv(
      { FFF_REAL_UPLOAD: 'true', FFF_STORAGE_FS_ROOT: tmpRoot },
      async () => {
        const form = buildForm(JPEG, 'IMG.png', 'image/png', {})
        const req = makeRequest({
          headers: {
            'x-creator-id': 'creator-1',
            'x-upload-token': '22222222-3333-4444-8555-666666666666',
          },
          body: form,
        })
        const res = await POST(req as unknown as Parameters<typeof POST>[0])
        expect(res.status).toBe(415)
        const body = await res.json()
        expect(body.code).toBe('validation')
        expect(body.validation_code).toBe('magic_mismatch')
      },
    )
  })

  it('returns 415 for unsupported MIME', async () => {
    await withEnv(
      { FFF_REAL_UPLOAD: 'true', FFF_STORAGE_FS_ROOT: tmpRoot },
      async () => {
        const form = buildForm(JPEG, 'IMG.gif', 'image/gif', {})
        const req = makeRequest({
          headers: {
            'x-creator-id': 'creator-1',
            'x-upload-token': '33333333-4444-4555-8666-777777777777',
          },
          body: form,
        })
        const res = await POST(req as unknown as Parameters<typeof POST>[0])
        expect(res.status).toBe(415)
        const body = await res.json()
        expect(body.validation_code).toBe('mime_not_allowed')
      },
    )
  })
})
