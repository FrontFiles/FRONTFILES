/**
 * Direct Offer Engine — Reducer
 *
 * Deterministic state machine for Direct Offer UI.
 * All mutations through dispatched actions.
 * Domain logic is in services.ts — this reducer delegates to services.
 */

import type { SpecialOfferEngineState, SpecialOfferAction } from './types'
import type { SpecialOfferThread, SpecialOfferEvent } from '@/lib/types'

// ══════════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════════

export const initialSpecialOfferState: SpecialOfferEngineState = {
  thread: null,
  events: [],
}

// ══════════════════════════════════════════════
// REDUCER
// ══════════════════════════════════════════════

export function specialOfferReducer(
  state: SpecialOfferEngineState,
  action: SpecialOfferAction,
): SpecialOfferEngineState {
  switch (action.type) {
    case 'LOAD_THREAD':
      return {
        ...state,
        thread: action.thread,
        events: action.events,
      }

    default:
      return state
  }
}
