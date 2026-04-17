import type {
  OnboardingFlowState,
  OnboardingStepKey,
  OnboardingRole,
  OnboardingBuyerType,
  CreatorMinimalDraft,
} from './types'

export const initialState: OnboardingFlowState = {
  // Navigation
  //
  // Fresh flows start at the role picker — the single top-level
  // entry into onboarding. Returning users who already created
  // an account are restored to their persisted step by the
  // hydration replay in `useOnboardingFlow`, which dispatches
  // SET_STEP after replaying role + createdUserId, so they never
  // see the picker on re-entry.
  currentStep: 'role-picker',
  completedSteps: [],
  role: null,

  // Phase 0 account form
  email: '',
  username: '',
  usernameAvailable: null,
  password: '',
  createdUserId: null,
  awaitingEmailVerification: false,

  // Creator minimal
  creatorMinimal: {
    professionalTitle: '',
    biography: '',
  },

  // Buyer minimal
  buyerMinimal: {
    buyerType: null,
    companyName: '',
  },

  // Launch result
  vaultId: null,
}

// Discriminated union of every action the live onboarding UI
// actually dispatches. Anything not in this list is dead code.
export type OnboardingAction =
  // Navigation
  | { type: 'SET_STEP'; payload: OnboardingStepKey }
  | { type: 'MARK_STEP_COMPLETE'; payload: OnboardingStepKey }

  // Account creation
  | { type: 'SET_EMAIL'; payload: string }
  | { type: 'SET_USERNAME'; payload: { username: string; available: boolean | null } }
  | { type: 'SET_PASSWORD'; payload: string }
  | { type: 'SET_ROLE'; payload: OnboardingRole }
  | { type: 'SET_CREATED_USER_ID'; payload: string }
  | {
      type: 'SET_AWAITING_EMAIL_VERIFICATION'
      payload: boolean
    }

  // Creator minimal
  | { type: 'UPDATE_CREATOR_MINIMAL'; payload: Partial<CreatorMinimalDraft> }

  // Buyer minimal
  | { type: 'SET_BUYER_TYPE'; payload: OnboardingBuyerType }
  | { type: 'SET_COMPANY_NAME'; payload: string }

  // Launch
  | { type: 'SET_VAULT_CREATED'; payload: { vaultId: string } }

  | { type: 'RESET' }

export function onboardingReducer(
  state: OnboardingFlowState,
  action: OnboardingAction,
): OnboardingFlowState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload }

    case 'MARK_STEP_COMPLETE': {
      if (state.completedSteps.includes(action.payload)) return state
      return {
        ...state,
        completedSteps: [...state.completedSteps, action.payload],
      }
    }

    case 'SET_EMAIL':
      return { ...state, email: action.payload }

    case 'SET_USERNAME':
      return {
        ...state,
        username: action.payload.username,
        usernameAvailable: action.payload.available,
      }

    case 'SET_PASSWORD':
      return { ...state, password: action.payload }

    case 'SET_ROLE':
      return { ...state, role: action.payload }

    case 'SET_CREATED_USER_ID':
      return { ...state, createdUserId: action.payload }

    case 'SET_AWAITING_EMAIL_VERIFICATION':
      return { ...state, awaitingEmailVerification: action.payload }

    case 'UPDATE_CREATOR_MINIMAL':
      return {
        ...state,
        creatorMinimal: { ...state.creatorMinimal, ...action.payload },
      }

    case 'SET_BUYER_TYPE':
      return {
        ...state,
        buyerMinimal: { ...state.buyerMinimal, buyerType: action.payload },
      }

    case 'SET_COMPANY_NAME':
      return {
        ...state,
        buyerMinimal: { ...state.buyerMinimal, companyName: action.payload },
      }

    case 'SET_VAULT_CREATED':
      return {
        ...state,
        vaultId: action.payload.vaultId,
      }

    case 'RESET':
      return { ...initialState }

    default:
      return state
  }
}
