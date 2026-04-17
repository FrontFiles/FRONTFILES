'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type {
  OnboardingFlowState,
  OnboardingRole,
} from '@/lib/onboarding/types'
import { ROLE_LABELS } from '@/lib/onboarding/constants'
import { useUser } from '@/lib/user-context'

interface PhaseLaunchProps {
  state: OnboardingFlowState
  /**
   * Clear the persisted onboarding draft from localStorage.
   * Called when the user clicks any terminal CTA on this
   * screen so that returning to `/onboarding` starts fresh
   * instead of re-rendering the launch screen for the
   * already-completed account.
   */
  onExit: () => void
}

/**
 * Role-aware launch screen.
 *
 * Final step of every onboarding path. Re-uses the vault
 * activation aesthetic for the creator path (vault ID card,
 * "Your Vault is ready." hero) and adapts copy + CTAs for
 * buyer and reader paths.
 *
 * Routing on the primary CTA:
 *   creator → /creator/{sessionHandle}/frontfolio
 *   buyer   → /search
 *   reader  → /search
 *
 * ── Why the creator CTA uses the session handle, not
 *    `state.username` ────────────────────────────────────────
 *
 * This project started life as a mockup whose demo session
 * user is Sarah Chen (`SESSION_DEMO_USER_ID = 'creator-010'`,
 * handle `sarahchen`). Her frontfolio at
 * `/creator/sarahchen/frontfolio` is the canonical mockup
 * profile page — it's the one every "Go to Frontfolio" link
 * in the app should land on for the demo session.
 *
 * `state.username` is a prototype collection field captured
 * by `Phase0CreateAccount`. It is written into a mock store
 * and displayed on the `frontfiles.com/{username}` card below
 * for prototype narrative, but it does NOT correspond to the
 * currently signed-in session, which stays pinned to the demo
 * user. Using `state.username` in the href would land you on
 * someone else's (probably non-existent) page.
 *
 * The correct resolver is the *session* user. The frontfolio
 * page now reads its profile shell live from the identity
 * store via `getCreatorPortfolioShellByHandle`, so passing
 * `sessionUser.username` from the UserProvider is all we need
 * here — no more lookup against `getCreatorProfileById` and
 * the frozen module-load snapshot.
 *
 * Secondary CTA lands on the role-appropriate account shell
 * so the user can complete progressive profile fields at
 * their own pace.
 */
export function PhaseLaunch({ state, onExit }: PhaseLaunchProps) {
  const { sessionUser } = useUser()
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const role: OnboardingRole = state.role ?? 'reader'
  // `username` is the prototype collection field from the
  // onboarding form — used only to display the mock
  // `frontfiles.com/{username}` card below for narrative.
  const username = state.username || 'your-handle'
  const firstName = state.username || 'there'

  // The creator primary-CTA handle is the canonical
  // `users.username` on the current session, read live from
  // the UserProvider. The frontfolio page resolves this via
  // `getCreatorPortfolioShellByHandle` against the live
  // identity store, so we no longer route through
  // `getCreatorProfileById`'s module-load snapshot.
  const sessionHandle = sessionUser.username

  async function handleCopyVaultId() {
    if (!state.vaultId) return
    try {
      await navigator.clipboard.writeText(state.vaultId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-8 max-w-2xl transition-all duration-500',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
      )}
    >
      {/* Hero */}
      <div className="flex flex-col items-start gap-6">
        <div className="w-16 h-16 bg-[#0000ff] flex items-center justify-center">
          <svg viewBox="0 0 32 32" fill="none" className="w-9 h-9 text-white">
            <path
              d="M16 3L6 7.5v8c0 6.075 4.25 11.75 10 13.5C21.75 27.25 26 21.575 26 15.5v-8L16 3z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="currentColor"
              fillOpacity="0.2"
            />
            <path
              d="M11 16l3.5 3.5L21 12"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold tracking-[0.14em] uppercase bg-[#0000ff] text-white mb-3">
            {role === 'creator' ? 'Vault activated' : 'Account ready'}
          </span>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-black tracking-tight leading-[1.05] mb-3">
            {role === 'creator'
              ? 'Your Vault is ready.'
              : role === 'buyer'
                ? 'You are ready to license.'
                : 'Welcome to Frontfiles.'}
          </h1>
          <p className="text-slate-500 text-base leading-relaxed max-w-lg">
            {role === 'creator' ? (
              <>
                Welcome, {firstName}. Your Vault has been created and is ready
                for uploads. You can start publishing your work immediately.
              </>
            ) : role === 'buyer' ? (
              <>
                Welcome, {firstName}. Your buyer account is active. Explore the
                certified catalogue and start licensing work, or commission
                creators directly.
              </>
            ) : (
              <>
                Welcome, {firstName}. Your reader account is active. Explore
                certified stories and follow the creators whose work you trust.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Username URL card */}
      {state.username && (
        <div className="border-2 border-[#0000ff] px-6 py-4">
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#0000ff] font-bold mb-1 block">
            Your profile
          </span>
          <div className="font-mono text-black text-lg tracking-wide">
            frontfiles.com/{username}
          </div>
        </div>
      )}

      {/* Vault ID card — creator path only */}
      {role === 'creator' && state.vaultId && (
        <div className="bg-black text-white px-6 py-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">
              Vault ID
            </span>
            <button
              onClick={handleCopyVaultId}
              className="text-xs text-white/40 hover:text-white transition-colors uppercase tracking-[0.12em] font-bold"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div className="font-mono text-white text-xl tracking-[0.15em]">
            {state.vaultId}
          </div>
          <p className="text-xs text-white/30 mt-2">
            Your account creation has been logged as a timestamped entry in the Certification Event Log.
          </p>
        </div>
      )}

      {/* Account summary */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Account summary
        </h2>
        <div className="grid grid-cols-2 gap-3 border-2 border-black p-4">
          <SummaryItem label="Email" value={state.email || '—'} />
          <SummaryItem label="Username" value={state.username || '—'} />
          <SummaryItem label="Role" value={ROLE_LABELS[role]} />
          {role === 'creator' && state.creatorMinimal.professionalTitle && (
            <SummaryItem
              label="Title"
              value={state.creatorMinimal.professionalTitle}
            />
          )}
          {role === 'buyer' && state.buyerMinimal.buyerType && (
            <SummaryItem
              label="Buyer type"
              value={
                state.buyerMinimal.buyerType === 'company'
                  ? `Company · ${state.buyerMinimal.companyName || 'unnamed'}`
                  : 'Individual'
              }
            />
          )}
        </div>
      </div>

      {/* CTAs
          Primary CTA routes each role to its canonical workspace.
          Secondary CTA lands the user on the role-appropriate
          account shell — `/account/profile` for creators (the
          real profile editor), `/account/buyer` for buyers (the
          real buyer account panel), and `/account` for readers
          (the account overview). Every terminal link calls
          `onExit()` first to clear the persisted onboarding draft
          so `/onboarding` is a fresh start next time. */}
      <div className="flex items-center gap-3 pt-2 pb-8">
        {role === 'creator' ? (
          <Link
            href={`/creator/${sessionHandle}/frontfolio`}
            onClick={onExit}
            className="inline-flex items-center justify-center h-12 px-8 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-[13px] rounded-none uppercase tracking-[0.12em]"
          >
            Go to Frontfolio
          </Link>
        ) : role === 'buyer' ? (
          <Link
            href="/search"
            onClick={onExit}
            className="inline-flex items-center justify-center h-12 px-8 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-[13px] rounded-none uppercase tracking-[0.12em]"
          >
            Explore the catalogue
          </Link>
        ) : (
          <Link
            href="/search"
            onClick={onExit}
            className="inline-flex items-center justify-center h-12 px-8 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-[13px] rounded-none uppercase tracking-[0.12em]"
          >
            Start exploring
          </Link>
        )}
        <Link
          href={
            role === 'creator'
              ? '/account/profile'
              : role === 'buyer'
                ? '/account/buyer'
                : '/account'
          }
          onClick={onExit}
          className="inline-flex items-center justify-center h-12 px-5 text-slate-500 hover:text-black hover:bg-slate-50 text-sm rounded-none font-bold"
        >
          {role === 'creator'
            ? 'Complete your profile'
            : role === 'buyer'
              ? 'Go to buyer account'
              : 'Go to account'}
        </Link>
      </div>

      {/* Footer note */}
      <div className="border border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          Additional profile details, buyer billing identity, legal identity,
          and payouts are collected only when needed — at checkout, signing,
          or first payout — rather than during initial signup.
        </p>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-bold">
        {label}
      </span>
      <span className="text-sm text-black font-medium truncate">
        {value || '·'}
      </span>
    </div>
  )
}
