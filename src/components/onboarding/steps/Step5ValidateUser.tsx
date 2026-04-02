'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ProposedFieldEditor } from '@/components/onboarding/fields/ProposedFieldEditor'
import { cn } from '@/lib/utils'
import { validateConfirmedProfile, createVaultAccount } from '@/lib/onboarding/mock-services'
import type { CreatorProfileDraft, IdentityAnchor, ValidationOutcome, ProposedField } from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'

interface Step5Props {
  profileDraft: CreatorProfileDraft
  identityAnchor: IdentityAnchor
  finalValidationOutcome: ValidationOutcome | null
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

export function Step5ValidateUser({ profileDraft, identityAnchor, finalValidationOutcome, dispatch, onComplete }: Step5Props) {
  const [validating, setValidating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [localProfile, setLocalProfile] = useState(profileDraft)

  async function handleValidate() {
    setValidating(true)
    try {
      const outcome = await validateConfirmedProfile(localProfile, identityAnchor)
      dispatch({ type: 'SET_FINAL_VALIDATION_OUTCOME', payload: outcome })
      dispatch({ type: 'UPDATE_PROFILE_DRAFT', payload: localProfile })
    } finally {
      setValidating(false)
    }
  }

  async function handleCreateVault() {
    setCreating(true)
    try {
      const result = await createVaultAccount(localProfile, identityAnchor)
      dispatch({ type: 'SET_VAULT_CREATED', payload: { vaultId: result.vaultId } })
      onComplete()
    } finally {
      setCreating(false)
    }
  }

  function updateProfileField(key: keyof Pick<CreatorProfileDraft, 'fullName' | 'professionalTitle' | 'biography'>) {
    return (field: ProposedField) => {
      setLocalProfile(prev => ({ ...prev, [key]: field }))
      dispatch({ type: 'UPDATE_PROFILE_DRAFT', payload: { [key]: field } })
    }
  }

  const nameMatch = localProfile.fullName.value
    .toLowerCase()
    .includes(identityAnchor.fullName.toLowerCase().split(' ')[0].toLowerCase())

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Step header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase border-2 border-black text-black">
            Step 05
          </span>
        </div>
        <h1 className="text-4xl font-bold text-black tracking-tight mb-3">
          Final Validation
        </h1>
        <p className="text-slate-600 text-base leading-relaxed max-w-xl">
          Before your Vault is created, we run a final consistency check between your confirmed profile and your verified identity.
        </p>
      </div>

      {/* Profile summary */}
      <div className="border-2 border-black">
        <div className="px-6 py-4 border-b-2 border-black bg-black">
          <span className="text-sm font-bold text-white uppercase tracking-wide">Profile summary</span>
        </div>
        <div className="px-6 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <SummaryField label="Verified name" value={identityAnchor.fullName} highlight="identity" />
            <SummaryField label="Profile name" value={localProfile.fullName.value} highlight={nameMatch ? 'match' : 'mismatch'} />
          </div>
          <Separator className="bg-slate-200" />
          <SummaryField label="Professional title" value={localProfile.professionalTitle.value} />
          <SummaryField label="Media affiliations" value={localProfile.mediaAffiliations.map(e => e.value).join(', ')} />
          <SummaryField label="Coverage areas" value={localProfile.geographicCoverageAreas.map(e => e.value).join(', ')} />
        </div>
      </div>

      {/* Name mismatch notice */}
      {!finalValidationOutcome && !nameMatch && (
        <div className="border-2 border-dashed border-black px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase border border-black text-black">
              Name mismatch
            </span>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed mb-3">
            Your profile name does not appear to match your verified identity. You can correct this now or the system will flag it during validation.
          </p>
          <ProposedFieldEditor
            label="Profile name"
            field={localProfile.fullName}
            onChange={updateProfileField('fullName')}
          />
        </div>
      )}

      {/* Validation trigger */}
      {!finalValidationOutcome && (
        <div>
          <Button
            onClick={handleValidate}
            disabled={validating}
            className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none uppercase tracking-wide"
          >
            {validating ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-transparent animate-spin" />
                Validating…
              </span>
            ) : (
              'Run final validation'
            )}
          </Button>
        </div>
      )}

      {/* Validation outcome */}
      {finalValidationOutcome && (
        <div className="flex flex-col gap-4">
          {finalValidationOutcome.status === 'VALIDATED' && (
            <>
              <div className="border-2 border-blue-600 px-6 py-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 bg-blue-600 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white">
                      <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-black font-bold text-base uppercase tracking-wide">Profile validated</div>
                    <div className="text-slate-500 text-xs">Consistent with your verified identity</div>
                  </div>
                </div>
                <p className="text-slate-600 text-sm">
                  Your profile is consistent and ready for Vault creation. Click below to activate your Vault.
                </p>
              </div>

              <Button
                onClick={handleCreateVault}
                disabled={creating}
                className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none w-fit uppercase tracking-wide"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-transparent animate-spin" />
                    Creating Vault…
                  </span>
                ) : (
                  'Create Vault'
                )}
              </Button>
            </>
          )}

          {finalValidationOutcome.status === 'FLAGGED' && (
            <div className="flex flex-col gap-4">
              <div className="border-2 border-dashed border-black px-6 py-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase border-2 border-black text-black">
                    Validation issue
                  </span>
                </div>
                <p className="text-slate-600 text-sm mb-4">{finalValidationOutcome.reviewMessage}</p>
              </div>

              {finalValidationOutcome.flags.map((flag, i) => (
                <div key={i} className="border border-slate-200 px-4 py-3">
                  <div className="text-xs font-mono text-slate-400 mb-1">{flag.field}</div>
                  <div className="text-sm text-slate-600 mb-3">{flag.description}</div>
                  {flag.resolvable && flag.field === 'fullName' && (
                    <ProposedFieldEditor
                      label="Correct your name"
                      field={localProfile.fullName}
                      onChange={(f) => {
                        updateProfileField('fullName')(f)
                      }}
                    />
                  )}
                </div>
              ))}

              <Button
                onClick={handleValidate}
                disabled={validating}
                className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none w-fit uppercase tracking-wide"
              >
                {validating ? 'Re-validating…' : 'Re-run validation'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryField({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: 'identity' | 'match' | 'mismatch'
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{label}</span>
      <span
        className={cn(
          'text-sm font-medium',
          highlight === 'identity' && 'text-blue-600',
          highlight === 'match' && 'text-blue-600',
          highlight === 'mismatch' && 'text-black font-bold underline',
          !highlight && 'text-black'
        )}
      >
        {value || <span className="text-slate-300 italic">Not set</span>}
      </span>
    </div>
  )
}
