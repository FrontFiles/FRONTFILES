'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProposedFieldEditor } from '@/components/onboarding/fields/ProposedFieldEditor'
import { MultiValueEditor } from '@/components/onboarding/fields/MultiValueEditor'
import { cn } from '@/lib/utils'
import type { CreatorProfileDraft, ProposedField, MultiValueEntry } from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'

interface Step4Props {
  profileDraft: CreatorProfileDraft
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

interface SectionState {
  identity: boolean
  professional: boolean
  coverage: boolean
  specialisations: boolean
  affiliations: boolean
  accreditations: boolean
  published: boolean
  skills: boolean
  links: boolean
}

export function Step4PreFill({ profileDraft, dispatch, onComplete }: Step4Props) {
  const [sectionConfirmed, setSectionConfirmed] = useState<SectionState>({
    identity: false,
    professional: false,
    coverage: false,
    specialisations: false,
    affiliations: false,
    accreditations: false,
    published: false,
    skills: false,
    links: false,
  })

  const allSectionsConfirmed = Object.values(sectionConfirmed).every(Boolean)

  function confirmSection(key: keyof SectionState) {
    setSectionConfirmed(prev => ({ ...prev, [key]: true }))
  }

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

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Step header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase border-2 border-black text-black">
            Step 04
          </span>
        </div>
        <h1 className="text-4xl font-bold text-black tracking-tight mb-3">
          Profile Setup
        </h1>
        <p className="text-slate-600 text-base leading-relaxed max-w-xl">
          Your profile has been pre-filled from your cross-check. Review each section carefully — you can edit any field. Confirm each section before continuing.
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-black uppercase border border-black px-1.5 py-0.5">AI</span>
          <span>AI-proposed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-blue-600 uppercase border border-blue-600 px-1.5 py-0.5">ID</span>
          <span>From identity anchor</span>
        </div>
      </div>

      {/* Section: Identity */}
      <ProfileSection
        title="Verified identity"
        description="Populated from your identity verification. These values match your government ID."
        confirmed={sectionConfirmed.identity}
        onConfirm={() => confirmSection('identity')}
      >
        <ProposedFieldEditor
          label="Full name"
          field={profileDraft.fullName}
          onChange={updateField('fullName')}
          readOnly
        />
      </ProfileSection>

      <div className="border-t border-slate-200 pt-6 mt-2">
        <ProfileSection
          title="Professional identity"
          description="Your title and biography as discovered through the credibility check."
          confirmed={sectionConfirmed.professional}
          onConfirm={() => confirmSection('professional')}
        >
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
        </ProfileSection>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-2">
        <ProfileSection
          title="Geographic coverage"
          description="Regions and territories covered in your published work."
          confirmed={sectionConfirmed.coverage}
          onConfirm={() => confirmSection('coverage')}
        >
          <MultiValueEditor
            label="Coverage areas"
            entries={profileDraft.geographicCoverageAreas}
            onChange={updateMulti('geographicCoverageAreas')}
            placeholder="Add a region or country…"
          />
        </ProfileSection>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-2">
        <ProfileSection
          title="Content specialisations"
          description="Your primary editorial beats and subject areas."
          confirmed={sectionConfirmed.specialisations}
          onConfirm={() => confirmSection('specialisations')}
        >
          <MultiValueEditor
            label="Specialisations"
            entries={profileDraft.contentSpecialisations}
            onChange={updateMulti('contentSpecialisations')}
            placeholder="Add a specialisation…"
          />
        </ProfileSection>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-2">
        <ProfileSection
          title="Media affiliations"
          description="Current and previous organisations you have worked with or contributed to."
          confirmed={sectionConfirmed.affiliations}
          onConfirm={() => confirmSection('affiliations')}
        >
          <MultiValueEditor
            label="Affiliations"
            entries={profileDraft.mediaAffiliations}
            onChange={updateMulti('mediaAffiliations')}
            placeholder="Add a media organisation…"
          />
        </ProfileSection>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-2">
        <ProfileSection
          title="Press accreditations"
          description="Press passes, press club memberships, and formal accreditations."
          confirmed={sectionConfirmed.accreditations}
          onConfirm={() => confirmSection('accreditations')}
        >
          <MultiValueEditor
            label="Accreditations"
            entries={profileDraft.pressAccreditations}
            onChange={updateMulti('pressAccreditations')}
            placeholder="Add an accreditation…"
          />
        </ProfileSection>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-2">
        <ProfileSection
          title="Published in"
          description="Publications and outlets that have carried your byline."
          confirmed={sectionConfirmed.published}
          onConfirm={() => confirmSection('published')}
        >
          <MultiValueEditor
            label="Publications"
            entries={profileDraft.publishedIn}
            onChange={updateMulti('publishedIn')}
            placeholder="Add a publication…"
          />
        </ProfileSection>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-2">
        <ProfileSection
          title="Skills"
          description="Technical and editorial skills relevant to your work."
          confirmed={sectionConfirmed.skills}
          onConfirm={() => confirmSection('skills')}
        >
          <MultiValueEditor
            label="Skills"
            entries={profileDraft.skills}
            onChange={updateMulti('skills')}
            placeholder="Add a skill…"
          />
        </ProfileSection>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-2">
        <ProfileSection
          title="Also me"
          description="Links to your professional profiles and personal sites."
          confirmed={sectionConfirmed.links}
          onConfirm={() => confirmSection('links')}
        >
          <MultiValueEditor
            label="Links"
            entries={profileDraft.alsoMeLinks}
            onChange={updateMulti('alsoMeLinks')}
            placeholder="https://…"
          />
        </ProfileSection>
      </div>

      {/* Continue action */}
      <div className="flex items-center gap-4 pt-2">
        <Button
          onClick={onComplete}
          disabled={!allSectionsConfirmed}
          className={cn(
            'h-11 px-8 font-bold text-sm rounded-none uppercase tracking-wide',
            allSectionsConfirmed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          )}
        >
          Continue to final validation
        </Button>
        {!allSectionsConfirmed && (
          <span className="text-xs text-slate-400">
            Confirm all sections to proceed
          </span>
        )}
      </div>
    </div>
  )
}

function ProfileSection({
  title,
  description,
  confirmed,
  onConfirm,
  children,
}: {
  title: string
  description: string
  confirmed: boolean
  onConfirm: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {confirmed ? (
            <div className="w-5 h-5 bg-black flex items-center justify-center shrink-0 mt-0.5">
              <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-white">
                <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 border border-slate-300 shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className={cn('text-sm font-bold uppercase tracking-wide', confirmed ? 'text-black' : 'text-black')}>
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs text-slate-400 hover:text-black shrink-0 uppercase tracking-wider font-bold"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {open && (
        <div className="pl-8 flex flex-col gap-4">
          {children}
          {!confirmed && (
            <Button
              onClick={onConfirm}
              size="sm"
              className="h-7 px-3 w-fit bg-white hover:bg-slate-50 text-black border-2 border-black text-xs rounded-none font-bold uppercase tracking-wide"
            >
              Confirm section
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
