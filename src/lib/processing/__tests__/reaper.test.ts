import { describe, it, expect, beforeEach, vi } from 'vitest'

import { reapStuckProcessingRows } from '../reaper'
import { __testing as mediaRowTesting } from '../media-row-adapter'
import { scopeEnvVars } from '@/lib/test/env-scope'

// Force mock mode.
scopeEnvVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
])

beforeEach(() => {
  mediaRowTesting.reset()
  vi.restoreAllMocks()
})

function seedProcessingRow(opts: {
  assetId: string
  mediaRole: string
  startedSecondsAgo: number
}): void {
  mediaRowTesting.seed({
    assetId: opts.assetId,
    mediaRole: opts.mediaRole,
    generationStatus: 'processing',
    storageRef: null,
    contentType: null,
    fileSizeBytes: null,
    width: null,
    height: null,
    watermarkProfileVersion: null,
    processingStartedAt: new Date(
      Date.now() - opts.startedSecondsAgo * 1000,
    ).toISOString(),
  })
}

describe('reapStuckProcessingRows — mock mode', () => {
  it('resets a row stuck in processing past the timeout', async () => {
    seedProcessingRow({ assetId: 'asset-1', mediaRole: 'thumbnail', startedSecondsAgo: 700 })

    const reaped = await reapStuckProcessingRows(600)
    expect(reaped).toHaveLength(1)
    expect(reaped[0].assetId).toBe('asset-1')
    expect(reaped[0].mediaRole).toBe('thumbnail')
    expect(reaped[0].stuckDurationSeconds).toBeGreaterThanOrEqual(700)

    // Row was reset
    const row = mediaRowTesting.get('asset-1', 'thumbnail')
    expect(row?.generationStatus).toBe('pending')
    expect(row?.processingStartedAt).toBeNull()
  })

  it('does NOT reset a row that is processing within the timeout', async () => {
    seedProcessingRow({ assetId: 'asset-1', mediaRole: 'thumbnail', startedSecondsAgo: 100 })

    const reaped = await reapStuckProcessingRows(600)
    expect(reaped).toHaveLength(0)

    // Row was left alone
    const row = mediaRowTesting.get('asset-1', 'thumbnail')
    expect(row?.generationStatus).toBe('processing')
    expect(row?.processingStartedAt).not.toBeNull()
  })

  it('does NOT reset a row that is in pending / ready / failed state', async () => {
    mediaRowTesting.seed({
      assetId: 'asset-pending',
      mediaRole: 'thumbnail',
      generationStatus: 'pending',
      storageRef: null,
      contentType: null,
      fileSizeBytes: null,
      width: null,
      height: null,
      watermarkProfileVersion: null,
      processingStartedAt: null,
    })
    mediaRowTesting.seed({
      assetId: 'asset-ready',
      mediaRole: 'thumbnail',
      generationStatus: 'ready',
      storageRef: 'derivatives/asset-ready/thumbnail.jpg',
      contentType: 'image/jpeg',
      fileSizeBytes: 12345,
      width: 400,
      height: 300,
      watermarkProfileVersion: null,
      processingStartedAt: null,
    })

    const reaped = await reapStuckProcessingRows(600)
    expect(reaped).toHaveLength(0)
  })

  it('handles multiple stuck rows in one sweep', async () => {
    seedProcessingRow({ assetId: 'asset-A', mediaRole: 'thumbnail', startedSecondsAgo: 700 })
    seedProcessingRow({ assetId: 'asset-A', mediaRole: 'watermarked_preview', startedSecondsAgo: 800 })
    seedProcessingRow({ assetId: 'asset-B', mediaRole: 'thumbnail', startedSecondsAgo: 900 })
    seedProcessingRow({ assetId: 'asset-C', mediaRole: 'thumbnail', startedSecondsAgo: 30 }) // not stuck

    const reaped = await reapStuckProcessingRows(600)
    expect(reaped).toHaveLength(3)
    const reapedKeys = reaped.map(r => `${r.assetId}:${r.mediaRole}`)
    expect(reapedKeys).toContain('asset-A:thumbnail')
    expect(reapedKeys).toContain('asset-A:watermarked_preview')
    expect(reapedKeys).toContain('asset-B:thumbnail')
    expect(reapedKeys).not.toContain('asset-C:thumbnail')

    // The non-stuck row stays processing
    expect(mediaRowTesting.get('asset-C', 'thumbnail')?.generationStatus).toBe('processing')
  })

  it('logs a structured warning per reset row', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    seedProcessingRow({ assetId: 'asset-1', mediaRole: 'thumbnail', startedSecondsAgo: 700 })

    await reapStuckProcessingRows(600)

    expect(consoleSpy).toHaveBeenCalledWith(
      'reaper.stuck_processing_reset',
      expect.stringContaining('"code":"stuck_processing_reset"'),
    )
  })
})
