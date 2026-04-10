import type { OnboardingPhase, ValidationOutcomeStatus } from './types'

export const ONBOARDING_PHASES: OnboardingPhase[] = [
  { id: 1, label: 'Verify', description: 'Verify your identity' },
  { id: 2, label: 'Build', description: 'Review your profile' },
  { id: 3, label: 'Launch', description: 'Your Vault is ready' },
]

/** @deprecated Use ONBOARDING_PHASES */
export const ONBOARDING_STEPS = ONBOARDING_PHASES

export const VALIDATION_STATUS_LABELS: Record<ValidationOutcomeStatus, string> = {
  VALIDATED: 'Validated',
  FLAGGED: 'Flagged for Review',
  STANDARD_BLOCK: 'Application Paused',
  HARD_BLOCK: 'Application Closed',
}

export const CROSS_CHECK_TASKS = [
  { id: 'professional_presence', label: 'Professional presence', description: 'LinkedIn and professional networks' },
  { id: 'bylines', label: 'Published bylines', description: 'Attributed articles and reports' },
  { id: 'accreditations', label: 'Press accreditations', description: 'Press pass and credential records' },
  { id: 'web_references', label: 'Web references', description: 'Open web mentions and citations' },
  { id: 'publication_footprint', label: 'Publication footprint', description: 'Editorial history and outlets' },
]

export const BUILDING_TASKS = [
  { id: 'scan', label: 'Scanning professional record', description: 'Querying networks, bylines, and registries' },
  { id: 'validate', label: 'Validating credentials', description: 'Cross-referencing against your verified identity' },
  { id: 'assemble', label: 'Assembling your profile', description: 'Building your creator profile from discovered signals' },
]
