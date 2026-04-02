import type {
  OnboardingFlowState,
  OnboardingStepId,
  IdentityVerificationResult,
  IdentityAnchor,
  CrossCheckSignal,
  ValidationOutcome,
  CreatorProfileDraft,
} from './types'

export const initialState: OnboardingFlowState = {
  currentStep: 1,
  completedSteps: [],
  identityVerification: null,
  identityAnchor: null,
  crossCheckSignals: [],
  crossCheckComplete: false,
  validationOutcome: null,
  profileDraft: null,
  finalValidationOutcome: null,
  vaultCreated: false,
  vaultId: null,
}

// Discriminated union of all action types
export type OnboardingAction =
  | { type: 'SET_STEP'; payload: OnboardingStepId }
  | { type: 'SET_IDENTITY_VERIFICATION'; payload: IdentityVerificationResult }
  | { type: 'SET_IDENTITY_ANCHOR'; payload: IdentityAnchor }
  | { type: 'SET_CROSS_CHECK_SIGNALS'; payload: CrossCheckSignal[] }
  | { type: 'SET_CROSS_CHECK_COMPLETE'; payload: boolean }
  | { type: 'SET_VALIDATION_OUTCOME'; payload: ValidationOutcome }
  | { type: 'SET_PROFILE_DRAFT'; payload: CreatorProfileDraft }
  | { type: 'UPDATE_PROFILE_DRAFT'; payload: Partial<CreatorProfileDraft> }
  | { type: 'SET_FINAL_VALIDATION_OUTCOME'; payload: ValidationOutcome }
  | { type: 'SET_VAULT_CREATED'; payload: { vaultId: string } }
  | { type: 'MARK_STEP_COMPLETE'; payload: OnboardingStepId }
  | { type: 'RESET' }

export function onboardingReducer(
  state: OnboardingFlowState,
  action: OnboardingAction
): OnboardingFlowState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload }

    case 'SET_IDENTITY_VERIFICATION':
      return { ...state, identityVerification: action.payload }

    case 'SET_IDENTITY_ANCHOR':
      return { ...state, identityAnchor: action.payload }

    case 'SET_CROSS_CHECK_SIGNALS':
      return { ...state, crossCheckSignals: action.payload }

    case 'SET_CROSS_CHECK_COMPLETE':
      return { ...state, crossCheckComplete: action.payload }

    case 'SET_VALIDATION_OUTCOME':
      return { ...state, validationOutcome: action.payload }

    case 'SET_PROFILE_DRAFT':
      return { ...state, profileDraft: action.payload }

    case 'UPDATE_PROFILE_DRAFT':
      if (!state.profileDraft) return state
      return {
        ...state,
        profileDraft: { ...state.profileDraft, ...action.payload },
      }

    case 'SET_FINAL_VALIDATION_OUTCOME':
      return { ...state, finalValidationOutcome: action.payload }

    case 'SET_VAULT_CREATED':
      return {
        ...state,
        vaultCreated: true,
        vaultId: action.payload.vaultId,
      }

    case 'MARK_STEP_COMPLETE': {
      const alreadyComplete = state.completedSteps.includes(action.payload)
      if (alreadyComplete) return state
      return {
        ...state,
        completedSteps: [...state.completedSteps, action.payload],
      }
    }

    case 'RESET':
      return { ...initialState }

    default:
      return state
  }
}
