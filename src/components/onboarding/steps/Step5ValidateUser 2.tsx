'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase bg-white/5 text-white/40 border border-white/8">
            Step 05
          </span>
        </div>
        <h1 className="text-4xl font-semibold text-white tracking-tight mb-3">
          Final Validation
        </h1>
        <p className="text-white/45 text-base leading-relaxed max-w-xl">
          Before your Vault is created, we run a final consistency check between your confirmed profile and your verified identity.
        </p>
      </div>

      {/* Profile summary */}
      <Card className="bg-slate-900 border-0 ring-1 ring-white/8">
        <CardHeader>
          <CardTitle className="text-white text-sm font-semibold">Profile summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <SummaryField label="Verified name" value={identityAnchor.fullName} highlight="identity" />
            <SummaryField label="Profile name" value={localProfile.fullName.value} highlight={nameMatch ? 'match' : 'mismatch'} />
          </div>
          <Separator className="bg-white/8" />
          <SummaryField label="Professional title" value={localProfile.professionalTitle.value} />
          <SummaryField label="Media affiliations" value={localProfile.mediaAffiliations.map(e => e.value).join(', ')} />
          <SummaryField label="Coverage areas" value={localProfile.geographicCoverageAreas.map(e => e.value).join(', ')} />
        </CardContent>
      </Card>

      {/* Name mismatch warning — shown before validation */}
      {!finalValidationOutcome && !nameMatch && (
        <div className="rounded-lg bg-amber-950/30 border border-amber-500/25 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-amber-400 shrink-0">
              <path d="M10 8v4M10 14.5h.01M9.07 3.5L2.07 15.5a1 1 0 00.86 1.5h14.14a1 1 0 00.86-1.5L10.93 3.5a1 1 0 00-1.72 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-amber-400 text-sm font-medium">Name mismatch detected</span>
          </div>
          <p className="text-white/45 text-xs leading-relaxed mb-3">
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
            className="h-11 px-8 bg-white text-slate-900 hover:bg-white/90 font-semibold text-sm rounded-lg"
          >
            {validating ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-900/40 border-t-slate-900 animate-spin" />
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
              <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 px-6 py-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white">
                      <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-emerald-400 font-semibold text-base">Profile validated</div>
                    <div className="text-emerald-600/60 text-xs">Consistent with your verified identity</div>
                  </div>
                </div>
                <p className="text-white/50 text-sm">
                  Your profile is consistent and ready for Vault creation. Click below to activate your Vault.
                </p>
              </div>

              <Button
                onClick={handleCreateVault}
                disabled={creating}
                className="h-11 px-8 bg-white text-slate-900 hover:bg-white/90 font-semibold text-sm rounded-lg w-fit"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-900/40 border-t-slate-900 animate-spin" />
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
              <div className="rounded-xl bg-amber-950/40 border border-amber-500/30 px-6 py-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-amber-400">
                      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-amber-400 font-semibold text-base">Validation issue</div>
                    <div className="text-amber-600/60 text-xs">Resolve the issue below to continue</div>
                  </div>
                </div>
                <p className="text-white/55 text-sm mb-4">{finalValidationOutcome.reviewMessage}</p>
              </div>

              {finalValidationOutcome.flags.map((flag, i) => (
                <div key={i} className="rounded-lg bg-black/20 border border-white/8 px-4 py-3">
                  <div className="text-xs font-mono text-white/30 mb-1">{flag.field}</div>
                  <div className="text-sm text-white/65 mb-3">{flag.description}</div>
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
                className="h-11 px-8 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm rounded-lg w-fit"
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
      <span className="text-xs uppercase tracking-wider text-white/30 font-medium">{label}</span>
      <span
        className={cn(
          'text-sm font-medium',
          highlight === 'identity' && 'text-blue-300',
          highlight === 'match' && 'text-emerald-400',
          highlight === 'mismatch' && 'text-amber-400',
          !highlight && 'text-white/70'
        )}
      >
        {value || <span className="text-white/20 italic">Not set</span>}
      </span>
    </div>
  )
}
