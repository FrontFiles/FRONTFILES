import { describe, it, expect, beforeEach } from 'vitest'

import {
  DERIVATIVE_ROLES,
  enqueueDerivativeRows,
  __testing as enqueueTesting,
} from '../enqueue'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode: unset Supabase env vars so the real-path code
// is bypassed and the in-memory Set is exercised.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

beforeEach(() => {
  enqueueTesting.reset()
})

describe('DERIVATIVE_ROLES constant', () => {
  it('exposes exactly three roles in the expected order', () => {
    // Catches accidental enum drift. Order is asserted because tests
    // and downstream code may depend on it (e.g. UI rendering of
    // pending rows in row order).
    expect(DERIVATIVE_ROLES).toEqual([
      'thumbnail',
      'watermarked_preview',
      'og_image',
    ])
  })

  it('does NOT include detail_preview (deferred per IP-2)', () => {
    expect(DERIVATIVE_ROLES).not.toContain('detail_preview')
  })

  it('does NOT include original (inserted by upload_commit RPC)', () => {
    expect(DERIVATIVE_ROLES).not.toContain('original')
  })
})

describe('enqueueDerivativeRows — happy path (mock mode)', () => {
  it('inserts exactly 3 rows for a new asset', async () => {
    const result = await enqueueDerivativeRows('asset-A')
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.rolesInserted).toEqual([
      'thumbnail',
      'watermarked_preview',
      'og_image',
    ])
    expect(enqueueTesting.size()).toBe(3)
  })

  it('mock store tracks each (assetId, role) pair individually', async () => {
    await enqueueDerivativeRows('asset-A')
    expect(enqueueTesting.has('asset-A', 'thumbnail')).toBe(true)
    expect(enqueueTesting.has('asset-A', 'watermarked_preview')).toBe(true)
    expect(enqueueTesting.has('asset-A', 'og_image')).toBe(true)
  })
})

describe('enqueueDerivativeRows — replay safety', () => {
  it('replay returns the same rolesInserted shape (not empty)', async () => {
    // Per the contract: the result reports "the asset has these
    // pending roles," not "we just inserted these." Replay returns
    // the same shape both times.
    const first = await enqueueDerivativeRows('asset-A')
    const second = await enqueueDerivativeRows('asset-A')
    expect(first.kind).toBe('ok')
    expect(second.kind).toBe('ok')
    if (first.kind !== 'ok' || second.kind !== 'ok') return
    expect(second.rolesInserted).toEqual(first.rolesInserted)
  })

  it('replay does NOT increase mock store size (idempotent insert)', async () => {
    await enqueueDerivativeRows('asset-A')
    expect(enqueueTesting.size()).toBe(3)
    await enqueueDerivativeRows('asset-A')
    expect(enqueueTesting.size()).toBe(3) // unchanged
  })
})

describe('enqueueDerivativeRows — multi-asset isolation', () => {
  it('two distinct assetIds do not cross-contaminate the mock store', async () => {
    await enqueueDerivativeRows('asset-A')
    await enqueueDerivativeRows('asset-B')
    expect(enqueueTesting.size()).toBe(6) // 3 per asset
    expect(enqueueTesting.has('asset-A', 'thumbnail')).toBe(true)
    expect(enqueueTesting.has('asset-B', 'thumbnail')).toBe(true)
    // Inverse — assetIds don't pollute each other
    expect(enqueueTesting.has('asset-A', 'og_image')).toBe(true)
    expect(enqueueTesting.has('asset-B', 'og_image')).toBe(true)
  })
})
