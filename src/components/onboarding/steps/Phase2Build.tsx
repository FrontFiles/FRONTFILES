'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isValidUsername } from '@/lib/types'
import { ProposedFieldEditor } from '@/components/onboarding/fields/ProposedFieldEditor'
import { MultiValueEditor } from '@/components/onboarding/fields/MultiValueEditor'
import {
  validateConfirmedProfile,
  createVaultAccount,
  checkUsernameAvailability,
} from '@/lib/onboarding/mock-services'
import type {
  CreatorProfileDraft,
  IdentityAnchor,
  ValidationOutcome,
  ProposedField,
  MultiValueEntry,
} from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'

interface Phase2Props {
  profileDraft: CreatorProfileDraft
  identityAnchor: IdentityAnchor
  validationOutcome: ValidationOutcome | null
  username: string | null
  usernameAvailable: boolean | null
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

export function Phase2Build({ profileDraft, identityAnchor, validationOutcome, username, usernameAvailable, dispatch, onComplete }: Phase2Props) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<ValidationOutcome | null>(null)
  const [usernameInput, setUsernameInput] = useState(username ?? '')
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkUsername = useCallback(async (value: string) => {
    const lower = value.toLowerCase()
    if (!isValidUsername(lower)) {
      setUsernameError('3–30 chars, lowercase letters, numbers, and hyphens only')
      dispatch({ type: 'SET_USERNAME', payload: { username: lower, available: false } })
      return
    }
    setUsernameChecking(true)
    setUsernameError(null)
    const result = await checkUsernameAvailability(lower)
    setUsernameChecking(false)
    dispatch({ type: 'SET_USERNAME', payload: { username: lower, available: result.available } })
    if (!result.available) setUsernameError(result.reason)
  }, [dispatch])

  function handleUsernameChange(value: string) {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setUsernameInput(sanitized)
    setUsernameError(null)
    dispatch({ type: 'SET_USERNAME', payload: { username: sanitized, available: false } })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (sanitized.length >= 3) {
      debounceRef.current = setTimeout(() => checkUsername(sanitized), 500)
    }
  }

  const usernameReady = !!(usernameInput && usernameAvailable === true && !usernameError)

  function updateField(key: keyof Pick<CreatorProfileDraft, 'fullName' | 'professionalTitle' | 'biography'>) {
    return (field: ProposedField) => {
      dispatch({ type: 'UPDATE_PROFILE_DRAFT', payload: { [key]: field } })
    }
  }

  function updateMulti(key: keyof Omit<CreatorProfileDraft, 'fullName' | 'professionalTitle' | 'biography'>) {
    return (entries: MultiValueEntry[]) => {
      dispatch({ type: 'UPDATE_PROFILE_DRAFT', payload: { [key]: entries } })
    }
  }

  async function handleConfirmProfile() {
    setSubmitting(true)
    setSubmitError(null)

    try {
      // Run final validation
      const outcome = await validateConfirmedProfile(profileDraft, identityAnchor)
      dispatch({ type: 'SET_FINAL_VALIDATION_OUTCOME', payload: outcome })

      if (outcome.status === 'VALIDATED') {
        // Create vault
        const result = await createVaultAccount(profileDraft, identityAnchor)
        dispatch({ type: 'SET_VAULT_CREATED', payload: { vaultId: result.vaultId } })
        onComplete()
      } else {
        setSubmitError(outcome)
      }
    } catch {
      setSubmitError({
        status: 'FLAGGED',
        canContinue: false,
        reviewMessage: 'An error occurred. Please try again.',
        flags: [],
      })
    } finally {
      setSubmitting(false)
    }
  }

  const isFlagged = validationOutcome?.status === 'FLAGGED'

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      {/* Phase header */}
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-black tracking-tight leading-[1.05] mb-3">
          Review your profile
        </h1>
        <p className="text-slate-500 text-base leading-relaxed max-w-xl">
          We built this from your professional record. Edit anything that needs correcting.
        </p>
      </div>

      {/* Flagged advisory */}
      {isFlagged && (
        <div className="flex gap-3 border-2 border-dashed border-black px-5 py-4">
          <div className="w-1 bg-black shrink-0 self-stretch" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black mb-1 block">Review advisory</span>
            <p className="text-sm text-slate-500 leading-relaxed">
              {validationOutcome?.reviewMessage ?? 'Some signals could not be fully corroborated. Please review the highlighted fields.'}
            </p>
          </div>
        </div>
      )}

      {/* Source legend */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-black uppercase border border-black px-1.5 py-0.5">AI</span>
          <span>AI-proposed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-[#0000ff] uppercase border border-[#0000ff] px-1.5 py-0.5">ID</span>
          <span>From identity anchor</span>
        </div>
      </div>

      {/* ── Tier 1: Identity ────────────────── */}
      <section>
        <SectionHeader title="Verified identity" />
        <div className="border-2 border-[#0000ff] px-5 py-4 mt-3">
          <div className="grid grid-cols-3 gap-4">
            <CompactField label="Full name" value={identityAnchor.fullName} />
            <CompactField label="Nationality" value={identityAnchor.nationality} />
            <CompactField label="Document" value={identityAnchor.documentType} />
          </div>
        </div>
      </section>

      {/* ── Username ────────────────────────── */}
      <section>
        <SectionHeader
          title="Choose your username"
          description="This becomes your public URL: frontfiles.com/username"
        />
        <div className="border-2 border-black px-5 py-5 mt-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 font-mono shrink-0">frontfiles.com/</span>
            <div className="flex-1 relative">
              <input
                type="text"
                value={usernameInput}
                onChange={e => handleUsernameChange(e.target.value)}
                placeholder="your-username"
                maxLength={30}
                className="w-full h-10 px-3 text-sm font-mono border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]"
              />
              {usernameChecking && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-transparent animate-spin inline-block" />
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
            <p className="text-xs text-black mt-2 font-medium">{usernameError}</p>
          )}
          {!usernameError && usernameInput.length > 0 && usernameInput.length < 3 && (
            <p className="text-xs text-slate-400 mt-2">Minimum 3 characters</p>
          )}
          {usernameReady && (
            <p className="text-xs text-slate-400 mt-2">
              Your profile will be at <span className="font-mono text-black">frontfiles.com/{usernameInput}</span>
            </p>
          )}
        </div>
      </section>

      {/* ── Tier 2: Professional ─────────────── */}
      <section>
        <SectionHeader
          title="Professional profile"
          description="Your title, biography, affiliations, and publication record."
        />
        <div className="border-2 border-black px-5 py-6 mt-3 flex flex-col gap-6">
          <ProposedFieldEditor
            label="Professional title"
            field={profileDraft.professionalTitle}
            onChange={updateField('professionalTitle')}
          />
          <ProposedFieldEditor
            label="Biography"
            field={profileDraft.biography}
            onChange={updateField('biography')}
            multiline
          />
          <MultiValueEditor
            label="Media affiliations"
            entries={profileDraft.mediaAffiliations}
            onChange={updateMulti('mediaAffiliations')}
            placeholder="Add a media organisation…"
          />
          <MultiValueEditor
            label="Press accreditations"
            entries={profileDraft.pressAccreditations}
            onChange={updateMulti('pressAccreditations')}
            placeholder="Add an accreditation…"
          />
          <MultiValueEditor
            label="Published in"
            entries={profileDraft.publishedIn}
            onChange={updateMulti('publishedIn')}
            placeholder="Add a publication…"
          />
        </div>
      </section>

      {/* ── Tier 3: Optional ─────────────────── */}
      <section>
        <SectionHeader
          title="Coverage & skills"
          description="Optional — you can add these later from your profile."
          optional
        />
        <div className="border border-slate-200 px-5 py-6 mt-3 flex flex-col gap-6">
          <MultiValueEditor
            label="Geographic coverage"
            entries={profileDraft.geographicCoverageAreas}
            onChange={updateMulti('geographicCoverageAreas')}
            placeholder="Add a region or country…"
          />
          <MultiValueEditor
            label="Content specialisations"
            entries={profileDraft.contentSpecialisations}
            onChange={updateMulti('contentSpecialisations')}
            placeholder="Add a specialisation…"
          />
          <MultiValueEditor
            label="Skills"
            entries={profileDraft.skills}
            onChange={updateMulti('skills')}
            placeholder="Add a skill…"
          />
          <MultiValueEditor
            label="Profile links"
            entries={profileDraft.alsoMeLinks}
            onChange={updateMulti('alsoMeLinks')}
            placeholder="https://…"
          />
        </div>
      </section>

      {/* Submit error */}
      {submitError && (
        <div className="border-2 border-dashed border-black px-5 py-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black mb-1 block">Validation issue</span>
          <p className="text-sm text-slate-500 leading-relaxed mb-3">
            {submitError.reviewMessage}
          </p>
          {submitError.flags.map((flag, i) => (
            <div key={i} className="flex gap-3 border border-slate-200 px-3 py-2.5 mb-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 border border-black text-black shrink-0 uppercase tracking-[0.12em]">
                {flag.severity}
              </span>
              <div>
                <div className="text-xs font-mono text-slate-400 mb-0.5">{flag.field}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{flag.description}</div>
              </div>
            </div>
          ))}
          {submitError.flags.some(f => f.field === 'fullName' && f.resolvable) && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <ProposedFieldEditor
                label="Correct your name"
                field={profileDraft.fullName}
                onChange={updateField('fullName')}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 pb-8">
        <Button
          onClick={handleConfirmProfile}
          disabled={submitting || !usernameReady}
          className={cn(
            "h-12 px-8 font-bold text-[13px] rounded-none uppercase tracking-[0.12em]",
            usernameReady
              ? "bg-[#0000ff] text-white hover:bg-[#0000cc]"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          )}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-transparent animate-spin" />
              {submitError ? 'Re-validating…' : 'Creating your Vault…'}
            </span>
          ) : submitError ? (
            'Try again'
          ) : (
            'This looks right'
          )}
        </Button>
        {!submitting && !submitError && (
          <span className="text-xs text-slate-400">
            You can edit your profile later from your Vault
          </span>
        )}
      </div>
    </div>
  )
}

// ── Subcomponents ───────────────────────────

function SectionHeader({ title, description, optional }: { title: string; description?: string; optional?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">{title}</h2>
      {optional && (
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">Optional</span>
      )}
      {description && (
        <span className="text-xs text-slate-400 hidden sm:inline">— {description}</span>
      )}
    </div>
  )
}

function CompactField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400 uppercase tracking-[0.14em] font-bold">{label}</span>
      <span className="text-sm text-black font-medium">{value}</span>
    </div>
  )
}
