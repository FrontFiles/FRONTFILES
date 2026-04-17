"use client"

import { useCallback, useEffect, useReducer, useRef } from "react"
import {
  onboardingReducer,
  initialState,
  type OnboardingAction,
} from "@/lib/onboarding/reducer"
import type {
  OnboardingFlowState,
  OnboardingStepKey,
} from "@/lib/onboarding/types"
import { getStepSequence } from "@/lib/onboarding/constants"
import { reconcileOnboardingState } from "@/lib/onboarding/resume"

// ══════════════════════════════════════════════
// Persistence + resume reconciliation
//
// The flow state is persisted to localStorage so a browser
// refresh mid-onboarding resumes on the correct step for
// the newly-created user. Persistence is OPT-IN per field:
//
//   - `password` is NEVER persisted (security).
//   - Persistence only kicks in AFTER `createdUserId` is set
//     — before that, restarting is cheap and we do not want
//     a stale draft to leak across unrelated signup attempts.
//
// The storage key is not scoped by user id because a browser
// holds at most one active onboarding wizard at a time; the
// `createdUserId` rides inside the persisted blob so we can
// tell which account the draft belongs to.
//
// After hydration, a SECOND effect runs `reconcileOnboardingState`
// from `@/lib/onboarding/resume`. That reads the live identity
// store and returns a correction action — `reset` if the
// persisted user id is a ghost, `advance-to-launch` if the
// role-specific facet row is already written, or `noop`. The
// reconcile runs exactly once per mount (gated by the
// `reconcileAttempted` ref) and is safe to run even on a
// freshly-created account: it degrades to `noop` because the
// facet row isn't there yet.
// ══════════════════════════════════════════════

const STORAGE_KEY = "frontfiles_onboarding_state"
const STORAGE_VERSION = 1

interface PersistedEnvelope {
  version: number
  state: Omit<OnboardingFlowState, "password">
}

function loadPersistedState(): OnboardingFlowState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedEnvelope
    if (!parsed || parsed.version !== STORAGE_VERSION) return null
    if (!parsed.state || !parsed.state.createdUserId) return null
    // Re-introduce the non-persisted `password` field with its
    // default value so the rehydrated state is shape-compatible
    // with `OnboardingFlowState`.
    return { ...parsed.state, password: "" }
  } catch {
    return null
  }
}

function savePersistedState(state: OnboardingFlowState): void {
  if (typeof window === "undefined") return
  // Do not persist until the real user row exists. This
  // intentionally discards half-filled Phase 0 drafts.
  if (!state.createdUserId) return
  // Strip the password field before writing.
  const { password: _password, ...rest } = state
  void _password
  const envelope: PersistedEnvelope = {
    version: STORAGE_VERSION,
    state: rest,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  } catch {
    // Quota or private mode — fail silent.
  }
}

function clearPersistedStateImpl(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Fail silent.
  }
}

// ══════════════════════════════════════════════
// Public hook
// ══════════════════════════════════════════════

export interface OnboardingFlowHook {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  /** Ordered step keys for the current role (or the default sequence). */
  stepSequence: OnboardingStepKey[]
  goToStep: (key: OnboardingStepKey) => void
  goNext: () => void
  goBack: () => void
  canGoNext: boolean
  canGoBack: boolean
  markStepComplete: (key: OnboardingStepKey) => void
  /**
   * Remove the persisted onboarding state from localStorage.
   * Called by PhaseLaunch on the final CTA so that navigating
   * back to `/onboarding` after completion starts a fresh flow.
   */
  clearPersistedState: () => void
}

export function useOnboardingFlow(): OnboardingFlowHook {
  const [state, dispatch] = useReducer(onboardingReducer, initialState)

  // Rehydrate once on mount. We use a ref to remember whether
  // we have already attempted hydration so Fast Refresh does
  // not re-apply it and overwrite in-progress changes.
  const hydrationAttempted = useRef(false)
  useEffect(() => {
    if (hydrationAttempted.current) return
    hydrationAttempted.current = true
    const restored = loadPersistedState()
    if (restored) {
      // Replay the restored state as a sequence of targeted
      // actions. We cannot dispatch a single "hydrate" action
      // without adding it to the reducer, and a targeted replay
      // keeps the reducer's action union minimal.
      if (restored.role) {
        dispatch({ type: "SET_ROLE", payload: restored.role })
      }
      if (restored.email) {
        dispatch({ type: "SET_EMAIL", payload: restored.email })
      }
      if (restored.username) {
        dispatch({
          type: "SET_USERNAME",
          payload: {
            username: restored.username,
            available: restored.usernameAvailable,
          },
        })
      }
      if (restored.createdUserId) {
        dispatch({
          type: "SET_CREATED_USER_ID",
          payload: restored.createdUserId,
        })
      }
      // Replay the Phase 0 verification checkpoint state. We
      // always dispatch this rather than guarding on
      // `restored.awaitingEmailVerification` so the reducer
      // state matches the persisted envelope exactly — that
      // way a cleared checkpoint (`false`) is not silently
      // treated as "not replayed".
      dispatch({
        type: "SET_AWAITING_EMAIL_VERIFICATION",
        payload: restored.awaitingEmailVerification === true,
      })
      if (
        restored.creatorMinimal.professionalTitle ||
        restored.creatorMinimal.biography
      ) {
        dispatch({
          type: "UPDATE_CREATOR_MINIMAL",
          payload: restored.creatorMinimal,
        })
      }
      if (restored.buyerMinimal.buyerType) {
        dispatch({
          type: "SET_BUYER_TYPE",
          payload: restored.buyerMinimal.buyerType,
        })
      }
      if (restored.buyerMinimal.companyName) {
        dispatch({
          type: "SET_COMPANY_NAME",
          payload: restored.buyerMinimal.companyName,
        })
      }
      if (restored.vaultId) {
        dispatch({
          type: "SET_VAULT_CREATED",
          payload: { vaultId: restored.vaultId },
        })
      }
      // Replay completed-step markers before setting the final
      // current step so the phase strip reflects progress.
      for (const step of restored.completedSteps) {
        dispatch({ type: "MARK_STEP_COMPLETE", payload: step })
      }
      dispatch({ type: "SET_STEP", payload: restored.currentStep })
    }
  }, [])

  // Persist on every subsequent render. This is intentionally a
  // separate effect from hydration so Fast Refresh cannot cause
  // a restore loop.
  useEffect(() => {
    savePersistedState(state)
  }, [state])

  // ── Resume reconciliation ────────────────────────────────
  //
  // Runs at most once per mount, gated by the
  // `reconcileAttempted` ref. The dep is `state.createdUserId`
  // so the effect only re-runs when that specific field
  // transitions from null to a real id — which happens either
  // after hydration replays `SET_CREATED_USER_ID` or after
  // Phase 0 dispatches it on a fresh signup.
  //
  // Why we read `stateRef.current` instead of `state` directly:
  // the effect's dep array only lists `state.createdUserId`
  // (not the full `state`), so exhaustive-deps would otherwise
  // flag `state` as a missing dependency. The `stateRef` is
  // synced in a sibling effect so it always holds the latest
  // state at the moment the reconcile fires. This lets the
  // reconcile see the full restored state without forcing the
  // dep array to include every field of `state`.
  //
  // Why we don't use a `cancelled` flag: the dispatches the
  // reconcile produces (`RESET`, `MARK_STEP_COMPLETE`, `SET_STEP`)
  // are all idempotent, and React 19 tolerates dispatching to
  // an unmounted reducer without warning. Cancellation would
  // buy us nothing and would create a race if the effect were
  // to re-fire on an unrelated state change.
  //
  // In the fresh-signup case the reconcile is effectively a
  // no-op: the user row and grant exist, no facet row has been
  // written yet, so `reconcileOnboardingState` returns
  // `{ action: 'noop' }` and nothing is dispatched.
  const reconcileAttempted = useRef(false)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })
  useEffect(() => {
    if (reconcileAttempted.current) return
    if (!state.createdUserId) return
    reconcileAttempted.current = true
    reconcileOnboardingState(stateRef.current).then((result) => {
      if (result.action === "reset") {
        dispatch({ type: "RESET" })
        clearPersistedStateImpl()
        return
      }
      if (result.action === "advance-to-launch") {
        dispatch({
          type: "MARK_STEP_COMPLETE",
          payload: result.completedStep,
        })
        dispatch({ type: "SET_STEP", payload: "launch" })
        return
      }
      if (result.action === "clear-email-verification") {
        // The auth provider now reports the email as
        // confirmed. Collapse the Phase 0 checkpoint AND, if
        // the user is still parked on the `account` step,
        // advance them to the role-specific step. Two
        // dispatches so the wizard "jumps forward" on resume
        // without a dead intermediate state.
        dispatch({
          type: "SET_AWAITING_EMAIL_VERIFICATION",
          payload: false,
        })
        const resumedState = stateRef.current
        if (
          resumedState.role &&
          resumedState.currentStep === "account"
        ) {
          const seq = getStepSequence(resumedState.role)
          const idx = seq.indexOf("account")
          if (idx !== -1 && idx < seq.length - 1) {
            dispatch({
              type: "MARK_STEP_COMPLETE",
              payload: "account",
            })
            dispatch({
              type: "SET_STEP",
              payload: seq[idx + 1],
            })
          }
        }
        return
      }
      // noop — nothing to dispatch.
    })
  }, [state.createdUserId])

  // The sequence is derived from the currently-selected role.
  // Before Phase 0 submits, the role is null and the sequence is
  // just `['account', 'launch']` — though the shell will normally
  // transition to a role-specific sequence on Phase 0 submit.
  const stepSequence = getStepSequence(state.role)
  const currentIndex = stepSequence.indexOf(state.currentStep)

  const goToStep = useCallback((key: OnboardingStepKey) => {
    dispatch({ type: "SET_STEP", payload: key })
  }, [])

  const goNext = useCallback(() => {
    const seq = getStepSequence(state.role)
    const idx = seq.indexOf(state.currentStep)
    if (idx === -1 || idx >= seq.length - 1) return
    const nextKey = seq[idx + 1]
    dispatch({ type: "MARK_STEP_COMPLETE", payload: state.currentStep })
    dispatch({ type: "SET_STEP", payload: nextKey })
  }, [state.role, state.currentStep])

  const goBack = useCallback(() => {
    const seq = getStepSequence(state.role)
    const idx = seq.indexOf(state.currentStep)
    if (idx <= 0) return
    dispatch({ type: "SET_STEP", payload: seq[idx - 1] })
  }, [state.role, state.currentStep])

  const markStepComplete = useCallback((key: OnboardingStepKey) => {
    dispatch({ type: "MARK_STEP_COMPLETE", payload: key })
  }, [])

  const clearPersistedState = useCallback(() => {
    clearPersistedStateImpl()
  }, [])

  const canGoNext = currentIndex !== -1 && currentIndex < stepSequence.length - 1
  const canGoBack = currentIndex > 0

  return {
    state,
    dispatch,
    stepSequence,
    goToStep,
    goNext,
    goBack,
    canGoNext,
    canGoBack,
    markStepComplete,
    clearPersistedState,
  }
}
