// All TypeScript types for the onboarding flow

export type ValidationOutcomeStatus = 'VALIDATED' | 'FLAGGED' | 'STANDARD_BLOCK' | 'HARD_BLOCK'
export type FieldSource = 'identity' | 'ai-cross-check' | 'user'
export type OnboardingStepId = 1 | 2 | 3 | 4 | 5 | 6

export interface IdentityVerificationResult {
  status: 'verified' | 'failed' | 'pending' | 'needs_retry'
  provider: string
  verifiedAt: string | null
  failureReason: string | null
}

export interface IdentityAnchor {
  fullName: string
  dateOfBirth: string
  nationality: string
  documentType: string
  verificationId: string
}

export interface CrossCheckSource {
  platform: string
  url: string | null
  found: boolean
  confidence: number // 0-1
  summary: string
}

export interface CrossCheckSignal {
  field: string
  proposedValue: string
  sources: CrossCheckSource[]
  confidence: number // 0-1
  conflictsWithIdentity: boolean
  flagReason: string | null
}

export interface ValidationOutcome {
  status: ValidationOutcomeStatus
  flags: ValidationFlag[]
  canContinue: boolean
  reviewMessage: string | null
}

export interface ValidationFlag {
  field: string
  severity: 'low' | 'medium' | 'high'
  description: string
  resolvable: boolean
}

export interface ProposedField<T = string> {
  value: T
  source: FieldSource
  confidence: number | null
  confirmed: boolean
  edited: boolean
}

export interface MultiValueEntry {
  id: string
  value: string
  source: FieldSource
  confirmed: boolean
}

export interface CreatorProfileDraft {
  fullName: ProposedField
  professionalTitle: ProposedField
  biography: ProposedField
  geographicCoverageAreas: MultiValueEntry[]
  contentSpecialisations: MultiValueEntry[]
  mediaAffiliations: MultiValueEntry[]
  pressAccreditations: MultiValueEntry[]
  publishedIn: MultiValueEntry[]
  skills: MultiValueEntry[]
  alsoMeLinks: MultiValueEntry[]
}

export interface OnboardingFlowState {
  currentStep: OnboardingStepId
  completedSteps: OnboardingStepId[]
  identityVerification: IdentityVerificationResult | null
  identityAnchor: IdentityAnchor | null
  crossCheckSignals: CrossCheckSignal[]
  crossCheckComplete: boolean
  validationOutcome: ValidationOutcome | null
  profileDraft: CreatorProfileDraft | null
  finalValidationOutcome: ValidationOutcome | null
  vaultCreated: boolean
  vaultId: string | null
}

export interface OnboardingStep {
  id: OnboardingStepId
  label: string
  description: string
}
