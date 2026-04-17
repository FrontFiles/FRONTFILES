'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { UserType, AccountState } from '@/lib/types'
import type {
  CreatorProfileRow,
  BuyerAccountRow,
  CompanyMembershipFullRow,
} from '@/lib/db/schema'
import type {
  LegalIdentityFacet,
  LegalIdentityStatusSummary,
} from '@/lib/identity/types'
import {
  getLegalIdentity,
  getLegalIdentityStatusSummary,
} from '@/lib/identity/store'
import { userSeedById, SESSION_DEMO_USER_ID } from '@/data/users'

export type { UserType }

/**
 * @deprecated Phase C moved the canonical copy of this map to
 * `@/lib/types`. This re-export is retained for one release so
 * legacy imports from `@/lib/user-context` keep compiling.
 * Prefer `import { USER_TYPE_LABELS } from '@/lib/types'`.
 */
export { USER_TYPE_LABELS } from '@/lib/types'

// ══════════════════════════════════════════════
// SESSION USER — core fields only
// ══════════════════════════════════════════════

export interface SessionUser {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
  accountState: AccountState
  foundingMember: boolean
}

/**
 * Resolve the demo session user from the canonical seed.
 * This is the single ground truth for the prototype's demo
 * identity data — everything downstream either reads it via
 * `useUser()` or pulls `SESSION_DEMO_USER_ID` directly from
 * `@/data/users`.
 */
function resolveDemoSessionUser(): SessionUser {
  const seed = userSeedById[SESSION_DEMO_USER_ID]
  if (!seed) {
    throw new Error(
      `user-context: demo session user '${SESSION_DEMO_USER_ID}' is missing from data/users.ts.`,
    )
  }
  return {
    id: seed.user.id,
    username: seed.user.username,
    displayName: seed.user.display_name,
    email: seed.user.email,
    avatarUrl: seed.user.avatar_url,
    accountState: seed.user.account_state,
    foundingMember: seed.user.founding_member,
  }
}

// ══════════════════════════════════════════════
// CONTEXT
// ══════════════════════════════════════════════

interface UserState {
  sessionUser: SessionUser
  grantedUserTypes: UserType[]
  activeUserType: UserType
  setActiveUserType: (type: UserType) => void
  /** Creator profile facet — null when the user has no 'creator' grant. */
  creatorProfile: CreatorProfileRow | null
  /** Buyer account facet — null when the user has no 'buyer' grant. */
  buyerAccount: BuyerAccountRow | null
  /** Active, invited, or historical company memberships. */
  companyMemberships: CompanyMembershipFullRow[]

  // ── Phase D — legal identity facet + derived status ──
  /**
   * The canonical legal identity facet for this session. Null
   * until the user has touched the identity flow at least
   * once (drafted or submitted).
   */
  legalIdentity: LegalIdentityFacet | null
  /**
   * UX-facing summary derived from `legalIdentity` + any
   * attached Stripe verification state. Always defined —
   * renders as `not_started` when the facet is missing.
   */
  legalIdentityStatus: LegalIdentityStatusSummary
  /**
   * Re-read the legal identity from the store and update
   * context state. Called by the IdentityDrawer after
   * save / submit / Stripe sync.
   */
  refreshLegalIdentity: () => Promise<void>
}

const UserContext = createContext<UserState | null>(null)

const STORAGE_KEY = 'frontfiles_active_user_type'

const NOT_STARTED_STATUS: LegalIdentityStatusSummary = {
  status: 'not_started',
  subjectType: null,
  provider: 'none',
  displayName: '—',
  isVerified: false,
  canSubmit: false,
  requiresAttention: false,
  statusLabel: 'Not started',
  nextActionLabel: 'Start verification',
  hasStripeConnection: false,
  chargesEnabled: false,
  payoutsEnabled: false,
}

export function UserProvider({ children }: { children: ReactNode }) {
  const sessionUser = useMemo(() => resolveDemoSessionUser(), [])
  const seed = userSeedById[sessionUser.id]
  const granted: UserType[] = useMemo(
    () => (seed ? seed.grants.map((g) => g.user_type) : []),
    [seed],
  )

  const creatorProfile: CreatorProfileRow | null = seed?.creatorProfile ?? null
  const buyerAccount: BuyerAccountRow | null = seed?.buyerAccount ?? null
  const companyMemberships: CompanyMembershipFullRow[] =
    seed?.companyMemberships ?? []

  const [active, setActive] = useState<UserType>(granted[0] ?? 'creator')
  const [hydrated, setHydrated] = useState(false)

  // Legal identity state lives in the provider so
  // IdentityDrawer writes can propagate to every listener
  // without reloading the page.
  const [legalIdentity, setLegalIdentity] =
    useState<LegalIdentityFacet | null>(null)
  const [legalIdentityStatus, setLegalIdentityStatus] =
    useState<LegalIdentityStatusSummary>(NOT_STARTED_STATUS)

  const refreshLegalIdentity = useCallback(async () => {
    const [facet, summary] = await Promise.all([
      getLegalIdentity(sessionUser.id),
      getLegalIdentityStatusSummary(sessionUser.id),
    ])
    setLegalIdentity(facet)
    setLegalIdentityStatus(summary)
  }, [sessionUser.id])

  // Hydrate active-role + legal identity from the store.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as UserType | null
    if (stored && granted.includes(stored)) {
      setActive(stored)
    }
    void refreshLegalIdentity().finally(() => setHydrated(true))
  }, [granted, refreshLegalIdentity])

  const setActiveUserType = (type: UserType) => {
    if (!granted.includes(type)) return
    setActive(type)
    localStorage.setItem(STORAGE_KEY, type)
  }

  const base: Omit<UserState, 'activeUserType'> = {
    sessionUser,
    grantedUserTypes: granted,
    setActiveUserType,
    creatorProfile,
    buyerAccount,
    companyMemberships,
    legalIdentity,
    legalIdentityStatus,
    refreshLegalIdentity,
  }

  // Avoid hydration mismatch — render nothing different until client takes over
  if (!hydrated) {
    return (
      <UserContext.Provider value={{ ...base, activeUserType: granted[0] ?? 'creator' }}>
        {children}
      </UserContext.Provider>
    )
  }

  return (
    <UserContext.Provider value={{ ...base, activeUserType: active }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserState {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within <UserProvider>')
  return ctx
}

// ══════════════════════════════════════════════
// FACET HOOKS
//
// These are the canonical way to read buyer/creator/company
// facet data going forward. They read straight through the
// UserProvider so every consumer stays in sync with the active
// session; later phases can swap the seed source for a real
// identity-store call without changing call sites.
// ══════════════════════════════════════════════

/**
 * Returns the creator profile facet for the current session
 * user, or `null` if the user does not hold a 'creator' grant.
 */
export function useCreatorProfile(): CreatorProfileRow | null {
  return useUser().creatorProfile
}

/**
 * Returns the buyer account facet for the current session
 * user, or `null` if the user does not hold a 'buyer' grant.
 */
export function useBuyerAccount(): BuyerAccountRow | null {
  return useUser().buyerAccount
}

/**
 * Returns the current user's company memberships (all statuses).
 * Callers that want only active memberships should filter on
 * `status === 'active'`.
 */
export function useCompanyMemberships(): CompanyMembershipFullRow[] {
  return useUser().companyMemberships
}

/**
 * Returns the canonical legal identity facet, or `null` when
 * the user has not started the flow. Components that only
 * need the rendered status (badge, next action, verified flag)
 * should prefer `useLegalIdentityStatus` — it is cheaper and
 * never null.
 */
export function useLegalIdentity(): LegalIdentityFacet | null {
  return useUser().legalIdentity
}

/**
 * Returns the UX-facing legal identity summary. Always
 * defined — `not_started` when no facet exists. Reads
 * through the provider so drawer writes propagate to every
 * listener without a page reload.
 */
export function useLegalIdentityStatus(): LegalIdentityStatusSummary {
  return useUser().legalIdentityStatus
}
