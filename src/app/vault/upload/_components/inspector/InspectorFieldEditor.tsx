/**
 * Frontfiles Upload V4 — Inspector Field Editor (D2.4 §1.1)
 *
 * Spec: UX-SPEC-V4 §5.2 (progressive disclosure) + §11.2 (per-field AI
 * accept lives ONLY here).
 *
 * Adapted from C2.6's SideDetailPanel FieldEditor (now dormant). Differences:
 *   - Always-visible: Title, Caption, Price, Privacy
 *   - Collapsible (closed by default per IPD4-3): Tags, Geography, Licences
 *
 * Per UX-SPEC-V4 §11.1: high-confidence proposals auto-accepted at hydration.
 * Ghost text + ✓ + ↻ only render for low-confidence fields (where the
 * editable value is empty AND a proposal value exists).
 *
 * Inline-save: every change dispatches UPDATE_ASSET_FIELD; no save button.
 */

'use client'

import { useState } from 'react'
import { useUploadContext } from '../UploadContext'
import type { V2Asset, AssetEditableFields } from '@/lib/upload/v3-types'
import type { PrivacyState, LicenceType } from '@/lib/upload/types'
import { LICENCE_TYPE_LABELS } from '@/lib/upload/types'
import InspectorAcceptRow from './InspectorAcceptRow'

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

const FIELD_INPUT =
  'border border-black px-2 py-1 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 min-w-0'

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

  // Ghost flags — only render ✓ + ↻ when editable is empty AND proposal has content.
  const hasTitleGhost = !asset.editable.title && !!asset.proposal?.title
  const hasCaptionGhost = !asset.editable.description && !!asset.proposal?.description
  const hasTagsGhost = asset.editable.tags.length === 0 && (asset.proposal?.tags?.length ?? 0) > 0
  const hasGeoGhost =
    asset.editable.geography.length === 0 && (asset.proposal?.geography?.length ?? 0) > 0
  const hasPriceGhost = asset.editable.price === null && !!asset.proposal?.priceSuggestion

  return (
    <div className="border-b border-black p-3 flex flex-col gap-2 min-w-0 flex-shrink-0">
      {/* Title — always visible */}
      <Field label="Title">
        <div className="flex items-start gap-1.5 min-w-0">
          <input
            type="text"
            value={asset.editable.title}
            onChange={e => update('title', e.target.value)}
            className={`${FIELD_INPUT} flex-1 ${hasTitleGhost ? 'italic text-slate-500' : ''}`}
            placeholder={asset.proposal?.title ?? ''}
          />
          {hasTitleGhost && (
            <InspectorAcceptRow
              onAccept={() => update('title', asset.proposal!.title)}
              onRegen={() => regenerate('title')}
              regenerating={regenerating === 'title'}
              acceptTitle="Accept AI title"
            />
          )}
        </div>
      </Field>

      {/* Caption — always visible */}
      <Field label="Caption">
        <div className="flex items-start gap-1.5 min-w-0">
          <textarea
            value={asset.editable.description}
            onChange={e => update('description', e.target.value)}
            rows={3}
            className={`${FIELD_INPUT} resize-y flex-1 ${hasCaptionGhost ? 'italic text-slate-500' : ''}`}
            placeholder={asset.proposal?.description ?? ''}
          />
          {hasCaptionGhost && (
            <InspectorAcceptRow
              onAccept={() => update('description', asset.proposal!.description)}
              onRegen={() => regenerate('caption')}
              regenerating={regenerating === 'caption'}
              acceptTitle="Accept AI caption"
            />
          )}
        </div>
      </Field>

      {/* Price — always visible */}
      <Field label="Price (EUR)">
        <div className="flex items-start gap-1.5 min-w-0">
          <input
            type="number"
            step="0.01"
            min="0"
            value={asset.editable.price !== null ? (asset.editable.price / 100).toFixed(2) : ''}
            onChange={e => {
              const raw = e.target.value
              if (raw === '') {
                update('price', null)
                return
              }
              const cents = Math.round(parseFloat(raw) * 100)
              if (Number.isFinite(cents) && cents >= 0) update('price', cents)
            }}
            placeholder={
              asset.proposal?.priceSuggestion
                ? (asset.proposal.priceSuggestion.amount / 100).toFixed(2)
                : ''
            }
            className={`${FIELD_INPUT} font-mono w-32 ${hasPriceGhost ? 'italic text-slate-500' : ''}`}
          />
          {hasPriceGhost && (
            <InspectorAcceptRow
              onAccept={() => update('price', asset.proposal!.priceSuggestion!.amount)}
              onRegen={() => regenerate('price')}
              regenerating={regenerating === 'price'}
              acceptTitle="Accept engine price"
            />
          )}
        </div>
      </Field>

      {/* Privacy — always visible */}
      <Field label="Privacy">
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
      >
        <div className="flex items-start gap-1.5 min-w-0">
          <input
            type="text"
            value={asset.editable.tags.join(', ')}
            onChange={e =>
              update(
                'tags',
                e.target.value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              )
            }
            className={`${FIELD_INPUT} flex-1 ${hasTagsGhost ? 'italic text-slate-500' : ''}`}
            placeholder={hasTagsGhost ? asset.proposal!.tags.join(', ') : 'comma-separated'}
          />
          {hasTagsGhost && (
            <InspectorAcceptRow
              onAccept={() => update('tags', asset.proposal!.tags)}
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
      >
        <div className="flex items-start gap-1.5 min-w-0">
          <input
            type="text"
            value={asset.editable.geography.join(', ')}
            onChange={e =>
              update(
                'geography',
                e.target.value
                  .split(',')
                  .map(g => g.trim())
                  .filter(Boolean),
              )
            }
            className={`${FIELD_INPUT} flex-1 ${hasGeoGhost ? 'italic text-slate-500' : ''}`}
            placeholder={
              hasGeoGhost ? asset.proposal!.geography.join(', ') : 'comma-separated place names'
            }
          />
          {hasGeoGhost && (
            <InspectorAcceptRow
              onAccept={() => update('geography', asset.proposal!.geography)}
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
      >
        <div className="grid grid-cols-2 gap-1">
          {LICENCE_OPTIONS.map(l => {
            const checked = asset.editable.licences.includes(l)
            return (
              <label
                key={l}
                className="flex items-center gap-1.5 text-xs text-black cursor-pointer"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  )
}

/**
 * Closed-by-default collapsible section. Toggle button on top, content
 * indented below when open. Optional badge in the top-right (e.g., a count).
 */
function Collapsible({
  label,
  open,
  onToggle,
  badge,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-black bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span>{open ? '▼' : '▶'}</span>
          <span>{label}</span>
        </span>
        {badge !== undefined && (
          <span className="text-slate-500 font-mono">{badge}</span>
        )}
      </button>
      {open && <div className="px-2 pb-2 pt-1">{children}</div>}
    </div>
  )
}
