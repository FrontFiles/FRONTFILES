import type { OnboardingStep, ValidationOutcomeStatus } from './types'

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 1, label: 'ID Verification', description: 'Verify your identity with a third-party provider' },
  { id: 2, label: 'Credibility Check', description: 'AI-assisted professional presence cross-check' },
  { id: 3, label: 'Data Validation', description: 'Review cross-check results' },
  { id: 4, label: 'Profile Setup', description: 'Review and confirm your profile information' },
  { id: 5, label: 'Final Validation', description: 'Confirm profile consistency' },
  { id: 6, label: 'Vault Activation', description: 'Your Vault is created and ready' },
]

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
