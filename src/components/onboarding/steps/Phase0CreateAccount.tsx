'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isValidUsername } from '@/lib/types'
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
} from '@/lib/onboarding/constants'
import { checkUsernameAvailability } from '@/lib/onboarding/mock-services'
import { createOnboardingAccount } from '@/lib/onboarding/account-creation'
import { getAuthUserEmailConfirmed } from '@/lib/auth/provider'
import type { OnboardingAction } from '@/lib/onboarding/reducer'
import type {
  OnboardingFlowState,
  OnboardingRole,
} from '@/lib/onboarding/types'

interface Phase0Props {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

const ROLES: OnboardingRole[] = ['creator', 'buyer', 'reader']

/**
 * Phase 0 — Create account.
 *
 * Owns the minimum identity-row write that every Frontfiles
 * user must make:
 *   1. Collect email, username, password, role.
 *   2. Call `createOnboardingAccount` — the single auth seam.
 *      On a fresh submit it mints a Supabase auth user and a
 *      linked Frontfiles `users` row; on a retry it adopts the
 *      existing auth user and fills in whatever writes the
 *      previous attempt left undone. See
 *      `src/lib/onboarding/account-creation.ts` for the full
 *      partial-failure recovery contract.
 *   3. If the auth provider reports `needsEmailVerification`,
 *      stop at an in-component "verify your email" checkpoint
 *      instead of advancing. The checkpoint offers a manual
 *      "I've confirmed it" button that re-probes the provider
 *      via `getAuthUserEmailConfirmed`, and the resume
 *      reconcile in `useOnboardingFlow` re-probes on mount
 *      whenever this state is persisted.
 *   4. Otherwise route into the role-specific minimal step.
 *
 * This component is deliberately lightweight. Professional
 * profile fields, buyer company details, and legal identity
 * are collected later — in the role-specific step or deferred
 * to account editors / JIT drawers.
 */
export function Phase0CreateAccount({ state, dispatch, onComplete }: Phase0Props) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [verificationChecking, setVerificationChecking] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkUsername = useCallback(
    async (value: string) => {
      const lower = value.toLowerCase()
      if (!isValidUsername(lower)) {
        setUsernameError('3–30 chars, lowercase letters, numbers, and hyphens only')
        dispatch({
          type: 'SET_USERNAME',
          payload: { username: lower, available: false },
        })
        return
      }
      setUsernameChecking(true)
      setUsernameError(null)
      const result = await checkUsernameAvailability(lower)
      setUsernameChecking(false)
      dispatch({
        type: 'SET_USERNAME',
        payload: { username: lower, available: result.available },
      })
      if (!result.available) setUsernameError(result.reason)
    },
    [dispatch],
  )

  function handleUsernameChange(value: string) {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setUsernameError(null)
    dispatch({
      type: 'SET_USERNAME',
      payload: { username: sanitized, available: null },
    })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (sanitized.length >= 3) {
      debounceRef.current = setTimeout(() => checkUsername(sanitized), 500)
    }
  }

  function handleEmailChange(value: string) {
    dispatch({ type: 'SET_EMAIL', payload: value.trim() })
  }

  function handlePasswordChange(value: string) {
    dispatch({ type: 'SET_PASSWORD', payload: value })
  }

  function handleRoleSelect(role: OnboardingRole) {
    dispatch({ type: 'SET_ROLE', payload: role })
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)
  const passwordOk = state.password.length >= 8
  const usernameReady =
    !!state.username && state.usernameAvailable === true && !usernameError
  const roleReady = state.role !== null
  const formReady = emailOk && passwordOk && usernameReady && roleReady && !submitting

  async function handleSubmit() {
    if (!formReady || !state.role) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Single-seam account creation. Idempotent on transient
      // retry — see `src/lib/onboarding/account-creation.ts`.
      const { user, needsEmailVerification } = await createOnboardingAccount({
        email: state.email,
        username: state.username,
        password: state.password,
        role: state.role,
      })
      dispatch({ type: 'SET_CREATED_USER_ID', payload: user.id })
      dispatch({
        type: 'SET_AWAITING_EMAIL_VERIFICATION',
        payload: needsEmailVerification,
      })
      if (needsEmailVerification) {
        // Stop at the verification checkpoint. The wizard
        // persists this flag so a reload on a different tab
        // resumes in the same state, and the reconcile in
        // `useOnboardingFlow` re-probes the auth provider on
        // mount to see whether the email has been confirmed
        // in the meantime.
        setSubmitting(false)
        return
      }
      onComplete()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create your account'
      setSubmitError(message)
      setSubmitting(false)
    }
  }

  /**
   * Manual re-probe, fired by the "I've confirmed my email"
   * button on the verification checkpoint. The flow:
   *
   *   1. Call `getAuthUserEmailConfirmed(createdUserId)`.
   *   2. If confirmed, clear the checkpoint flag and advance
   *      via the existing `onComplete` path.
   *   3. If still pending, show an inline "not yet — try
   *      again in a moment" message. We do NOT reset any
   *      wizard state on a pending probe.
   *   4. If the probe returns `null`, the auth user id is
   *      unknown to the provider (ghost id). Surface a hard
   *      error — the caller can then choose to reset the
   *      wizard. In practice this is exceptionally rare and
   *      almost always means a local dev reset.
   */
  async function handleManualVerificationProbe() {
    if (!state.createdUserId) return
    setVerificationChecking(true)
    setVerificationError(null)
    try {
      const confirmed = await getAuthUserEmailConfirmed(state.createdUserId)
      if (confirmed === null) {
        setVerificationError(
          'We could not find that account with our auth provider. Try reloading the page to reset the wizard.',
        )
        return
      }
      if (!confirmed) {
        setVerificationError(
          'Still waiting for your confirmation. Click the link in your inbox, then tap here again.',
        )
        return
      }
      dispatch({
        type: 'SET_AWAITING_EMAIL_VERIFICATION',
        payload: false,
      })
      onComplete()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not check your verification status'
      setVerificationError(message)
    } finally {
      setVerificationChecking(false)
    }
  }

  if (state.awaitingEmailVerification) {
    return (
      <div className="flex flex-col gap-8 max-w-2xl">
        <div>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-black tracking-tight leading-[1.05] mb-3">
            Confirm your email
          </h1>
          <p className="text-slate-500 text-base leading-relaxed max-w-xl">
            We sent a confirmation link to{' '}
            <span className="font-mono text-black">{state.email}</span>. Click
            it to finish creating your account, then come back here and tap
            the button below.
          </p>
        </div>

        <section className="border-2 border-black px-5 py-5 flex flex-col gap-4">
          <SectionLabel>Pending verification</SectionLabel>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your account is reserved. You cannot continue onboarding until we
            know your inbox is reachable, so we will hold here until the
            confirmation link is clicked. If you do not see the email, check
            spam or promotions folders.
          </p>

          {verificationError && (
            <div className="border border-dashed border-black px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black block mb-1">
                Not yet confirmed
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                {verificationError}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={handleManualVerificationProbe}
              disabled={verificationChecking}
              className={cn(
                'h-11 px-6 font-bold text-[12px] rounded-none uppercase tracking-[0.12em]',
                verificationChecking
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#0000ff] text-white hover:bg-[#0000cc]',
              )}
            >
              {verificationChecking ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-transparent animate-spin" />
                  Checking…
                </span>
              ) : (
                "I've confirmed my email"
              )}
            </Button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-black tracking-tight leading-[1.05] mb-3">
          Create your account
        </h1>
        <p className="text-slate-500 text-base leading-relaxed max-w-xl">
          Pick a username, set a password, and tell us how you plan to use Frontfiles. Everything else can be filled in later.
        </p>
      </div>

      {/* Account fields */}
      <section className="border-2 border-black px-5 py-5 flex flex-col gap-5">
        <SectionLabel>Account</SectionLabel>

        {/* Email */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            value={state.email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="you@example.com"
            className="h-10 px-3 text-sm font-mono border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]"
          />
        </label>

        {/* Password */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
            Password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={state.password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder="Minimum 8 characters"
            className="h-10 px-3 text-sm font-mono border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]"
          />
          <span className="text-[10px] text-slate-400">
            At least 8 characters. You will use this to sign in.
          </span>
        </label>

        {/* Username */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
            Username
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 font-mono shrink-0">frontfiles.com/</span>
            <div className="flex-1 relative">
              <input
                type="text"
                value={state.username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="your-handle"
                maxLength={30}
                className="w-full h-10 px-3 text-sm font-mono border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]"
              />
              {usernameChecking && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-transparent animate-spin" />
                </span>
              )}
              {!usernameChecking && usernameReady && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0000ff] text-sm font-bold">
                  ✓
                </span>
              )}
            </div>
          </div>
          {usernameError && (
            <span className="text-xs text-black font-medium">{usernameError}</span>
          )}
          {!usernameError && state.username.length > 0 && state.username.length < 3 && (
            <span className="text-xs text-slate-400">Minimum 3 characters</span>
          )}
        </label>
      </section>

      {/* Role selection */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Account type</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ROLES.map((role) => {
            const selected = state.role === role
            return (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleSelect(role)}
                className={cn(
                  'text-left border-2 px-4 py-4 transition-colors',
                  selected
                    ? 'border-[#0000ff] bg-[#f0f0ff]'
                    : 'border-black bg-white hover:bg-slate-50',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={cn(
                      'w-4 h-4 border-2 flex items-center justify-center shrink-0',
                      selected ? 'border-[#0000ff] bg-[#0000ff]' : 'border-black',
                    )}
                  >
                    {selected && (
                      <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
                        <path
                          d="M1.5 5L4 7.5L8.5 2.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-bold uppercase tracking-[0.14em]',
                      selected ? 'text-[#0000ff]' : 'text-black',
                    )}
                  >
                    {ROLE_LABELS[role]}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Submit error */}
      {submitError && (
        <div className="border-2 border-dashed border-black px-5 py-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black mb-1 block">
            Could not create account
          </span>
          <p className="text-sm text-slate-500 leading-relaxed">{submitError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 pb-8">
        <Button
          onClick={handleSubmit}
          disabled={!formReady}
          className={cn(
            'h-12 px-8 font-bold text-[13px] rounded-none uppercase tracking-[0.12em]',
            formReady
              ? 'bg-[#0000ff] text-white hover:bg-[#0000cc]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed',
          )}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-transparent animate-spin" />
              Creating your account…
            </span>
          ) : (
            'Continue'
          )}
        </Button>
        {!submitting && (
          <span className="text-xs text-slate-400">
            You can edit everything else from your account later.
          </span>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">
      {children}
    </span>
  )
}
