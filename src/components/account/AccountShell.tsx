'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUser, useBuyerAccount, useCompanyMemberships } from '@/lib/user-context'
import { useOnboardingCompletion } from '@/hooks/useOnboardingCompletion'
import { OnboardingChecklistSlot } from '@/components/onboarding/OnboardingChecklistSlot'
import { USER_TYPE_LABELS, type UserType } from '@/lib/types'

interface AccountShellProps {
  title: string
  description?: string
  children: React.ReactNode
}

interface NavItem {
  key: string
  label: string
  href: string
  /**
   * When set, the entry is hidden unless the current user's
   * facets satisfy the predicate.
   */
  visible?: (ctx: {
    grants: UserType[]
    hasBuyer: boolean
    hasCompanyMemberships: boolean
  }) => boolean
}

const ACCOUNT_NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', href: '/account' },
  {
    key: 'profile',
    label: 'Profile',
    href: '/account/profile',
    // Every user can see the profile editor, but the creator-only
    // sections inside render conditionally if the creator facet
    // is missing. We therefore show the link to everyone.
  },
  {
    key: 'personal-info',
    label: 'Personal info',
    href: '/account/personal-info',
  },
  {
    key: 'buyer',
    label: 'Buyer details',
    href: '/account/buyer',
    visible: ({ grants, hasBuyer }) =>
      grants.includes('buyer') || hasBuyer,
  },
  {
    key: 'companies',
    label: 'Companies',
    href: '/account/companies',
    visible: ({ grants, hasBuyer, hasCompanyMemberships }) =>
      hasCompanyMemberships || grants.includes('buyer') || hasBuyer,
  },
  {
    key: 'security',
    label: 'Security',
    href: '/account/security',
  },
]

/**
 * Phase C — Shared chrome for every `/account/*` route.
 *
 * Renders a left-side nav over a content column so each editor
 * page is a thin wrapper that only has to render its domain
 * component inside `<AccountShell>`. Visibility of the nav
 * items is driven by the session's facets and grants.
 *
 * Progressive-onboarding plug point: this shell reads the
 * canonical activation flags via `useOnboardingCompletion`
 * and forwards them to `<OnboardingChecklistSlot>` so a
 * future checklist can hang off the flags without touching
 * this file again. The hook reads from user-context state
 * (grants + facets), not the onboarding wizard, so the flags
 * stay correct after the wizard closes and across refreshes.
 */
export function AccountShell({ title, description, children }: AccountShellProps) {
  const pathname = usePathname()
  const { grantedUserTypes } = useUser()
  const buyerAccount = useBuyerAccount()
  const memberships = useCompanyMemberships()
  const onboardingCompletion = useOnboardingCompletion()

  const ctx = {
    grants: grantedUserTypes,
    hasBuyer: buyerAccount !== null,
    hasCompanyMemberships: memberships.length > 0,
  }

  const visibleNav = ACCOUNT_NAV.filter((item) =>
    item.visible ? item.visible(ctx) : true,
  )

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8 flex flex-col gap-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold text-black tracking-tight">
              {title}
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {grantedUserTypes.map((g) => USER_TYPE_LABELS[g]).join(' · ')}
            </span>
          </div>
          {description && (
            <p className="text-sm text-slate-500 max-w-2xl">{description}</p>
          )}

          <div className="flex gap-8">
            {/* Left nav */}
            <nav
              aria-label="Account sections"
              className="w-44 shrink-0 flex flex-col"
            >
              {visibleNav.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/account' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      'px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] border-l-2 transition-colors',
                      active
                        ? 'border-[#0000ff] text-[#0000ff] bg-[#f0f0ff]'
                        : 'border-transparent text-black hover:text-[#0000ff] hover:border-slate-300',
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Onboarding checklist plug point. Renders null
                  today; a future checklist implementation can
                  surface activation prompts here based on
                  `onboardingCompletion` without editing this
                  file or the individual /account/* pages. */}
              <OnboardingChecklistSlot
                flags={onboardingCompletion}
                surface="account"
              />
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
