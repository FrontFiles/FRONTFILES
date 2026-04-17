'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Panel } from '@/components/platform/Panel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  updateUserCore,
  upsertCreatorProfile,
} from '@/lib/identity/store'
import type { SessionUser } from '@/lib/user-context'
import type { CreatorProfileRow } from '@/lib/db/schema'

interface ProfileEditorProps {
  sessionUser: SessionUser
  creatorProfile: CreatorProfileRow | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Phase C — Canonical profile editor.
 *
 * Owns:
 *   • users.display_name, users.avatar_url  (via updateUserCore)
 *   • creator_profiles.{professional_title, biography,
 *     location_base, website_url,
 *     coverage_areas, specialisations,
 *     media_affiliations, press_accreditations,
 *     published_in, skills, also_me_links}
 *     (via upsertCreatorProfile)
 *
 * Sections:
 *   overview  → display name, avatar, title, biography,
 *               location, website
 *   coverage  → coverage areas, specialisations
 *   press     → media affiliations, press accreditations,
 *               published in
 *   practice  → skills, also_me_links
 *
 * The section is chosen via a `?section=` query param so
 * deep links from the frontfolio self-view pencils and from
 * the account shell side nav can land on the right block.
 */
export function ProfileEditor({ sessionUser, creatorProfile }: ProfileEditorProps) {
  const searchParams = useSearchParams()
  const requestedSection = searchParams.get('section') ?? 'overview'

  // ── users (core) form state ────────────────
  const [displayName, setDisplayName] = useState(sessionUser.displayName)
  const [avatarUrl, setAvatarUrl] = useState<string>(sessionUser.avatarUrl ?? '')

  // ── creator_profiles form state ─────────────
  const [professionalTitle, setProfessionalTitle] = useState<string>(
    creatorProfile?.professional_title ?? '',
  )
  const [biography, setBiography] = useState<string>(
    creatorProfile?.biography ?? '',
  )
  const [locationBase, setLocationBase] = useState<string>(
    creatorProfile?.location_base ?? '',
  )
  const [websiteUrl, setWebsiteUrl] = useState<string>(
    creatorProfile?.website_url ?? '',
  )
  const [coverageAreas, setCoverageAreas] = useState<string>(
    (creatorProfile?.coverage_areas ?? []).join(', '),
  )
  const [specialisations, setSpecialisations] = useState<string>(
    (creatorProfile?.specialisations ?? []).join(', '),
  )
  const [mediaAffiliations, setMediaAffiliations] = useState<string>(
    (creatorProfile?.media_affiliations ?? []).join(', '),
  )
  const [pressAccreditations, setPressAccreditations] = useState<string>(
    (creatorProfile?.press_accreditations ?? []).join(', '),
  )
  const [publishedIn, setPublishedIn] = useState<string>(
    (creatorProfile?.published_in ?? []).join(', '),
  )
  const [skills, setSkills] = useState<string>(
    (creatorProfile?.skills ?? []).join(', '),
  )
  const [alsoMeLinks, setAlsoMeLinks] = useState<string>(
    (creatorProfile?.also_me_links ?? []).join('\n'),
  )

  const [coreStatus, setCoreStatus] = useState<SaveStatus>('idle')
  const [creatorStatus, setCreatorStatus] = useState<SaveStatus>('idle')
  const [coreError, setCoreError] = useState<string | null>(null)
  const [creatorError, setCreatorError] = useState<string | null>(null)

  // Scroll the requested section into view on deep link
  const overviewRef = useRef<HTMLDivElement | null>(null)
  const coverageRef = useRef<HTMLDivElement | null>(null)
  const pressRef = useRef<HTMLDivElement | null>(null)
  const practiceRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const target =
      requestedSection === 'coverage'
        ? coverageRef.current
        : requestedSection === 'press'
          ? pressRef.current
          : requestedSection === 'practice'
            ? practiceRef.current
            : overviewRef.current
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [requestedSection])

  // Split a comma- or newline-separated string into a trimmed,
  // non-empty array. Shared helper used by every multi-value field.
  const splitList = useMemo(
    () => (raw: string, separator: ',' | '\n'): string[] =>
      raw
        .split(separator)
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    [],
  )

  async function handleSaveCore() {
    setCoreStatus('saving')
    setCoreError(null)
    try {
      await updateUserCore(sessionUser.id, {
        display_name: displayName,
        avatar_url: avatarUrl.trim() || null,
      })
      setCoreStatus('saved')
      setTimeout(() => setCoreStatus('idle'), 1500)
    } catch (err) {
      setCoreStatus('error')
      setCoreError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  async function handleSaveCreator() {
    setCreatorStatus('saving')
    setCreatorError(null)
    try {
      await upsertCreatorProfile({
        user_id: sessionUser.id,
        professional_title: professionalTitle.trim() || null,
        biography: biography.trim() || null,
        location_base: locationBase.trim() || null,
        website_url: websiteUrl.trim() || null,
        coverage_areas: splitList(coverageAreas, ','),
        specialisations: splitList(specialisations, ','),
        media_affiliations: splitList(mediaAffiliations, ','),
        press_accreditations: splitList(pressAccreditations, ','),
        published_in: splitList(publishedIn, ','),
        skills: splitList(skills, ','),
        also_me_links: splitList(alsoMeLinks, '\n'),
      })
      setCreatorStatus('saved')
      setTimeout(() => setCreatorStatus('idle'), 1500)
    } catch (err) {
      setCreatorStatus('error')
      setCreatorError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  const noCreatorFacet = creatorProfile === null

  return (
    <div className="flex flex-col gap-8">
      {/* ── OVERVIEW ── */}
      <div ref={overviewRef} id="overview" className="scroll-mt-8">
        <Panel title="Overview" headerStyle="black">
          <div className="flex flex-col gap-5">
            <FieldLabel label="Display name">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
              />
            </FieldLabel>

            <FieldLabel label="Avatar URL">
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="/assets/avatars/your-image.jpg"
                className={inputClass}
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Public path of your avatar image. Upload flow will come in a later phase.
              </span>
            </FieldLabel>

            {!noCreatorFacet && (
              <>
                <FieldLabel label="Professional title">
                  <input
                    type="text"
                    value={professionalTitle}
                    onChange={(e) => setProfessionalTitle(e.target.value)}
                    placeholder="e.g. Photojournalist, Southern Brazil"
                    className={inputClass}
                  />
                </FieldLabel>

                <FieldLabel label="Location base">
                  <input
                    type="text"
                    value={locationBase}
                    onChange={(e) => setLocationBase(e.target.value)}
                    placeholder="e.g. Porto Alegre, Brazil"
                    className={inputClass}
                  />
                </FieldLabel>

                <FieldLabel label="Website">
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://your-domain.press"
                    className={inputClass}
                  />
                </FieldLabel>

                <FieldLabel label="Biography">
                  <textarea
                    value={biography}
                    onChange={(e) => setBiography(e.target.value)}
                    rows={5}
                    maxLength={1200}
                    placeholder="I cover…"
                    className={cn(inputClass, 'resize-none px-3 py-2 h-auto')}
                  />
                </FieldLabel>
              </>
            )}

            {noCreatorFacet && (
              <p className="text-xs text-slate-400">
                You do not have a creator profile yet. Core account fields above
                can still be edited.
              </p>
            )}

            <SaveRow
              status={coreStatus}
              error={coreError}
              onSaveCore={handleSaveCore}
              onSaveCreator={noCreatorFacet ? null : handleSaveCreator}
              creatorStatus={creatorStatus}
              creatorError={creatorError}
            />
          </div>
        </Panel>
      </div>

      {/* ── COVERAGE ── */}
      {!noCreatorFacet && (
        <div ref={coverageRef} id="coverage" className="scroll-mt-8">
          <Panel title="Coverage & specialisations" headerStyle="black">
            <div className="flex flex-col gap-5">
              <FieldLabel label="Coverage areas">
                <input
                  type="text"
                  value={coverageAreas}
                  onChange={(e) => setCoverageAreas(e.target.value)}
                  placeholder="Comma-separated — e.g. Rio Grande do Sul, Southern Brazil"
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Specialisations">
                <input
                  type="text"
                  value={specialisations}
                  onChange={(e) => setSpecialisations(e.target.value)}
                  placeholder="Comma-separated — e.g. Flood documentation, Displacement coverage"
                  className={inputClass}
                />
              </FieldLabel>
              <SaveRow
                status="idle"
                error={null}
                onSaveCore={null}
                onSaveCreator={handleSaveCreator}
                creatorStatus={creatorStatus}
                creatorError={creatorError}
              />
            </div>
          </Panel>
        </div>
      )}

      {/* ── PRESS ── */}
      {!noCreatorFacet && (
        <div ref={pressRef} id="press" className="scroll-mt-8">
          <Panel title="Press record" headerStyle="black">
            <div className="flex flex-col gap-5">
              <FieldLabel label="Media affiliations">
                <input
                  type="text"
                  value={mediaAffiliations}
                  onChange={(e) => setMediaAffiliations(e.target.value)}
                  placeholder="Comma-separated — e.g. Reuters, Folha de S.Paulo"
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Press accreditations">
                <input
                  type="text"
                  value={pressAccreditations}
                  onChange={(e) => setPressAccreditations(e.target.value)}
                  placeholder="Comma-separated — e.g. FNJ, Rio Grande do Sul Press Association"
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Published in">
                <input
                  type="text"
                  value={publishedIn}
                  onChange={(e) => setPublishedIn(e.target.value)}
                  placeholder="Comma-separated — e.g. Reuters, Le Monde, The Guardian"
                  className={inputClass}
                />
              </FieldLabel>
              <SaveRow
                status="idle"
                error={null}
                onSaveCore={null}
                onSaveCreator={handleSaveCreator}
                creatorStatus={creatorStatus}
                creatorError={creatorError}
              />
            </div>
          </Panel>
        </div>
      )}

      {/* ── PRACTICE ── */}
      {!noCreatorFacet && (
        <div ref={practiceRef} id="practice" className="scroll-mt-8">
          <Panel title="Practice & links" headerStyle="black">
            <div className="flex flex-col gap-5">
              <FieldLabel label="Skills">
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Comma-separated — e.g. Photojournalism, Video production"
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Also me">
                <textarea
                  value={alsoMeLinks}
                  onChange={(e) => setAlsoMeLinks(e.target.value)}
                  rows={4}
                  placeholder={'One link per line\nhttps://linkedin.com/in/you\nhttps://twitter.com/you'}
                  className={cn(inputClass, 'resize-none px-3 py-2 h-auto font-mono text-xs')}
                />
              </FieldLabel>
              <SaveRow
                status="idle"
                error={null}
                onSaveCore={null}
                onSaveCreator={handleSaveCreator}
                creatorStatus={creatorStatus}
                creatorError={creatorError}
              />
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

// ── helpers ────────────────────────────────────

const inputClass =
  'w-full h-10 px-3 text-sm border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]'

function FieldLabel({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
        {label}
      </span>
      {children}
    </label>
  )
}

function SaveRow({
  status,
  error,
  onSaveCore,
  onSaveCreator,
  creatorStatus,
  creatorError,
}: {
  status: SaveStatus
  error: string | null
  onSaveCore: (() => void) | null
  onSaveCreator: (() => void) | null
  creatorStatus: SaveStatus
  creatorError: string | null
}) {
  return (
    <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
      {onSaveCore && (
        <Button
          onClick={onSaveCore}
          disabled={status === 'saving'}
          className={cn(
            'h-10 px-5 font-bold text-[11px] rounded-none uppercase tracking-[0.12em]',
            status === 'saving'
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#0000ff] text-white hover:bg-[#0000cc]',
          )}
        >
          {status === 'saving' ? 'Saving…' : 'Save account'}
        </Button>
      )}
      {onSaveCreator && (
        <Button
          onClick={onSaveCreator}
          disabled={creatorStatus === 'saving'}
          className={cn(
            'h-10 px-5 font-bold text-[11px] rounded-none uppercase tracking-[0.12em]',
            creatorStatus === 'saving'
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#0000ff] text-white hover:bg-[#0000cc]',
          )}
        >
          {creatorStatus === 'saving' ? 'Saving…' : 'Save profile'}
        </Button>
      )}
      {(status === 'saved' || creatorStatus === 'saved') && (
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#0000ff]">
          ✓ Saved
        </span>
      )}
      {(error || creatorError) && (
        <span className="text-[11px] text-red-600">
          {error ?? creatorError}
        </span>
      )}
    </div>
  )
}
