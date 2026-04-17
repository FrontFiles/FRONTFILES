"use client"

/**
 * Onboarding — completion flags.
 *
 * Lightweight read-only hook that tells the rest of the app
 * whether the current session user has completed onboarding
 * for each role. It reads ONLY from canonical user-context
 * state — grants + facet rows — and never touches the wizard
 * reducer. That means:
 *
 *   - Flags stay correct after the user closes the wizard.
 *   - Flags survive a page refresh without any persistence.
 *   - Swapping the user-context from seed-backed to a real
 *     Supabase fetch will not require any change here.
 *
 * ── Activation vs. "row exists" ───────────────────────────
 *
 * An earlier version of this hook flipped a role's flag as
 * soon as the matching facet row existed. That was too loose:
 * both `PhaseCreatorMinimal` and `PhaseBuyerMinimal` write a
 * stub row on skip / partial submit to preserve the 1:1
 * invariant (`creator` grant => exactly one `creator_profiles`
 * row, `buyer` grant => exactly one `buyer_accounts` row).
 * A stub row passes a null-check but carries no headline, no
 * bio, and no company name, so the creator workspace, the
 * frontfolio page, and the buyer tools all render empty
 * placeholders. Treating that state as "activated" would hide
 * the onboarding checklist prompts from exactly the users who
 * still need them.
 *
 * The flags below therefore gate on **minimum viable
 * readiness** — "can this user actually USE the capability"
 * — rather than mere row existence. The predicates that
 * encode the readiness rules live in this same file as small,
 * named helpers (`isCreatorProfileReady`, `isBuyerAccountReady`)
 * so other call sites (route guards, form validators, test
 * fixtures) can reuse them without re-importing the hook.
 *
 * Activation semantics:
 *
 *   creator : has the `creator` grant AND
 *             `isCreatorProfileReady(creatorProfile)` is true.
 *             See that helper for the exact minimum fields.
 *   buyer   : has the `buyer` grant AND
 *             `isBuyerAccountReady(buyerAccount)` is true.
 *             See that helper for the exact minimum fields.
 *   reader  : has the `reader` grant. Readers have no separate
 *             facet row — the grant itself is the signal and
 *             there is nothing to ready-check.
 *
 * This hook is intentionally not a checklist UI — callers
 * that want to surface "finish your profile" or "set up
 * buyer details" cards should build their own UI on top of
 * these flags. Keeping the hook to raw booleans lets it be
 * composed into whatever progressive-completion surfaces get
 * added later without reshaping its contract.
 */

import {
  useBuyerAccount,
  useCreatorProfile,
  useUser,
} from "@/lib/user-context"
import type {
  BuyerAccountRow,
  CreatorProfileRow,
} from "@/lib/db/schema"

export interface OnboardingCompletionFlags {
  /** True once the creator path's minimum viable fields are set. */
  isCreatorActivated: boolean
  /** True once the buyer path's minimum viable fields are set. */
  isBuyerActivated: boolean
  /** True when the session user holds the reader grant. */
  isReaderActivated: boolean
  /** Convenience — any of the three flags above is true. */
  anyActivated: boolean
}

/**
 * Creator profile — minimum viable readiness.
 *
 * Ready means a `creator_profiles` row exists AND both of the
 * fields `PhaseCreatorMinimal` collects are populated. These
 * are also the two fields the frontfolio and creator workspace
 * render most prominently — without them both surfaces show
 * empty placeholders and are not actually usable.
 *
 * Minimum fields (all must pass):
 *
 *   1. `professional_title`  non-null AND non-empty after
 *                            `.trim()`. Drives the headline
 *                            under the creator's name on the
 *                            frontfolio page and the creator
 *                            card in search.
 *   2. `biography`           non-null AND non-empty after
 *                            `.trim()`. Drives the long-form
 *                            "about" block on the frontfolio
 *                            page and the creator detail rail.
 *
 * Returns `false` when `profile` is `null` so callers can pass
 * the raw hook return (`useCreatorProfile()`) without a prior
 * null-check. A skipped-stub row — written with both fields
 * `null` to preserve the 1:1 grant/row invariant — therefore
 * returns `false`, which is exactly the "not yet ready" signal
 * the onboarding checklist needs.
 */
export function isCreatorProfileReady(
  profile: CreatorProfileRow | null,
): boolean {
  if (!profile) return false
  if (!profile.professional_title || profile.professional_title.trim() === "") {
    return false
  }
  if (!profile.biography || profile.biography.trim() === "") {
    return false
  }
  return true
}

/**
 * Buyer account — minimum viable readiness.
 *
 * Ready means a `buyer_accounts` row exists AND the row
 * carries the fields `PhaseBuyerMinimal` collects. Buyer tools
 * (lightboxes, saved searches, license requests, company
 * directory listings, invoice headers) rely on these fields
 * being present, so treating a half-filled row as "activated"
 * would ship a broken buyer experience.
 *
 * Minimum fields (all must pass):
 *
 *   1. `buyer_type`    one of `'individual' | 'company'`. The
 *                      SQL column is NOT NULL so the type
 *                      system already guarantees this, but
 *                      we keep the branching explicit so the
 *                      company-only rules are obvious.
 *   2. `company_name`  required ONLY when
 *                      `buyer_type === 'company'`. In that
 *                      case it must be non-null AND non-empty
 *                      after `.trim()`. Individual buyers have
 *                      no company and stay ready regardless
 *                      of this field.
 *
 * Returns `false` when `account` is `null` so callers can
 * pass the raw hook return (`useBuyerAccount()`) without a
 * prior null-check.
 */
export function isBuyerAccountReady(
  account: BuyerAccountRow | null,
): boolean {
  if (!account) return false
  if (account.buyer_type === "company") {
    if (!account.company_name || account.company_name.trim() === "") {
      return false
    }
  }
  return true
}

export function useOnboardingCompletion(): OnboardingCompletionFlags {
  const { grantedUserTypes } = useUser()
  const creatorProfile = useCreatorProfile()
  const buyerAccount = useBuyerAccount()

  const isCreatorActivated =
    grantedUserTypes.includes("creator") &&
    isCreatorProfileReady(creatorProfile)
  const isBuyerActivated =
    grantedUserTypes.includes("buyer") &&
    isBuyerAccountReady(buyerAccount)
  const isReaderActivated = grantedUserTypes.includes("reader")

  return {
    isCreatorActivated,
    isBuyerActivated,
    isReaderActivated,
    anyActivated:
      isCreatorActivated || isBuyerActivated || isReaderActivated,
  }
}
