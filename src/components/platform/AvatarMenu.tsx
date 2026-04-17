'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  useUser,
  useBuyerAccount,
  useCompanyMemberships,
  useCreatorProfile,
} from '@/lib/user-context'
import {
  useViewer,
  isCreator,
  isBuyer,
  isMultiRole,
} from '@/lib/identity/permissions'
import { USER_TYPE_LABELS, type UserType } from '@/lib/types'

type ItemKind =
  | { kind: 'link'; label: string; href: string; hint?: string }
  | { kind: 'divider' }
  | { kind: 'submenu-title'; label: string }
  | {
      kind: 'submenu-item'
      label: string
      active: boolean
      onSelect: () => void
    }
  | { kind: 'action'; label: string; onSelect: () => void; hint?: string }

/**
 * Phase C — Avatar dropdown menu.
 *
 * Replaces the old avatar `<Link>` in `DiscoveryNav` with a
 * full account-navigation surface. The menu is facet-aware:
 *   • "Your public profile" only appears for creators
 *   • "Buyer details" and "Companies" appear only when the
 *     session has a buyer facet or any company memberships
 *   • "Switch role" appears only when the user holds more
 *     than one grant
 *
 * Keyboard behaviour:
 *   Escape closes the menu.
 *   Tab rotates through the links normally.
 *   Click-outside closes the menu.
 *
 * Sign out is a no-op placeholder because there is still
 * no real auth provider wired (Phase B called this out in
 * the signin cleanup). It routes to `/signin` so the user
 * lands somewhere explicit instead of the button doing
 * nothing.
 */
export function AvatarMenu() {
  const router = useRouter()
  const {
    sessionUser,
    activeUserType,
    grantedUserTypes,
    setActiveUserType,
  } = useUser()
  const buyerAccount = useBuyerAccount()
  const memberships = useCompanyMemberships()
  const creatorProfileRow = useCreatorProfile()
  const viewer = useViewer()

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Use the centralized permission predicates so every "which
  // sections of the menu does this viewer see" check reads
  // through the same helper layer the rest of the app uses.
  const viewerIsCreator = isCreator(viewer)
  const hasBuyerFacet = buyerAccount !== null || isBuyer(viewer)
  const hasCompanies = memberships.length > 0 || hasBuyerFacet
  const multiRole = isMultiRole(viewer)

  // Gate "Your public profile" on the live creator facet from
  // the UserProvider rather than the legacy module-load snapshot
  // in `@/data/profiles`:
  //
  //   1. `useCreatorProfile()` returns the canonical
  //      `creator_profiles` row for the session, so the menu
  //      item appears the moment the row lands — during
  //      onboarding this is immediately after
  //      `PhaseCreatorMinimal` writes.
  //   2. The URL uses `sessionUser.username`, which is the
  //      canonical `users.username` read live from the context,
  //      not a field that was frozen at bundle load time.
  //   3. When a creator grant exists but the profile row is
  //      missing (a valid intermediate state between the grant
  //      landing and the profile row landing) we hide the item
  //      entirely to avoid linking to a page that would 404.
  //
  // The "Your public profile" entry is only pushed when this
  // resolves to a real profile — see `items` below.
  const hasPublicProfile = viewerIsCreator && creatorProfileRow !== null

  // Click outside → close
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Escape → close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleSignOut = useCallback(() => {
    // No real auth backend yet — see Phase B signin cleanup.
    // Route the user back to the signin screen so clicking
    // this never silently does nothing.
    setOpen(false)
    router.push('/signin')
  }, [router])

  const handleSwitchRole = useCallback(
    (role: UserType) => {
      setActiveUserType(role)
      setOpen(false)
    },
    [setActiveUserType],
  )

  const items: ItemKind[] = useMemo(() => {
    const entries: ItemKind[] = []

    if (hasPublicProfile) {
      entries.push({
        kind: 'link',
        label: 'Your public profile',
        href: `/creator/${sessionUser.username}/frontfolio`,
        hint: `frontfiles.com/${sessionUser.username}`,
      })
    }

    entries.push({ kind: 'link', label: 'Account overview', href: '/account' })
    entries.push({ kind: 'link', label: 'Profile', href: '/account/profile' })
    entries.push({
      kind: 'link',
      label: 'Personal info',
      href: '/account/personal-info',
    })

    if (hasBuyerFacet) {
      entries.push({
        kind: 'link',
        label: 'Buyer details',
        href: '/account/buyer',
      })
    }
    if (hasCompanies) {
      entries.push({
        kind: 'link',
        label: 'Companies',
        href: '/account/companies',
      })
    }
    entries.push({ kind: 'link', label: 'Security', href: '/account/security' })

    if (multiRole) {
      entries.push({ kind: 'divider' })
      entries.push({ kind: 'submenu-title', label: 'Switch role' })
      for (const t of grantedUserTypes) {
        entries.push({
          kind: 'submenu-item',
          label: USER_TYPE_LABELS[t],
          active: t === activeUserType,
          onSelect: () => handleSwitchRole(t),
        })
      }
    }

    entries.push({ kind: 'divider' })
    entries.push({
      kind: 'action',
      label: 'Sign out',
      onSelect: handleSignOut,
      hint: 'Demo mode — returns you to the signin page',
    })

    return entries
  }, [
    hasPublicProfile,
    sessionUser.username,
    hasBuyerFacet,
    hasCompanies,
    multiRole,
    grantedUserTypes,
    activeUserType,
    handleSwitchRole,
    handleSignOut,
  ])

  return (
    <div className="relative h-full" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-full flex items-center gap-2 pl-0 pr-4 border-l border-r border-black shrink-0 hover:bg-slate-50 transition-colors"
      >
        <span className="h-full aspect-square shrink-0 overflow-hidden border-r border-black/10">
          <img
            src={sessionUser.avatarUrl ?? ''}
            alt={sessionUser.displayName}
            className="w-full h-full object-cover"
          />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-black">
          {sessionUser.displayName}
        </span>
        <span className="text-[10px] text-black/20">·</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#0000ff]">
          {USER_TYPE_LABELS[activeUserType]}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-2.5 h-2.5 text-[#0000ff]"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-full mt-px z-50 bg-white border-2 border-black shadow-lg min-w-[260px] max-w-[320px]"
        >
          <div className="flex flex-col">
            {items.map((item, i) => {
              switch (item.kind) {
                case 'divider':
                  return (
                    <div
                      key={`d-${i}`}
                      className="h-px bg-slate-200"
                      aria-hidden
                    />
                  )
                case 'submenu-title':
                  return (
                    <div
                      key={`t-${i}`}
                      className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400"
                    >
                      {item.label}
                    </div>
                  )
                case 'submenu-item':
                  return (
                    <button
                      key={`sm-${i}`}
                      type="button"
                      role="menuitemradio"
                      aria-checked={item.active}
                      onClick={item.onSelect}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors text-left',
                        item.active
                          ? 'bg-[#0000ff] text-white'
                          : 'text-black hover:bg-black/5',
                      )}
                    >
                      <span>{item.label}</span>
                      {item.active && <span>✓</span>}
                    </button>
                  )
                case 'link':
                  return (
                    <Link
                      key={`l-${i}`}
                      role="menuitem"
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex flex-col px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-black hover:bg-[#f0f0ff] hover:text-[#0000ff] transition-colors"
                    >
                      <span>{item.label}</span>
                      {item.hint && (
                        <span className="text-[9px] font-normal normal-case tracking-normal text-slate-400 mt-0.5">
                          {item.hint}
                        </span>
                      )}
                    </Link>
                  )
                case 'action':
                  return (
                    <button
                      key={`a-${i}`}
                      type="button"
                      role="menuitem"
                      onClick={item.onSelect}
                      className="flex flex-col px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-black hover:bg-[#f0f0ff] hover:text-[#0000ff] transition-colors"
                    >
                      <span>{item.label}</span>
                      {item.hint && (
                        <span className="text-[9px] font-normal normal-case tracking-normal text-slate-400 mt-0.5">
                          {item.hint}
                        </span>
                      )}
                    </button>
                  )
              }
            })}
          </div>
        </div>
      )}
    </div>
  )
}
