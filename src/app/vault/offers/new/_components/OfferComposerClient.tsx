// ═══════════════════════════════════════════════════════════════
// Frontfiles — OfferComposerClient (P4 concern 4A.2.C2 Prompt 8 / §F8)
//
// Standalone offer composer at /vault/offers/new. Complements the
// /asset/[id] modal: the modal is asset-scoped single-asset only;
// this composer supports single_asset, asset_pack, single_brief,
// and brief_pack target types per ECONOMIC_FLOW_v1.md §7.
//
// ─── Architecture (§R6-pure) ────────────────────────────────────
//
// Component shell owns form state, session, and router. Pure
// helpers `parseItemsInput` + `buildComposerOfferBody` carry the
// testable logic (IIL — body assembly + validation). Body shape
// mirrors CreateOfferBody at src/app/api/offers/route.ts:57-69.
//
// ─── Scope (§F8) ────────────────────────────────────────────────
//
// Form fields:
//   - target type (single_asset / asset_pack / single_brief / brief_pack)
//   - items (UUIDs for asset-direction; one-per-line for brief slots)
//   - creator ID (UUID)
//   - rights template (4 templates per §F15.1)
//   - gross fee (number, > 0)
//   - currency (EUR v1 lock)
//   - expiry (hours-from-now select, 1h–720h per spec §C.5 range)
//   - note (optional, ≤ 2000 chars)
//
// ─── Styling (§F9 / Canon §4.1–§4.3) ────────────────────────────
//
// Plain HTML inputs. Black borders. No rounded corners. Three-colour
// palette. Destructive maps to black per §D7. Error messages in
// black bold; no red anywhere.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useMemo, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'

import { useSession } from '@/hooks/useSession'
import type { OfferTargetType, RightsTemplateId } from '@/lib/offer'

// ─── Form state + types ─────────────────────────────────────────

type ComposerFormState = {
  targetType: OfferTargetType
  itemsInput: string // one per line for multi; plain text for single
  creatorId: string
  rightsTemplate: RightsTemplateId
  grossFee: string // controlled; parsed on submit
  currency: 'EUR'
  expiryHours: number
  note: string
}

const DEFAULT_FORM_STATE: ComposerFormState = {
  targetType: 'single_asset',
  itemsInput: '',
  creatorId: '',
  rightsTemplate: 'editorial_one_time',
  grossFee: '',
  currency: 'EUR',
  expiryHours: 4,
  note: '',
}

const EXPIRY_OPTIONS: ReadonlyArray<{ hours: number; label: string }> = [
  { hours: 1, label: '1 hour' },
  { hours: 4, label: '4 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 720, label: '30 days' },
] as const

const TARGET_TYPE_LABELS: Record<OfferTargetType, string> = {
  single_asset: 'Single asset',
  asset_pack: 'Asset pack',
  single_brief: 'Single brief',
  brief_pack: 'Brief pack',
}

const RIGHTS_TEMPLATE_LABELS: Record<RightsTemplateId, string> = {
  editorial_one_time: 'Editorial — one-time use',
  editorial_with_archive_12mo: 'Editorial with 12-month archive',
  commercial_restricted: 'Commercial — restricted scope',
  custom: 'Custom (counsel review)',
}

// ─── Pure helpers (testable) ────────────────────────────────────

/**
 * Parse the `itemsInput` textarea into the wire-shape `items[]`
 * array. Asset-direction targets carry UUIDs; brief-direction
 * targets carry brief specs as JSON blobs (one per line). The
 * route handler validates composition via `validatePackComposition`;
 * this function only produces a typed array.
 */
export function parseItemsInput(
  targetType: OfferTargetType,
  rawText: string,
): string[] {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  // single_* target types expect exactly one entry.
  if (targetType === 'single_asset' || targetType === 'single_brief') {
    return lines.slice(0, 1)
  }
  return lines
}

export type ComposerBodyResult =
  | {
      ok: true
      body: {
        creatorId: string
        targetType: OfferTargetType
        grossFee: number
        platformFeeBps: number
        currency: 'EUR'
        rights: {
          template: RightsTemplateId
          params: Record<string, unknown>
          is_transfer: boolean
        }
        expiresAt: string
        note: string
        items: unknown[]
      }
    }
  | { ok: false; error: string }

/**
 * Assemble the POST /api/offers body from the composer form state.
 * Returns `{ ok: false, error }` for client-validation failures
 * (missing required fields, bad numeric amount, empty items list).
 * The server `rpc_create_offer` is the authoritative validator.
 */
export function buildComposerOfferBody(params: {
  form: ComposerFormState
  /** Clock injection for deterministic tests. */
  now?: Date
}): ComposerBodyResult {
  const { form } = params
  const nowMs = params.now?.getTime() ?? Date.now()

  if (form.creatorId.trim().length === 0) {
    return { ok: false, error: 'Enter a creator ID.' }
  }
  const items = parseItemsInput(form.targetType, form.itemsInput)
  if (items.length === 0) {
    return { ok: false, error: 'Enter at least one item.' }
  }
  const grossFee = Number.parseFloat(form.grossFee)
  if (!Number.isFinite(grossFee) || grossFee <= 0) {
    return {
      ok: false,
      error: 'Enter a gross fee greater than zero.',
    }
  }
  if (form.note.length > 2000) {
    return {
      ok: false,
      error: 'Note must be 2000 characters or fewer.',
    }
  }
  const expiresAt = new Date(
    nowMs + form.expiryHours * 60 * 60 * 1000,
  ).toISOString()

  // For asset-direction targets, items are UUID strings already.
  // For brief-direction targets, items must be objects matching the
  // OfferBriefSpec shape. v1 composer enters them as one JSON blob
  // per line; we parse each line.
  let parsedItems: unknown[]
  if (
    form.targetType === 'single_asset' ||
    form.targetType === 'asset_pack'
  ) {
    parsedItems = items
  } else {
    try {
      parsedItems = items.map((line) => JSON.parse(line))
    } catch {
      return {
        ok: false,
        error: 'Brief items must be valid JSON, one per line.',
      }
    }
  }

  return {
    ok: true,
    body: {
      creatorId: form.creatorId.trim(),
      targetType: form.targetType,
      grossFee,
      platformFeeBps: 2000,
      currency: form.currency,
      rights: {
        template: form.rightsTemplate,
        params: {
          publication_name: 'Frontfiles Standard',
          territory: 'worldwide',
        },
        is_transfer: false,
      },
      expiresAt,
      note: form.note,
      items: parsedItems,
    },
  }
}

// ─── Styling ────────────────────────────────────────────────────

const LABEL_CLASS =
  'block text-[10px] font-bold uppercase tracking-widest text-black mb-1'
const INPUT_CLASS =
  'border border-black px-3 py-2 w-full text-sm text-black disabled:opacity-50'
const BUTTON_CLASS = [
  'border border-black px-4 py-2',
  'text-[10px] font-bold uppercase tracking-widest text-black',
  'hover:bg-black hover:text-white transition-colors',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black',
].join(' ')

// ─── Component ──────────────────────────────────────────────────

export default function OfferComposerClient({
  initialAssetId,
}: {
  initialAssetId: string | null
}): ReactElement {
  const router = useRouter()
  const { accessToken, status } = useSession()

  const initialForm = useMemo<ComposerFormState>(
    () =>
      initialAssetId !== null
        ? { ...DEFAULT_FORM_STATE, itemsInput: initialAssetId }
        : DEFAULT_FORM_STATE,
    [initialAssetId],
  )
  const [form, setForm] = useState<ComposerFormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof ComposerFormState>(
    key: K,
    value: ComposerFormState[K],
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (error !== null) setError(null)
  }

  async function handleSubmit(): Promise<void> {
    if (accessToken === null) {
      setError('Sign in to submit an offer.')
      return
    }
    const assembled = buildComposerOfferBody({ form })
    if (!assembled.ok) {
      setError(assembled.error)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(assembled.body),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        setError(body?.error?.message ?? 'Could not submit offer.')
        setSubmitting(false)
        return
      }
      const result = (await res.json()) as { data: { offerId: string } }
      router.push(`/vault/offers/${result.data.offerId}`)
    } catch {
      setError('Could not submit offer.')
      setSubmitting(false)
    }
  }

  if (status === 'unauthenticated') {
    return (
      <div className="max-w-3xl mx-auto bg-white p-6">
        <p className="text-sm text-black">Sign in to compose an offer.</p>
      </div>
    )
  }

  const isAssetTarget =
    form.targetType === 'single_asset' || form.targetType === 'asset_pack'

  return (
    <div className="max-w-3xl mx-auto bg-white p-6">
      <h1 className="text-lg font-bold uppercase tracking-widest text-black border-b border-black pb-3 mb-6">
        New offer
      </h1>

      <div className="flex flex-col gap-4">
        <label className="block">
          <span className={LABEL_CLASS}>Target type</span>
          <select
            value={form.targetType}
            onChange={(e) =>
              update('targetType', e.target.value as OfferTargetType)
            }
            disabled={submitting}
            className={INPUT_CLASS}
          >
            {(Object.keys(TARGET_TYPE_LABELS) as OfferTargetType[]).map(
              (t) => (
                <option key={t} value={t}>
                  {TARGET_TYPE_LABELS[t]}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>
            {isAssetTarget ? 'Asset UUIDs (one per line)' : 'Brief specs (one JSON per line)'}
          </span>
          <textarea
            value={form.itemsInput}
            onChange={(e) => update('itemsInput', e.target.value)}
            disabled={submitting}
            rows={4}
            className={INPUT_CLASS}
            placeholder={
              isAssetTarget
                ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
                : '{"title":"Front-page illo","deadline_offset_days":7,"deliverable_format":"illustration_vector","revision_cap":2}'
            }
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Creator ID (UUID)</span>
          <input
            type="text"
            value={form.creatorId}
            onChange={(e) => update('creatorId', e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Rights template</span>
          <select
            value={form.rightsTemplate}
            onChange={(e) =>
              update('rightsTemplate', e.target.value as RightsTemplateId)
            }
            disabled={submitting}
            className={INPUT_CLASS}
          >
            {(Object.keys(RIGHTS_TEMPLATE_LABELS) as RightsTemplateId[]).map(
              (t) => (
                <option key={t} value={t}>
                  {RIGHTS_TEMPLATE_LABELS[t]}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Gross fee (EUR)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.grossFee}
            onChange={(e) => update('grossFee', e.target.value)}
            disabled={submitting}
            className={`${INPUT_CLASS} font-mono`}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Expires in</span>
          <select
            value={form.expiryHours}
            onChange={(e) => update('expiryHours', Number(e.target.value))}
            disabled={submitting}
            className={INPUT_CLASS}
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.hours} value={opt.hours}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Note (optional)</span>
          <textarea
            value={form.note}
            onChange={(e) => update('note', e.target.value)}
            disabled={submitting}
            maxLength={2000}
            rows={3}
            className={INPUT_CLASS}
          />
          <span className="block text-[10px] text-black mt-1">
            {form.note.length} / 2000
          </span>
        </label>

        {error !== null && (
          <p className="text-black text-sm font-bold">{error}</p>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t border-black">
          <button
            type="button"
            onClick={() => router.push('/vault/offers')}
            disabled={submitting}
            className={BUTTON_CLASS}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={BUTTON_CLASS}
          >
            {submitting ? 'Submitting…' : 'Submit offer'}
          </button>
        </div>
      </div>
    </div>
  )
}
