/**
 * Frontfiles — Offer-surface domain library barrel (P4 concern
 * 4A.2 Part A)
 *
 * Re-exports types, state guards, pricing helpers, rights registry
 * + validator, and pack/payload composers. Consumed by Parts B1/B2
 * route handlers and Parts C1/C2 UI components.
 */

export type {
  AssignmentDeliverableRow,
  OfferAssetRow,
  OfferBriefRow,
  OfferBriefSpec,
  OfferRow,
  OfferState,
  OfferTargetType,
  PlatformFeeBps,
  Rights,
  RightsTemplateId,
} from './types'

export {
  canAccept,
  canCancel,
  canCounter,
  canExpire,
  canReject,
} from './state'
export type { TransitionGuardResult } from './state'

export {
  feeBreakdown,
  formatCurrency,
  netToCreator,
  platformFeeAmount,
} from './pricing'
export type { FeeBreakdown } from './pricing'

export {
  RIGHTS_TEMPLATES,
  RightsSchema,
  validateRights,
} from './rights'
export type { ValidateRightsResult } from './rights'

export {
  buildOfferCounteredPayload,
  buildOfferCreatedPayload,
  validatePackComposition,
} from './composer'
export type {
  AssetItem,
  BriefItem,
  PackComposition,
  PackErrCode,
  ValidateResult,
} from './composer'
