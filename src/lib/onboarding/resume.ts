/**
 * Onboarding — resume reconciliation.
 *
 * When the wizard rehydrates from localStorage on a fresh
 * browser mount, the persisted state may not match the truth
 * in the live identity store or auth provider. The drift
 * cases that matter:
 *
 *   1. The persisted `createdUserId` points at a users row
 *      that no longer exists (local dev reset, cross-env
 *      leak, stale localStorage). Every downstream step will
 *      silently work with a ghost id. The right move is to
 *      reset the wizard and start fresh at the role picker.
 *
 *   2. The user completed the role-specific facet write
 *      (creator_profiles / buyer_accounts) but the wizard
 *      never advanced past the facet step — the page crashed
 *      or the tab was closed between the write and the
 *      `goNext` dispatch. On the next visit the wizard shows
 *      the facet form again. The right move is to skip
 *      forward to the launch step because the facet is
 *      already in place.
 *
 *   3. (PR 3) The wizard is persisted on the Phase 0 email-
 *      verification checkpoint. The user may have clicked the
 *      confirmation link in the meantime. We re-probe the auth
 *      provider via `getAuthUserEmailConfirmed` and, if the
 *      email is now confirmed, clear the checkpoint so the
 *      wizard can advance past `account`. If the email is
 *      still unconfirmed we stay on the checkpoint.
 *
 * This module exposes a single pure async function that
 * reads the live identity store and the auth provider, compares
 * them to the persisted wizard state, and returns a discriminated
 * result describing what the hook should do. The hook
 * (`useOnboardingFlow`) owns the actual dispatches — this file
 * never touches React or localStorage so it stays trivially
 * testable.
 *
 * Note on idempotency — if the persisted state has a `role`
 * but the live user row is missing that grant, the reconcile
 * re-applies the grant. `grantUserType` is idempotent on both
 * the mock and the Supabase paths, so this is safe even if
 * the original Phase 0 submit actually succeeded in full.
 * The reconcile does NOT re-insert the users row; if the row
 * is missing, that's a reset, not a retry.
 */

import {
  getUserWithFacets,
  grantUserType,
} from "@/lib/identity/store"
import { getAuthUserEmailConfirmed } from "@/lib/auth/provider"
import type { OnboardingFlowState, OnboardingStepKey } from "./types"

/**
 * Result of reconciling a persisted onboarding state against
 * the live identity store and auth provider.
 *
 *   - `noop`            — persisted state matches the store;
 *                         the hook does nothing.
 *   - `reset`           — persisted `createdUserId` is missing
 *                         from the store. The hook dispatches
 *                         `RESET` and clears localStorage so
 *                         the next render starts at the role
 *                         picker.
 *   - `advance-to-launch` — the role-specific facet row is
 *                         already present, so the hook should
 *                         mark the corresponding step complete
 *                         and jump the current step to
 *                         `launch`.
 *   - `clear-email-verification` — the persisted state is
 *                         waiting on email verification and
 *                         the auth provider now reports the
 *                         email as confirmed. The hook should
 *                         clear `awaitingEmailVerification` so
 *                         the Phase 0 checkpoint collapses and
 *                         the user can advance past `account`.
 */
export type ReconcileResult =
  | { action: "noop" }
  | { action: "reset"; reason: "user-missing" }
  | {
      action: "advance-to-launch"
      completedStep: Extract<
        OnboardingStepKey,
        "creator-profile" | "buyer-details" | "reader-welcome"
      >
    }
  | { action: "clear-email-verification" }

/**
 * Pure async reconciliation. Reads the live identity store,
 * compares it to `state`, and returns a reconcile result.
 *
 * Side effect: if `state.role` is set but the live user row
 * is missing that grant, this function re-applies the grant
 * via `grantUserType` (idempotent). This recovers the narrow
 * case where the original Phase 0 submit landed the users
 * row but failed at the grant step.
 *
 * Every other mutation is deferred to the caller — this
 * function never dispatches, never touches React state, and
 * never reads/writes localStorage.
 */
export async function reconcileOnboardingState(
  state: OnboardingFlowState,
): Promise<ReconcileResult> {
  if (!state.createdUserId) return { action: "noop" }

  // Case 3 — email verification checkpoint. If the wizard was
  // persisted waiting on an email confirmation, re-probe the
  // auth provider before touching the identity store. We do
  // this first because the verification state can change
  // independently of the `users` row (the user clicks the
  // confirmation link from a different device, email client,
  // etc.) and because the correct action if the email is now
  // confirmed is simply to clear the checkpoint — we don't
  // want to trigger a reset just because the identity store
  // doesn't know about the auth change.
  //
  // A `null` probe result means the auth user id is unknown
  // to the provider — treat that as a reset, same as the
  // identity-store ghost case. A `false` result means the
  // email is still pending — the hook stays on the checkpoint
  // (noop, the reducer state already has
  // `awaitingEmailVerification: true`).
  if (state.awaitingEmailVerification) {
    const confirmed = await getAuthUserEmailConfirmed(state.createdUserId)
    if (confirmed === null) {
      return { action: "reset", reason: "user-missing" }
    }
    if (confirmed === true) {
      return { action: "clear-email-verification" }
    }
    // Still pending — fall through to the rest of the
    // reconcile. A pending-verification user may still have
    // a valid Frontfiles row and facets, so it's worth
    // running the rest of the checks.
  }

  const facets = await getUserWithFacets(state.createdUserId)

  // Case 1 — the persisted createdUserId is a ghost. Reset
  // the wizard so the next mount starts clean at Phase 0.
  if (!facets) {
    return { action: "reset", reason: "user-missing" }
  }

  // Recover the missing-grant case. If the original Phase 0
  // submit wrote the users row but failed at the grant step,
  // the wizard state still holds the role and the idempotent
  // grantUserType call fills in the hole.
  if (state.role && !facets.grantedTypes.includes(state.role)) {
    await grantUserType(state.createdUserId, state.role)
  }

  // Case 2 — facet row already written. Advance the wizard
  // past the facet step so the user isn't asked to fill it
  // in a second time. We only advance from the role-specific
  // step itself; if the persisted step is something else
  // (e.g. already `launch`), we leave it alone.
  if (
    state.currentStep === "creator-profile" &&
    facets.creatorProfile
  ) {
    return {
      action: "advance-to-launch",
      completedStep: "creator-profile",
    }
  }
  if (
    state.currentStep === "buyer-details" &&
    facets.buyerAccount
  ) {
    return {
      action: "advance-to-launch",
      completedStep: "buyer-details",
    }
  }
  // Readers have no facet row — the only signal that reader
  // onboarding is "done" is the grant, which we've already
  // reconciled above. If the persisted step is
  // `reader-welcome` the user still needs to tap the
  // confirmation, so we leave the step alone.

  return { action: "noop" }
}
