import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock surface — vitest hoists vi.mock() above imports.
const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock('@/lib/db/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}))

import { writeAuditEvent } from '../audit'

const VALID_EVENT = {
  asset_id: '00000000-0000-0000-0000-000000000001',
  creator_id: '00000000-0000-0000-0000-000000000002',
  event_type: 'proposal_accepted' as const,
  field_name: 'caption' as const,
  before_value: null,
  after_value: 'A new caption',
  surface: 'upload' as const,
}

beforeEach(() => {
  mockInsert.mockReset()
  mockFrom.mockClear()
})

describe('writeAuditEvent', () => {
  it('writes a valid event to asset_proposal_audit_log', async () => {
    mockInsert.mockResolvedValue({ error: null })
    await writeAuditEvent(VALID_EVENT)
    expect(mockFrom).toHaveBeenCalledWith('asset_proposal_audit_log')
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const inserted = mockInsert.mock.calls[0][0]
    expect(inserted.asset_id).toBe(VALID_EVENT.asset_id)
    expect(inserted.event_type).toBe('proposal_accepted')
    expect(inserted.field_name).toBe('caption')
  })

  it('throws on Zod validation failure (invalid event_type)', async () => {
    await expect(
      writeAuditEvent({
        ...VALID_EVENT,
        // @ts-expect-error testing invalid input
        event_type: 'proposal_shown',
      }),
    ).rejects.toThrow()
    // Zod throws BEFORE the supabase insert is attempted
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('throws on Zod validation failure (invalid surface)', async () => {
    await expect(
      writeAuditEvent({
        ...VALID_EVENT,
        // @ts-expect-error testing invalid input
        surface: 'admin_console',
      }),
    ).rejects.toThrow()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('throws on supabase insert error (non-silent failure)', async () => {
    mockInsert.mockResolvedValue({
      error: { message: 'permission denied for table asset_proposal_audit_log' },
    })
    await expect(writeAuditEvent(VALID_EVENT)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('accepts cluster events without field_name', async () => {
    mockInsert.mockResolvedValue({ error: null })
    await writeAuditEvent({
      asset_id: VALID_EVENT.asset_id,
      creator_id: VALID_EVENT.creator_id,
      event_type: 'cluster_accepted',
      cluster_id: '00000000-0000-0000-0000-000000000010',
      surface: 'upload',
    })
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })
})
