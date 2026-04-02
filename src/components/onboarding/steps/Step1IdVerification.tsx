'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CreditCard, ShieldOff, Zap } from 'lucide-react'
import {
  startIdentityVerification,
  pollIdentityVerification,
  getIdentityAnchor,
} from '@/lib/onboarding/mock-services'
import type { IdentityVerificationResult, IdentityAnchor } from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'

interface Step1Props {
  identityVerification: IdentityVerificationResult | null
  identityAnchor: IdentityAnchor | null
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

type UIState = 'idle' | 'starting' | 'verifying' | 'verified' | 'failed'

export function Step1IdVerification({ identityVerification, identityAnchor, dispatch, onComplete }: Step1Props) {
  const [uiState, setUiState] = useState<UIState>(
    identityVerification?.status === 'verified' ? 'verified' : 'idle'
  )
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const isVerified = uiState === 'verified' || identityVerification?.status === 'verified'

  async function handleStartVerification() {
    setUiState('starting')
    setShowModal(true)
    try {
      const session = await startIdentityVerification()
      setSessionId(session.sessionId)
      setUiState('verifying')

      const result = await pollIdentityVerification(session.sessionId)
      dispatch({ type: 'SET_IDENTITY_VERIFICATION', payload: result })

      if (result.status === 'verified') {
        const anchor = await getIdentityAnchor(session.sessionId)
        dispatch({ type: 'SET_IDENTITY_ANCHOR', payload: anchor })
        setUiState('verified')
      } else {
        setUiState('failed')
      }
    } catch {
      setUiState('failed')
    }
  }

  async function handleRetry() {
    setUiState('idle')
    setShowModal(false)
    setSessionId(null)
  }

  function handleDismissModal() {
    if (uiState === 'verified' || uiState === 'failed') {
      setShowModal(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Step header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase border-2 border-black text-black">
            Step 01
          </span>
        </div>
        <h1 className="text-4xl font-bold text-black tracking-tight mb-3">
          Identity Verification
        </h1>
        <p className="text-slate-600 text-base leading-relaxed max-w-xl">
          Before creating your Frontfiles Vault, we verify your identity once via a third-party KYC provider. This is a one-time process.
        </p>
      </div>

      {/* Info card */}
      <div className="border-2 border-black overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-black bg-black">
          <span className="text-sm font-bold text-white uppercase tracking-wide">What to expect</span>
        </div>
        <div className="flex flex-col divide-y divide-slate-200">
          <InfoRow
            icon={<CreditCard className="w-4 h-4 text-black" />}
            title="Third-party verification"
            body="Your identity is verified by Onfido, an independent KYC provider. Frontfiles holds only the verification result and an anonymised identity anchor — not your raw biometric data."
          />
          <InfoRow
            icon={<ShieldOff className="w-4 h-4 text-black" />}
            title="Document scan"
            body="Photograph a government-issued ID (passport, national ID card, or driving licence) and complete a brief liveness check."
          />
          <InfoRow
            icon={<Zap className="w-4 h-4 text-black" />}
            title="Under two minutes"
            body="The process is typically completed in under two minutes. Have your ID document ready before you begin."
          />
        </div>
      </div>

      {/* Privacy notice */}
      <div className="flex gap-3 border border-slate-200 px-5 py-4">
        <div className="w-1 bg-blue-600 shrink-0 self-stretch" />
        <p className="text-sm text-slate-600 leading-relaxed">
          <span className="text-black font-bold">Privacy: </span>
          Frontfiles receives only a verification outcome and an anonymised identity anchor. Raw biometric data never leaves the KYC provider.
        </p>
      </div>

      {/* Verified result */}
      {isVerified && identityAnchor && (
        <div className="border-2 border-blue-600 px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-blue-600 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-white">
                <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-blue-600 font-bold text-sm uppercase tracking-wide">Identity verified</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <VerifiedField label="Name" value={identityAnchor.fullName} />
            <VerifiedField label="Document type" value={identityAnchor.documentType} />
            <VerifiedField label="Nationality" value={identityAnchor.nationality} />
            <VerifiedField label="Provider" value={identityVerification?.provider ?? 'Onfido'} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        {!isVerified && (
          <Button
            onClick={handleStartVerification}
            disabled={uiState === 'starting' || uiState === 'verifying'}
            className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none uppercase tracking-wide"
          >
            {uiState === 'idle' ? 'Begin verification' : 'Starting…'}
          </Button>
        )}
        {isVerified && (
          <Button
            onClick={onComplete}
            className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none uppercase tracking-wide"
          >
            Continue
          </Button>
        )}
      </div>

      {/* Verification modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative w-full max-w-md mx-4 bg-white border-2 border-black p-8 flex flex-col items-center gap-6">
            {(uiState === 'starting' || uiState === 'verifying') && (
              <>
                <div className="w-14 h-14 border-2 border-black flex items-center justify-center">
                  <SpinnerIcon className="w-7 h-7 text-black animate-spin" />
                </div>
                <div className="text-center">
                  <h3 className="text-black font-bold text-lg mb-2">
                    {uiState === 'starting' ? 'Connecting to provider…' : 'Verifying your identity…'}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {uiState === 'starting'
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

            {uiState === 'verified' && (
              <>
                <div className="w-14 h-14 bg-blue-600 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white">
                    <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-black font-bold text-lg mb-2">Verification successful</h3>
                  <p className="text-slate-500 text-sm">Your identity has been confirmed. You can now continue.</p>
                </div>
                <Button
                  onClick={handleDismissModal}
                  className="h-9 px-5 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none uppercase tracking-wide"
                >
                  Continue
                </Button>
              </>
            )}

            {uiState === 'failed' && (
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
                    className="h-9 px-5 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none uppercase tracking-wide"
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

function InfoRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4 px-6 py-4">
      <div className="w-8 h-8 border border-slate-300 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-black mb-1">{title}</div>
        <div className="text-sm text-slate-600 leading-relaxed">{body}</div>
      </div>
    </div>
  )
}

function VerifiedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">{label}</span>
      <span className="text-sm text-black font-medium">{value}</span>
    </div>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('', className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
