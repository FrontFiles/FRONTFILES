'use client'

/**
 * Fulfilment Composer — Creator's fulfilment submission form
 *
 * Allows creator to build and submit a fulfilment package for a milestone.
 * Validates evidence requirements against milestone acceptance criteria.
 */

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import { centsToEur } from '@/lib/assignment/selectors'
import type {
  FulfilmentType,
  EvidenceItemKind,
  EvidenceItem,
  ServiceLog,
  FulfilmentSubmission,
} from '@/lib/types'
import {
  SectionLabel,
  FieldLabel,
  MilestoneStateBadge,
  MilestoneTypeBadge,
  MetaChip,
  ActionBar,
  EmptyState,
  PermissionNotice,
} from './shared'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react'

// ══════════════════════════════════════════════
// EVIDENCE DRAFT TYPES
// ══════════════════════════════════════════════

interface EvidenceDraft {
  localId: string
  kind: EvidenceItemKind
  label: string
  description: string
  // vault_asset
  vaultAssetId: string
  // support_document
  fileName: string
  fileRef: string
  // service_log
  serviceLog: {
    date: string
    startTime: string
    endTime: string
    location: string
    role: string
    completedDuties: string
  }
}

const EVIDENCE_KIND_OPTIONS: { value: EvidenceItemKind; label: string }[] = [
  { value: 'vault_asset', label: 'Vault Asset' },
  { value: 'service_log', label: 'Service Log' },
  { value: 'support_document', label: 'Support Document' },
  { value: 'handoff_note', label: 'Handoff Note' },
  { value: 'attendance_confirmation', label: 'Attendance Confirmation' },
  { value: 'time_location_record', label: 'Time / Location Record' },
  { value: 'buyer_acknowledgement', label: 'Buyer Acknowledgement' },
  { value: 'other', label: 'Other' },
]

const FULFILMENT_TYPE_OPTIONS: { value: FulfilmentType; label: string }[] = [
  { value: 'asset', label: 'Asset' },
  { value: 'service', label: 'Service' },
  { value: 'hybrid', label: 'Hybrid' },
]

function createEmptyDraft(): EvidenceDraft {
  return {
    localId: crypto.randomUUID(),
    kind: 'vault_asset',
    label: '',
    description: '',
    vaultAssetId: '',
    fileName: '',
    fileRef: '',
    serviceLog: {
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      role: '',
      completedDuties: '',
    },
  }
}

// ══════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════

export function FulfilmentComposer() {
  const { state, dispatch } = useAssignment()
  const a = state.assignment
  const milestoneId = state.ui.fulfilmentDraftMilestoneId

  // Form state
  const [fulfilmentType, setFulfilmentType] = useState<FulfilmentType>('asset')
  const [evidenceItems, setEvidenceItems] = useState<EvidenceDraft[]>([createEmptyDraft()])
  const [creatorNotes, setCreatorNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Resolve milestone
  const milestone = useMemo(
    () => a?.milestones.find(m => m.id === milestoneId) ?? null,
    [a, milestoneId],
  )

  // Validation: which required evidence types are covered
  const validationSummary = useMemo(() => {
    if (!milestone) return { met: [], unmet: [], isValid: false }
    const required = milestone.requiredEvidenceTypes
    const submittedKinds = new Set(
      evidenceItems
        .filter(e => e.label.trim().length > 0)
        .map(e => e.kind),
    )
    const met = required.filter(k => submittedKinds.has(k))
    const unmet = required.filter(k => !submittedKinds.has(k))
    return { met, unmet, isValid: unmet.length === 0 }
  }, [milestone, evidenceItems])

  // Evidence item handlers
  const addEvidence = useCallback(() => {
    setEvidenceItems(prev => [...prev, createEmptyDraft()])
  }, [])

  const removeEvidence = useCallback((localId: string) => {
    setEvidenceItems(prev => prev.filter(e => e.localId !== localId))
  }, [])

  const updateEvidence = useCallback((localId: string, patch: Partial<EvidenceDraft>) => {
    setEvidenceItems(prev =>
      prev.map(e => (e.localId === localId ? { ...e, ...patch } : e)),
    )
  }, [])

  const updateServiceLog = useCallback(
    (localId: string, patch: Partial<EvidenceDraft['serviceLog']>) => {
      setEvidenceItems(prev =>
        prev.map(e =>
          e.localId === localId
            ? { ...e, serviceLog: { ...e.serviceLog, ...patch } }
            : e,
        ),
      )
    },
    [],
  )

  // Cancel
  const handleCancel = useCallback(() => {
    dispatch({ type: 'SHOW_FULFILMENT_FORM', milestoneId: null })
  }, [dispatch])

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!milestone || !a) return
    if (!validationSummary.isValid) return

    setSubmitting(true)
    setSubmitError(null)

    const builtEvidence: EvidenceItem[] = evidenceItems
      .filter(e => e.label.trim().length > 0)
      .map(e => ({
        id: crypto.randomUUID(),
        kind: e.kind,
        label: e.label,
        description: e.description || null,
        vaultAssetId: e.kind === 'vault_asset' ? e.vaultAssetId || null : null,
        fileRef: ['support_document', 'handoff_note'].includes(e.kind) ? e.fileRef || null : null,
        fileName: ['support_document', 'handoff_note'].includes(e.kind) ? e.fileName || null : null,
        fileSizeBytes: null,
        serviceLog:
          e.kind === 'service_log'
            ? {
                date: e.serviceLog.date,
                startTime: e.serviceLog.startTime || null,
                endTime: e.serviceLog.endTime || null,
                location: e.serviceLog.location || null,
                role: e.serviceLog.role,
                completedDuties: e.serviceLog.completedDuties,
              }
            : null,
        createdAt: new Date().toISOString(),
      }))

    const submission: FulfilmentSubmission = {
      id: crypto.randomUUID(),
      milestoneId: milestone.id,
      fulfilmentType,
      evidenceItems: builtEvidence,
      creatorNotes: creatorNotes.trim() || null,
      submittedAt: new Date().toISOString(),
    }

    try {
      const res = await fetch(`/api/assignment/${a.id}/fulfil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneId: milestone.id,
          fulfilmentType,
          evidenceItems: builtEvidence,
          creatorNotes: creatorNotes.trim() || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server returned ${res.status}`)
      }

      dispatch({ type: 'SUBMIT_FULFILMENT', milestoneId: milestone.id, submission })
      dispatch({ type: 'SHOW_FULFILMENT_FORM', milestoneId: null })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }, [a, milestone, fulfilmentType, evidenceItems, creatorNotes, validationSummary, dispatch])

  // ── Guard ──
  if (!a || !milestone) {
    return (
      <div className="border-2 border-black p-4">
        <EmptyState message="No milestone selected" detail="Select a milestone to begin fulfilment" />
      </div>
    )
  }

  return (
    <div className="border-2 border-black">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-black flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-black">
            Submit Fulfilment
          </span>
          <MilestoneTypeBadge type={milestone.milestoneType} />
          <MilestoneStateBadge state={milestone.state} />
        </div>
        <span className="text-xs font-mono text-black/40">
          {centsToEur(milestone.releasableAmountCents)}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-5">
        {/* ── Milestone context ── */}
        <div>
          <SectionLabel label={`Milestone ${milestone.ordinal} — ${milestone.title}`} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Acceptance criteria" />
              <p className="text-[10px] text-black leading-relaxed">{milestone.acceptanceCriteria}</p>
            </div>
            <div>
              <FieldLabel label="Required evidence types" />
              <div className="flex flex-wrap gap-1">
                {milestone.requiredEvidenceTypes.map(t => (
                  <span
                    key={t}
                    className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border border-blue-600/30 text-blue-600/60"
                  >
                    {t.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <MetaChip label="Scope" value={milestone.scopeSummary} />
            <MetaChip label="Due" value={new Date(milestone.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
          </div>
        </div>

        {/* ── Fulfilment type selector ── */}
        <div>
          <SectionLabel label="Fulfilment type" />
          <div className="flex items-center gap-2">
            {FULFILMENT_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFulfilmentType(opt.value)}
                className={cn(
                  'text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 border-2 transition-colors',
                  fulfilmentType === opt.value
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black/40 border-black/15 hover:border-black/40',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Evidence items ── */}
        <div>
          <SectionLabel label={`Evidence items (${evidenceItems.length})`} />
          <div className="flex flex-col gap-3">
            {evidenceItems.map((item, idx) => (
              <div key={item.localId} className="border border-black/15 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-mono text-black/25">Item {idx + 1}</span>
                  {evidenceItems.length > 1 && (
                    <button
                      onClick={() => removeEvidence(item.localId)}
                      className="text-black/20 hover:text-black transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>

                {/* Kind selector */}
                <div className="mb-2">
                  <FieldLabel label="Evidence kind" />
                  <select
                    value={item.kind}
                    onChange={e => updateEvidence(item.localId, { kind: e.target.value as EvidenceItemKind })}
                    className="w-full h-8 border-2 border-black/15 bg-white text-[10px] px-2 outline-none focus:border-black"
                  >
                    {EVIDENCE_KIND_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Label + description (always shown) */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <FieldLabel label="Label" />
                    <Input
                      value={item.label}
                      onChange={e => updateEvidence(item.localId, { label: e.target.value })}
                      placeholder="Evidence label"
                      className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Description" />
                    <Input
                      value={item.description}
                      onChange={e => updateEvidence(item.localId, { description: e.target.value })}
                      placeholder="Optional description"
                      className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black"
                    />
                  </div>
                </div>

                {/* Kind-specific fields */}
                {item.kind === 'vault_asset' && (
                  <div>
                    <FieldLabel label="Vault asset ID" />
                    <Input
                      value={item.vaultAssetId}
                      onChange={e => updateEvidence(item.localId, { vaultAssetId: e.target.value })}
                      placeholder="asset_xxxxxxxxxxxx"
                      className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black font-mono"
                    />
                  </div>
                )}

                {item.kind === 'service_log' && (
                  <div className="border-t border-black/10 pt-2 mt-1">
                    <FieldLabel label="Service log details" />
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <span className="text-[7px] text-black/20 block mb-0.5">Date</span>
                        <Input
                          type="date"
                          value={item.serviceLog.date}
                          onChange={e => updateServiceLog(item.localId, { date: e.target.value })}
                          className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black"
                        />
                      </div>
                      <div>
                        <span className="text-[7px] text-black/20 block mb-0.5">Start time</span>
                        <Input
                          type="time"
                          value={item.serviceLog.startTime}
                          onChange={e => updateServiceLog(item.localId, { startTime: e.target.value })}
                          className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black"
                        />
                      </div>
                      <div>
                        <span className="text-[7px] text-black/20 block mb-0.5">End time</span>
                        <Input
                          type="time"
                          value={item.serviceLog.endTime}
                          onChange={e => updateServiceLog(item.localId, { endTime: e.target.value })}
                          className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <span className="text-[7px] text-black/20 block mb-0.5">Location</span>
                        <Input
                          value={item.serviceLog.location}
                          onChange={e => updateServiceLog(item.localId, { location: e.target.value })}
                          placeholder="Location"
                          className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black"
                        />
                      </div>
                      <div>
                        <span className="text-[7px] text-black/20 block mb-0.5">Role</span>
                        <Input
                          value={item.serviceLog.role}
                          onChange={e => updateServiceLog(item.localId, { role: e.target.value })}
                          placeholder="Role performed"
                          className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[7px] text-black/20 block mb-0.5">Completed duties</span>
                      <Textarea
                        value={item.serviceLog.completedDuties}
                        onChange={e => updateServiceLog(item.localId, { completedDuties: e.target.value })}
                        placeholder="Describe completed duties"
                        className="!min-h-[48px] !text-[10px] !border-2 !border-black/15 focus:!border-black"
                      />
                    </div>
                  </div>
                )}

                {(item.kind === 'support_document' || item.kind === 'handoff_note') && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <FieldLabel label="File name" />
                      <Input
                        value={item.fileName}
                        onChange={e => updateEvidence(item.localId, { fileName: e.target.value })}
                        placeholder="document.pdf"
                        className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black font-mono"
                      />
                    </div>
                    <div>
                      <FieldLabel label="File reference" />
                      <Input
                        value={item.fileRef}
                        onChange={e => updateEvidence(item.localId, { fileRef: e.target.value })}
                        placeholder="ref_xxxxxxxxxxxx"
                        className="!h-7 !text-[10px] !border-2 !border-black/15 focus:!border-black font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addEvidence}
            className="mt-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-black/30 hover:text-black transition-colors"
          >
            <Plus size={10} />
            Add evidence item
          </button>
        </div>

        {/* ── Creator notes ── */}
        <div>
          <SectionLabel label="Creator notes" />
          <Textarea
            value={creatorNotes}
            onChange={e => setCreatorNotes(e.target.value)}
            placeholder="Optional notes for the reviewer..."
            className="!min-h-[56px] !text-[10px] !border-2 !border-black/15 focus:!border-black"
          />
        </div>

        {/* ── Validation summary ── */}
        <div>
          <SectionLabel label="Validation summary" />
          <div className="border border-black/15 p-3">
            {milestone.requiredEvidenceTypes.length === 0 ? (
              <p className="text-[9px] text-black/30">No specific evidence types required for this milestone.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {validationSummary.met.map(kind => (
                  <div key={kind} className="flex items-center gap-2">
                    <CheckCircle2 size={10} className="text-black shrink-0" />
                    <span className="text-[9px] text-black">{kind.replace(/_/g, ' ')}</span>
                    <span className="text-[7px] font-bold uppercase tracking-wider text-black/25">Met</span>
                  </div>
                ))}
                {validationSummary.unmet.map(kind => (
                  <div key={kind} className="flex items-center gap-2">
                    <XCircle size={10} className="text-black/25 shrink-0" />
                    <span className="text-[9px] text-black/40">{kind.replace(/_/g, ' ')}</span>
                    <span className="text-[7px] font-bold uppercase tracking-wider text-black/15">Missing</span>
                  </div>
                ))}
              </div>
            )}
            {!validationSummary.isValid && milestone.requiredEvidenceTypes.length > 0 && (
              <PermissionNotice>
                All required evidence types must be provided before submission. Missing:{' '}
                {validationSummary.unmet.map(k => k.replace(/_/g, ' ')).join(', ')}.
              </PermissionNotice>
            )}
          </div>
        </div>

        {/* ── Submit error ── */}
        {submitError && (
          <div className="border-2 border-black p-3">
            <p className="text-[9px] text-black font-bold">{submitError}</p>
          </div>
        )}

        {/* ── Actions ── */}
        <ActionBar
          actions={[
            {
              label: 'Submit fulfilment',
              variant: 'primary',
              onClick: handleSubmit,
              disabled: submitting || (!validationSummary.isValid && milestone.requiredEvidenceTypes.length > 0),
              disabledReason: submitting
                ? 'Submitting...'
                : !validationSummary.isValid
                  ? 'Missing required evidence types'
                  : undefined,
            },
            {
              label: 'Cancel',
              variant: 'secondary',
              onClick: handleCancel,
              disabled: submitting,
            },
          ]}
        />
      </div>
    </div>
  )
}
