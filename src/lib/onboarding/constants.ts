import type {
  OnboardingRole,
  OnboardingStepKey,
  OnboardingStepMeta,
} from './types'

// ══════════════════════════════════════════════
// ROLE + STEP METADATA
// ══════════════════════════════════════════════

export const ROLE_LABELS: Record<OnboardingRole, string> = {
  creator: 'Creator',
  buyer: 'Buyer',
  reader: 'Reader',
}

export const ROLE_DESCRIPTIONS: Record<OnboardingRole, string> = {
  creator: 'Publish certified work. Licence your assets to editorial buyers.',
  buyer: 'Licence certified assets. Commission assignments from verified creators.',
  reader: 'Follow creators, read articles, and save searches.',
}

/**
 * Canonical metadata for each onboarding step.
 * The PhaseStrip renders a filtered view of this map,
 * selecting the steps relevant to the current role.
 */
export const ONBOARDING_STEP_META: Record<OnboardingStepKey, OnboardingStepMeta> = {
  'role-picker': {
    key: 'role-picker',
    label: 'Role',
    description: 'Choose creator, buyer, or reader',
  },
  account: {
    key: 'account',
    label: 'Account',
    description: 'Email, username, and role',
  },
  'creator-profile': {
    key: 'creator-profile',
    label: 'Profile',
    description: 'Optional creator profile details',
  },
  'buyer-details': {
    key: 'buyer-details',
    label: 'Buyer',
    description: 'Individual or company buyer',
  },
  'reader-welcome': {
    key: 'reader-welcome',
    label: 'Welcome',
    description: 'You are ready to explore',
  },
  launch: {
    key: 'launch',
    label: 'Launch',
    description: 'All set — enter Frontfiles',
  },
}

/**
 * Ordered step sequence per role.
 *
 * `role-picker` is the single top-level entry point and is
 * always the first step. `account` (Phase 0) follows it and is
 * common to every role. Everything after `account` diverges
 * based on the role picked in the `role-picker` step.
 */
export const ROLE_STEP_SEQUENCES: Record<OnboardingRole, OnboardingStepKey[]> = {
  creator: ['role-picker', 'account', 'creator-profile', 'launch'],
  buyer: ['role-picker', 'account', 'buyer-details', 'launch'],
  reader: ['role-picker', 'account', 'reader-welcome', 'launch'],
}

/**
 * The step sequence shown before a role is selected.
 *
 * Every role-specific sequence also begins with
 * `['role-picker', 'account', ...]`, so advancing past the
 * picker is a well-defined transition even in the instant
 * between the picker's `SET_ROLE` dispatch and the follow-up
 * `goNext` — both sequences agree that the step after
 * `role-picker` is `account`.
 */
export const DEFAULT_STEP_SEQUENCE: OnboardingStepKey[] = [
  'role-picker',
  'account',
  'launch',
]

/**
 * Compute the active step sequence for the current role,
 * falling back to the default sequence when no role is
 * selected yet.
 */
export function getStepSequence(role: OnboardingRole | null): OnboardingStepKey[] {
  return role ? ROLE_STEP_SEQUENCES[role] : DEFAULT_STEP_SEQUENCE
}
