/**
 * Funding Engine — Domain Types
 *
 * Three case types:
 *   1. creator_support  — recurring patronage for a creator
 *   2. project_funding  — goal-based crowdfunding for a project/story
 *   3. special_commission — one-off commissioned work funding
 *
 * System boundary: Funding Engine owns case lifecycle.
 * Stripe is authoritative for payment state; this mirrors.
 */

// ══════════════════════════════════════════════
// CASE TYPES
// ══════════════════════════════════════════════

export type FundingCaseType =
  | 'creator_support'
  | 'project_funding'
  | 'special_commission'

export const FUNDING_CASE_TYPE_LABELS: Record<FundingCaseType, string> = {
  creator_support: 'Creator Support',
  project_funding: 'Project Funding',
  special_commission: 'Special Commission',
}

// ══════════════════════════════════════════════
// LIFECYCLE STATES
// ══════════════════════════════════════════════

export type FundingLifecycle =
  | 'draft'
  | 'open'
  | 'threshold_met'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed'

export const FUNDING_LIFECYCLE_LABELS: Record<FundingLifecycle, string> = {
  draft: 'Draft',
  open: 'Open',
  threshold_met: 'Threshold Met',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
}

/** Valid transitions from each state */
export const FUNDING_TRANSITIONS: Record<FundingLifecycle, FundingLifecycle[]> = {
  draft: ['open', 'cancelled'],
  open: ['threshold_met', 'paused', 'cancelled', 'failed'],
  threshold_met: ['active', 'paused', 'cancelled'],
  active: ['completed', 'paused', 'cancelled'],
  paused: ['open', 'active', 'cancelled'],
  completed: [],
  cancelled: [],
  failed: [],
}

// ══════════════════════════════════════════════
// CADENCE
// ══════════════════════════════════════════════

export type FundingCadence =
  | 'one_time'
  | 'monthly'
  | 'quarterly'
  | 'annual'

export const FUNDING_CADENCE_LABELS: Record<FundingCadence, string> = {
  one_time: 'One-time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

// ══════════════════════════════════════════════
// PAYMENT RULES
// ══════════════════════════════════════════════

export type PaymentRuleType =
  | 'fixed'       // exact amount, no choice
  | 'tiered'      // preset tiers to choose from
  | 'open'        // any amount above minimum

export interface PaymentRule {
  type: PaymentRuleType
  /** Minimum contribution in EUR cents */
  minimumCents: number
  /** Suggested amounts in EUR cents (for tiered/open) */
  suggestedAmountsCents: number[]
  /** Fixed amount in EUR cents (for fixed type) */
  fixedAmountCents?: number
  /** Allowed cadences for this case */
  allowedCadences: FundingCadence[]
  /** Platform fee percentage (0-100) */
  platformFeePercent: number
}

// ══════════════════════════════════════════════
// FUNDING TIER
// ══════════════════════════════════════════════

export interface FundingTier {
  id: string
  name: string
  amountCents: number
  description: string
  /** Perks or rewards for this tier */
  perks: string[]
  /** Max backers for this tier (null = unlimited) */
  maxBackers: number | null
  currentBackers: number
}

// ══════════════════════════════════════════════
// CONTRIBUTOR
// ══════════════════════════════════════════════

export interface FundingContributor {
  id: string
  name: string
  avatarRef: string
  amountCents: number
  cadence: FundingCadence
  tierId: string | null
  contributedAt: string
  isAnonymous: boolean
}

// ══════════════════════════════════════════════
// FUNDING CASE — Master Record
// ══════════════════════════════════════════════

export interface FundingCase {
  id: string
  type: FundingCaseType
  lifecycle: FundingLifecycle

  // Identity
  title: string
  description: string
  heroImageRef: string
  heroVideoRef: string | null
  /** Creator or project owner */
  creatorId: string
  /** Related story/article ID (for project_funding) */
  relatedEntityId: string | null
  relatedEntityType: 'story' | 'article' | null

  // Goals
  /** Target amount in EUR cents */
  goalCents: number
  /** Minimum threshold to proceed in EUR cents (0 = no threshold) */
  thresholdCents: number
  /** Current total raised in EUR cents */
  raisedCents: number
  /** Deadline ISO string (null = ongoing for creator_support) */
  deadlineAt: string | null

  // Payment
  paymentRule: PaymentRule
  tiers: FundingTier[]

  // Contributors
  contributors: FundingContributor[]
  totalContributors: number

  // Timestamps
  createdAt: string
  publishedAt: string | null
  completedAt: string | null

  // Currency
  currency: 'EUR'
}

// ══════════════════════════════════════════════
// ENGINE STATE (for useReducer)
// ══════════════════════════════════════════════

export interface FundingEngineState {
  fundingCase: FundingCase | null
  ui: FundingUIState
  payment: FundingPaymentState
}

export interface FundingUIState {
  selectedTierId: string | null
  selectedCadence: FundingCadence
  customAmountCents: number | null
  /** The resolved amount: from tier, custom, or fixed */
  resolvedAmountCents: number
  step: FundingStep
  error: string | null
  successMessage: string | null
}

export type FundingStep =
  | 'select'    // choosing amount/tier/cadence
  | 'payment'   // entering card details
  | 'confirm'   // reviewing before submit
  | 'processing'// stripe processing
  | 'success'   // done
  | 'error'     // payment failed

export interface FundingPaymentState {
  stripeClientSecret: string | null
  stripePaymentIntentId: string | null
  cardComplete: boolean
  processing: boolean
  lastError: string | null
}

// ══════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════

export type FundingAction =
  // Load
  | { type: 'LOAD_CASE'; fundingCase: FundingCase }

  // Amount selection
  | { type: 'SELECT_TIER'; tierId: string }
  | { type: 'SET_CUSTOM_AMOUNT'; amountCents: number }
  | { type: 'CLEAR_SELECTION' }

  // Cadence
  | { type: 'SET_CADENCE'; cadence: FundingCadence }

  // Step navigation
  | { type: 'GO_TO_PAYMENT' }
  | { type: 'GO_BACK_TO_SELECT' }
  | { type: 'GO_TO_CONFIRM' }

  // Payment
  | { type: 'CARD_COMPLETE'; complete: boolean }
  | { type: 'SET_CLIENT_SECRET'; clientSecret: string }
  | { type: 'SUBMIT_PAYMENT' }
  | { type: 'PAYMENT_SUCCESS'; paymentIntentId: string }
  | { type: 'PAYMENT_ERROR'; error: string }

  // UI
  | { type: 'DISMISS_ERROR' }
  | { type: 'RESET' }
