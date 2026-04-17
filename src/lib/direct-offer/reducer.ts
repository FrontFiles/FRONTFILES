/**
 * Direct Offer Engine — Reducer
 *
 * Deterministic state machine for Direct Offer UI.
 * All mutations through dispatched actions.
 * Domain logic is in services.ts — this reducer delegates to services.
 */

import type { DirectOfferEngineState, DirectOfferAction } from './types'
import type { DirectOfferThread, DirectOfferEvent } from '@/lib/types'

// ══════════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════════

export const initialDirectOfferState: DirectOfferEngineState = {
  thread: null,
  events: [],
}

// ══════════════════════════════════════════════
// REDUCER
// ══════════════════════════════════════════════

export function directOfferReducer(
  state: DirectOfferEngineState,
  action: DirectOfferAction,
): DirectOfferEngineState {
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
