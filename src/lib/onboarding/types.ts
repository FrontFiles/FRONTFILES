// All TypeScript types for the onboarding flow.
//
// Phase B replaced the old three-phase creator-only path
// (`1 | 2 | 3`) with a role-aware step-key model. Phase C
// tightened the account shell around it. This cleanup pass
// removes the legacy creator-KYC types that used to live
// here so the file is a one-to-one match with the live
// onboarding flow.
//
// KYC and legal identity are a Phase D concern and will
// rebuild their own scoped state when the `IdentityDrawer`
// is introduced — they no longer pollute this module.

// ══════════════════════════════════════════════
// PHASE B — role and step model
// ══════════════════════════════════════════════

/**
 * The three user-facing onboarding paths.
 *
 *   creator : publishes work, holds a `creator_profiles` row,
 *             routes to the creator workspace on launch.
 *   buyer   : licenses work, holds a `buyer_accounts` row,
 *             routes to `/search` + the buyer account shell.
 *   reader  : lightweight browse role. After Phase 0 the
 *             user has only the `reader` grant — no separate
 *             facet row is written. Readers can browse the
 *             certified catalogue, follow creators, and save
 *             searches. A reader can later upgrade into the
 *             buyer path from `/account` without re-running
 *             the wizard.
 *
 * Staff is NOT a self-service path — staff accounts are
 * provisioned out of band.
 */
export type OnboardingRole = 'creator' | 'buyer' | 'reader'

/**
 * Ordered, role-aware step keys.
 *
 * Flow:
 *   role-picker → account → creator-profile → launch
 *   role-picker → account → buyer-details   → launch
 *   role-picker → account → reader-welcome  → launch
 *
 * `role-picker` is the single top-level entry into the wizard
 * and is the only place a user chooses between creator, buyer,
 * and reader. `account` (Phase 0) immediately follows and writes
 * the real `users` row plus the grant for the chosen role.
 */
export type OnboardingStepKey =
  | 'role-picker'
  | 'account'
  | 'creator-profile'
  | 'buyer-details'
  | 'reader-welcome'
  | 'launch'

export const ONBOARDING_STEP_KEYS: OnboardingStepKey[] = [
  'role-picker',
  'account',
  'creator-profile',
  'buyer-details',
  'reader-welcome',
  'launch',
]

/** Buyer onboarding sub-type. */
export type OnboardingBuyerType = 'individual' | 'company'

// ══════════════════════════════════════════════
// PHASE B — minimal role-specific draft shapes
// ══════════════════════════════════════════════

/** Phase B minimum viable creator profile (optional fields). */
export interface CreatorMinimalDraft {
  professionalTitle: string
  biography: string
}

/** Phase B minimum viable buyer draft. */
export interface BuyerMinimalDraft {
  buyerType: OnboardingBuyerType | null
  companyName: string
}

// ══════════════════════════════════════════════
// ONBOARDING FLOW STATE
// ══════════════════════════════════════════════

export interface OnboardingFlowState {
  // ── Navigation ──────────────────────────────
  currentStep: OnboardingStepKey
  completedSteps: OnboardingStepKey[]
  role: OnboardingRole | null

  // ── Phase 0 account form ────────────────────
  email: string
  username: string
  usernameAvailable: boolean | null
  /**
   * Password is collected in Phase 0 for UX parity with a real
   * signup form, but is NOT persisted by the identity store
   * today — auth wiring is explicitly out of scope for Phase B.
   */
  password: string

  /** Set once the Phase 0 submit has created the `users` row. */
  createdUserId: string | null

  /**
   * `true` when the Phase 0 submit succeeded but the auth
   * provider reported the email as not yet confirmed. In this
   * state Phase 0 renders a "verify your email" checkpoint
   * instead of advancing to the role-specific step, and the
   * wizard is suspended on `account` until the user clicks the
   * confirmation link (or the resume reconcile discovers the
   * email is now confirmed, whichever happens first).
   *
   * Mock mode defaults this to `false` (auto-confirmed); tests
   * that exercise the checkpoint opt in via
   * `_setMockVerificationRequired(true)` on the auth provider
   * before their Phase 0 submit.
   */
  awaitingEmailVerification: boolean

  // ── Creator minimal ─────────────────────────
  creatorMinimal: CreatorMinimalDraft

  // ── Buyer minimal ───────────────────────────
  buyerMinimal: BuyerMinimalDraft

  // ── Launch result ───────────────────────────
  vaultId: string | null
}

/** Canonical step metadata shown in the Phase B PhaseStrip. */
export interface OnboardingStepMeta {
  key: OnboardingStepKey
  label: string
  description: string
}
