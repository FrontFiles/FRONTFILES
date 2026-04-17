import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processDerivative } from '../pipeline'
import type { StorageAdapter, MediaRowAdapter } from '../pipeline'
import type { ProcessingJob } from '../types'
import { IMAGE_DERIVATIVE_SPECS } from '../types'

// ══════════════════════════════════════════════
// Mock Sharp — avoids real image processing in unit tests.
// Integration tests with real images should use a separate test suite.
// ══════════════════════════════════════════════

vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.alloc(1024)),
  }))
  return { default: mockSharp }
})

// ══════════════════════════════════════════════
// Test fixtures
// ══════════════════════════════════════════════

const TEST_ORIGINAL = Buffer.alloc(2048)

function createMockStorage(): StorageAdapter {
  return {
    readOriginal: vi.fn().mockResolvedValue(TEST_ORIGINAL),
    writeDerivative: vi.fn().mockResolvedValue('derivatives/test-asset/thumbnail.jpg'),
  }
}

function createMockMediaRows(): MediaRowAdapter {
  return {
    updateMediaRow: vi.fn().mockResolvedValue(undefined),
  }
}

function createJob(specIndex = 0): ProcessingJob {
  return {
    assetId: 'asset-test123',
    spec: IMAGE_DERIVATIVE_SPECS[specIndex],
    intrusionLevel: 'standard',
    assetIdShort: 'test123',
    attribution: 'TEST CREATOR',
  }
}

// ══════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════

describe('processDerivative', () => {
  let storage: StorageAdapter
  let mediaRows: MediaRowAdapter

  beforeEach(() => {
    storage = createMockStorage()
    mediaRows = createMockMediaRows()
  })

  it('processes thumbnail (unwatermarked) successfully', async () => {
    const job = createJob(0) // thumbnail
    expect(job.spec.role).toBe('thumbnail')
    expect(job.spec.watermarked).toBe(false)

    const result = await processDerivative(job, storage, mediaRows, true)

    expect(result.success).toBe(true)
    expect(result.role).toBe('thumbnail')
    expect(result.storageRef).not.toBeNull()
    expect(result.profileVersion).toBeNull() // no watermark
    expect(result.error).toBeNull()
  })

  it('processes watermarked_preview with draft profile in dev mode', async () => {
    const job = createJob(1) // watermarked_preview
    expect(job.spec.role).toBe('watermarked_preview')
    expect(job.spec.watermarked).toBe(true)

    const result = await processDerivative(job, storage, mediaRows, true)

    expect(result.success).toBe(true)
    expect(result.role).toBe('watermarked_preview')
    expect(result.profileVersion).toBe(1)
  })

  it('fails watermarked_preview without draft allowance when profiles are draft', async () => {
    const job = createJob(1) // watermarked_preview

    const result = await processDerivative(job, storage, mediaRows, false)

    expect(result.success).toBe(false)
    expect(result.error).toContain('not approved')
  })

  it('marks status as processing then ready on success', async () => {
    const job = createJob(0)

    await processDerivative(job, storage, mediaRows, true)

    const calls = (mediaRows.updateMediaRow as ReturnType<typeof vi.fn>).mock.calls
    // First call: status → processing
    expect(calls[0][2].status).toBe('processing')
    // Second call: status → ready
    expect(calls[1][2].status).toBe('ready')
  })

  it('marks status as failed when original is not found', async () => {
    ;(storage.readOriginal as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const job = createJob(0)

    const result = await processDerivative(job, storage, mediaRows, true)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Original not found')

    const calls = (mediaRows.updateMediaRow as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0][2].status).toBe('processing')
    expect(calls[1][2].status).toBe('failed')
  })

  it('is idempotent — can re-run for the same asset and role', async () => {
    const job = createJob(0)

    const result1 = await processDerivative(job, storage, mediaRows, true)
    const result2 = await processDerivative(job, storage, mediaRows, true)

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
    expect(result1.role).toBe(result2.role)
  })

  it('processes OG image (watermarked) with draft profile in dev mode', async () => {
    const job = createJob(2) // og_image
    expect(job.spec.role).toBe('og_image')
    expect(job.spec.watermarked).toBe(true)

    const result = await processDerivative(job, storage, mediaRows, true)

    expect(result.success).toBe(true)
    expect(result.profileVersion).toBe(1)
  })
})
