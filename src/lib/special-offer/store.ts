/**
 * Direct Offer Engine — In-Memory Store
 *
 * Mirrors the assignment engine store pattern.
 * Will be replaced by Supabase queries when codegen is wired.
 */

import type { SpecialOfferThread, SpecialOfferEvent } from '@/lib/types'
import type { OfferCheckoutIntent } from './types'

// ══════════════════════════════════════════════
// IN-MEMORY STORES
// ══════════════════════════════════════════════

const threads = new Map<string, SpecialOfferThread>()
const events = new Map<string, SpecialOfferEvent[]>()
const checkoutIntents = new Map<string, OfferCheckoutIntent>()

// ══════════════════════════════════════════════
// THREAD OPERATIONS
// ══════════════════════════════════════════════

export function getThread(id: string): SpecialOfferThread | undefined {
  return threads.get(id)
}

export function putThread(thread: SpecialOfferThread): void {
  threads.set(thread.id, thread)
}

export function listThreads(filter?: {
  buyerId?: string
  creatorId?: string
  assetId?: string
}): SpecialOfferThread[] {
  let result = Array.from(threads.values())

  if (filter?.buyerId) {
    result = result.filter(t => t.buyerId === filter.buyerId)
  }
  if (filter?.creatorId) {
    result = result.filter(t => t.creatorId === filter.creatorId)
  }
  if (filter?.assetId) {
    result = result.filter(t => t.assetId === filter.assetId)
  }

  return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// ══════════════════════════════════════════════
// EVENT OPERATIONS
// ══════════════════════════════════════════════

export function getEvents(threadId: string): SpecialOfferEvent[] {
  return events.get(threadId) ?? []
}

export function putEvents(threadId: string, threadEvents: SpecialOfferEvent[]): void {
  events.set(threadId, threadEvents)
}

// ══════════════════════════════════════════════
// CHECKOUT INTENT OPERATIONS
// ══════════════════════════════════════════════

export function getCheckoutIntent(id: string): OfferCheckoutIntent | undefined {
  return checkoutIntents.get(id)
}

export function putCheckoutIntent(intent: OfferCheckoutIntent): void {
  checkoutIntents.set(intent.id, intent)
}

export function getCheckoutIntentByThread(threadId: string): OfferCheckoutIntent | undefined {
  return Array.from(checkoutIntents.values()).find(i => i.threadId === threadId)
}
