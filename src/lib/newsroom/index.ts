/**
 * Frontfiles — Newsroom domain library barrel (NR-D4, F7)
 *
 * Pure re-exports of the 7 NR-D4 modules plus the NR-D3 host
 * helper. Keeps downstream imports tidy:
 *
 *     import { LICENCE_CLASSES, generateEmbedSnippet } from '@/lib/newsroom'
 *
 * No logic here. Any new public symbol added to a sibling module
 * must be re-exported here (and covered by the VERIFY 4 barrel
 * smoke test).
 */

// Licence classes
export {
  LICENCE_CLASSES,
  getLicenceClass,
  isFFLicenceClass,
} from './licence-classes'
export type {
  LicenceClassConfig,
  LicenceFlags,
  LicenceUseContext,
} from './licence-classes'

// Embed snippet
export { generateEmbedSnippet } from './embed-snippet'
export type { EmbedSnippetInput } from './embed-snippet'

// Receipt terms
export { generateReceiptTerms } from './receipt-terms'
export type { ReceiptTermsInput } from './receipt-terms'

// State machine
export {
  VALID_PACK_TRANSITIONS,
  canTransition,
  deriveVisibility,
  isTerminalStatus,
} from './state-machine'
export type {
  PackTransition,
  PackTransitionTrigger,
} from './state-machine'

// Invariants
export {
  checkPublishPreconditions,
  isPublishable,
  blockingPreconditions,
} from './invariants'
export type {
  PackPublishInput,
  PublishPreconditionReport,
} from './invariants'

// Canonical URLs
export {
  NEWSROOM_BASE_URL,
  RECEIPT_BASE_URL,
  packCanonicalUrl,
  newsroomOrgUrl,
  receiptUrl,
} from './canonical-url'

// Host detection (NR-D3)
export { NEWSROOM_HOST_PATTERN, isNewsroomHost } from './host'
