// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Share Token Dataset
// Minimal seed records for share link resolution.
// In production these would live in the database.
// ═══════════════════════════════════════════════════════════════

export type ShareStatus = 'active' | 'expired' | 'revoked'
export type ShareTemplate = 'asset' | 'collection' | 'creator' | 'frontfolio'

export interface ShareRecord {
  token: string
  status: ShareStatus
  template: ShareTemplate
  /** Populated for 'asset' template */
  assetId?: string
  /** Populated for 'creator' and 'frontfolio' templates */
  creatorHandle?: string
  /** Populated for 'collection' template */
  collectionId?: string
  expiresAt?: string
  createdAt: string
}

export const shareRecords: ShareRecord[] = [
  {
    token: 'shr_asset_guaiba',
    status: 'active',
    template: 'asset',
    assetId: 'asset-001',
    createdAt: '2026-03-10T08:00:00Z',
  },
  {
    token: 'shr_frontfolio_marco',
    status: 'active',
    template: 'frontfolio',
    creatorHandle: 'marcooliveira',
    createdAt: '2026-03-10T09:00:00Z',
  },
  {
    token: 'shr_collection_climate',
    status: 'active',
    template: 'collection',
    collectionId: 'collection-001',
    createdAt: '2026-03-10T10:00:00Z',
  },
  {
    token: 'shr_expired_example',
    status: 'expired',
    template: 'asset',
    assetId: 'asset-002',
    expiresAt: '2026-01-01T00:00:00Z',
    createdAt: '2025-12-01T00:00:00Z',
  },
  {
    token: 'shr_revoked_example',
    status: 'revoked',
    template: 'creator',
    creatorHandle: 'anasousa',
    createdAt: '2026-02-01T00:00:00Z',
  },
]

export const shareMap: Record<string, ShareRecord> = Object.fromEntries(
  shareRecords.map(s => [s.token, s])
)
