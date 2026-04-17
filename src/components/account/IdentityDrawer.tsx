'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  useLegalIdentity,
  useLegalIdentityStatus,
  useUser,
} from '@/lib/user-context'
import {
  upsertLegalIdentityDraft,
  submitLegalIdentity,
} from '@/lib/identity/store'
import {
  ensureStripeConnectedAccountForIdentity,
  submitIdentityToStripe,
} from '@/lib/identity/stripe-identity'
import type {
  IdentitySubjectType,
  IdentityVerificationStatus,
  LegalIdentityDraftPatch,
  LegalIdentityFacet,
} from '@/lib/identity/types'
import {
  IdentityStatusBadge,
  StripeRequirementsDetail,
} from './IdentityStatusBadge'
import {
  resolveIdentityCopy,
  type IdentityCopy,
  type IdentityScenario,
} from './identity-copy'

interface IdentityDrawerProps {
  open: boolean
  onClose: () => void
  /**
   * Scenario controls drawer title, intro, bullets, step-1
   * framing, CTA labels, and all state copy. Defaults to
   * `account_setup` — the neutral account-side launch.
   */
  scenario?: IdentityScenario
  /**
   * Optional initial subject-type suggestion when the user
   * has no facet yet. Ignored once a facet exists.
   */
  initialSubjectType?: IdentitySubjectType
}

type DrawerMode =
  | 'collect'
  | 'review'
  | 'submitted'
  | 'verified'
  | 'rejected'
  | 'requirements_due'

/**
 * R.1 — Stripe requirement key → local form-field key.
 *
 * Stripe surfaces requirements as dotted strings like
 * `individual.first_name` or `company.address.line1`. The
 * drawer collapses those into a small set of composite
 * field keys (`section:field`) that the rendered form can
 * match against. One Stripe key may target a composite
 * field that the UI renders as a single input (e.g. first
 * + last name both point at `person:fullLegalName`).
 *
 * This table is intentionally local to the drawer — it is
 * presentation mapping, not identity data, and should not
 * leak into shared modules.
 */
const REQUIREMENT_FIELD_MAP: Record<string, string> = {
  // ── Person ────────────────────────────────
  'individual.first_name': 'person:fullLegalName',
  'individual.last_name': 'person:fullLegalName',
  'individual.dob': 'person:dateOfBirth',
  'individual.dob.day': 'person:dateOfBirth',
  'individual.dob.month': 'person:dateOfBirth',
  'individual.dob.year': 'person:dateOfBirth',

  // ── Person address ─────────────────────────
  'individual.address.line1': 'address:addressLine1',
  'individual.address.city': 'address:city',
  'individual.address.postal_code': 'address:postalCode',

  // ── Company ────────────────────────────────
  'company.name': 'company:companyLegalName',
  'company.tax_id': 'company:taxId',
  'company.vat_id': 'company:vatNumber',
  'company.registration_number': 'company:companyRegistrationNumber',

  // ── Company address ────────────────────────
  'company.address.line1': 'address:addressLine1',
  'company.address.city': 'address:city',
  'company.address.postal_code': 'address:postalCode',

  // ── Company representative ─────────────────
  'company.representative.first_name': 'company:representativeFullName',
  'company.representative.last_name': 'company:representativeFullName',
  'company.representative.relationship_title': 'company:representativeTitle',
}

/**
 * Convert a Stripe `requirements_currently_due` array into
 * the Set of composite field keys the form should highlight.
 * Unknown Stripe keys are silently ignored — the detail
 * panel above still lists every raw requirement, so nothing
 * is hidden from the user.
 */
function computeFieldsNeedingAttention(requirements: string[]): Set<string> {
  const out = new Set<string>()
  for (const req of requirements) {
    const fieldKey = REQUIREMENT_FIELD_MAP[req]
    if (fieldKey) out.add(fieldKey)
  }
  return out
}

/** Empty set reused when there are no requirements — avoids
 *  re-allocating a Set on every render. */
const EMPTY_FIELD_SET: ReadonlySet<string> = new Set()

/**
 * V.1 — Returns the short helper line rendered under any
 * field that Stripe has flagged as requiring an update.
 * Keeps the message truthful per scenario without leaking
 * payout language into the buyer-trust or neutral flows.
 */
function resolveFieldAttentionHint(scenario: IdentityScenario): string {
  switch (scenario) {
    case 'creator_payouts':
      return 'Stripe asked for updated details here before payouts can be enabled.'
    case 'buyer_trust':
      return 'Stripe asked for updated details here to confirm this account.'
    case 'account_setup':
    default:
      return 'Stripe asked for updated details here.'
  }
}

/**
 * Phase D — Legal Identity Drawer.
 *
 * Scenario-aware. The same underlying form and lifecycle
 * serve three launch points:
 *
 *   account_setup    — neutral launch from /account
 *   creator_payouts  — payout preparation, creator-side
 *   buyer_trust      — buyer/company trust-sensitive actions
 *
 * Stripe is the default verification provider. Copy
 * reflects that truthfully per scenario. The drawer does
 * NOT mention email confirmation.
 *
 * Modes (derived from `IdentityVerificationStatus`):
 *   collect          — blank form, user is starting fresh
 *   review           — draft exists, editable, has a "Submit" CTA
 *   submitted        — submitted, read-only, waiting on Stripe
 *   verified         — locked, shows summary
 *   rejected         — read-only with rejection reason + support CTA
 *   requirements_due — editable with Stripe requirements surfaced
 */
export function IdentityDrawer({
  open,
  onClose,
  scenario = 'account_setup',
  initialSubjectType,
}: IdentityDrawerProps) {
  const { sessionUser, refreshLegalIdentity } = useUser()
  const facet = useLegalIdentity()
  const summary = useLegalIdentityStatus()

  // Drawer form state — a mutable copy of whatever facet
  // exists, so editing doesn't live-mutate the provider
  // state until the user hits Save or Submit.
  const [subjectType, setSubjectType] = useState<IdentitySubjectType>(
    facet?.subject_type ?? initialSubjectType ?? 'person',
  )
  const [form, setForm] = useState<LegalIdentityDraftPatch>(
    () => draftFromFacet(facet),
  )
  const [saving, setSaving] = useState<false | 'draft' | 'submit'>(false)
  const [error, setError] = useState<string | null>(null)
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null)

  // Re-seed the form when the drawer opens or when the
  // facet under it changes (e.g. after an external
  // refresh).
  useEffect(() => {
    if (!open) return
    setSubjectType(facet?.subject_type ?? initialSubjectType ?? 'person')
    setForm(draftFromFacet(facet))
    setError(null)
  }, [open, facet, initialSubjectType])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const mode: DrawerMode = useMemo(
    () => statusToMode(summary.status),
    [summary.status],
  )

  const editable =
    mode === 'collect' || mode === 'review' || mode === 'requirements_due'

  // Resolve all scenario-specific copy in one place.
  const copy = useMemo<IdentityCopy>(
    () => resolveIdentityCopy(scenario, summary.status, subjectType),
    [scenario, summary.status, subjectType],
  )

  const setField = useCallback(
    <K extends keyof LegalIdentityDraftPatch>(
      key: K,
      value: LegalIdentityDraftPatch[K],
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const canSubmit = useMemo(() => {
    const countryOk = !!form.country_code?.trim()
    if (subjectType === 'person') {
      return countryOk && !!form.full_legal_name?.trim()
    }
    return countryOk && !!form.company_legal_name?.trim()
  }, [form, subjectType])

  // R.1 — derive the Set of composite field keys that Stripe
  // has flagged as currently due. Used by PersonFields /
  // CompanyFields / AddressFields to mark individual inputs
  // as needing attention.
  const fieldsNeedingAttention = useMemo<ReadonlySet<string>>(() => {
    const due = facet?.stripe_verification?.requirements_currently_due
    if (!due || due.length === 0) return EMPTY_FIELD_SET
    return computeFieldsNeedingAttention(due)
  }, [facet?.stripe_verification?.requirements_currently_due])

  // V.1 — scenario-specific helper line shown under each
  // flagged field. Pure derivation from scenario prop.
  const fieldAttentionHint = resolveFieldAttentionHint(scenario)

  // R.3 — build a small "submitting as …" summary from the
  // live form state. Only renders when we have enough info
  // to make a truthful one-line sentence (name + country).
  const submissionSummary = useMemo(() => {
    const derivedName =
      subjectType === 'company'
        ? (form.company_legal_name ?? '').trim()
        : (form.full_legal_name ?? '').trim()
    const summaryDisplayName =
      summary.displayName && summary.displayName !== '—'
        ? summary.displayName
        : derivedName
    const countryLabel = (form.country_code ?? '').trim().toUpperCase()
    const subjectLabel = subjectType === 'company' ? 'Company' : 'Individual'

    if (!summaryDisplayName || !countryLabel) return null
    return {
      displayName: summaryDisplayName,
      countryLabel,
      subjectLabel,
    }
  }, [
    subjectType,
    form.company_legal_name,
    form.full_legal_name,
    form.country_code,
    summary.displayName,
  ])

  async function handleSaveDraft() {
    setSaving('draft')
    setError(null)
    try {
      await upsertLegalIdentityDraft(sessionUser.id, {
        ...form,
        subject_type: subjectType,
      })
      await refreshLegalIdentity()
      setJustSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save draft')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    setSaving('submit')
    setError(null)
    try {
      await upsertLegalIdentityDraft(sessionUser.id, {
        ...form,
        subject_type: subjectType,
      })
      await submitLegalIdentity(sessionUser.id)
      await ensureStripeConnectedAccountForIdentity(
        sessionUser.id,
        subjectType,
      )
      await submitIdentityToStripe(sessionUser.id)
      await refreshLegalIdentity()
      setJustSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.drawerTitle}
      className="fixed inset-0 z-[100] flex items-start justify-end"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close legal identity drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      {/* Drawer panel */}
      <aside className="relative h-full w-full max-w-[560px] bg-white border-l-2 border-black overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b-2 border-black px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">
              {copy.drawerEyebrow}
            </div>
            <h2 className="text-lg font-black text-black tracking-tight leading-tight">
              {copy.drawerTitle}
            </h2>
            <div className="mt-2">
              <IdentityStatusBadge status={summary.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-black/50 hover:text-black hover:bg-slate-100 border border-slate-200"
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="px-6 py-5 flex flex-col gap-6">
          {/* Intro paragraph */}
          <p className="text-sm text-slate-600 leading-relaxed">
            {mode === 'rejected' ? copy.rejectedIntro : copy.intro}
          </p>

          {/* "Why this is needed" block — always visible so
              the user understands the purpose before they
              start filling the form. */}
          <WhyBlock title={copy.whyTitle} bullets={copy.whyBullets} />

          {/* Stripe requirements surface — only renders when
              there is something Stripe-side to show. */}
          {facet && (
            <StripeRequirementsDetail
              status={summary}
              stripe={facet.stripe_verification}
            />
          )}

          {/* Non-editable state panels */}
          {mode === 'submitted' && (
            <StatePanel
              tone="neutral"
              title={copy.submittedTitle}
              body={copy.submittedBody}
            />
          )}
          {mode === 'verified' && (
            <StatePanel
              tone="success"
              title={copy.verifiedTitle}
              body={
                facet?.verified_at
                  ? `${copy.verifiedBody} Verified on ${new Date(
                      facet.verified_at,
                    ).toLocaleDateString()}.`
                  : copy.verifiedBody
              }
            />
          )}
          {mode === 'requirements_due' && (
            <StatePanel
              tone="warning"
              title={copy.requirementsDueTitle}
              body={copy.requirementsDueBody}
            />
          )}
          {mode === 'rejected' && facet?.rejection_reason && (
            <div className="border-2 border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 leading-relaxed">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1">
                Rejection reason
              </div>
              {facet.rejection_reason}
            </div>
          )}

          {/* "What happens next" block — only shown in
              non-collect states where the user has already
              acted. */}
          {mode !== 'collect' && mode !== 'review' && (
            <WhatNextBlock
              title={copy.whatNextTitle}
              bullets={copy.whatNextBullets}
            />
          )}

          {/* ── STEP 1 ── */}
          <StepHeader index={1} title={copy.step1Title} />
          <section className="flex flex-col gap-2">
            <FieldLabel>{copy.subjectQuestion}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <SubjectCard
                label={copy.subjectPersonLabel}
                description={copy.subjectPersonDescription}
                selected={subjectType === 'person'}
                disabled={!editable}
                onSelect={() => setSubjectType('person')}
              />
              <SubjectCard
                label={copy.subjectCompanyLabel}
                description={copy.subjectCompanyDescription}
                selected={subjectType === 'company'}
                disabled={!editable}
                onSelect={() => setSubjectType('company')}
              />
            </div>
          </section>

          {/* ── STEP 2 ── */}
          <StepHeader index={2} title={copy.step2Title} />
          {subjectType === 'person' ? (
            <PersonFields
              form={form}
              setField={setField}
              readOnly={!editable}
              sectionTitle={copy.personSectionTitle}
              fieldsNeedingAttention={fieldsNeedingAttention}
              fieldAttentionHint={fieldAttentionHint}
            />
          ) : (
            <CompanyFields
              form={form}
              setField={setField}
              readOnly={!editable}
              sectionTitle={copy.companySectionTitle}
              repSectionTitle={copy.companyRepSectionTitle}
              repNameLabel={copy.companyRepNameLabel}
              repTitleLabel={copy.companyRepTitleLabel}
              repNamePlaceholder={copy.companyRepNamePlaceholder}
              repTitlePlaceholder={copy.companyRepTitlePlaceholder}
              fieldsNeedingAttention={fieldsNeedingAttention}
              fieldAttentionHint={fieldAttentionHint}
            />
          )}

          {/* ── STEP 3 ── */}
          <StepHeader index={3} title={copy.step3Title} />

          {/* Error / saved feedback */}
          {error && (
            <div className="border-2 border-dashed border-red-500 bg-red-50 text-red-700 text-xs px-4 py-3">
              {error}
            </div>
          )}
          {justSavedAt && !error && (
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0000ff]">
              ✓ Saved
            </div>
          )}

          {/* R.3 — compact "submitting as …" summary.
              Read-only sanity check, no navigation. Only
              renders when the form has enough data to make
              a truthful sentence (name + country). Sits
              directly above the CTA row so it reads as the
              last thing the user sees before pressing Submit. */}
          {editable && submissionSummary && (
            <p className="text-xs text-slate-500 leading-snug py-1">
              Submitting as{' '}
              <span className="font-bold text-black">
                {submissionSummary.displayName}
              </span>{' '}
              · <span className="font-mono">{submissionSummary.countryLabel}</span>{' '}
              · {submissionSummary.subjectLabel}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
            {editable ? (
              <>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || saving === 'submit'}
                  className={cn(
                    'h-10 px-5 font-bold text-[11px] rounded-none uppercase tracking-[0.12em]',
                    canSubmit && saving !== 'submit'
                      ? 'bg-[#0000ff] text-white hover:bg-[#0000cc]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                  )}
                >
                  {saving === 'submit'
                    ? 'Submitting…'
                    : mode === 'requirements_due'
                      ? copy.requirementsDueCtaLabel
                      : copy.primaryCtaLabel}
                </Button>
                <Button
                  onClick={handleSaveDraft}
                  disabled={saving === 'draft'}
                  className={cn(
                    'h-10 px-5 font-bold text-[11px] rounded-none uppercase tracking-[0.12em]',
                    'bg-white text-black border-2 border-black hover:bg-slate-50',
                  )}
                >
                  {saving === 'draft' ? 'Saving…' : copy.draftCtaLabel}
                </Button>
              </>
            ) : (
              <Button
                onClick={onClose}
                className="h-10 px-5 font-bold text-[11px] rounded-none uppercase tracking-[0.12em] bg-black text-white hover:bg-[#0000ff]"
              >
                Close
              </Button>
            )}
          </div>

          {/* Legal footer */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {copy.footerNote}
          </p>
        </div>
      </aside>
    </div>
  )
}

// ══════════════════════════════════════════════
// helpers + form subcomponents
// ══════════════════════════════════════════════

function statusToMode(status: IdentityVerificationStatus): DrawerMode {
  switch (status) {
    case 'not_started':
      return 'collect'
    case 'draft':
      return 'review'
    case 'submitted':
    case 'in_review':
      return 'submitted'
    case 'verified':
      return 'verified'
    case 'rejected':
      return 'rejected'
    case 'requirements_due':
    case 'needs_resubmission':
      return 'requirements_due'
  }
}

function draftFromFacet(
  facet: LegalIdentityFacet | null,
): LegalIdentityDraftPatch {
  if (!facet) return {}
  return {
    subject_type: facet.subject_type,
    full_legal_name: facet.full_legal_name,
    date_of_birth: facet.date_of_birth,
    country_code: facet.country_code,
    nationality: facet.nationality,
    address_line_1: facet.address_line_1,
    address_line_2: facet.address_line_2,
    city: facet.city,
    region: facet.region,
    postal_code: facet.postal_code,
    company_legal_name: facet.company_legal_name,
    company_registration_number: facet.company_registration_number,
    vat_number: facet.vat_number,
    tax_id: facet.tax_id,
    representative_full_name: facet.representative_full_name,
    representative_title: facet.representative_title,
  }
}

// ── Shared blocks ──────────────────────────────

function StepHeader({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
      <span className="w-5 h-5 flex items-center justify-center bg-black text-white text-[10px] font-mono font-bold shrink-0">
        {index}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-black">
        {title}
      </span>
    </div>
  )
}

function WhyBlock({
  title,
  bullets,
}: {
  title: string
  bullets: string[]
}) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">
        {title}
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-slate-600 leading-snug">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 w-1 h-1 bg-slate-400 shrink-0"
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WhatNextBlock({
  title,
  bullets,
}: {
  title: string
  bullets: string[]
}) {
  return (
    <div className="border border-[#0000ff]/30 bg-[#f0f0ff] px-4 py-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#0000ff] mb-2">
        {title}
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-slate-700 leading-snug">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 w-1 h-1 bg-[#0000ff] shrink-0"
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatePanel({
  tone,
  title,
  body,
}: {
  tone: 'neutral' | 'warning' | 'success'
  title: string
  body: string
}) {
  const toneClass = {
    neutral: 'border-[#0000ff]/40 bg-[#f0f0ff] text-slate-800',
    warning: 'border-amber-300 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone]
  const labelClass = {
    neutral: 'text-[#0000ff]',
    warning: 'text-amber-700',
    success: 'text-emerald-700',
  }[tone]
  return (
    <div className={cn('border-2 px-4 py-3 text-xs leading-relaxed', toneClass)}>
      <div
        className={cn(
          'text-[10px] font-bold uppercase tracking-[0.14em] mb-1',
          labelClass,
        )}
      >
        {title}
      </div>
      {body}
    </div>
  )
}

function SubjectCard({
  label,
  description,
  selected,
  disabled,
  onSelect,
}: {
  label: string
  description: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'text-left border-2 px-3 py-3 transition-colors',
        disabled && 'cursor-not-allowed opacity-70',
        selected
          ? 'border-[#0000ff] bg-[#f0f0ff]'
          : 'border-black bg-white hover:bg-slate-50',
      )}
    >
      <div
        className={cn(
          'text-[10px] font-bold uppercase tracking-[0.14em] mb-1',
          selected ? 'text-[#0000ff]' : 'text-black',
        )}
      >
        {label}
      </div>
      <div className="text-[11px] text-slate-500 leading-snug">
        {description}
      </div>
    </button>
  )
}

// ── Form fields ────────────────────────────────

function PersonFields({
  form,
  setField,
  readOnly,
  sectionTitle,
  fieldsNeedingAttention,
  fieldAttentionHint,
}: {
  form: LegalIdentityDraftPatch
  setField: <K extends keyof LegalIdentityDraftPatch>(
    key: K,
    value: LegalIdentityDraftPatch[K],
  ) => void
  readOnly: boolean
  sectionTitle: string
  fieldsNeedingAttention: ReadonlySet<string>
  fieldAttentionHint: string
}) {
  const nameAttn = fieldsNeedingAttention.has('person:fullLegalName')
  const dobAttn = fieldsNeedingAttention.has('person:dateOfBirth')
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>{sectionTitle}</SectionTitle>
      <Field label="Full legal name" needsAttention={nameAttn} attentionHint={fieldAttentionHint}>
        <input
          type="text"
          readOnly={readOnly}
          value={form.full_legal_name ?? ''}
          onChange={(e) => setField('full_legal_name', e.target.value)}
          placeholder="As it appears on your government ID"
          className={inputClass(readOnly, nameAttn)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of birth" needsAttention={dobAttn} attentionHint={fieldAttentionHint}>
          <input
            type="date"
            readOnly={readOnly}
            value={form.date_of_birth ?? ''}
            onChange={(e) => setField('date_of_birth', e.target.value)}
            className={inputClass(readOnly, dobAttn)}
          />
        </Field>
        <Field label="Nationality">
          <input
            type="text"
            readOnly={readOnly}
            value={form.nationality ?? ''}
            onChange={(e) => setField('nationality', e.target.value)}
            placeholder="ISO country, e.g. PT"
            maxLength={2}
            className={cn(inputClass(readOnly), 'font-mono uppercase')}
          />
        </Field>
      </div>
      <AddressFields
        form={form}
        setField={setField}
        readOnly={readOnly}
        fieldsNeedingAttention={fieldsNeedingAttention}
        fieldAttentionHint={fieldAttentionHint}
      />
    </section>
  )
}

function CompanyFields({
  form,
  setField,
  readOnly,
  sectionTitle,
  repSectionTitle,
  repNameLabel,
  repTitleLabel,
  repNamePlaceholder,
  repTitlePlaceholder,
  fieldsNeedingAttention,
  fieldAttentionHint,
}: {
  form: LegalIdentityDraftPatch
  setField: <K extends keyof LegalIdentityDraftPatch>(
    key: K,
    value: LegalIdentityDraftPatch[K],
  ) => void
  readOnly: boolean
  sectionTitle: string
  repSectionTitle: string
  repNameLabel: string
  repTitleLabel: string
  repNamePlaceholder: string
  repTitlePlaceholder: string
  fieldsNeedingAttention: ReadonlySet<string>
  fieldAttentionHint: string
}) {
  const nameAttn = fieldsNeedingAttention.has('company:companyLegalName')
  const regNumAttn = fieldsNeedingAttention.has('company:companyRegistrationNumber')
  const vatAttn = fieldsNeedingAttention.has('company:vatNumber')
  const taxAttn = fieldsNeedingAttention.has('company:taxId')
  const repNameAttn = fieldsNeedingAttention.has('company:representativeFullName')
  const repTitleAttn = fieldsNeedingAttention.has('company:representativeTitle')

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>{sectionTitle}</SectionTitle>
      <Field label="Company legal name" needsAttention={nameAttn} attentionHint={fieldAttentionHint}>
        <input
          type="text"
          readOnly={readOnly}
          value={form.company_legal_name ?? ''}
          onChange={(e) => setField('company_legal_name', e.target.value)}
          placeholder="Registered legal name"
          className={inputClass(readOnly, nameAttn)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Registration number" needsAttention={regNumAttn} attentionHint={fieldAttentionHint}>
          <input
            type="text"
            readOnly={readOnly}
            value={form.company_registration_number ?? ''}
            onChange={(e) =>
              setField('company_registration_number', e.target.value)
            }
            className={cn(inputClass(readOnly, regNumAttn), 'font-mono')}
          />
        </Field>
        <Field label="VAT number" needsAttention={vatAttn} attentionHint={fieldAttentionHint}>
          <input
            type="text"
            readOnly={readOnly}
            value={form.vat_number ?? ''}
            onChange={(e) => setField('vat_number', e.target.value)}
            className={cn(inputClass(readOnly, vatAttn), 'font-mono')}
          />
        </Field>
      </div>
      <Field label="Tax ID" needsAttention={taxAttn} attentionHint={fieldAttentionHint}>
        <input
          type="text"
          readOnly={readOnly}
          value={form.tax_id ?? ''}
          onChange={(e) => setField('tax_id', e.target.value)}
          placeholder="EIN / TIN — non-VAT jurisdictions"
          className={cn(inputClass(readOnly, taxAttn), 'font-mono')}
        />
      </Field>

      <SectionTitle>{repSectionTitle}</SectionTitle>
      <Field label={repNameLabel} needsAttention={repNameAttn} attentionHint={fieldAttentionHint}>
        <input
          type="text"
          readOnly={readOnly}
          value={form.representative_full_name ?? ''}
          onChange={(e) => setField('representative_full_name', e.target.value)}
          placeholder={repNamePlaceholder}
          className={inputClass(readOnly, repNameAttn)}
        />
      </Field>
      <Field label={repTitleLabel} needsAttention={repTitleAttn} attentionHint={fieldAttentionHint}>
        <input
          type="text"
          readOnly={readOnly}
          value={form.representative_title ?? ''}
          onChange={(e) => setField('representative_title', e.target.value)}
          placeholder={repTitlePlaceholder}
          className={inputClass(readOnly, repTitleAttn)}
        />
      </Field>

      <AddressFields
        form={form}
        setField={setField}
        readOnly={readOnly}
        fieldsNeedingAttention={fieldsNeedingAttention}
        fieldAttentionHint={fieldAttentionHint}
      />
    </section>
  )
}

function AddressFields({
  form,
  setField,
  readOnly,
  fieldsNeedingAttention,
  fieldAttentionHint,
}: {
  form: LegalIdentityDraftPatch
  setField: <K extends keyof LegalIdentityDraftPatch>(
    key: K,
    value: LegalIdentityDraftPatch[K],
  ) => void
  readOnly: boolean
  fieldsNeedingAttention: ReadonlySet<string>
  fieldAttentionHint: string
}) {
  const line1Attn = fieldsNeedingAttention.has('address:addressLine1')
  const cityAttn = fieldsNeedingAttention.has('address:city')
  const postalAttn = fieldsNeedingAttention.has('address:postalCode')
  return (
    <>
      <SectionTitle>Address</SectionTitle>
      <Field label="Country">
        <input
          type="text"
          readOnly={readOnly}
          value={form.country_code ?? ''}
          onChange={(e) => setField('country_code', e.target.value.toUpperCase())}
          placeholder="ISO country, e.g. PT"
          maxLength={2}
          className={cn(inputClass(readOnly), 'font-mono uppercase')}
        />
      </Field>
      <Field label="Address line 1" needsAttention={line1Attn} attentionHint={fieldAttentionHint}>
        <input
          type="text"
          readOnly={readOnly}
          value={form.address_line_1 ?? ''}
          onChange={(e) => setField('address_line_1', e.target.value)}
          className={inputClass(readOnly, line1Attn)}
        />
      </Field>
      <Field label="Address line 2">
        <input
          type="text"
          readOnly={readOnly}
          value={form.address_line_2 ?? ''}
          onChange={(e) => setField('address_line_2', e.target.value)}
          className={inputClass(readOnly)}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="City" needsAttention={cityAttn} attentionHint={fieldAttentionHint}>
          <input
            type="text"
            readOnly={readOnly}
            value={form.city ?? ''}
            onChange={(e) => setField('city', e.target.value)}
            className={inputClass(readOnly, cityAttn)}
          />
        </Field>
        <Field label="Region / state">
          <input
            type="text"
            readOnly={readOnly}
            value={form.region ?? ''}
            onChange={(e) => setField('region', e.target.value)}
            className={inputClass(readOnly)}
          />
        </Field>
        <Field label="Postal code" needsAttention={postalAttn} attentionHint={fieldAttentionHint}>
          <input
            type="text"
            readOnly={readOnly}
            value={form.postal_code ?? ''}
            onChange={(e) => setField('postal_code', e.target.value)}
            className={cn(inputClass(readOnly, postalAttn), 'font-mono')}
          />
        </Field>
      </div>
    </>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
      {children}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 pt-1">
      {children}
    </div>
  )
}

function Field({
  label,
  needsAttention,
  attentionHint,
  children,
}: {
  label: string
  /**
   * R.2 — mark the field as requested-for-update by Stripe.
   * This is not an error; it renders as a subtle amber
   * border + helper line ("please pay attention here").
   */
  needsAttention?: boolean
  /**
   * V.1 — scenario-specific helper text shown when
   * needsAttention is true. Falls back to a generic
   * Stripe-update line if omitted.
   */
  attentionHint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {children}
      {needsAttention && (
        <span className="text-[10px] text-amber-600 leading-snug">
          {attentionHint ?? 'Stripe asked for updated details here.'}
        </span>
      )}
    </label>
  )
}

function inputClass(readOnly: boolean, needsAttention?: boolean): string {
  return cn(
    'w-full h-10 px-3 text-sm border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]',
    readOnly && 'bg-slate-50 text-slate-500 cursor-not-allowed',
    // Subtle review tint — not an error state. Amber-400 border
    // reads as "look here" rather than "this is wrong". twMerge
    // handles the border/bg override over the base classes.
    needsAttention &&
      'border-amber-400 bg-amber-50/50 focus:border-amber-500',
  )
}
