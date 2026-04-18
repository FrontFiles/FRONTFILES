import { describe, it, expect, beforeEach } from 'vitest'

import type { StorageAdapter } from '@/lib/storage'

import {
  canonicalJSONStringify,
  commitUpload,
  type CommitUploadRequest,
} from '../commit-service'
import { __testing as storeTesting } from '../upload-store'
import { sha256Hex } from './test-helpers'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode: unset the 3 Supabase env vars so Pattern-a's
// live-read isSupabaseConfigured() returns false. upload-store's
// findExistingByToken / insertDraftAndOriginal then route through
// their in-memory Map branches, honouring storeTesting.reset() and
// the single-shot failure-injection helpers that the suite drives.
// See KD-9-audit.md §Phase 4.A §KD-9.1.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

// ── Minimal valid JPEG fixture ────────────────────────────
// Header only — the sniff accepts it; sharp would throw on
// decode, so tests inject `imageMetadata` via deps.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x01, 0x02, 0x03])

beforeEach(() => {
  storeTesting.reset()
})

// ── Fake adapter for commit tests ────────────────────────
// Records method invocations, lets tests script failure modes
// on `putOriginal` / `delete`.

interface FakeAdapter extends StorageAdapter {
  calls: { op: string; args: unknown }[]
  nextPutShouldThrow?: string
  nextDeleteShouldThrow?: string
}

function makeAdapter(): FakeAdapter {
  const calls: { op: string; args: unknown }[] = []
  const adapter = {
    calls,
    async putOriginal(input) {
      calls.push({ op: 'putOriginal', args: input })
      if (adapter.nextPutShouldThrow) {
        const msg = adapter.nextPutShouldThrow
        adapter.nextPutShouldThrow = undefined
        throw new Error(msg)
      }
      return `originals/${input.assetId}/${input.filename}`
    },
    async putDerivative(input) {
      calls.push({ op: 'putDerivative', args: input })
      return `derivatives/${input.assetId}/${input.role}.jpg`
    },
    async getBytes(ref) {
      calls.push({ op: 'getBytes', args: ref })
      return Buffer.alloc(0)
    },
    async exists(ref) {
      calls.push({ op: 'exists', args: ref })
      return false
    },
    async delete(ref) {
      calls.push({ op: 'delete', args: ref })
      if (adapter.nextDeleteShouldThrow) {
        const msg = adapter.nextDeleteShouldThrow
        adapter.nextDeleteShouldThrow = undefined
        throw new Error(msg)
      }
    },
  } as FakeAdapter
  return adapter
}

function baseRequest(overrides: Partial<CommitUploadRequest> = {}): CommitUploadRequest {
  return {
    creatorId: 'creator-1',
    clientUploadToken: 'token-xyz',
    filename: 'IMG_0001.jpeg',
    claimedMime: 'image/jpeg',
    bytes: JPEG,
    metadata: { caption: 'hello', tags: ['a', 'b'] },
    ...overrides,
  }
}

function deps(adapter: FakeAdapter, assetId = 'asset-fixed-1') {
  return {
    adapter,
    generateAssetId: () => assetId,
    imageMetadata: async () => ({ width: 800, height: 600 }),
  }
}

// ═══════════════════════════════════════════════════════════════
// Happy path
// ═══════════════════════════════════════════════════════════════

describe('commitUpload — happy path', () => {
  it('writes bytes, inserts rows, returns assetId', async () => {
    const adapter = makeAdapter()
    const result = await commitUpload(baseRequest(), deps(adapter))
    expect(result).toEqual({
      ok: true,
      outcome: 'created',
      assetId: 'asset-fixed-1',
    })
    // putOriginal was called once with expected fields.
    const puts = adapter.calls.filter(c => c.op === 'putOriginal')
    expect(puts).toHaveLength(1)
    expect(puts[0].args).toMatchObject({
      assetId: 'asset-fixed-1',
      filename: 'IMG_0001.jpeg',
      contentType: 'image/jpeg',
    })
    // No compensating delete on success.
    expect(adapter.calls.some(c => c.op === 'delete')).toBe(false)
    expect(storeTesting.size()).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// Idempotency replays
// ═══════════════════════════════════════════════════════════════

describe('commitUpload — idempotency replay', () => {
  it('returns hit with matching fingerprints, no writes', async () => {
    const adapter = makeAdapter()
    const req = baseRequest()
    const metaChecksum = sha256Hex(Buffer.from(canonicalJSONStringify(req.metadata), 'utf8'))

    storeTesting.seedExisting({
      assetId: 'pre-existing-asset',
      creatorId: req.creatorId,
      clientUploadToken: req.clientUploadToken,
      originalSizeBytes: req.bytes.length,
      metadataChecksum: metaChecksum,
      originalSha256: sha256Hex(req.bytes),
    })

    const result = await commitUpload(req, deps(adapter))
    expect(result).toEqual({
      ok: true,
      outcome: 'hit',
      assetId: 'pre-existing-asset',
    })
    expect(adapter.calls.filter(c => c.op === 'putOriginal')).toHaveLength(0)
  })

  it('returns 409-shape on sha mismatch', async () => {
    const adapter = makeAdapter()
    const req = baseRequest()
    const metaChecksum = sha256Hex(Buffer.from(canonicalJSONStringify(req.metadata), 'utf8'))

    storeTesting.seedExisting({
      assetId: 'other-asset',
      creatorId: req.creatorId,
      clientUploadToken: req.clientUploadToken,
      originalSizeBytes: req.bytes.length,
      metadataChecksum: metaChecksum,
      originalSha256: 'different-sha-value',
    })

    const result = await commitUpload(req, deps(adapter))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('idempotency_conflict')
    expect(result.mismatched).toContain('original_sha256')
  })

  it('returns 409-shape on size mismatch', async () => {
    const adapter = makeAdapter()
    const req = baseRequest()
    const metaChecksum = sha256Hex(Buffer.from(canonicalJSONStringify(req.metadata), 'utf8'))

    storeTesting.seedExisting({
      assetId: 'other-asset',
      creatorId: req.creatorId,
      clientUploadToken: req.clientUploadToken,
      originalSizeBytes: req.bytes.length + 1,
      metadataChecksum: metaChecksum,
      originalSha256: sha256Hex(req.bytes),
    })

    const result = await commitUpload(req, deps(adapter))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.mismatched).toContain('original_size_bytes')
  })

  it('returns 409-shape on metadata mismatch', async () => {
    const adapter = makeAdapter()
    const req = baseRequest()

    storeTesting.seedExisting({
      assetId: 'other-asset',
      creatorId: req.creatorId,
      clientUploadToken: req.clientUploadToken,
      originalSizeBytes: req.bytes.length,
      metadataChecksum: 'completely-different-checksum',
      originalSha256: sha256Hex(req.bytes),
    })

    const result = await commitUpload(req, deps(adapter))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.mismatched).toContain('metadata_checksum')
  })
})

// ═══════════════════════════════════════════════════════════════
// Failure modes + rollback
// ═══════════════════════════════════════════════════════════════

describe('commitUpload — storage write failure', () => {
  it('returns storage_write_failed and never inserts rows', async () => {
    const adapter = makeAdapter()
    adapter.nextPutShouldThrow = 'disk full'
    const result = await commitUpload(baseRequest(), deps(adapter))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('storage_write_failed')
    expect(storeTesting.size()).toBe(0)
    // No compensating delete needed — nothing was written.
    expect(adapter.calls.some(c => c.op === 'delete')).toBe(false)
  })
})

describe('commitUpload — DB insert failure', () => {
  it('compensating delete runs and success is recorded', async () => {
    const adapter = makeAdapter()
    storeTesting.makeNextInsertFail({ kind: 'other', error: 'boom' })

    const result = await commitUpload(baseRequest(), deps(adapter))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('persistence_failed')
    expect(result.compensatingDelete).toMatchObject({
      attempted: true,
      ok: true,
      storageRef: 'originals/asset-fixed-1/IMG_0001.jpeg',
    })
    // No row persisted.
    expect(storeTesting.size()).toBe(0)
    // Exactly one delete call.
    expect(adapter.calls.filter(c => c.op === 'delete')).toHaveLength(1)
  })

  it('compensating delete failure is surfaced (not swallowed)', async () => {
    const adapter = makeAdapter()
    adapter.nextDeleteShouldThrow = 'storage unreachable'
    storeTesting.makeNextInsertFail({ kind: 'other', error: 'primary db failure' })

    const result = await commitUpload(baseRequest(), deps(adapter))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('persistence_failed')
    expect(result.detail).toBe('primary db failure')
    expect(result.compensatingDelete).toMatchObject({
      attempted: true,
      ok: false,
      storageRef: 'originals/asset-fixed-1/IMG_0001.jpeg',
      error: 'storage unreachable',
    })
  })
})

describe('commitUpload — token race (unique violation)', () => {
  function matchingWinner(req: CommitUploadRequest, assetId = 'winner-asset') {
    return {
      assetId,
      creatorId: req.creatorId,
      clientUploadToken: req.clientUploadToken,
      originalSizeBytes: req.bytes.length,
      metadataChecksum: sha256Hex(Buffer.from(canonicalJSONStringify(req.metadata), 'utf8')),
      originalSha256: sha256Hex(req.bytes),
    }
  }

  it('race + delete success + matching fingerprints → 200 hit with no compensating marker', async () => {
    const adapter = makeAdapter()
    const req = baseRequest()
    storeTesting.makeNextInsertFail(
      { kind: 'unique_violation' },
      matchingWinner(req),
    )

    const result = await commitUpload(req, deps(adapter))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outcome).toBe('hit')
    expect(result.assetId).toBe('winner-asset')
    // Delete succeeded, so no compensating marker on the OK variant.
    expect(result.compensatingDelete).toBeUndefined()
    // But the delete was attempted exactly once.
    expect(adapter.calls.filter(c => c.op === 'delete')).toHaveLength(1)
  })

  it('race + delete FAILURE + matching fingerprints → 200 hit with compensatingDelete carried forward', async () => {
    const adapter = makeAdapter()
    adapter.nextDeleteShouldThrow = 'storage unreachable'
    const req = baseRequest()
    storeTesting.makeNextInsertFail(
      { kind: 'unique_violation' },
      matchingWinner(req),
    )

    const result = await commitUpload(req, deps(adapter))
    // Canonical business outcome is success; operational cleanup
    // failure is reflected on the OK variant.
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outcome).toBe('hit')
    expect(result.assetId).toBe('winner-asset')
    expect(result.compensatingDelete).toMatchObject({
      attempted: true,
      ok: false,
      storageRef: 'originals/asset-fixed-1/IMG_0001.jpeg',
      error: 'storage unreachable',
    })
  })

  it('race + fingerprint mismatch → 409 with compensatingDelete', async () => {
    const adapter = makeAdapter()
    const req = baseRequest()
    const winner = matchingWinner(req)
    // Tamper with the winner's sha so the re-lookup returns a
    // fingerprint-mismatched row.
    winner.originalSha256 = 'different-sha'
    storeTesting.makeNextInsertFail({ kind: 'unique_violation' }, winner)

    const result = await commitUpload(req, deps(adapter))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('idempotency_conflict')
    expect(result.mismatched).toContain('original_sha256')
    expect(result.compensatingDelete?.ok).toBe(true)
  })

  it('race but winner row not found on re-lookup → 500 persistence_failed', async () => {
    const adapter = makeAdapter()
    storeTesting.makeNextInsertFail({ kind: 'unique_violation' }) // no seed

    const result = await commitUpload(baseRequest(), deps(adapter))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('persistence_failed')
    expect(result.detail).toMatch(/winner row not found/)
    expect(result.compensatingDelete?.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// Validation short-circuits
// ═══════════════════════════════════════════════════════════════

describe('commitUpload — validation', () => {
  it('rejects empty bytes without any adapter or DB call', async () => {
    const adapter = makeAdapter()
    const result = await commitUpload(
      baseRequest({ bytes: Buffer.alloc(0) }),
      deps(adapter),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('validation')
    expect(result.validationCode).toBe('empty')
    expect(adapter.calls).toHaveLength(0)
    expect(storeTesting.size()).toBe(0)
  })

  it('rejects MIME/magic mismatch', async () => {
    const adapter = makeAdapter()
    const result = await commitUpload(
      baseRequest({ claimedMime: 'image/png' }),
      deps(adapter),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.validationCode).toBe('magic_mismatch')
  })
})

// ═══════════════════════════════════════════════════════════════
// Canonical JSON stringify
// ═══════════════════════════════════════════════════════════════

describe('canonicalJSONStringify', () => {
  it('emits equal strings for objects with different key orderings', () => {
    expect(canonicalJSONStringify({ b: 1, a: 2 })).toBe(
      canonicalJSONStringify({ a: 2, b: 1 }),
    )
  })
  it('recurses into arrays and nested objects', () => {
    expect(
      canonicalJSONStringify({ x: [{ b: 1, a: 2 }, 'z'], y: null }),
    ).toBe('{"x":[{"a":2,"b":1},"z"],"y":null}')
  })
})
