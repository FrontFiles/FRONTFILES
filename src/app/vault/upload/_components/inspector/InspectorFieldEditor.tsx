/**
 * Frontfiles Upload V4 — Inspector Field Editor (D2.4 §1.1, D2.9 Move 8)
 *
 * Spec: UX-SPEC-V4 §5.2 (progressive disclosure) + §11.2 (per-field AI
 * accept lives ONLY here) + D2.9-DIRECTIVE.md §3 Move 8 (AI provenance
 * tagging).
 *
 * D2.9 changes (vs D2.4):
 *   - InspectorAcceptRow extracted helper REMOVED. The [✓][↻] button pair
 *     is now inline (small `ApproveRegen` helper at file scope).
 *   - Each editable field renders: <label> → <FieldProvenanceTag/> →
 *     <input>, with the tag showing "AI generated" / "Edited by creator"
 *     based on the asset.editable.metadataSource[field] state machine.
 *   - "Ghost" pattern changed: instead of HTML placeholder + plain editable
 *     value, the input's actual `value` attribute carries the proposal
 *     value (visually muted via italic + slate-500) when source !== 'creator'
 *     AND editable[field] is empty AND proposal[field] exists. First
 *     creator interaction (typing OR clicking ✓) commits via
 *     UPDATE_ASSET_FIELD, the reducer flips source to 'creator', and the
 *     muted styling drops on next render.
 *   - [✓][↻] now renders whenever source !== 'creator' AND a proposal
 *     exists — including after auto-accept (so creators can explicitly
 *     stamp ownership of an AI-suggested caption / tags / geography that
 *     was auto-accepted at hydration). After ✓ click, source flips to
 *     'creator' and the pair disappears.
 *
 * Founder lock L6 preserved: title + price never auto-accepted at
 * hydration (D2.1 sweep excludes them). For those fields, source starts
 * as `undefined` when proposal exists; the input shows the proposal as a
 * muted ghost without writing to editable.X. First creator interaction
 * commits.
 *
 * Inline-save: every change dispatches UPDATE_ASSET_FIELD; no save button.
 */

'use client'

import { useState } from 'react'
import { useUploadContext } from '../UploadContext'
import type { V2Asset, AssetEditableFields } from '@/lib/upload/v3-types'
import type { PrivacyState, LicenceType } from '@/lib/upload/types'
import { LICENCE_TYPE_LABELS } from '@/lib/upload/types'
import FieldProvenanceTag from './FieldProvenanceTag'

const PRIVACY_OPTIONS: PrivacyState[] = ['PUBLIC', 'RESTRICTED', 'PRIVATE']
const LICENCE_OPTIONS: LicenceType[] = [
  'editorial',
  'commercial',
  'broadcast',
  'print',
  'digital',
  'web',
  'merchandise',
]

// D2.9 Move 3: field-input borders descend from black to slate-300.
// Kills the admin-form feel; the inputs now read as quiet content slots
// rather than aggressive form fields.
const FIELD_INPUT =
  'border border-slate-300 px-2 py-1 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 min-w-0'

const REGEN_FEEDBACK_MS = 600

type RegenField = 'title' | 'caption' | 'tags' | 'geography' | 'price'

interface Props {
  asset: V2Asset
}

export default function InspectorFieldEditor({ asset }: Props) {
  const { dispatch } = useUploadContext()
  const [regenerating, setRegenerating] = useState<RegenField | null>(null)

  // Collapsible-section local state (per IPD4-3 default = all closed).
  const [tagsOpen, setTagsOpen] = useState(false)
  const [geoOpen, setGeoOpen] = useState(false)
  const [licencesOpen, setLicencesOpen] = useState(false)

  function update<K extends keyof AssetEditableFields>(
    field: K,
    value: AssetEditableFields[K],
  ): void {
    dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field, value })
  }

  function regenerate(field: RegenField) {
    dispatch({
      type: 'REGENERATE_PROPOSAL',
      assetId: asset.id,
      field:
        field === 'title' || field === 'geography' ? 'tags' : (field as 'caption' | 'tags' | 'price'),
    })
    setRegenerating(field)
    setTimeout(() => setRegenerating(null), REGEN_FEEDBACK_MS)
  }

  // ── Per-field provenance state (D2.9 Move 8) ──
  //
  // For each field that has a proposal-layer counterpart, compute:
  //   source              — current metadataSource[field] value
  //   hasProposal         — whether a proposal exists for this field
  //   isEmpty             — whether editable[field] is unset (per type)
  //   showsProposal       — whether the input renders the proposal as a
  //                         muted ghost value (source !== 'creator' AND
  //                         editable empty AND proposal exists)
  //   hasApprove          — whether [✓][↻] should render (source !==
  //                         'creator' AND proposal exists)
  //
  // Privacy + Licences have no proposal layer — only the tag varies.

  const ms = asset.editable.metadataSource

  const titleProposal = asset.proposal?.title
  const titleSource = ms.title
  const titleHasProposal = !!titleProposal
  const titleIsEmpty = !asset.editable.title
  const titleShowsProposal = titleSource !== 'creator' && titleIsEmpty && titleHasProposal
  const titleHasApprove = titleSource !== 'creator' && titleHasProposal
  const titleDisplayValue = titleShowsProposal ? titleProposal! : asset.editable.title

  const captionProposal = asset.proposal?.description
  const captionSource = ms.description
  const captionHasProposal = !!captionProposal
  const captionIsEmpty = !asset.editable.description
  const captionShowsProposal = captionSource !== 'creator' && captionIsEmpty && captionHasProposal
  const captionHasApprove = captionSource !== 'creator' && captionHasProposal
  const captionDisplayValue = captionShowsProposal ? captionProposal! : asset.editable.description

  const priceProposalCents = asset.proposal?.priceSuggestion?.amount ?? null
  const priceSource = ms.price
  const priceHasProposal = priceProposalCents !== null
  const priceIsEmpty = asset.editable.price === null
  const priceShowsProposal = priceSource !== 'creator' && priceIsEmpty && priceHasProposal
  const priceHasApprove = priceSource !== 'creator' && priceHasProposal
  // Price input is a euro string, not cents. Compute the display string
  // from whichever source applies (proposal cents or editable cents).
  const priceDisplayString = priceShowsProposal
    ? (priceProposalCents! / 100).toFixed(2)
    : asset.editable.price !== null
      ? (asset.editable.price / 100).toFixed(2)
      : ''

  const tagsProposal = asset.proposal?.tags ?? []
  const tagsSource = ms.tags
  const tagsHasProposal = tagsProposal.length > 0
  const tagsIsEmpty = asset.editable.tags.length === 0
  const tagsShowsProposal = tagsSource !== 'creator' && tagsIsEmpty && tagsHasProposal
  const tagsHasApprove = tagsSource !== 'creator' && tagsHasProposal
  const tagsDisplayString = tagsShowsProposal
    ? tagsProposal.join(', ')
    : asset.editable.tags.join(', ')

  const geoProposal = asset.proposal?.geography ?? []
  const geoSource = ms.geography
  const geoHasProposal = geoProposal.length > 0
  const geoIsEmpty = asset.editable.geography.length === 0
  const geoShowsProposal = geoSource !== 'creator' && geoIsEmpty && geoHasProposal
  const geoHasApprove = geoSource !== 'creator' && geoHasProposal
  const geoDisplayString = geoShowsProposal
    ? geoProposal.join(', ')
    : asset.editable.geography.join(', ')

  const privacySource = ms.privacy
  const licencesSource = ms.licences

  return (
    // D2.9 Move 3: section divider descends to slate-200; pt-6 establishes
    // the 24px gap from thumbnail (the "after thumbnail: 24px gap" directive
    // requirement). Other padding stays at 12px (p-3 equivalent).
    <div className="border-b border-slate-200 px-3 pt-6 pb-3 flex flex-col gap-2 min-w-0 flex-shrink-0">
      {/* Title — always visible */}
      <Field
        label="Title"
        provenance={<FieldProvenanceTag source={titleSource} hasProposal={titleHasProposal} />}
      >
        <div className="flex items-start gap-2 min-w-0">
          <input
            type="text"
            value={titleDisplayValue}
            onChange={e => update('title', e.target.value)}
            className={`${FIELD_INPUT} flex-1 ${titleShowsProposal ? 'italic text-slate-500' : ''}`}
          />
          {titleHasApprove && (
            <ApproveRegen
              onAccept={() => update('title', titleProposal!)}
              onRegen={() => regenerate('title')}
              regenerating={regenerating === 'title'}
              acceptTitle="Accept AI title"
            />
          )}
        </div>
      </Field>

      {/* Caption — always visible */}
      <Field
        label="Caption"
        provenance={
          <FieldProvenanceTag source={captionSource} hasProposal={captionHasProposal} />
        }
      >
        <div className="flex items-start gap-2 min-w-0">
          <textarea
            value={captionDisplayValue}
            onChange={e => update('description', e.target.value)}
            rows={3}
            className={`${FIELD_INPUT} resize-y flex-1 ${captionShowsProposal ? 'italic text-slate-500' : ''}`}
          />
          {captionHasApprove && (
            <ApproveRegen
              onAccept={() => update('description', captionProposal!)}
              onRegen={() => regenerate('caption')}
              regenerating={regenerating === 'caption'}
              acceptTitle="Accept AI caption"
            />
          )}
        </div>
      </Field>

      {/* Price — always visible */}
      <Field
        label="Price (EUR)"
        provenance={<FieldProvenanceTag source={priceSource} hasProposal={priceHasProposal} />}
      >
        <div className="flex items-start gap-2 min-w-0">
          <input
            type="number"
            step="0.01"
            min="0"
            value={priceDisplayString}
            onChange={e => {
              const raw = e.target.value
              if (raw === '') {
                update('price', null)
                return
              }
              const cents = Math.round(parseFloat(raw) * 100)
              if (Number.isFinite(cents) && cents >= 0) update('price', cents)
            }}
            className={`${FIELD_INPUT} font-mono w-32 ${priceShowsProposal ? 'italic text-slate-500' : ''}`}
          />
          {priceHasApprove && (
            <ApproveRegen
              onAccept={() => update('price', priceProposalCents!)}
              onRegen={() => regenerate('price')}
              regenerating={regenerating === 'price'}
              acceptTitle="Accept engine price"
            />
          )}
        </div>
      </Field>

      {/* Privacy — always visible (no AI proposal layer) */}
      <Field
        label="Privacy"
        provenance={<FieldProvenanceTag source={privacySource} hasProposal={false} />}
      >
        <select
          value={asset.editable.privacy ?? ''}
          onChange={e => {
            const v = e.target.value
            update('privacy', v === '' ? null : (v as PrivacyState))
          }}
          className={FIELD_INPUT}
        >
          <option value="">— Select —</option>
          {PRIVACY_OPTIONS.map(p => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      {/* ── Collapsibles (closed by default per IPD4-3) ── */}

      <Collapsible
        label="Tags"
        open={tagsOpen}
        onToggle={() => setTagsOpen(o => !o)}
        badge={asset.editable.tags.length > 0 ? `${asset.editable.tags.length}` : undefined}
        provenance={<FieldProvenanceTag source={tagsSource} hasProposal={tagsHasProposal} />}
      >
        <div className="flex items-start gap-2 min-w-0">
          <input
            type="text"
            value={tagsDisplayString}
            onChange={e =>
              update(
                'tags',
                e.target.value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              )
            }
            className={`${FIELD_INPUT} flex-1 ${tagsShowsProposal ? 'italic text-slate-500' : ''}`}
            placeholder="comma-separated"
          />
          {tagsHasApprove && (
            <ApproveRegen
              onAccept={() => update('tags', [...tagsProposal])}
              onRegen={() => regenerate('tags')}
              regenerating={regenerating === 'tags'}
              acceptTitle="Accept AI tags"
            />
          )}
        </div>
      </Collapsible>

      <Collapsible
        label="Geography"
        open={geoOpen}
        onToggle={() => setGeoOpen(o => !o)}
        badge={
          asset.editable.geography.length > 0 ? `${asset.editable.geography.length}` : undefined
        }
        provenance={<FieldProvenanceTag source={geoSource} hasProposal={geoHasProposal} />}
      >
        <div className="flex items-start gap-2 min-w-0">
          <input
            type="text"
            value={geoDisplayString}
            onChange={e =>
              update(
                'geography',
                e.target.value
                  .split(',')
                  .map(g => g.trim())
                  .filter(Boolean),
              )
            }
            className={`${FIELD_INPUT} flex-1 ${geoShowsProposal ? 'italic text-slate-500' : ''}`}
            placeholder="comma-separated place names"
          />
          {geoHasApprove && (
            <ApproveRegen
              onAccept={() => update('geography', [...geoProposal])}
              onRegen={() => regenerate('geography')}
              regenerating={regenerating === 'geography'}
              acceptTitle="Accept AI geography"
            />
          )}
        </div>
      </Collapsible>

      <Collapsible
        label="Licences"
        open={licencesOpen}
        onToggle={() => setLicencesOpen(o => !o)}
        badge={asset.editable.licences.length > 0 ? `${asset.editable.licences.length}` : undefined}
        provenance={<FieldProvenanceTag source={licencesSource} hasProposal={false} />}
      >
        <div className="grid grid-cols-2 gap-1">
          {LICENCE_OPTIONS.map(l => {
            const checked = asset.editable.licences.includes(l)
            return (
              <label
                key={l}
                className="flex items-center gap-2 text-xs text-black cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? asset.editable.licences.filter(x => x !== l)
                      : [...asset.editable.licences, l]
                    update('licences', next)
                  }}
                />
                {LICENCE_TYPE_LABELS[l]}
              </label>
            )
          })}
        </div>
      </Collapsible>
    </div>
  )
}

/**
 * Field row: label (bold uppercase) + optional FieldProvenanceTag
 * (sits right of label per IPD9-1 = (a) → on second thought directive
 * §5.A says "below label, above input"; rendering position revisited:
 * IPD9-1 default = (a) "Below the field label, above the input"). Tag
 * sits on its own line between label and input.
 */
function Field({
  label,
  provenance,
  children,
}: {
  label: string
  provenance?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        {provenance}
      </div>
      {children}
    </label>
  )
}

/**
 * Closed-by-default collapsible section. Toggle button on top, content
 * indented below when open. Optional badge in the top-right (e.g., a count).
 * D2.9: also accepts a `provenance` slot rendered next to the badge.
 */
function Collapsible({
  label,
  open,
  onToggle,
  badge,
  provenance,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  badge?: string
  provenance?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // D2.9 Move 3: collapsible box border descends to slate-300 (was black).
    <div className="border border-slate-300 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span>{open ? '▼' : '▶'}</span>
          <span>{label}</span>
        </span>
        <span className="flex items-center gap-2">
          {provenance}
          {badge !== undefined && <span className="text-slate-500 font-mono">{badge}</span>}
        </span>
      </button>
      {open && <div className="px-2 pb-2 pt-1">{children}</div>}
    </div>
  )
}

/**
 * D2.9 Move 8: inlined ✓ + ↻ button pair (replaces the deleted
 * InspectorAcceptRow.tsx). Renders next to a field that has a proposal
 * the creator hasn't yet taken ownership of (source !== 'creator' AND
 * proposal exists).
 *
 * Click ✓ → dispatch UPDATE_ASSET_FIELD with the proposal value. The
 * reducer flips metadataSource[field] to 'creator', this pair disappears
 * on next render, and the FieldProvenanceTag reads "Edited by creator".
 *
 * Click ↻ → dispatch REGENERATE_PROPOSAL (no-op stub until E2 wires the
 * AI pipeline). Visual feedback only via the `regenerating` prop.
 */
function ApproveRegen({
  onAccept,
  onRegen,
  regenerating,
  acceptTitle,
}: {
  onAccept: () => void
  onRegen: () => void
  regenerating: boolean
  acceptTitle: string
}) {
  return (
    <div className="flex flex-row gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={onAccept}
        title={acceptTitle}
        className="border border-black px-2 py-0.5 text-[10px] font-bold uppercase text-black hover:bg-black hover:text-white transition-colors"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onRegen}
        disabled={regenerating}
        title="Regenerate AI suggestion"
        className={`border border-black px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 hover:bg-slate-200 transition-colors ${
          regenerating ? 'opacity-60 cursor-wait' : ''
        }`}
      >
        {regenerating ? '⟳' : '↻'}
      </button>
    </div>
  )
}
