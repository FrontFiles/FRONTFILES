/**
 * Frontfiles Upload V3 — Side Detail Panel (C2.3 §1.1)
 *
 * Spec: UX-SPEC-V3.md §7 (canonical), C2-PLAN.md §8 (scope), C2.3-DIRECTIVE.md
 *
 * Push-layout panel (NOT overlay — spec §7 explicit). 480px wide, 100% height,
 * slides in from the right edge of the asset-list region. Renders only when
 * `state.ui.sidePanelOpenAssetId` is non-null. UploadShell wraps asset-list
 * and panel in a horizontal flex; the asset list shrinks left when panel mounts.
 *
 * Anatomy (per spec §7.1):
 *   Header     — filename + ✕ close
 *   Thumbnail  — square; uses asset.thumbnailRef OR object-URL of asset.file
 *                OR placeholder (dev fixtures pass file: null)
 *   Fields     — Title / Caption / Tags / Geography / Price / Privacy / Licences
 *                Inline-save: every change dispatches UPDATE_ASSET_FIELD with
 *                the typed field key. No save button (per spec §7.1 + L5).
 *   Exceptions — Lists getAssetExceptions(asset) (filter needs_story per
 *                UX-BRIEF v3 §4.5). Inline DuplicateResolver for likely_duplicate.
 *                Inline conflict resolver buttons for metadata conflicts.
 *   AI detail  — Collapsible shell only; rationale body is C2.5.
 *
 * Keyboard (per spec §7.1 + L6):
 *   Esc — close panel (works even when typing in a field)
 *   J   — NAVIGATE_SIDE_PANEL { direction: 'next' }  (fires only when not in input)
 *   K   — NAVIGATE_SIDE_PANEL { direction: 'prev' }
 *
 * Defensive auto-close (IPIII-3 + IPIII-5):
 *   - density transitions into 'linear' → CLOSE_SIDE_PANEL (Linear is panel-free per L4)
 *   - open id no longer in assetsById → CLOSE_SIDE_PANEL (stale id guard)
 *
 * Per IPIII-7: AI Proposal Detail section is a collapsible shell only.
 * The body content (caption rationale, price basis, tag confidence) ships in C2.5.
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUploadContext } from './UploadContext'
import { densityForCount } from '@/lib/upload/v3-types'
import { getAssetExceptions } from '@/lib/upload/upload-selectors'
import type { V2Asset, V3State, AssetEditableFields, MetadataConflict } from '@/lib/upload/v3-types'
import type { PrivacyState, LicenceType } from '@/lib/upload/types'
import { LICENCE_TYPE_LABELS } from '@/lib/upload/types'
import DuplicateResolver from './DuplicateResolver'
import PriceBasisPanel from './PriceBasisPanel'

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

export default function SideDetailPanel() {
  const { state, dispatch } = useUploadContext()
  const openId = state.ui.sidePanelOpenAssetId
  const asset = openId ? state.assetsById[openId] : null

  // IPIII-5: stale-id auto-close. If openId is set but the asset no longer
  // exists in the map, close the panel. (IPIII-5 spec: filtered-out !== removed
  // — a hidden asset stays open. Only true removal closes.)
  useEffect(() => {
    if (openId && !asset) {
      dispatch({ type: 'CLOSE_SIDE_PANEL' })
    }
  }, [openId, asset, dispatch])

  // IPIII-3: density-transition-to-Linear auto-close. L4 says Linear is
  // panel-free. If the user deletes assets down into Linear range while the
  // panel is open, dispose of it gracefully.
  const density = densityForCount(state.assetOrder.length)
  useEffect(() => {
    if (density === 'linear' && openId) {
      dispatch({ type: 'CLOSE_SIDE_PANEL' })
    }
  }, [density, openId, dispatch])

  // L6 keyboard handlers. Window-level listener so J/K/Esc work no matter
  // where focus is — but skip J/K when the user is typing in an input/textarea/select
  // (otherwise typing 'j' in caption would navigate away). Esc still closes
  // even from inside a field.
  useEffect(() => {
    if (!openId) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        e.preventDefault()
        dispatch({ type: 'CLOSE_SIDE_PANEL' })
        if (inField) target?.blur()
        return
      }
      if (inField) return // J/K must not steal keystrokes from inputs

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        dispatch({ type: 'NAVIGATE_SIDE_PANEL', direction: 'next' })
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        dispatch({ type: 'NAVIGATE_SIDE_PANEL', direction: 'prev' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, dispatch])

  if (!openId || !asset) return null

  return (
    <aside
      role="complementary"
      aria-label={`Detail panel for ${asset.filename}`}
      data-region="side-panel"
      className="w-[480px] min-w-[480px] max-w-[480px] border-l border-black bg-white flex flex-col overflow-y-auto motion-reduce:transition-none transition-transform duration-150 ease-out"
    >
      <PanelHeader asset={asset} onClose={() => dispatch({ type: 'CLOSE_SIDE_PANEL' })} />
      <Thumbnail asset={asset} />
      <FieldEditor asset={asset} />
      <ExceptionsSection asset={asset} state={state} />
      <AIProposalDetailSection asset={asset} />
    </aside>
  )
}

// ── Header ────────────────────────────────────────────────────────────

function PanelHeader({ asset, onClose }: { asset: V2Asset; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-black px-3 py-2 sticky top-0 bg-white z-10 min-w-0">
      <span className="text-sm font-mono text-black truncate min-w-0" title={asset.filename}>
        {asset.filename}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close side panel"
        className="text-sm text-black border border-black w-6 h-6 flex-shrink-0 flex items-center justify-center hover:bg-black hover:text-white transition-colors"
      >
        ✕
      </button>
    </div>
  )
}

// ── Thumbnail ─────────────────────────────────────────────────────────

function Thumbnail({ asset }: { asset: V2Asset }) {
  // IPIII-12: prefer thumbnailRef (URL string) → object-URL of File → placeholder.
  // Object URLs MUST be revoked when they go out of scope (otherwise the blob
  // sticks around in memory until tab close).
  const url = useMemo<string | null>(() => {
    if (asset.thumbnailRef) return asset.thumbnailRef
    if (asset.file) {
      try {
        return URL.createObjectURL(asset.file)
      } catch {
        return null
      }
    }
    return null
  }, [asset.thumbnailRef, asset.file])

  useEffect(() => {
    return () => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [url])

  return (
    <div className="border-b border-black bg-slate-100 aspect-square flex items-center justify-center overflow-hidden flex-shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={asset.filename} className="w-full h-full object-contain" />
      ) : (
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center px-4">
          {asset.format ?? 'asset'} preview unavailable
          <br />
          <span className="font-mono normal-case text-slate-500">{asset.filename}</span>
        </div>
      )}
    </div>
  )
}

// ── Field editor ─────────────────────────────────────────────────────

const REGEN_FEEDBACK_MS = 600

type RegenField = 'title' | 'caption' | 'tags' | 'geography' | 'price'

function FieldEditor({ asset }: { asset: V2Asset }) {
  const { dispatch } = useUploadContext()
  const [regenerating, setRegenerating] = useState<RegenField | null>(null)

  function update<K extends keyof AssetEditableFields>(
    field: K,
    value: AssetEditableFields[K],
  ): void {
    dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field, value })
  }

  // Per C2.5 IPV-3 (UI stub) + spec §9.4: dispatch the no-op REGENERATE_PROPOSAL
  // (telemetry hook) and show brief feedback. Real regen is E2.
  function regenerate(field: RegenField) {
    dispatch({
      type: 'REGENERATE_PROPOSAL',
      assetId: asset.id,
      // Action shape supports caption/tags/keywords/price; map our 5-field UX.
      field:
        field === 'title' || field === 'geography' ? 'tags' : (field as 'caption' | 'tags' | 'price'),
    })
    setRegenerating(field)
    setTimeout(() => setRegenerating(null), REGEN_FEEDBACK_MS)
  }

  // Per spec §9.1 + L2: ✓ accept icon appears only when the editable value
  // is empty AND the proposal field has content.
  const hasTitleGhost = !asset.editable.title && !!asset.proposal?.title
  const hasCaptionGhost = !asset.editable.description && !!asset.proposal?.description
  const hasTagsGhost = asset.editable.tags.length === 0 && (asset.proposal?.tags?.length ?? 0) > 0
  const hasGeoGhost =
    asset.editable.geography.length === 0 && (asset.proposal?.geography?.length ?? 0) > 0
  const hasPriceGhost = asset.editable.price === null && !!asset.proposal?.priceSuggestion

  return (
    <div className="border-b border-black p-3 flex flex-col gap-2 min-w-0">
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
            <AcceptRow
              onAccept={() => update('title', asset.proposal!.title)}
              onRegen={() => regenerate('title')}
              regenerating={regenerating === 'title'}
              acceptTitle="Accept AI title"
            />
          )}
        </div>
      </Field>

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
            <AcceptRow
              onAccept={() => update('description', asset.proposal!.description)}
              onRegen={() => regenerate('caption')}
              regenerating={regenerating === 'caption'}
              acceptTitle="Accept AI caption"
            />
          )}
        </div>
      </Field>

      <Field label="Tags">
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
            <AcceptRow
              onAccept={() => update('tags', asset.proposal!.tags)}
              onRegen={() => regenerate('tags')}
              regenerating={regenerating === 'tags'}
              acceptTitle="Accept AI tags"
            />
          )}
        </div>
      </Field>

      <Field label="Geography">
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
            <AcceptRow
              onAccept={() => update('geography', asset.proposal!.geography)}
              onRegen={() => regenerate('geography')}
              regenerating={regenerating === 'geography'}
              acceptTitle="Accept AI geography"
            />
          )}
        </div>
      </Field>

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
                ? `${(asset.proposal.priceSuggestion.amount / 100).toFixed(2)}`
                : ''
            }
            className={`${FIELD_INPUT} font-mono w-32 ${hasPriceGhost ? 'italic text-slate-500' : ''}`}
          />
          {hasPriceGhost && (
            <AcceptRow
              onAccept={() => update('price', asset.proposal!.priceSuggestion!.amount)}
              onRegen={() => regenerate('price')}
              regenerating={regenerating === 'price'}
              acceptTitle="Accept engine price"
            />
          )}
        </div>
      </Field>

      <Field label="Privacy">
        <select
          value={asset.editable.privacy ?? ''}
          onChange={e => {
            const v = e.target.value
            update('privacy', (v === '' ? null : (v as PrivacyState)))
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

      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
          Licences
        </div>
        <div className="grid grid-cols-2 gap-1">
          {LICENCE_OPTIONS.map(l => {
            const checked = asset.editable.licences.includes(l)
            return (
              <label key={l} className="flex items-center gap-1.5 text-xs text-black cursor-pointer">
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
      </div>
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

// ── Exceptions section ────────────────────────────────────────────────

function ExceptionsSection({ asset, state }: { asset: V2Asset; state: V3State }) {
  // IPIII-6: list ALL exceptions (UX-BRIEF v3 §4.5: filter needs_story at render).
  const exceptions = getAssetExceptions(asset).filter(e => e.type !== 'needs_story')
  const hasDuplicate = asset.duplicateStatus === 'likely_duplicate'
  const otherDup = asset.duplicateOfId ? state.assetsById[asset.duplicateOfId] : null
  const conflicts = asset.conflicts.filter(c => c.resolvedBy === null)

  if (exceptions.length === 0 && !hasDuplicate && conflicts.length === 0) {
    return (
      <div className="border-b border-black p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Exceptions</div>
        <div className="text-xs text-slate-500 italic mt-1">No active exceptions.</div>
      </div>
    )
  }

  return (
    <div className="border-b border-black p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        Exceptions
      </div>

      {exceptions.length > 0 && (
        <ul className="flex flex-col gap-0.5 mb-2">
          {exceptions.map((e, i) => (
            <li
              key={`${e.type}-${i}`}
              className={`text-xs ${e.severity === 'blocking' ? 'text-black' : 'text-slate-600'}`}
            >
              {e.severity === 'blocking' ? '⚠' : 'ℹ'} {e.label}
            </li>
          ))}
        </ul>
      )}

      {hasDuplicate && otherDup && (
        <DuplicateResolver thisAsset={asset} otherAsset={otherDup} />
      )}

      {conflicts.map((conflict, i) => (
        <ConflictResolver key={`${conflict.field}-${i}`} asset={asset} conflict={conflict} />
      ))}
    </div>
  )
}

function ConflictResolver({ asset, conflict }: { asset: V2Asset; conflict: MetadataConflict }) {
  const { dispatch } = useUploadContext()
  return (
    <div className="border border-black p-2 mt-2 bg-yellow-50">
      <div className="text-[10px] font-bold uppercase tracking-widest text-black mb-1">
        Metadata conflict — {String(conflict.field)}
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'RESOLVE_CONFLICT',
              assetId: asset.id,
              field: conflict.field,
              value: conflict.embeddedValue,
            })
          }
          className="text-xs text-left border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors"
        >
          Use embedded: <span className="font-mono">{conflict.embeddedValue}</span>
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'RESOLVE_CONFLICT',
              assetId: asset.id,
              field: conflict.field,
              value: conflict.aiValue,
            })
          }
          className="text-xs text-left border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors"
        >
          Use AI ({Math.round(conflict.aiConfidence * 100)}%):{' '}
          <span className="font-mono">{conflict.aiValue}</span>
        </button>
      </div>
    </div>
  )
}

// ── Reusable AcceptRow (✓ + ↻) for FieldEditor ───────────────────────

function AcceptRow({
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
    <div className="flex flex-col gap-1 flex-shrink-0">
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

// ── AI Proposal Detail body — per C2.5 §1.1 + spec §7.1 anatomy ───────

function AIProposalDetailSection({ asset }: { asset: V2Asset }) {
  const { state, dispatch } = useUploadContext()
  const [sectionOpen, setSectionOpen] = useState(false)

  // Per IPV-6: independent collapse per row (multiple can be open).
  // The "Price basis" toggle uses the reducer's TOGGLE_PRICE_BASIS_PANEL
  // because the same panel is also reachable from Linear AssetRow (one
  // source of truth for which asset's basis is open).
  const [captionOpen, setCaptionOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const priceOpen = state.ui.priceBasisOpenAssetId === asset.id

  if (!asset.proposal) {
    return (
      <div className="border-b border-black p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          AI Proposal Detail
        </div>
        <div className="text-xs text-slate-500 italic mt-1">No AI proposal for this asset.</div>
      </div>
    )
  }

  const overallConfPct = Math.round(asset.proposal.confidence * 100)

  return (
    <div className="border-b border-black p-3">
      <button
        type="button"
        onClick={() => setSectionOpen(o => !o)}
        className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-black transition-colors flex items-center gap-2"
        aria-expanded={sectionOpen}
      >
        {sectionOpen ? '▼' : '▶'} AI Proposal Detail
      </button>

      {sectionOpen && (
        <div className="mt-2 flex flex-col gap-1 min-w-0">
          {/* Caption rationale row */}
          <DetailRow
            open={captionOpen}
            onToggle={() => setCaptionOpen(o => !o)}
            label="Caption rationale"
          >
            <div className="text-xs text-slate-700">
              {asset.proposal.rationale || (
                <span className="italic text-slate-500">No rationale recorded.</span>
              )}
            </div>
          </DetailRow>

          {/* Price basis row — mounts PriceBasisPanel (per IPV-4) */}
          <DetailRow
            open={priceOpen}
            onToggle={() =>
              dispatch({ type: 'TOGGLE_PRICE_BASIS_PANEL', assetId: asset.id })
            }
            label="Price basis"
            disabled={!asset.proposal.priceSuggestion}
          >
            {asset.proposal.priceSuggestion ? (
              <PriceBasisPanel asset={asset} compact />
            ) : (
              <div className="text-xs text-slate-500 italic">No price suggestion.</div>
            )}
          </DetailRow>

          {/* Tag confidence row */}
          <DetailRow
            open={tagsOpen}
            onToggle={() => setTagsOpen(o => !o)}
            label="Tag confidence"
          >
            <div className="flex flex-col gap-1 text-xs">
              <div className="text-slate-700">
                Overall metadata confidence:{' '}
                <span className="font-mono text-black">{overallConfPct}%</span>
              </div>
              {asset.proposal.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {asset.proposal.tags.map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="text-[10px] font-bold uppercase tracking-widest border border-slate-400 text-slate-700 px-1.5 py-0.5 bg-white"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="italic text-slate-500">No tags suggested.</span>
              )}
            </div>
          </DetailRow>
        </div>
      )}
    </div>
  )
}

function DetailRow({
  open,
  onToggle,
  label,
  disabled = false,
  children,
}: {
  open: boolean
  onToggle: () => void
  label: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="border border-black bg-white">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`w-full text-left px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
          disabled ? 'text-slate-400 cursor-not-allowed' : 'text-black hover:bg-slate-50'
        }`}
        aria-expanded={open}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>{label}</span>
      </button>
      {open && !disabled && <div className="px-2 pb-2">{children}</div>}
    </div>
  )
}
