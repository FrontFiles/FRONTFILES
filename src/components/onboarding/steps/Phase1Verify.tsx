'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CreditCard, ShieldOff, Zap } from 'lucide-react'
import { BUILDING_TASKS } from '@/lib/onboarding/constants'
import {
  startIdentityVerification,
  pollIdentityVerification,
  getIdentityAnchor,
  runCreatorCrossCheck,
  validateCreatorPersonalData,
  buildProfileDraft,
} from '@/lib/onboarding/mock-services'
import type { IdentityVerificationResult, IdentityAnchor, ValidationOutcome } from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'

interface Phase1Props {
  identityVerification: IdentityVerificationResult | null
  identityAnchor: IdentityAnchor | null
  profileDraft: unknown
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

type VerifyState = 'idle' | 'starting' | 'verifying' | 'verified' | 'failed'
type BuildState = 'idle' | 'building' | 'blocked' | 'ready'
type TaskStatus = 'pending' | 'running' | 'complete'

export function Phase1Verify({ identityVerification, identityAnchor, profileDraft, dispatch, onComplete }: Phase1Props) {
  // If returning to Phase 1 with everything done, allow immediate continue
  const alreadyComplete = !!(identityVerification?.status === 'verified' && identityAnchor && profileDraft)

  const [verifyState, setVerifyState] = useState<VerifyState>(
    identityVerification?.status === 'verified' ? 'verified' : 'idle'
  )
  const [buildState, setBuildState] = useState<BuildState>(alreadyComplete ? 'ready' : 'idle')
  const [showModal, setShowModal] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [blockOutcome, setBlockOutcome] = useState<ValidationOutcome | null>(null)
  const [taskStates, setTaskStates] = useState<Record<string, TaskStatus>>(
    Object.fromEntries(BUILDING_TASKS.map(t => [t.id, alreadyComplete ? 'complete' : 'pending']))
  )

  const buildStarted = useRef(false)

  const isVerified = verifyState === 'verified' || identityVerification?.status === 'verified'

  // ── ID verification ──────────────────────

  async function handleStartVerification() {
    setVerifyState('starting')
    setShowModal(true)
    try {
      const session = await startIdentityVerification()
      setSessionId(session.sessionId)
      setVerifyState('verifying')

      const result = await pollIdentityVerification(session.sessionId)
      dispatch({ type: 'SET_IDENTITY_VERIFICATION', payload: result })

      if (result.status === 'verified') {
        const anchor = await getIdentityAnchor(session.sessionId)
        dispatch({ type: 'SET_IDENTITY_ANCHOR', payload: anchor })
        setVerifyState('verified')
      } else {
        setVerifyState('failed')
      }
    } catch {
      setVerifyState('failed')
    }
  }

  function handleRetry() {
    setVerifyState('idle')
    setShowModal(false)
    setSessionId(null)
  }

  function handleDismissModal() {
    if (verifyState === 'verified' || verifyState === 'failed') {
      setShowModal(false)
    }
  }

  // ── Background pipeline ──────────────────

  async function runBuildingPipeline(anchor: IdentityAnchor) {
    setBuildState('building')

    // Task 1: Scan professional record (cross-check)
    setTaskStates(prev => ({ ...prev, scan: 'running' }))
    const signals = await runCreatorCrossCheck(anchor)
    dispatch({ type: 'SET_CROSS_CHECK_SIGNALS', payload: signals })
    dispatch({ type: 'SET_CROSS_CHECK_COMPLETE', payload: true })
    setTaskStates(prev => ({ ...prev, scan: 'complete' }))

    // Task 2: Validate credentials
    setTaskStates(prev => ({ ...prev, validate: 'running' }))
    const outcome = await validateCreatorPersonalData(signals, anchor)
    dispatch({ type: 'SET_VALIDATION_OUTCOME', payload: outcome })
    setTaskStates(prev => ({ ...prev, validate: 'complete' }))

    if (!outcome.canContinue) {
      setBlockOutcome(outcome)
      setBuildState('blocked')
      return
    }

    // Task 3: Assemble profile
    setTaskStates(prev => ({ ...prev, assemble: 'running' }))
    const draft = await buildProfileDraft(signals, anchor)
    dispatch({ type: 'SET_PROFILE_DRAFT', payload: draft })
    setTaskStates(prev => ({ ...prev, assemble: 'complete' }))

    setBuildState('ready')
  }

  // Auto-start building when verified and modal dismissed
  useEffect(() => {
    if (isVerified && !showModal && identityAnchor && buildState === 'idle' && !buildStarted.current) {
      buildStarted.current = true
      const timer = setTimeout(() => runBuildingPipeline(identityAnchor), 400)
      return () => clearTimeout(timer)
    }
  }, [isVerified, showModal, identityAnchor, buildState])

  // ── Render ───────────────────────────────

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Phase header */}
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-black tracking-tight leading-[1.05] mb-3">
          Verify your identity
        </h1>
        <p className="text-slate-500 text-base leading-relaxed max-w-xl">
          Before creating your Frontfiles Vault, we verify your identity once via a third-party provider. This is a one-time process.
        </p>
      </div>

      {/* What to expect — hide after verification */}
      {!isVerified && (
        <div className="border-2 border-black overflow-hidden">
          <div className="px-5 py-3 border-b-2 border-black bg-black">
            <span className="text-[11px] font-bold text-white uppercase tracking-[0.14em]">What to expect</span>
          </div>
          <div className="flex flex-col divide-y divide-slate-200">
            <InfoRow
              icon={<CreditCard className="w-4 h-4 text-black" />}
              title="Third-party verification"
              body="Your identity is verified by Onfido. Frontfiles holds only the verification result, not your raw biometric data."
            />
            <InfoRow
              icon={<ShieldOff className="w-4 h-4 text-black" />}
              title="Document scan"
              body="Photograph a government-issued ID and complete a brief liveness check."
            />
            <InfoRow
              icon={<Zap className="w-4 h-4 text-black" />}
              title="Under two minutes"
              body="Have your ID document ready before you begin."
            />
          </div>
        </div>
      )}

      {/* Privacy notice — hide after verification */}
      {!isVerified && (
        <div className="flex gap-3 border border-slate-200 px-5 py-4">
          <div className="w-1 bg-[#0000ff] shrink-0 self-stretch" />
          <p className="text-sm text-slate-500 leading-relaxed">
            <span className="text-black font-bold">Privacy: </span>
            Raw biometric data never leaves the KYC provider. Frontfiles receives only a verification outcome and an anonymised identity anchor.
          </p>
        </div>
      )}

      {/* Verified identity card */}
      {isVerified && identityAnchor && (
        <div className="border-2 border-[#0000ff] px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-[#0000ff] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-white">
                <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[#0000ff] font-bold text-[11px] uppercase tracking-[0.14em]">Identity verified</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <VerifiedField label="Name" value={identityAnchor.fullName} />
            <VerifiedField label="Document" value={identityAnchor.documentType} />
            <VerifiedField label="Nationality" value={identityAnchor.nationality} />
            <VerifiedField label="Provider" value={identityVerification?.provider ?? 'Onfido'} />
          </div>
        </div>
      )}

      {/* Building pipeline progress */}
      {(buildState === 'building' || buildState === 'ready') && (
        <div className="border-2 border-black overflow-hidden">
          <div className="px-5 py-3 border-b-2 border-black bg-black">
            <span className="text-[11px] font-bold text-white uppercase tracking-[0.14em]">
              {buildState === 'ready' ? 'Profile ready' : 'Building your profile…'}
            </span>
          </div>
          <div className="flex flex-col divide-y divide-slate-200">
            {BUILDING_TASKS.map(task => {
              const status = taskStates[task.id] ?? 'pending'
              return (
                <div key={task.id} className={cn(
                  'flex items-center gap-4 px-5 py-3 transition-all duration-300',
                  status === 'complete' && 'bg-slate-50',
                  status === 'running' && 'bg-[#f0f0ff]',
                )}>
                  <div className="shrink-0">
                    {status === 'complete' && (
                      <div className="w-5 h-5 bg-black flex items-center justify-center">
                        <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-white">
                          <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    {status === 'running' && (
                      <div className="w-5 h-5 border-2 border-[#0000ff] border-t-transparent animate-spin" />
                    )}
                    {status === 'pending' && (
                      <div className="w-5 h-5 border border-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-sm font-medium transition-colors',
                      status === 'complete' && 'text-black',
                      status === 'running' && 'text-[#0000ff] font-bold',
                      status === 'pending' && 'text-slate-400',
                    )}>
                      {task.label}
                    </div>
                    <div className="text-xs text-slate-400">{task.description}</div>
                  </div>
                  <div className={cn(
                    'text-[10px] font-bold uppercase tracking-[0.14em] shrink-0',
                    status === 'complete' && 'text-black',
                    status === 'running' && 'text-[#0000ff]',
                    status === 'pending' && 'text-slate-300',
                  )}>
                    {status === 'complete' && 'Done'}
                    {status === 'running' && 'Working'}
                    {status === 'pending' && 'Queued'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Block outcome */}
      {buildState === 'blocked' && blockOutcome && (
        <BlockPanel outcome={blockOutcome} />
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        {!isVerified && verifyState !== 'starting' && verifyState !== 'verifying' && (
          <Button
            onClick={handleStartVerification}
            className="h-12 px-8 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-[13px] rounded-none uppercase tracking-[0.12em]"
          >
            Begin verification
          </Button>
        )}
        {buildState === 'building' && (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
            <span className="text-slate-500 text-sm">Building your profile…</span>
          </div>
        )}
        {(buildState === 'ready' || alreadyComplete) && (
          <Button
            onClick={onComplete}
            className="h-12 px-8 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-[13px] rounded-none uppercase tracking-[0.12em]"
          >
            Review your profile
          </Button>
        )}
      </div>

      {/* Verification modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative w-full max-w-md mx-4 bg-white border-2 border-black p-8 flex flex-col items-center gap-6">
            {(verifyState === 'starting' || verifyState === 'verifying') && (
              <>
                <div className="w-14 h-14 border-2 border-black flex items-center justify-center">
                  <SpinnerIcon className="w-7 h-7 text-black animate-spin" />
                </div>
                <div className="text-center">
                  <h3 className="text-black font-bold text-lg mb-2">
                    {verifyState === 'starting' ? 'Connecting to provider…' : 'Verifying your identity…'}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {verifyState === 'starting'
                      ? 'Establishing a secure session with Onfido.'
                      : 'Processing your document. This usually takes about 30 seconds.'}
                  </p>
                </div>
                {sessionId && (
                  <div className="text-xs text-slate-400 font-mono">
                    Session: {sessionId.slice(0, 20)}…
                  </div>
                )}
              </>
            )}

            {verifyState === 'verified' && (
              <>
                <div className="w-14 h-14 bg-[#0000ff] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white">
                    <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-black font-bold text-lg mb-2">Verification successful</h3>
                  <p className="text-slate-500 text-sm">Your identity has been confirmed.</p>
                </div>
                <Button
                  onClick={handleDismissModal}
                  className="h-9 px-5 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-sm rounded-none uppercase tracking-[0.12em]"
                >
                  Continue
                </Button>
              </>
            )}

            {verifyState === 'failed' && (
              <>
                <div className="w-14 h-14 border-2 border-black flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-black">
                    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-black font-bold text-lg mb-2">Verification failed</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    We were unable to verify your identity. Please ensure your document is valid and try again.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleRetry}
                    className="h-9 px-5 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-sm rounded-none uppercase tracking-[0.12em]"
                  >
                    Try again
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleDismissModal}
                    className="h-9 px-5 text-slate-500 hover:text-black hover:bg-slate-50 text-sm rounded-none"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Subcomponents ───────────────────────────

function InfoRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4 px-5 py-4">
      <div className="w-8 h-8 border border-slate-300 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-black mb-1">{title}</div>
        <div className="text-sm text-slate-500 leading-relaxed">{body}</div>
      </div>
    </div>
  )
}

function VerifiedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400 uppercase tracking-[0.14em] font-bold">{label}</span>
      <span className="text-sm text-black font-medium">{value}</span>
    </div>
  )
}

function BlockPanel({ outcome }: { outcome: ValidationOutcome }) {
  if (outcome.status === 'HARD_BLOCK') {
    return (
      <div className="bg-black text-white px-6 py-8 flex flex-col items-center text-center gap-4">
        <div className="w-10 h-10 border border-white/30 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white/50">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div>
          <div className="text-white font-bold text-base mb-1 uppercase tracking-[0.12em]">Application closed</div>
          <div className="text-white/40 text-xs mb-3">This decision is final and not subject to appeal</div>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto">
            {outcome.reviewMessage}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-2 border-black px-6 py-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] uppercase bg-black text-white">
          Application paused
        </span>
      </div>
      <p className="text-slate-500 text-sm leading-relaxed mb-4">
        {outcome.reviewMessage}
      </p>
      {outcome.flags.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {outcome.flags.map((flag, i) => (
            <div key={i} className="flex gap-3 border border-slate-200 px-3 py-2.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 border border-black text-black shrink-0 self-start mt-0.5 uppercase tracking-[0.12em]">
                {flag.severity}
              </span>
              <div className="text-xs text-slate-500 leading-relaxed">{flag.description}</div>
            </div>
          ))}
        </div>
      )}
      <div className="pt-3 border-t border-slate-200">
        <p className="text-xs text-slate-400">
          Manual review required. For support:{' '}
          <span className="text-black font-bold">support@frontfiles.com</span>
        </p>
      </div>
    </div>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('', className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
