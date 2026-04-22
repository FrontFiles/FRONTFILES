/**
 * Frontfiles — Offer RPC error classifier (P4 concern 4A.2 Part B1)
 *
 * TS-side classifier for the SQLSTATE + SQLERRM pairs raised by
 * Part A's offer-surface business RPCs in
 * supabase/migrations/20260421000011_rpc_offer_business.sql.
 *
 * Pattern mirrors `src/lib/ledger/writer.ts` L133-158:
 * scoped SQLSTATE + SQLERRM substring match. Plain SQLSTATE
 * alone is unsafe — P0003 in particular carries TWO distinct
 * business conditions (`offer_not_found`, `invalid_state`) and
 * cannot be disambiguated without looking at the message prefix.
 * Substring-only matching is equally unsafe — it would
 * mis-classify any SQLERRM that happens to mention a keyword in
 * unrelated text. Both checks together pin the classifier to
 * exactly what Part A's migration raises.
 *
 * See P4_CONCERN_4A_2_B1_DIRECTIVE.md §DELIVERABLES F6 and
 * §DECISIONS D4 for the stable-code + HTTP-status table.
 *
 * Logger discipline (D9): this module does NOT log. Callers
 * log a single line with { route, kind, code, rawCode }. The
 * `raw` field below is for correlation only — it must never be
 * serialised into an HTTP response body, and callers should
 * only log it at error severity.
 */

// ─── Exhaustive union of classified outcomes ─────────────────────

export type OfferRpcErrorKind =
  | 'retry_exhausted'
  | 'rate_limit'
  | 'invalid_state'
  | 'offer_not_found'
  | 'not_party'
  | 'not_last_turn'
  | 'not_system'
  | 'not_yet_expired'
  | 'actor_mismatch'
  | 'unknown'

export type ClassifiedRpcError = {
  kind: OfferRpcErrorKind
  /** HTTP status the route handler should emit. */
  httpStatus: number
  /** Stable SCREAMING_SNAKE_CASE identifier for response bodies. */
  code: string
  /** Client-safe message. No SQL text, no PII, no stack trace. */
  message: string
  /** Raw Postgres error fields. For server-side logging only. */
  raw: { code?: string; message?: string }
}

// ─── SQLSTATE + SQLERRM substrings (pinned to migration) ─────────
//
// The substrings below are literal phrases drawn from the RAISE
// messages in migration 20260421000011. If those messages change
// (they shouldn't — the migration is frozen), this file updates
// in lockstep.

const SQLSTATE = {
  RETRY_EXHAUSTED: 'P0001',
  RATE_LIMIT: 'P0002',
  // P0003 carries two business conditions; disambiguate by SQLERRM.
  BUSINESS_STATE_OR_NOT_FOUND: 'P0003',
  NOT_PARTY: 'P0004',
  NOT_LAST_TURN: 'P0005',
  NOT_SYSTEM: 'P0006',
  NOT_YET_EXPIRED: 'P0007',
  ACTOR_MISMATCH: 'P0008',
} as const

// Substring anchors, matched case-sensitively against SQLERRM.
// Each literal is the stable prefix Part A's RAISE sites emit.
// P0001: `_emit_offer_event_with_retry exhausted N attempts ...`
const RAISE_RETRY_EXHAUSTED = 'exhausted'
const RAISE_RATE_LIMIT = 'rate_limit'
const RAISE_OFFER_NOT_FOUND = 'offer_not_found'
const RAISE_INVALID_STATE = 'invalid_state'
const RAISE_NOT_PARTY = 'not_party'
const RAISE_NOT_LAST_TURN = 'not_last_turn'
const RAISE_NOT_SYSTEM = 'not_system'
const RAISE_NOT_YET_EXPIRED = 'not_yet_expired'
const RAISE_ACTOR_MISMATCH = 'actor_mismatch'

// ─── Classifier ──────────────────────────────────────────────────

const UNKNOWN: Omit<ClassifiedRpcError, 'raw'> = {
  kind: 'unknown',
  httpStatus: 500,
  code: 'INTERNAL',
  message: 'Internal server error.',
}

/**
 * Classify a Supabase RPC error into a stable { kind, httpStatus,
 * code, message } bundle. Pass any falsy value (null / undefined
 * / absent .code) through as `unknown`; the caller has already
 * decided there was a failure and just needs the surface shape.
 *
 * Ordering matters: the P0003 branch checks the more specific
 * `offer_not_found` prefix before `invalid_state`, so a future
 * SQLERRM that contains both (there isn't one today) prefers the
 * not-found semantics. The final `default` branch catches unknown
 * SQLSTATEs and SQLSTATEs that match but fail the SQLERRM scope.
 */
export function classifyRpcError(
  err: { code?: string; message?: string } | null | undefined,
): ClassifiedRpcError {
  if (!err || typeof err.code !== 'string') {
    return { ...UNKNOWN, raw: { code: err?.code, message: err?.message } }
  }

  const raw = { code: err.code, message: err.message }
  const msg = err.message ?? ''

  switch (err.code) {
    case SQLSTATE.RETRY_EXHAUSTED: {
      if (!msg.includes(RAISE_RETRY_EXHAUSTED)) break
      return {
        kind: 'retry_exhausted',
        httpStatus: 503,
        code: 'LEDGER_CONTENTION',
        message: 'Ledger write contention; retry shortly.',
        raw,
      }
    }
    case SQLSTATE.RATE_LIMIT: {
      if (!msg.includes(RAISE_RATE_LIMIT)) break
      return {
        kind: 'rate_limit',
        httpStatus: 429,
        code: 'RATE_LIMIT',
        message:
          'Maximum pending offers with this counterparty reached.',
        raw,
      }
    }
    case SQLSTATE.BUSINESS_STATE_OR_NOT_FOUND: {
      if (msg.includes(RAISE_OFFER_NOT_FOUND)) {
        return {
          kind: 'offer_not_found',
          httpStatus: 404,
          code: 'OFFER_NOT_FOUND',
          message: 'Offer not found.',
          raw,
        }
      }
      if (msg.includes(RAISE_INVALID_STATE)) {
        return {
          kind: 'invalid_state',
          httpStatus: 409,
          code: 'INVALID_STATE',
          message: 'Offer is not in a transitionable state.',
          raw,
        }
      }
      break
    }
    case SQLSTATE.NOT_PARTY: {
      if (!msg.includes(RAISE_NOT_PARTY)) break
      return {
        kind: 'not_party',
        httpStatus: 403,
        code: 'NOT_PARTY',
        message: 'Not a party on this offer.',
        raw,
      }
    }
    case SQLSTATE.NOT_LAST_TURN: {
      if (!msg.includes(RAISE_NOT_LAST_TURN)) break
      return {
        kind: 'not_last_turn',
        httpStatus: 409,
        code: 'NOT_LAST_TURN',
        message: 'Cancellation requires the last turn to be yours.',
        raw,
      }
    }
    case SQLSTATE.NOT_SYSTEM: {
      if (!msg.includes(RAISE_NOT_SYSTEM)) break
      return {
        kind: 'not_system',
        httpStatus: 403,
        code: 'NOT_SYSTEM',
        message: 'This operation is system-only.',
        raw,
      }
    }
    case SQLSTATE.NOT_YET_EXPIRED: {
      if (!msg.includes(RAISE_NOT_YET_EXPIRED)) break
      return {
        kind: 'not_yet_expired',
        httpStatus: 409,
        code: 'NOT_YET_EXPIRED',
        message: 'Offer has not yet expired.',
        raw,
      }
    }
    case SQLSTATE.ACTOR_MISMATCH: {
      if (!msg.includes(RAISE_ACTOR_MISMATCH)) break
      return {
        kind: 'actor_mismatch',
        httpStatus: 401,
        code: 'ACTOR_MISMATCH',
        message:
          'Session actor does not match the authenticated user.',
        raw,
      }
    }
  }

  return { ...UNKNOWN, raw }
}
