/**
 * Frontfiles — Render Visibility & Redaction Policy
 *
 * Centralized policy for field-level masking/redaction.
 * The same document is renderable in different visibility modes:
 *
 *   canonical  — full legal identity data (internal only)
 *   buyer_pack — masked personal data where policy requires
 *   creator_pack — masked personal data where policy requires
 *   evidence — full data + signature/audit references
 *
 * RULE: Masking is policy-driven, not ad hoc in UI components.
 */

// ══════════════════════════════════════════════
// RENDER VISIBILITY MODE
// ══════════════════════════════════════════════

export type RenderVisibilityMode =
  | 'canonical'     // full internal record — all fields visible
  | 'buyer_pack'    // buyer delivery — sensitive creator fields masked
  | 'creator_pack'  // creator delivery — sensitive buyer fields masked
  | 'evidence'      // audit/evidence — full data + signature trail

export const RENDER_MODE_LABELS: Record<RenderVisibilityMode, string> = {
  canonical: 'Canonical (internal)',
  buyer_pack: 'Buyer pack',
  creator_pack: 'Creator pack',
  evidence: 'Evidence / audit',
}

// ══════════════════════════════════════════════
// REDACTABLE FIELD KEYS
// ══════════════════════════════════════════════
//
// Fields from LegalPartyIdentity that can be subject to redaction.

export type RedactableField =
  | 'fullLegalName'
  | 'dateOfBirth'
  | 'placeOfBirth'
  | 'nationality'
  | 'legalAddress'
  | 'governmentIdType'
  | 'governmentIdNumber'
  | 'issuingCountry'
  | 'email'
  | 'representedEntity'
  | 'authorityCapacity'

// ══════════════════════════════════════════════
// REDACTION LEVEL
// ══════════════════════════════════════════════

export type RedactionLevel =
  | 'visible'        // show the full value
  | 'partial'        // show a masked version (e.g. last 4 digits)
  | 'hidden'         // do not show — render as placeholder

// ══════════════════════════════════════════════
// REDACTION POLICY
// ══════════════════════════════════════════════
//
// Maps each redactable field to a redaction level
// for a given render visibility mode.

export type RedactionPolicy = Record<RedactableField, RedactionLevel>

// ══════════════════════════════════════════════
// CANONICAL POLICIES
// ══════════════════════════════════════════════

/** Full visibility — internal and evidence modes */
const FULL_VISIBILITY: RedactionPolicy = {
  fullLegalName: 'visible',
  dateOfBirth: 'visible',
  placeOfBirth: 'visible',
  nationality: 'visible',
  legalAddress: 'visible',
  governmentIdType: 'visible',
  governmentIdNumber: 'visible',
  issuingCountry: 'visible',
  email: 'visible',
  representedEntity: 'visible',
  authorityCapacity: 'visible',
}

/** Pack delivery — the counterparty's sensitive fields are masked */
const PACK_COUNTERPARTY_POLICY: RedactionPolicy = {
  fullLegalName: 'visible',          // name must be visible for contract clarity
  dateOfBirth: 'partial',            // show year only — "****-**-** (1987)"
  placeOfBirth: 'hidden',
  nationality: 'visible',            // visible for context
  legalAddress: 'partial',           // show city + country only
  governmentIdType: 'visible',       // show what type of ID was used
  governmentIdNumber: 'partial',     // show last 4 digits only
  issuingCountry: 'visible',
  email: 'partial',                  // show domain only — "***@reuters.com"
  representedEntity: 'visible',      // company info is not sensitive
  authorityCapacity: 'visible',      // role/title is not sensitive
}

/** Pack delivery — the pack owner sees their own data fully */
const PACK_SELF_POLICY: RedactionPolicy = FULL_VISIBILITY

/**
 * Get the redaction policy for a specific render mode and party position.
 *
 * @param mode - The render visibility mode
 * @param isSelfParty - true if this is the pack owner's own identity
 */
export function getRedactionPolicy(
  mode: RenderVisibilityMode,
  isSelfParty: boolean,
): RedactionPolicy {
  switch (mode) {
    case 'canonical':
    case 'evidence':
      return FULL_VISIBILITY
    case 'buyer_pack':
    case 'creator_pack':
      return isSelfParty ? PACK_SELF_POLICY : PACK_COUNTERPARTY_POLICY
  }
}

// ══════════════════════════════════════════════
// MASKING HELPERS
// ══════════════════════════════════════════════

/**
 * Apply masking to a string value based on the redaction level.
 * Returns the masked string or a placeholder.
 */
export function applyRedaction(
  value: string | null,
  level: RedactionLevel,
  fieldHint: RedactableField,
): string {
  if (value === null) return '—'

  switch (level) {
    case 'visible':
      return value

    case 'hidden':
      return '••••••••'

    case 'partial':
      return maskPartial(value, fieldHint)
  }
}

/**
 * Field-aware partial masking.
 * Each field type has its own masking strategy.
 */
function maskPartial(value: string, field: RedactableField): string {
  switch (field) {
    case 'dateOfBirth': {
      // "1987-03-15" → "••••-••-•• (1987)"
      const year = value.slice(0, 4)
      return `••••-••-•• (${year})`
    }

    case 'governmentIdNumber': {
      // "AB123456789" → "•••••••6789"
      if (value.length <= 4) return value
      const visible = value.slice(-4)
      const masked = '•'.repeat(value.length - 4)
      return `${masked}${visible}`
    }

    case 'email': {
      // "john.smith@reuters.com" → "•••@reuters.com"
      const atIndex = value.indexOf('@')
      if (atIndex < 0) return '•••'
      return `•••${value.slice(atIndex)}`
    }

    case 'legalAddress': {
      // "Rua Augusta 45, 3º Esq, 1100-048 Lisboa, Portugal"
      // → "Lisboa, Portugal"
      // Strategy: take last two comma-separated segments
      const parts = value.split(',').map(p => p.trim())
      if (parts.length <= 2) return value
      return parts.slice(-2).join(', ')
    }

    default:
      // Generic: show first and last 2 chars
      if (value.length <= 4) return value
      return `${value.slice(0, 2)}${'•'.repeat(value.length - 4)}${value.slice(-2)}`
  }
}

// ══════════════════════════════════════════════
// DOCUMENT RENDER CONTEXT
// ══════════════════════════════════════════════
//
// Passed into render functions to control visibility.

export interface DocumentRenderContext {
  /** Active render mode */
  mode: RenderVisibilityMode

  /** User ID of the viewer — used to determine self vs counterparty */
  viewerUserId: string

  /** Whether to include signature/evidence references in render output */
  includeEvidence: boolean
}
