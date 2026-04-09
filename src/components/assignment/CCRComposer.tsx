'use client'

/**
 * CCR Composer — Submit or respond to Commission Change Requests
 *
 * Used by both buyer and creator.
 * Submit form: amend fields, rationale.
 * Response form: approve or reject pending CCR.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import { getPendingCCR, centsToEur } from '@/lib/assignment/selectors'
import type { CCRAmendedField } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  SectionLabel,
  FieldLabel,
  CCRStateBadge,
  RelativeDeadline,
  ShortDate,
  EmptyState,
  PermissionNotice,
} from './shared'

export function CCRComposer() {
  const { state, dispatch } = useAssignment()
  const a = state.assignment
  if (!a) return null

  const pendingCCR = getPendingCCR(a)

  return (
    <div>
      {/* Pending CCR — response form */}
      {pendingCCR && <CCRResponseForm />}

      {/* CCR History */}
      <section className="mb-6">
        <SectionLabel label={`CCR history (${a.ccrHistory.length})`} />
        {a.ccrHistory.length === 0 ? (
          <EmptyState message="No change requests" detail="Either party may submit a CCR when in progress or delivered" />
        ) : (
          <div className="flex flex-col gap-0">
            {a.ccrHistory.map((ccr, i) => (
              <div key={ccr.id} className={cn('border-2 border-black p-4', i > 0 && '-mt-[2px]')}>
                <div className="flex items-center gap-2 mb-2">
                  <CCRStateBadge state={ccr.state} />
                  <span className="text-[8px] text-black/25">
                    by {ccr.requesterId === a.buyerId ? 'Buyer' : 'Creator'} · <ShortDate iso={ccr.createdAt} />
                  </span>
                  {ccr.state === 'pending' && (
                    <span className="text-[8px] text-black/40 ml-auto">
                      Deadline: <RelativeDeadline iso={ccr.responseDeadline} />
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1 mb-2">
                  {ccr.amendedFields.map((f, j) => (
                    <div key={j} className="flex items-center gap-2 text-[9px]">
                      <span className="font-bold text-black/50 uppercase tracking-wider">{f.field}</span>
                      <span className="text-black/25 line-through">{f.currentValue}</span>
                      <span className="text-black/25">→</span>
                      <span className="text-black font-bold">{f.proposedValue}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-black/60 leading-relaxed">{ccr.rationale}</p>

                {ccr.responseNote && (
                  <div className="mt-2 pt-2 border-t border-black/10">
                    <FieldLabel label="Response" />
                    <p className="text-[10px] text-black/60">{ccr.responseNote}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Submit new CCR form */}
      {!pendingCCR && state.ui.showCCRForm && <CCRSubmitForm />}

      {/* Show CCR form button */}
      {!pendingCCR && !state.ui.showCCRForm && (
        <Button
          variant="outline"
          onClick={() => dispatch({ type: 'SHOW_CCR_FORM', show: true })}
          className="text-[10px] uppercase tracking-wider"
        >
          Submit change request
        </Button>
      )}
    </div>
  )
}

function CCRSubmitForm() {
  const { state, dispatch } = useAssignment()
  const a = state.assignment!

  const [fields, setFields] = useState<CCRAmendedField[]>([
    { field: '', currentValue: '', proposedValue: '' },
  ])
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function addField() {
    setFields([...fields, { field: '', currentValue: '', proposedValue: '' }])
  }

  function removeField(i: number) {
    setFields(fields.filter((_, j) => j !== i))
  }

  function updateField(i: number, key: keyof CCRAmendedField, value: string) {
    setFields(fields.map((f, j) => j === i ? { ...f, [key]: value } : f))
  }

  const valid = fields.every(f => f.field && f.currentValue && f.proposedValue) && rationale.length > 0

  async function handleSubmit() {
    if (!valid) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/assignment/${a.id}/ccr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          requesterId: a.creatorId, // mock: assumes creator is submitting
          amendedFields: fields,
          rationale,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        dispatch({ type: 'LOAD_ASSIGNMENT', assignment: data })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border-2 border-black mb-6">
      <div className="px-4 py-3 border-b-2 border-black bg-black">
        <span className="text-sm font-bold text-white uppercase tracking-wide">New change request</span>
      </div>
      <div className="p-4">
        <SectionLabel label="Amended fields" />
        <div className="flex flex-col gap-3 mb-4">
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
              <div>
                <FieldLabel label="Field" />
                <Input
                  value={f.field}
                  onChange={e => updateField(i, 'field', e.target.value)}
                  placeholder="e.g. deadline, scope, price"
                  className="text-xs"
                />
              </div>
              <div>
                <FieldLabel label="Current value" />
                <Input
                  value={f.currentValue}
                  onChange={e => updateField(i, 'currentValue', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <FieldLabel label="Proposed value" />
                <Input
                  value={f.proposedValue}
                  onChange={e => updateField(i, 'proposedValue', e.target.value)}
                  className="text-xs"
                />
              </div>
              {fields.length > 1 && (
                <button
                  onClick={() => removeField(i)}
                  className="text-[9px] text-black/30 hover:text-black px-2 py-2"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addField}
          className="text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:text-black mb-4"
        >
          + Add field
        </button>

        <SectionLabel label="Rationale" />
        <Textarea
          value={rationale}
          onChange={e => setRationale(e.target.value)}
          placeholder="Explain why this change is needed"
          className="text-xs mb-4"
        />

        <PermissionNotice>
          The counterparty has 5 business days to respond. If no response is received, the CCR is auto-denied.
        </PermissionNotice>

        <div className="flex items-center gap-2 mt-4">
          <Button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="text-[10px] uppercase tracking-wider"
          >
            {submitting ? 'Submitting…' : 'Submit CCR'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => dispatch({ type: 'SHOW_CCR_FORM', show: false })}
            className="text-[10px] uppercase tracking-wider"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

function CCRResponseForm() {
  const { state, dispatch } = useAssignment()
  const a = state.assignment!
  const ccr = getPendingCCR(a)!

  const [responseNote, setResponseNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleRespond(action: 'approve' | 'reject') {
    setSubmitting(true)
    try {
      const responderId = ccr.requesterId === a.buyerId ? a.creatorId : a.buyerId
      const res = await fetch(`/api/assignment/${a.id}/ccr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ccrId: ccr.id,
          responderId,
          responseNote,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        dispatch({ type: 'LOAD_ASSIGNMENT', assignment: data })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border-2 border-blue-600 mb-6">
      <div className="px-4 py-3 border-b-2 border-blue-600 bg-blue-600">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Pending change request</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CCRStateBadge state={ccr.state} />
          <span className="text-[8px] text-black/25">
            from {ccr.requesterId === a.buyerId ? 'Buyer' : 'Creator'}
          </span>
          <span className="ml-auto">
            <RelativeDeadline iso={ccr.responseDeadline} />
          </span>
        </div>

        <div className="flex flex-col gap-1 mb-3">
          {ccr.amendedFields.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[9px]">
              <span className="font-bold text-black/50 uppercase tracking-wider">{f.field}</span>
              <span className="text-black/25 line-through">{f.currentValue}</span>
              <span className="text-black/25">→</span>
              <span className="text-black font-bold">{f.proposedValue}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-black/60 leading-relaxed mb-4">{ccr.rationale}</p>

        <FieldLabel label="Response note" />
        <Textarea
          value={responseNote}
          onChange={e => setResponseNote(e.target.value)}
          placeholder="Add response note"
          className="text-xs mb-4"
        />

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleRespond('approve')}
            disabled={submitting}
            className="text-[10px] uppercase tracking-wider"
          >
            Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => handleRespond('reject')}
            disabled={submitting}
            className="text-[10px] uppercase tracking-wider"
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  )
}
