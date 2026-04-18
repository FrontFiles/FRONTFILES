/**
 * Direct Offer Engine — Test Helpers
 *
 * Factory functions for creating test data.
 */

import type { SpecialOfferThread, SpecialOfferEvent, VaultAsset, LicenceType, SpecialOfferStatus } from '@/lib/types'

let threadSeq = 0
let eventSeq = 0

export function makeAsset(overrides: Partial<VaultAsset> = {}): VaultAsset {
  return {
    id: 'test-asset-001',
    title: 'Test Photo',
    description: 'A test asset',
    format: 'photo',
    thumbnailUrl: null,
    privacy: 'PUBLIC',
    declarationState: 'fully_validated',
    publication: 'PUBLISHED',
    uploadedAt: '2026-01-01T00:00:00Z',
    certifiedAt: '2026-01-01T00:00:00Z',
    certificationHash: 'abc123',
    fileSize: '2MB',
    storyId: null,
    creatorPrice: 15000, // €150.00
    enabledLicences: ['editorial', 'commercial'],
    exclusiveLock: null,
    ...overrides,
  }
}

export function makeThread(overrides: Partial<SpecialOfferThread> = {}): SpecialOfferThread {
  const id = `test-thread-${String(++threadSeq).padStart(4, '0')}`
  const now = new Date()
  return {
    id,
    assetId: 'test-asset-001',
    buyerId: 'buyer-001',
    creatorId: 'creator-001',
    licenceType: 'editorial',
    listedPriceAtOpen: 15000,
    currentOfferAmount: 11000,
    currentOfferBy: 'buyer',
    roundCount: 1,
    creatorResponseWindowMinutes: 240,
    expiresAt: new Date(now.getTime() + 4 * 60 * 60_000).toISOString(),
    status: 'buyer_offer_pending_creator',
    acceptedAmount: null,
    checkoutIntentId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    resolvedAt: null,
    autoCancelReason: null,
    ...overrides,
  }
}

export function makeEvent(overrides: Partial<SpecialOfferEvent> = {}): SpecialOfferEvent {
  return {
    id: `test-event-${String(++eventSeq).padStart(6, '0')}`,
    threadId: 'test-thread-0001',
    type: 'buyer_offer',
    actorId: 'buyer-001',
    amount: 11000,
    message: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function resetSequences(): void {
  threadSeq = 0
  eventSeq = 0
}
