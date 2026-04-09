'use client'

/**
 * New Assignment Wizard — Multi-step brief creation flow.
 *
 * Steps: Context -> Brief -> Rights -> Milestones -> Review & Issue
 * Design canon: black + blue-600 + white. No radius. Hard borders. Dense typography.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SectionLabel, FieldLabel, ClassBadge, MilestoneTypeBadge, EmptyState } from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type {
  AssignmentClass,
  MilestoneType,
  EvidenceItemKind,
  BuyerCompanyRole,
} from '@/lib/types'
import { Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'

// ══════════════════════════════════════════════
// LOCAL TYPES
// ══════════════════════════════════════════════

type BuyerRoleContext = BuyerCompanyRole | 'individual'

interface AssetRightsForm {
  usageRights: string
  exclusivityTerms: string
  permittedModifications: string
  duration: string
  territory: string
  publicationScope: string
}

interface ServiceTermsForm {
  scopeOfWork: string
  confidentiality: string
  attendanceObligations: string
  operationalRestrictions: string
  reimbursementTerms: string
  liabilityFraming: string
}

interface MilestoneForm {
  id: string
  title: string
  scopeSummary: string
  milestoneType: MilestoneType
  dueDate: string
  acceptanceCriteria: string
  requiredEvidenceTypes: EvidenceItemKind[]
  releasableAmountEur: string
  partialAcceptancePermitted: boolean
  reviewWindowDays: number
}

interface WizardState {
  // Step 1: Context
  buyerRole: BuyerRoleContext
  creatorId: string
  assignmentClass: AssignmentClass

  // Step 2: Brief
  scope: string
  deadline: string
  acceptanceCriteria: string
  requiredEvidenceTypes: EvidenceItemKind[]
  reviewWindowDays: number
  notes: string

  // Step 3: Rights
  assetRights: AssetRightsForm
  serviceTerms: ServiceTermsForm

  // Step 4: Milestones
  milestones: MilestoneForm[]
}

const STEPS = [
  { num: 1, label: 'Context' },
  { num: 2, label: 'Brief' },
  { num: 3, label: 'Rights' },
  { num: 4, label: 'Milestones' },
  { num: 5, label: 'Review' },
] as const

const EVIDENCE_TYPES: { value: EvidenceItemKind; label: string }[] = [
  { value: 'vault_asset', label: 'Vault Asset' },
  { value: 'service_log', label: 'Service Log' },
  { value: 'support_document', label: 'Support Document' },
  { value: 'handoff_note', label: 'Handoff Note' },
  { value: 'attendance_confirmation', label: 'Attendance Confirmation' },
]

const ROLE_OPTIONS: { value: BuyerRoleContext; label: string; description: string }[] = [
  { value: 'individual', label: 'Individual Buyer', description: 'Personal account. Can issue briefs and release escrow directly.' },
  { value: 'editor', label: 'Editor', description: 'Company role. Can issue briefs but cannot release escrow.' },
  { value: 'content_commit_holder', label: 'Content Commit Holder', description: 'Company role. Can issue briefs and release escrow on behalf of the company.' },
  { value: 'admin', label: 'Admin', description: 'Company admin. Full assignment management. Cannot release escrow directly.' },
]

const CLASS_OPTIONS: { value: AssignmentClass; label: string; description: string }[] = [
  { value: 'material', label: 'Material', description: 'File-based journalism content. Photos, video, audio, text, illustrations.' },
  { value: 'service', label: 'Service', description: 'Labour, operational support, access, or field assistance. No deliverable files.' },
  { value: 'hybrid', label: 'Hybrid', description: 'Service obligations and material outputs. Combines both delivery types.' },
]

function emptyAssetRights(): AssetRightsForm {
  return { usageRights: '', exclusivityTerms: '', permittedModifications: '', duration: '', territory: '', publicationScope: '' }
}

function emptyServiceTerms(): ServiceTermsForm {
  return { scopeOfWork: '', confidentiality: '', attendanceObligations: '', operationalRestrictions: '', reimbursementTerms: '', liabilityFraming: '' }
}

function emptyMilestone(): MilestoneForm {
  return {
    id: crypto.randomUUID(),
    title: '',
    scopeSummary: '',
    milestoneType: 'material',
    dueDate: '',
    acceptanceCriteria: '',
    requiredEvidenceTypes: [],
    releasableAmountEur: '',
    partialAcceptancePermitted: false,
    reviewWindowDays: 5,
  }
}

function eurToCents(eurStr: string): number {
  const val = parseFloat(eurStr)
  return isNaN(val) ? 0 : Math.round(val * 100)
}

function centsToEurDisplay(cents: number): string {
  return `\u20AC${(cents / 100).toFixed(2)}`
}

// ══════════════════════════════════════════════
// WIZARD COMPONENT
// ══════════════════════════════════════════════

export function NewAssignmentWizard() {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState<WizardState>({
    buyerRole: 'individual',
    creatorId: '',
    assignmentClass: 'material',
    scope: '',
    deadline: '',
    acceptanceCriteria: '',
    requiredEvidenceTypes: [],
    reviewWindowDays: 5,
    notes: '',
    assetRights: emptyAssetRights(),
    serviceTerms: emptyServiceTerms(),
    milestones: [],
  })

  // Helpers
  const patch = (partial: Partial<WizardState>) => setForm(prev => ({ ...prev, ...partial }))
  const needsAssetRights = form.assignmentClass === 'material' || form.assignmentClass === 'hybrid'
  const needsServiceTerms = form.assignmentClass === 'service' || form.assignmentClass === 'hybrid'

  const totalBudgetCents = form.milestones.reduce((sum, m) => sum + eurToCents(m.releasableAmountEur), 0)

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return form.creatorId.trim().length > 0
      case 2: return form.scope.trim().length > 0 && form.deadline.length > 0 && form.acceptanceCriteria.trim().length > 0
      case 3: {
        if (needsAssetRights && !form.assetRights.usageRights.trim()) return false
        if (needsServiceTerms && !form.serviceTerms.scopeOfWork.trim()) return false
        return true
      }
      case 4: return form.milestones.length > 0 && form.milestones.every(m => m.title.trim() && m.dueDate && eurToCents(m.releasableAmountEur) > 0)
      default: return true
    }
  }

  const goNext = () => { if (canAdvance() && step < 5) setStep(step + 1) }
  const goBack = () => { if (step > 1) setStep(step - 1) }

  // Issue brief
  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        creatorId: form.creatorId,
        assignmentClass: form.assignmentClass,
        buyerRole: form.buyerRole === 'individual' ? null : form.buyerRole,
        plan: {
          scope: form.scope,
          deadline: form.deadline,
          acceptanceCriteria: form.acceptanceCriteria,
          requiredEvidenceTypes: form.requiredEvidenceTypes,
          reviewWindowDays: form.reviewWindowDays,
          notes: form.notes || null,
        },
        rightsRecord: {
          assetRights: needsAssetRights ? {
            usageRights: form.assetRights.usageRights,
            exclusivityTerms: form.assetRights.exclusivityTerms || null,
            permittedModifications: form.assetRights.permittedModifications || null,
            duration: form.assetRights.duration || null,
            territory: form.assetRights.territory || null,
            publicationScope: form.assetRights.publicationScope || null,
          } : null,
          serviceTerms: needsServiceTerms ? {
            scopeOfWork: form.serviceTerms.scopeOfWork,
            confidentiality: form.serviceTerms.confidentiality || null,
            attendanceObligations: form.serviceTerms.attendanceObligations || null,
            operationalRestrictions: form.serviceTerms.operationalRestrictions || null,
            reimbursementTerms: form.serviceTerms.reimbursementTerms || null,
            liabilityFraming: form.serviceTerms.liabilityFraming || null,
          } : null,
        },
        milestones: form.milestones.map((m, i) => ({
          ordinal: i + 1,
          title: m.title,
          scopeSummary: m.scopeSummary,
          milestoneType: m.milestoneType,
          dueDate: m.dueDate,
          acceptanceCriteria: m.acceptanceCriteria,
          requiredEvidenceTypes: m.requiredEvidenceTypes,
          releasableAmountCents: eurToCents(m.releasableAmountEur),
          partialAcceptancePermitted: m.partialAcceptancePermitted,
          reviewWindowDays: m.reviewWindowDays,
        })),
      }

      const res = await fetch('/api/assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──
  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-[800px] w-full mx-auto px-6">
          <div className="border-2 border-black p-8 text-center">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-3">Assignment Engine</span>
            <h2 className="text-lg font-bold text-black mb-2">Brief Issued</h2>
            <p className="text-[10px] text-black/40 uppercase tracking-widest">The assignment brief has been issued to the creator.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[800px] mx-auto px-6 py-8">
        {/* ── Header ── */}
        <div className="mb-6">
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1">Assignment Engine</span>
          <h1 className="text-lg font-bold text-black">New Assignment</h1>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-stretch mb-8 border-2 border-black">
          {STEPS.map(s => (
            <button
              key={s.num}
              onClick={() => { if (s.num < step) setStep(s.num) }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors border-r border-black/15 last:border-r-0',
                step === s.num
                  ? 'bg-black text-white'
                  : s.num < step
                    ? 'bg-white text-black hover:bg-black/5 cursor-pointer'
                    : 'bg-white text-black/20 cursor-default',
              )}
            >
              <span className={cn(
                'text-[9px] font-bold w-5 h-5 flex items-center justify-center border',
                step === s.num
                  ? 'border-white/30 text-white'
                  : s.num < step
                    ? 'border-black text-black'
                    : 'border-black/15 text-black/20',
              )}>
                {s.num}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.12em]">{s.label}</span>
            </button>
          ))}
        </div>

        {/* ── Step content ── */}
        <div className="mb-8">
          {step === 1 && <StepContext form={form} patch={patch} />}
          {step === 2 && <StepBrief form={form} patch={patch} />}
          {step === 3 && <StepRights form={form} patch={patch} needsAssetRights={needsAssetRights} needsServiceTerms={needsServiceTerms} />}
          {step === 4 && <StepMilestones form={form} patch={patch} totalBudgetCents={totalBudgetCents} />}
          {step === 5 && <StepReview form={form} needsAssetRights={needsAssetRights} needsServiceTerms={needsServiceTerms} totalBudgetCents={totalBudgetCents} />}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="border-2 border-black p-3 mb-4">
            <span className="text-[9px] font-bold uppercase tracking-widest text-black">Error</span>
            <p className="text-[10px] text-black/60 mt-1">{error}</p>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex items-center justify-between border-t-2 border-black pt-4">
          <div>
            {step > 1 && (
              <button
                onClick={goBack}
                className="text-[10px] font-bold uppercase tracking-wider px-4 py-2 border-2 border-black/30 text-black hover:border-black transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft size={12} />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[8px] font-mono text-black/20">
              Step {step} of {STEPS.length}
            </span>
            {step < 5 ? (
              <button
                onClick={goNext}
                disabled={!canAdvance()}
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-4 py-2 border-2 transition-colors flex items-center gap-1.5',
                  canAdvance()
                    ? 'bg-black text-white border-black hover:bg-black/90'
                    : 'bg-black/10 text-black/30 border-black/15 cursor-not-allowed',
                )}
              >
                Next
                <ChevronRight size={12} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-6 py-2 border-2 transition-colors',
                  submitting
                    ? 'bg-black/10 text-black/30 border-black/15 cursor-not-allowed'
                    : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
                )}
              >
                {submitting ? 'Issuing...' : 'Issue Brief'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// STEP 1: CONTEXT
// ══════════════════════════════════════════════

function StepContext({ form, patch }: { form: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Buyer role */}
      <div>
        <SectionLabel label="Buyer Role Context" />
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => patch({ buyerRole: opt.value })}
              className={cn(
                'text-left p-3 border-2 transition-colors',
                form.buyerRole === opt.value
                  ? 'border-black bg-black/[0.02]'
                  : 'border-black/15 hover:border-black/30',
              )}
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-black block">{opt.label}</span>
              <span className="text-[8px] text-black/40 leading-relaxed block mt-1">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Creator ID */}
      <div>
        <SectionLabel label="Creator" />
        <FieldLabel label="Creator ID" />
        <Input
          value={form.creatorId}
          onChange={e => patch({ creatorId: e.target.value })}
          placeholder="Enter creator ID"
          className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
        />
        <span className="text-[8px] text-black/20 mt-1 block">Enter the unique identifier of the creator receiving this assignment.</span>
      </div>

      {/* Assignment class */}
      <div>
        <SectionLabel label="Assignment Class" />
        <div className="flex flex-col gap-2">
          {CLASS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => patch({ assignmentClass: opt.value })}
              className={cn(
                'text-left p-3 border-2 transition-colors flex items-start gap-3',
                form.assignmentClass === opt.value
                  ? 'border-black bg-black/[0.02]'
                  : 'border-black/15 hover:border-black/30',
              )}
            >
              <ClassBadge cls={opt.value} size="md" />
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-black block">{opt.label}</span>
                <span className="text-[8px] text-black/40 leading-relaxed block mt-0.5">{opt.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// STEP 2: BRIEF
// ══════════════════════════════════════════════

function StepBrief({ form, patch }: { form: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const toggleEvidence = (kind: EvidenceItemKind) => {
    const current = form.requiredEvidenceTypes
    const next = current.includes(kind)
      ? current.filter(k => k !== kind)
      : [...current, kind]
    patch({ requiredEvidenceTypes: next })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionLabel label="Plan Definition" />
        <FieldLabel label="Scope" />
        <Textarea
          value={form.scope}
          onChange={e => patch({ scope: e.target.value })}
          placeholder="Describe the assignment scope, deliverables, and expectations..."
          className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Deadline" />
          <Input
            type="date"
            value={form.deadline}
            onChange={e => patch({ deadline: e.target.value })}
            className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
          />
        </div>
        <div>
          <FieldLabel label="Review Window (days)" />
          <Input
            type="number"
            min={1}
            max={30}
            value={form.reviewWindowDays}
            onChange={e => patch({ reviewWindowDays: parseInt(e.target.value) || 5 })}
            className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
          />
        </div>
      </div>

      <div>
        <FieldLabel label="Acceptance Criteria" />
        <Textarea
          value={form.acceptanceCriteria}
          onChange={e => patch({ acceptanceCriteria: e.target.value })}
          placeholder="Define what constitutes acceptable fulfilment..."
          className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs min-h-[60px]"
        />
      </div>

      <div>
        <FieldLabel label="Required Evidence Types" />
        <div className="flex flex-wrap gap-2">
          {EVIDENCE_TYPES.map(ev => (
            <button
              key={ev.value}
              onClick={() => toggleEvidence(ev.value)}
              className={cn(
                'text-[8px] font-bold uppercase tracking-wider px-2.5 py-1.5 border-2 transition-colors',
                form.requiredEvidenceTypes.includes(ev.value)
                  ? 'border-black bg-black text-white'
                  : 'border-black/15 text-black/40 hover:border-black/30',
              )}
            >
              {ev.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel label="Notes (optional)" />
        <Textarea
          value={form.notes}
          onChange={e => patch({ notes: e.target.value })}
          placeholder="Additional notes for the creator..."
          className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs min-h-[48px]"
        />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// STEP 3: RIGHTS
// ══════════════════════════════════════════════

function StepRights({
  form,
  patch,
  needsAssetRights,
  needsServiceTerms,
}: {
  form: WizardState
  patch: (p: Partial<WizardState>) => void
  needsAssetRights: boolean
  needsServiceTerms: boolean
}) {
  const patchAsset = (partial: Partial<AssetRightsForm>) =>
    patch({ assetRights: { ...form.assetRights, ...partial } })
  const patchService = (partial: Partial<ServiceTermsForm>) =>
    patch({ serviceTerms: { ...form.serviceTerms, ...partial } })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <ClassBadge cls={form.assignmentClass} size="md" />
        <span className="text-[8px] text-black/30 uppercase tracking-widest">
          {form.assignmentClass === 'material' ? 'Asset rights required' :
           form.assignmentClass === 'service' ? 'Service terms required' :
           'Asset rights + service terms required'}
        </span>
      </div>

      {/* Asset Rights */}
      {needsAssetRights && (
        <div className="border-2 border-black p-4">
          <SectionLabel label="Asset Rights" />
          <div className="flex flex-col gap-3">
            <div>
              <FieldLabel label="Usage Rights" />
              <Textarea
                value={form.assetRights.usageRights}
                onChange={e => patchAsset({ usageRights: e.target.value })}
                placeholder="Define permitted usage of delivered assets..."
                className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs min-h-[48px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel label="Exclusivity Terms" />
                <Input
                  value={form.assetRights.exclusivityTerms}
                  onChange={e => patchAsset({ exclusivityTerms: e.target.value })}
                  placeholder="e.g. Exclusive for 12 months"
                  className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                />
              </div>
              <div>
                <FieldLabel label="Permitted Modifications" />
                <Input
                  value={form.assetRights.permittedModifications}
                  onChange={e => patchAsset({ permittedModifications: e.target.value })}
                  placeholder="e.g. Crop, colour grade"
                  className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <FieldLabel label="Duration" />
                <Input
                  value={form.assetRights.duration}
                  onChange={e => patchAsset({ duration: e.target.value })}
                  placeholder="e.g. Perpetual"
                  className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                />
              </div>
              <div>
                <FieldLabel label="Territory" />
                <Input
                  value={form.assetRights.territory}
                  onChange={e => patchAsset({ territory: e.target.value })}
                  placeholder="e.g. Worldwide"
                  className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                />
              </div>
              <div>
                <FieldLabel label="Publication Scope" />
                <Input
                  value={form.assetRights.publicationScope}
                  onChange={e => patchAsset({ publicationScope: e.target.value })}
                  placeholder="e.g. Print + digital"
                  className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Terms */}
      {needsServiceTerms && (
        <div className="border-2 border-blue-600 p-4">
          <SectionLabel label="Service Terms" />
          <div className="flex flex-col gap-3">
            <div>
              <FieldLabel label="Scope of Work" />
              <Textarea
                value={form.serviceTerms.scopeOfWork}
                onChange={e => patchService({ scopeOfWork: e.target.value })}
                placeholder="Define the service obligations in detail..."
                className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs min-h-[48px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel label="Confidentiality" />
                <Input
                  value={form.serviceTerms.confidentiality}
                  onChange={e => patchService({ confidentiality: e.target.value })}
                  placeholder="e.g. Full NDA applies"
                  className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                />
              </div>
              <div>
                <FieldLabel label="Attendance Obligations" />
                <Input
                  value={form.serviceTerms.attendanceObligations}
                  onChange={e => patchService({ attendanceObligations: e.target.value })}
                  placeholder="e.g. On-site 3 days"
                  className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel label="Operational Restrictions" />
                <Input
                  value={form.serviceTerms.operationalRestrictions}
                  onChange={e => patchService({ operationalRestrictions: e.target.value })}
                  placeholder="e.g. No subcontracting"
                  className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                />
              </div>
              <div>
                <FieldLabel label="Reimbursement Terms" />
                <Input
                  value={form.serviceTerms.reimbursementTerms}
                  onChange={e => patchService({ reimbursementTerms: e.target.value })}
                  placeholder="e.g. Travel expenses covered"
                  className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                />
              </div>
            </div>
            <div>
              <FieldLabel label="Liability Framing" />
              <Input
                value={form.serviceTerms.liabilityFraming}
                onChange={e => patchService({ liabilityFraming: e.target.value })}
                placeholder="e.g. Limited to assignment value"
                className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// STEP 4: MILESTONES
// ══════════════════════════════════════════════

function StepMilestones({
  form,
  patch,
  totalBudgetCents,
}: {
  form: WizardState
  patch: (p: Partial<WizardState>) => void
  totalBudgetCents: number
}) {
  const addMilestone = () => {
    patch({ milestones: [...form.milestones, emptyMilestone()] })
  }

  const removeMilestone = (id: string) => {
    patch({ milestones: form.milestones.filter(m => m.id !== id) })
  }

  const updateMilestone = (id: string, partial: Partial<MilestoneForm>) => {
    patch({
      milestones: form.milestones.map(m =>
        m.id === id ? { ...m, ...partial } : m
      ),
    })
  }

  const toggleMilestoneEvidence = (id: string, kind: EvidenceItemKind) => {
    const ms = form.milestones.find(m => m.id === id)
    if (!ms) return
    const next = ms.requiredEvidenceTypes.includes(kind)
      ? ms.requiredEvidenceTypes.filter(k => k !== kind)
      : [...ms.requiredEvidenceTypes, kind]
    updateMilestone(id, { requiredEvidenceTypes: next })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Budget summary */}
      <div className="flex items-center justify-between border-2 border-black p-3">
        <div>
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25 block">Total Budget</span>
          <span className="text-sm font-bold font-mono text-black">{centsToEurDisplay(totalBudgetCents)}</span>
        </div>
        <div className="text-right">
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25 block">Milestones</span>
          <span className="text-sm font-bold font-mono text-black">{form.milestones.length}</span>
        </div>
      </div>

      {/* Milestone list */}
      {form.milestones.length === 0 ? (
        <EmptyState message="No milestones added" detail="Add at least one milestone to define the assignment schedule." />
      ) : (
        <div className="flex flex-col gap-3">
          {form.milestones.map((ms, idx) => (
            <div key={ms.id} className="border-2 border-black/15 p-4">
              {/* Milestone header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-black bg-black/5 px-2 py-0.5 border border-black/10">
                    #{idx + 1}
                  </span>
                  <MilestoneTypeBadge type={ms.milestoneType} />
                  {eurToCents(ms.releasableAmountEur) > 0 && (
                    <span className="text-[9px] font-mono font-bold text-black">
                      {centsToEurDisplay(eurToCents(ms.releasableAmountEur))}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeMilestone(ms.id)}
                  className="text-black/20 hover:text-black transition-colors p-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel label="Title" />
                    <Input
                      value={ms.title}
                      onChange={e => updateMilestone(ms.id, { title: e.target.value })}
                      placeholder="Milestone title"
                      className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Milestone Type" />
                    <div className="flex gap-1.5">
                      {(['material', 'service'] as MilestoneType[]).map(t => (
                        <button
                          key={t}
                          onClick={() => updateMilestone(ms.id, { milestoneType: t })}
                          className={cn(
                            'text-[8px] font-bold uppercase tracking-wider px-2.5 py-1.5 border-2 transition-colors flex-1',
                            ms.milestoneType === t
                              ? t === 'service' ? 'border-blue-600 bg-blue-600 text-white' : 'border-black bg-black text-white'
                              : 'border-black/15 text-black/30 hover:border-black/30',
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel label="Scope Summary" />
                  <Textarea
                    value={ms.scopeSummary}
                    onChange={e => updateMilestone(ms.id, { scopeSummary: e.target.value })}
                    placeholder="What this milestone covers..."
                    className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs min-h-[40px]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <FieldLabel label="Due Date" />
                    <Input
                      type="date"
                      value={ms.dueDate}
                      onChange={e => updateMilestone(ms.id, { dueDate: e.target.value })}
                      className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Amount (EUR)" />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={ms.releasableAmountEur}
                      onChange={e => updateMilestone(ms.id, { releasableAmountEur: e.target.value })}
                      placeholder="0.00"
                      className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Review Window (days)" />
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={ms.reviewWindowDays}
                      onChange={e => updateMilestone(ms.id, { reviewWindowDays: parseInt(e.target.value) || 5 })}
                      className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs h-9"
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel label="Acceptance Criteria" />
                  <Textarea
                    value={ms.acceptanceCriteria}
                    onChange={e => updateMilestone(ms.id, { acceptanceCriteria: e.target.value })}
                    placeholder="What counts as accepted..."
                    className="rounded-none border-2 border-black/15 focus-visible:border-black focus-visible:ring-0 text-xs min-h-[40px]"
                  />
                </div>

                <div>
                  <FieldLabel label="Required Evidence" />
                  <div className="flex flex-wrap gap-1.5">
                    {EVIDENCE_TYPES.map(ev => (
                      <button
                        key={ev.value}
                        onClick={() => toggleMilestoneEvidence(ms.id, ev.value)}
                        className={cn(
                          'text-[7px] font-bold uppercase tracking-wider px-2 py-1 border transition-colors',
                          ms.requiredEvidenceTypes.includes(ev.value)
                            ? 'border-black bg-black text-white'
                            : 'border-black/15 text-black/30 hover:border-black/25',
                        )}
                      >
                        {ev.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateMilestone(ms.id, { partialAcceptancePermitted: !ms.partialAcceptancePermitted })}
                    className={cn(
                      'w-4 h-4 border-2 flex items-center justify-center transition-colors',
                      ms.partialAcceptancePermitted
                        ? 'border-black bg-black'
                        : 'border-black/15',
                    )}
                  >
                    {ms.partialAcceptancePermitted && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" /></svg>
                    )}
                  </button>
                  <span className="text-[9px] text-black/50">Partial acceptance permitted</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add milestone */}
      <button
        onClick={addMilestone}
        className="border-2 border-dashed border-black/15 hover:border-black/30 py-3 flex items-center justify-center gap-2 transition-colors"
      >
        <Plus size={12} className="text-black/30" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-black/30">Add Milestone</span>
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════
// STEP 5: REVIEW & ISSUE
// ══════════════════════════════════════════════

function StepReview({
  form,
  needsAssetRights,
  needsServiceTerms,
  totalBudgetCents,
}: {
  form: WizardState
  needsAssetRights: boolean
  needsServiceTerms: boolean
  totalBudgetCents: number
}) {
  return (
    <div className="flex flex-col gap-5">
      <SectionLabel label="Assignment Summary" />

      {/* Context */}
      <div className="border-2 border-black p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Context</span>
          <div className="flex-1 border-b border-black/5" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Buyer Role</span>
            <span className="text-[9px] text-black/60">
              {form.buyerRole === 'individual' ? 'Individual Buyer' :
               form.buyerRole === 'content_commit_holder' ? 'Content Commit Holder' :
               form.buyerRole === 'editor' ? 'Editor' : 'Admin'}
            </span>
          </div>
          <div>
            <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Creator</span>
            <span className="text-[9px] font-mono text-black/60">{form.creatorId}</span>
          </div>
          <div>
            <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Class</span>
            <ClassBadge cls={form.assignmentClass} size="sm" />
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="border-2 border-black/15 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Brief</span>
          <div className="flex-1 border-b border-black/5" />
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Scope</span>
            <p className="text-[10px] text-black/70 leading-relaxed mt-0.5">{form.scope}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-1">
            <div>
              <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Deadline</span>
              <span className="text-[9px] font-mono text-black/50">{form.deadline}</span>
            </div>
            <div>
              <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Review Window</span>
              <span className="text-[9px] font-mono text-black/50">{form.reviewWindowDays} days</span>
            </div>
            <div>
              <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Evidence Types</span>
              <span className="text-[8px] text-black/40">
                {form.requiredEvidenceTypes.length > 0
                  ? form.requiredEvidenceTypes.map(e => e.replace(/_/g, ' ')).join(', ')
                  : 'None specified'}
              </span>
            </div>
          </div>
          <div className="mt-1">
            <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Acceptance Criteria</span>
            <p className="text-[10px] text-black/70 leading-relaxed mt-0.5">{form.acceptanceCriteria}</p>
          </div>
          {form.notes && (
            <div className="mt-1">
              <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Notes</span>
              <p className="text-[10px] text-black/50 leading-relaxed mt-0.5">{form.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Rights */}
      <div className="border-2 border-black/15 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Rights</span>
          <div className="flex-1 border-b border-black/5" />
        </div>
        {needsAssetRights && (
          <div className="mb-3">
            <span className="text-[8px] font-bold uppercase tracking-wider text-black block mb-1.5">Asset Rights</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-2 border-l border-black/10">
              <ReviewField label="Usage Rights" value={form.assetRights.usageRights} />
              <ReviewField label="Exclusivity" value={form.assetRights.exclusivityTerms} />
              <ReviewField label="Modifications" value={form.assetRights.permittedModifications} />
              <ReviewField label="Duration" value={form.assetRights.duration} />
              <ReviewField label="Territory" value={form.assetRights.territory} />
              <ReviewField label="Publication Scope" value={form.assetRights.publicationScope} />
            </div>
          </div>
        )}
        {needsServiceTerms && (
          <div>
            <span className="text-[8px] font-bold uppercase tracking-wider text-blue-600 block mb-1.5">Service Terms</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-2 border-l border-blue-600/20">
              <ReviewField label="Scope of Work" value={form.serviceTerms.scopeOfWork} />
              <ReviewField label="Confidentiality" value={form.serviceTerms.confidentiality} />
              <ReviewField label="Attendance" value={form.serviceTerms.attendanceObligations} />
              <ReviewField label="Restrictions" value={form.serviceTerms.operationalRestrictions} />
              <ReviewField label="Reimbursement" value={form.serviceTerms.reimbursementTerms} />
              <ReviewField label="Liability" value={form.serviceTerms.liabilityFraming} />
            </div>
          </div>
        )}
      </div>

      {/* Milestones */}
      <div className="border-2 border-black/15 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Milestones</span>
            <div className="flex-1 border-b border-black/5" />
          </div>
          <span className="text-[8px] font-mono text-black/30">{form.milestones.length} milestone{form.milestones.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex flex-col gap-2">
          {form.milestones.map((ms, idx) => (
            <div key={ms.id} className="flex items-center gap-3 py-1.5 border-b border-black/5 last:border-b-0">
              <span className="text-[8px] font-mono text-black/20 w-5 shrink-0">#{idx + 1}</span>
              <MilestoneTypeBadge type={ms.milestoneType} />
              <span className="text-[9px] text-black flex-1 truncate">{ms.title || 'Untitled'}</span>
              <span className="text-[8px] font-mono text-black/30 shrink-0">{ms.dueDate}</span>
              <span className="text-[9px] font-mono font-bold text-black shrink-0">
                {centsToEurDisplay(eurToCents(ms.releasableAmountEur))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Budget summary */}
      <div className="border-2 border-black p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Total Escrow Required</span>
            <span className="text-lg font-bold font-mono text-black">{centsToEurDisplay(totalBudgetCents)}</span>
          </div>
          <div className="text-right">
            <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">Milestones</span>
            <span className="text-sm font-bold font-mono text-black">{form.milestones.length}</span>
          </div>
        </div>
        <div className="border-t border-black/10 mt-3 pt-2">
          <p className="text-[8px] text-black/30 leading-relaxed">
            Issuing this brief will notify the creator. Once the creator accepts, the escrow capture of {centsToEurDisplay(totalBudgetCents)} will be
            initiated against the buyer payment method. Funds are held in escrow and released per-milestone upon acceptance.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Small helper for review step ──

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">{label}</span>
      <span className="text-[9px] text-black/50">{value || '---'}</span>
    </div>
  )
}
