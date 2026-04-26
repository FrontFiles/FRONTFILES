import { describe, it, expect, beforeEach } from 'vitest'

import {
  makeMediaRowAdapter,
  findOriginalStorageRef,
  __testing as mediaRowTesting,
} from '../media-row-adapter'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

beforeEach(() => {
  mediaRowTesting.reset()
})

describe('makeMediaRowAdapter — mock mode', () => {
  it('updates a row from pending → processing and stamps processing_started_at', async () => {
    const adapter = makeMediaRowAdapter()
    await adapter.updateMediaRow('asset-1', 'thumbnail', { status: 'processing' })

    const row = mediaRowTesting.get('asset-1', 'thumbnail')
    expect(row).toBeDefined()
    expect(row?.generationStatus).toBe('processing')
    expect(row?.processingStartedAt).not.toBeNull()
    // Stamped to "now-ish" — within 5 seconds of test execution
    const ageMs = Date.now() - new Date(row!.processingStartedAt!).getTime()
    expect(ageMs).toBeLessThan(5000)
  })

  it('clears processing_started_at on transition to ready', async () => {
    const adapter = makeMediaRowAdapter()
    await adapter.updateMediaRow('asset-1', 'thumbnail', { status: 'processing' })
    await adapter.updateMediaRow('asset-1', 'thumbnail', {
      status: 'ready',
      storageRef: 'derivatives/asset-1/thumbnail.jpg',
      contentType: 'image/jpeg',
      width: 400,
      height: 300,
      fileSizeBytes: 12345,
    })

    const row = mediaRowTesting.get('asset-1', 'thumbnail')
    expect(row?.generationStatus).toBe('ready')
    expect(row?.processingStartedAt).toBeNull()
    expect(row?.storageRef).toBe('derivatives/asset-1/thumbnail.jpg')
    expect(row?.contentType).toBe('image/jpeg')
    expect(row?.width).toBe(400)
    expect(row?.height).toBe(300)
    expect(row?.fileSizeBytes).toBe(12345)
  })

  it('clears processing_started_at on transition to failed', async () => {
    const adapter = makeMediaRowAdapter()
    await adapter.updateMediaRow('asset-1', 'thumbnail', { status: 'processing' })
    await adapter.updateMediaRow('asset-1', 'thumbnail', { status: 'failed' })

    const row = mediaRowTesting.get('asset-1', 'thumbnail')
    expect(row?.generationStatus).toBe('failed')
    expect(row?.processingStartedAt).toBeNull()
  })

  it('clears processing_started_at on transition back to pending (stay-pending case)', async () => {
    const adapter = makeMediaRowAdapter()
    await adapter.updateMediaRow('asset-1', 'watermarked_preview', { status: 'processing' })
    // Stay-pending: profile missing
    await adapter.updateMediaRow('asset-1', 'watermarked_preview', { status: 'pending' })

    const row = mediaRowTesting.get('asset-1', 'watermarked_preview')
    expect(row?.generationStatus).toBe('pending')
    expect(row?.processingStartedAt).toBeNull()
  })

  it('stamps watermark_profile_version when set on ready', async () => {
    const adapter = makeMediaRowAdapter()
    await adapter.updateMediaRow('asset-1', 'watermarked_preview', { status: 'processing' })
    await adapter.updateMediaRow('asset-1', 'watermarked_preview', {
      status: 'ready',
      storageRef: 'derivatives/asset-1/watermarked_preview.jpg',
      watermarkProfileVersion: 1,
    })

    const row = mediaRowTesting.get('asset-1', 'watermarked_preview')
    expect(row?.watermarkProfileVersion).toBe(1)
  })

  it('updates do not cross-contaminate distinct (assetId, role) pairs', async () => {
    const adapter = makeMediaRowAdapter()
    await adapter.updateMediaRow('asset-A', 'thumbnail', { status: 'processing' })
    await adapter.updateMediaRow('asset-B', 'thumbnail', { status: 'processing' })

    expect(mediaRowTesting.size()).toBe(2)
    expect(mediaRowTesting.get('asset-A', 'thumbnail')?.generationStatus).toBe('processing')
    expect(mediaRowTesting.get('asset-B', 'thumbnail')?.generationStatus).toBe('processing')
  })
})

describe('findOriginalStorageRef — mock mode', () => {
  it('returns the storage_ref of a seeded original row', async () => {
    mediaRowTesting.seed({
      assetId: 'asset-1',
      mediaRole: 'original',
      generationStatus: 'ready',
      storageRef: 'originals/asset-1/IMG.jpeg',
      contentType: 'image/jpeg',
      fileSizeBytes: 100000,
      width: 1920,
      height: 1080,
      watermarkProfileVersion: null,
      processingStartedAt: null,
    })

    const ref = await findOriginalStorageRef('asset-1')
    expect(ref).toBe('originals/asset-1/IMG.jpeg')
  })

  it('returns null when no original row exists', async () => {
    const ref = await findOriginalStorageRef('asset-nonexistent')
    expect(ref).toBeNull()
  })
})
