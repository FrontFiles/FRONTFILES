// ═══════════════════════════════════════════════════════════════
// Frontfiles — Identity Permissions API (client-side)
//
// Pure predicate helpers + a tiny semantic permission API that
// every UI component can call instead of inlining
// `grantedUserTypes.includes('creator')` /
// `activeUserType === 'creator'` checks.
//
// DESIGN RULES
//
//   1. NO new state. This module is pure helpers + a hook that
//      reads from the existing `useUser()` provider. There is
//      still exactly one canonical user identity (`UserRow`)
//      and exactly one canonical role list (`user_granted_types`).
//
//   2. Server-side authorization stays in `lib/identity/guards.ts`
//      (`requireGrant`, `hasGrant`). This module is the CLIENT
//      mirror — its job is preventing UI from rendering actions
//      the server would reject. Both layers must agree.
//
//   3. Predicates are split into two flavours:
//
//      - ROLE predicates (`isCreator`, `isBuyer`, `isReader`,
//        `isCompanyMember`) only check whether the user holds
//        the matching grant. Cheap, mechanical, no
//        "is the profile filled out" logic.
//
//      - CAPABILITY predicates (`canUseComposer`,
//        `canViewCreatorFeed`, `canViewAssetOriginal`,
//        `canShareToFeed`) compose role checks with onboarding
//        readiness AND with the existing entitlement decisions
//        when relevant. These are the predicates UI buttons /
//        menu items should call.
//
//   4. Every helper takes a plain "viewer" object so they can
//      be called from components OR from non-React code (route
//      pages, ranking helpers, hooks). The `useViewer()` hook
//      builds that object from `useUser()` once per render.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useMemo } from 'react'
import {
  useUser,
  useBuyerAccount,
  useCompanyMemberships,
  useCreatorProfile,
} from '@/lib/user-context'
import {
  isCreatorProfileReady,
  isBuyerAccountReady,
} from '@/hooks/useOnboardingCompletion'
import type {
  BuyerAccountRow,
  CompanyMembershipFullRow,
  CreatorProfileRow,
  UserRow,
} from '@/lib/db/schema'
import type { UserType } from '@/lib/types'

// ─── Viewer view ─────────────────────────────────────────────

/**
 * The plain object every permission helper takes. Built from
 * the React user context by `useViewer()`, but anything that
 * can produce these fields can be passed to the helpers (server
 * actions, tests, hydration adapters).
 *
 * `null` is allowed for the unauthenticated case once real auth
 * lands; today the demo session always populates these fields.
 */
export interface Viewer {
  user: UserRow | null
  grantedTypes: UserType[]
  activeUserType: UserType | null
  creatorProfile: CreatorProfileRow | null
  buyerAccount: BuyerAccountRow | null
  companyMemberships: CompanyMembershipFullRow[]
}

/**
 * React hook — builds a `Viewer` from the live user context.
 * Memoised so consumers can pass it into other hook deps
 * without churning.
 */
export function useViewer(): Viewer {
  const { sessionUser, grantedUserTypes, activeUserType } = useUser()
  const creatorProfile = useCreatorProfile()
  const buyerAccount = useBuyerAccount()
  const companyMemberships = useCompanyMemberships()

  return useMemo<Viewer>(
    () => ({
      // The session user is always present in the demo prototype;
      // when real anonymous viewers land, the provider returns
      // null here and the helpers treat null as "anonymous".
      user: sessionUser
        ? {
            id: sessionUser.id,
            username: sessionUser.username,
            display_name: sessionUser.displayName,
            email: sessionUser.email,
            avatar_url: sessionUser.avatarUrl,
            account_state: sessionUser.accountState,
            founding_member: sessionUser.foundingMember,
            // The session shell does not carry timestamps — these
            // fields exist on the canonical row and are not used
            // by any permission helper, so we synthesise stable
            // values rather than dragging the whole row through.
            created_at: '',
            updated_at: '',
          }
        : null,
      grantedTypes: grantedUserTypes,
      activeUserType,
      creatorProfile,
      buyerAccount,
      companyMemberships,
    }),
    [
      sessionUser,
      grantedUserTypes,
      activeUserType,
      creatorProfile,
      buyerAccount,
      companyMemberships,
    ],
  )
}

// ─── Role predicates ─────────────────────────────────────────

/** True when the viewer holds the `creator` grant. */
export function isCreator(viewer: Viewer): boolean {
  return viewer.grantedTypes.includes('creator')
}

/** True when the viewer holds the `buyer` grant. */
export function isBuyer(viewer: Viewer): boolean {
  return viewer.grantedTypes.includes('buyer')
}

/** True when the viewer holds the `reader` grant. */
export function isReader(viewer: Viewer): boolean {
  return viewer.grantedTypes.includes('reader')
}

/**
 * True when the viewer is an active member of at least one
 * company. Status `invited` / `revoked` / `left` do not count.
 */
export function isCompanyMember(viewer: Viewer): boolean {
  return viewer.companyMemberships.some((m) => m.status === 'active')
}

/** True when the viewer holds more than one role grant. */
export function isMultiRole(viewer: Viewer): boolean {
  return viewer.grantedTypes.length > 1
}

// ─── Active-mode predicates ──────────────────────────────────
//
// These check the SESSION's currently-selected `activeUserType`,
// not just the grant. They're the right helpers for surfaces
// like the vault toolbar (Composer / Upload buttons) and the
// route-level `CreatorGate` that gate on "is the viewer
// CURRENTLY OPERATING as a creator", not "could they switch
// into creator mode".

/** True when the viewer is currently in creator mode this session. */
export function isInCreatorMode(viewer: Viewer): boolean {
  return viewer.activeUserType === 'creator'
}

/** True when the viewer is currently in buyer mode this session. */
export function isInBuyerMode(viewer: Viewer): boolean {
  return viewer.activeUserType === 'buyer'
}

/** True when the viewer is currently in reader mode this session. */
export function isInReaderMode(viewer: Viewer): boolean {
  return viewer.activeUserType === 'reader'
}

// ─── Activation predicates ───────────────────────────────────
//
// These extend the role predicates with the onboarding-
// readiness rules from `useOnboardingCompletion`. A creator
// who has the grant but skipped the minimal profile step is
// `isCreator(v) === true` but `isCreatorActivated(v) === false`.

/** True when the viewer is a creator AND their profile is ready. */
export function isCreatorActivated(viewer: Viewer): boolean {
  return isCreator(viewer) && isCreatorProfileReady(viewer.creatorProfile)
}

/** True when the viewer is a buyer AND their buyer account is ready. */
export function isBuyerActivated(viewer: Viewer): boolean {
  return isBuyer(viewer) && isBuyerAccountReady(viewer.buyerAccount)
}

/**
 * True when the viewer is currently OPERATING as a creator
 * (active role) and is creator-activated. This is the precise
 * gate for surfaces like the upload tool / composer / settlements
 * that are creator-scoped AND require an active session role.
 */
export function isOperatingAsCreator(viewer: Viewer): boolean {
  return viewer.activeUserType === 'creator' && isCreatorActivated(viewer)
}

/** Same shape, buyer side. */
export function isOperatingAsBuyer(viewer: Viewer): boolean {
  return viewer.activeUserType === 'buyer' && isBuyerActivated(viewer)
}

// ─── Capability predicates ───────────────────────────────────
//
// These are the predicates the UI should actually call. They
// encode the meaning of each capability so that if (e.g.) the
// composer rule changes from "any creator grant" to "creator
// grant AND minimum profile", every consumer picks up the new
// behaviour automatically.

/**
 * True when the viewer can open the FFF Sharing share composer.
 *
 * Rule: viewer must hold the `creator` grant. We deliberately
 * do NOT require `isCreatorActivated` here — a brand-new creator
 * who skipped the profile step can still post (publishing is
 * how some creators activate). The server-side `requireGrant`
 * check is the security boundary; this predicate is the UI hint
 * that decides whether to render the "Share" button.
 */
export function canUseComposer(viewer: Viewer): boolean {
  return isCreator(viewer)
}

/**
 * True when the viewer can publish to the FFF Sharing feed at
 * all. Currently identical to `canUseComposer` — kept as a
 * separate name so a future rule (e.g. "must verify email
 * before posting") changes the predicate, not every call site.
 */
export function canShareToFeed(viewer: Viewer): boolean {
  return canUseComposer(viewer)
}

/**
 * True when the viewer can view a creator's public posts feed
 * at `/creator/[handle]/posts`. Today this is universal — any
 * authenticated viewer can read the public feed of any creator.
 * The predicate exists so a future "private creator" or "muted"
 * rule changes the predicate and nothing else.
 */
export function canViewCreatorFeed(
  _viewer: Viewer,
  _creator: { username: string } | null,
): boolean {
  return true
}

/**
 * True when the viewer can view the ORIGINAL (high-resolution,
 * un-watermarked) version of an asset.
 *
 * IMPORTANT: this is the UI hint, not the security boundary.
 * The server-side decision lives in
 * `lib/entitlement/services.ts -> resolveDownloadAuthorization`
 * and is enforced by `app/api/media/[id]/route.ts`. Surfaces
 * that render an "open original" button can call this helper
 * for the first-pass check before they kick off the entitlement
 * round-trip.
 *
 * Rule: the asset's creator can always view their own original.
 * Anyone else routes through the entitlement layer.
 */
export function canViewAssetOriginal(
  viewer: Viewer,
  asset: { creatorId: string } | null,
): boolean {
  if (!viewer.user || !asset) return false
  return viewer.user.id === asset.creatorId
}

/**
 * True when the viewer can repost a given post.
 *
 * Rule: must be a creator AND must not be the post's author
 * (self-repost is a server-validator hard error).
 */
export function canRepost(
  viewer: Viewer,
  post: { author_user_id: string } | null,
): boolean {
  if (!isCreator(viewer)) return false
  if (!post) return false
  if (!viewer.user) return false
  return viewer.user.id !== post.author_user_id
}

/**
 * True when the viewer is looking at their own profile / feed.
 * Used to gate "Share to feed", "Edit profile", "View as buyer"
 * affordances that should only show on the viewer's own pages.
 */
export function isOwnProfile(
  viewer: Viewer,
  profile: { username: string } | null,
): boolean {
  if (!viewer.user || !profile) return false
  return viewer.user.username === profile.username
}
