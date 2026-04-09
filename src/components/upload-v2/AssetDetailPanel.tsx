'use client'

import { cn } from '@/lib/utils'
import { useUploadV2 } from './UploadV2Context'
import { getAssetExceptions, getStoryGroups, getFieldSource, getFieldConflict, centsToEur } from '@/lib/upload/v2-state'
import {
  ASSET_FORMAT_LABELS,
  DECLARATION_STATE_LABELS,
  LICENCE_TYPE_LABELS,
  type LicenceType,
  type PrivacyState,
} from '@/lib/upload/types'
import type { MetadataSource, V2Asset, MetadataConflict, AssetEditableFields } from '@/lib/upload/v2-types'
import {
  AlertTriangle, Info, FileText, Tag, MapPin, Shield, DollarSign, Layers,
  RotateCcw, ShieldCheck, ShieldAlert, ShieldQuestion, Camera, Calendar,
  Fingerprint, Eye, Check, X,
} from 'lucide-react'

const PRIVACY_OPTIONS: PrivacyState[] = ['PUBLIC', 'PRIVATE', 'RESTRICTED']
const LICENCE_OPTIONS: LicenceType[] = ['editorial', 'commercial', 'broadcast', 'print', 'digital', 'web', 'merchandise']

export function AssetDetailPanel() {
  const { state, dispatch } = useUploadV2()
  const groups = getStoryGroups(state)

  const focusedId = state.ui.focusedAssetId
  const asset = focusedId ? state.assetsById[focusedId] : null

  if (!asset) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-slate-300 px-4 text-center">
        Select an asset to view details
      </div>
    )
  }

  const exceptions = getAssetExceptions(asset)
  const blockingExceptions = exceptions.filter(e => e.severity === 'blocking')
  const advisoryExceptions = exceptions.filter(e => e.severity === 'advisory')
  const proposal = asset.proposal
  const em = asset.extractedMetadata
  const unresolvedConflicts = asset.conflicts?.filter(c => c.resolvedBy === null) ?? []

  // Story candidates
  const altCandidates = proposal?.storyCandidates
    ?.filter(c => c.storyGroupId !== asset.storyGroupId && c.score > 0.15)
    ?.sort((a, b) => b.score - a.score)
    ?.slice(0, 3) ?? []

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-3 space-y-3 text-xs">

        {/* ═══════ 1. ASSET HEADER / PREVIEW ═══════ */}
        <div className="border-2 border-black">
          <div className="bg-slate-100 h-28 flex items-center justify-center text-slate-300 overflow-hidden relative">
            {asset.thumbnailRef ? (
              <img src={asset.thumbnailRef} alt={asset.editable.title || asset.filename} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <div className="text-3xl font-bold uppercase">{asset.format?.charAt(0) ?? '?'}</div>
                <div className="text-[10px] font-mono mt-1">{asset.format ? ASSET_FORMAT_LABELS[asset.format] : 'Unknown'}</div>
              </div>
            )}
          </div>
          <div className="px-3 py-2 border-t border-black">
            <div className="font-mono text-[10px] text-slate-400 truncate">{asset.filename}</div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {asset.format && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-100 px-1.5 py-0.5">
                  {ASSET_FORMAT_LABELS[asset.format]}
                </span>
              )}
              {em?.dimensions && (
                <span className="text-[9px] font-mono text-slate-400">{em.dimensions.width}x{em.dimensions.height}</span>
              )}
              {asset.duplicateStatus === 'likely_duplicate' && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5">Duplicate</span>
              )}
              {asset.excluded && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-200 text-slate-500 px-1.5 py-0.5">Excluded</span>
              )}
              {proposal && (
                <span className="text-[9px] font-mono text-slate-400 ml-auto">{Math.round(proposal.confidence * 100)}% conf</span>
              )}
            </div>
          </div>
        </div>

        {/* ═══════ 2. BLOCKERS & EXCEPTIONS ═══════ */}
        {exceptions.length > 0 && (
          <Section label="Exceptions" icon={<AlertTriangle size={10} />} count={exceptions.length}>
            {blockingExceptions.map((e, i) => (
              <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 border-l-2 border-black bg-white">
                <span className="text-[9px] font-bold bg-black text-white px-1 uppercase shrink-0">Block</span>
                <span className="text-[10px]">{e.label}</span>
              </div>
            ))}
            {advisoryExceptions.map((e, i) => (
              <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 border-l border-dashed border-black bg-white">
                <span className="text-[9px] font-bold border border-black text-black px-1 uppercase shrink-0">Warn</span>
                <span className="text-[10px]">{e.label}</span>
              </div>
            ))}
          </Section>
        )}

        {/* ═══════ 3. METADATA CONFLICTS (prominent, not buried) ═══════ */}
        {unresolvedConflicts.length > 0 && (
          <Section label="Unresolved Conflicts" icon={<AlertTriangle size={10} />} count={unresolvedConflicts.length}>
            {asset.conflicts?.map((c, i) => (
              <ConflictCard key={i} conflict={c} assetId={asset.id} dispatch={dispatch} />
            ))}
          </Section>
        )}

        {/* ═══════ 4. DECLARATION CHECK ═══════ */}
        {asset.declarationState && (
          <DeclarationCard state={asset.declarationState} em={em} />
        )}

        {/* ═══════ 5. TITLE / DESCRIPTION / TAGS / GEOGRAPHY ═══════ */}
        <Section label="Metadata" icon={<FileText size={10} />}>
          {/* Title */}
          <FieldRow label="Title" source={getFieldSource(asset, 'title')} conflict={getFieldConflict(asset, 'title')}>
            <input
              value={asset.editable.title}
              onChange={e => dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'title', value: e.target.value })}
              className="w-full border-2 border-slate-200 px-2 py-1.5 text-xs focus:border-black outline-none"
              placeholder="Asset title..."
            />
            <ProposalHint asset={asset} field="title" proposal={proposal} dispatch={dispatch} />
          </FieldRow>

          {/* Description */}
          <FieldRow label="Description" source={getFieldSource(asset, 'description')} conflict={getFieldConflict(asset, 'description')}>
            <textarea
              value={asset.editable.description}
              onChange={e => dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'description', value: e.target.value })}
              rows={2}
              className="w-full border-2 border-slate-200 px-2 py-1.5 text-xs focus:border-black outline-none resize-none"
              placeholder="Description..."
            />
            <ProposalHint asset={asset} field="description" proposal={proposal} dispatch={dispatch} />
          </FieldRow>

          {/* Tags */}
          <FieldRow label="Tags" source={getFieldSource(asset, 'tags')}>
            <div className="flex flex-wrap gap-1 mb-1">
              {asset.editable.tags.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-[10px]">
                  {tag}
                  <button
                    onClick={() => dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'tags', value: asset.editable.tags.filter((_, idx) => idx !== i) })}
                    className="text-slate-400 hover:text-red-500 text-[8px]"
                  >x</button>
                </span>
              ))}
            </div>
            <input
              placeholder="Add tag + Enter"
              className="w-full border border-slate-200 px-2 py-1 text-[10px] outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'tags', value: [...asset.editable.tags, e.currentTarget.value.trim()] })
                  e.currentTarget.value = ''
                }
              }}
            />
          </FieldRow>

          {/* Geography */}
          <FieldRow label="Location" source={getFieldSource(asset, 'geography')} conflict={getFieldConflict(asset, 'geography')}>
            <div className="flex flex-wrap gap-1">
              {asset.editable.geography.map((g, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px]">{g}</span>
              ))}
              {asset.editable.geography.length === 0 && <span className="text-slate-300 text-[10px]">No location data</span>}
            </div>
            {em?.gpsLocationLabel && (
              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin size={8} /> GPS: {em.gpsLocationLabel}
                {em.gpsLat !== null && <span className="font-mono">({em.gpsLat.toFixed(4)}, {em.gpsLon?.toFixed(4)})</span>}
              </div>
            )}
          </FieldRow>
        </Section>

        {/* ═══════ 6. STORY ASSIGNMENT ═══════ */}
        <Section label="Story" icon={<Layers size={10} />}>
          <select
            value={asset.storyGroupId ?? ''}
            onChange={e => {
              const val = e.target.value
              if (val === '__create__') {
                const name = prompt('New Story name:')
                if (name?.trim()) dispatch({ type: 'CREATE_STORY_GROUP', name: name.trim() })
              } else if (val) {
                dispatch({ type: 'ASSIGN_ASSET_TO_STORY', assetId: asset.id, storyGroupId: val })
              } else {
                dispatch({ type: 'UNASSIGN_ASSET_FROM_STORY', assetId: asset.id })
              }
            }}
            className={cn('w-full border-2 px-2 py-1.5 text-xs', !asset.storyGroupId ? 'border-dashed border-black' : 'border-slate-200')}
          >
            <option value="">{'\u2014'} Not assigned {'\u2014'}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value="__create__">+ Create New Story</option>
          </select>
          {altCandidates.length > 0 && (
            <div className="mt-1.5 px-2 py-1.5 bg-slate-50 border border-dashed border-slate-300">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Also considered</div>
              {altCandidates.map(c => {
                const g = state.storyGroupsById[c.storyGroupId]
                return g ? (
                  <div key={c.storyGroupId} className="flex items-center justify-between text-[10px] py-0.5">
                    <button onClick={() => dispatch({ type: 'ASSIGN_ASSET_TO_STORY', assetId: asset.id, storyGroupId: c.storyGroupId })} className="truncate text-blue-600 hover:underline">{g.name}</button>
                    <span className="text-slate-400 font-mono ml-2">{Math.round(c.score * 100)}%</span>
                  </div>
                ) : null
              })}
            </div>
          )}
        </Section>

        {/* ═══════ 7. PRIVACY ═══════ */}
        <Section label="Privacy" icon={<Shield size={10} />}>
          <div className="flex gap-1">
            {PRIVACY_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'privacy', value: asset.editable.privacy === p ? null : p })}
                className={cn(
                  'flex-1 py-1 text-[10px] font-bold uppercase tracking-wide border-2 transition-colors',
                  asset.editable.privacy === p
                    ? 'border-black bg-black text-white'
                    : 'border-slate-200 text-slate-400 hover:border-slate-400',
                )}
              >{p}</button>
            ))}
          </div>
          {!asset.editable.privacy && proposal?.privacySuggestion && (
            <div className="mt-1 px-2 py-1 border border-dashed border-slate-300 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                <SourceBadge source="ai" /> <span className="font-bold ml-1">{proposal.privacySuggestion}</span>
              </span>
              <button onClick={() => dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'privacy', value: proposal.privacySuggestion })} className="text-[10px] font-bold text-blue-600 hover:underline">Accept</button>
            </div>
          )}
        </Section>

        {/* ═══════ 8. LICENCES ═══════ */}
        <Section label="Licences">
          <div className="flex flex-wrap gap-1">
            {LICENCE_OPTIONS.map(l => {
              const isActive = asset.editable.licences.includes(l)
              return (
                <button
                  key={l}
                  onClick={() => {
                    const next = isActive ? asset.editable.licences.filter(x => x !== l) : [...asset.editable.licences, l]
                    dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'licences', value: next })
                  }}
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-bold uppercase border transition-colors',
                    isActive ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-400 hover:border-slate-400',
                  )}
                >{LICENCE_TYPE_LABELS[l]}</button>
              )
            })}
          </div>
          {asset.editable.licences.length === 0 && proposal?.licenceSuggestions && proposal.licenceSuggestions.length > 0 && (
            <div className="mt-1 px-2 py-1 border border-dashed border-slate-300 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                <SourceBadge source="ai" /> <span className="font-bold ml-1">{proposal.licenceSuggestions.map(l => LICENCE_TYPE_LABELS[l]).join(', ')}</span>
              </span>
              <button onClick={() => dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'licences', value: [...proposal.licenceSuggestions] })} className="text-[10px] font-bold text-blue-600 hover:underline">Accept</button>
            </div>
          )}
        </Section>

        {/* ═══════ 9. PRICE ═══════ */}
        <Section label="Price (EUR)" icon={<DollarSign size={10} />}>
          <input
            type="number"
            value={asset.editable.price !== null ? asset.editable.price / 100 : ''}
            onChange={e => {
              const val = e.target.value
              if (val === '') dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'price', value: null })
              else {
                const cents = Math.round(parseFloat(val) * 100)
                if (!isNaN(cents)) dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'price', value: cents })
              }
            }}
            className="w-full border-2 border-slate-200 px-2 py-1.5 text-xs focus:border-black outline-none"
            placeholder="Enter price..."
          />
          {proposal?.priceSuggestion && (
            <div className="mt-1 px-2 py-1.5 border border-dashed border-slate-300">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span><SourceBadge source="ai" /> <span className="font-bold ml-1">{centsToEur(proposal.priceSuggestion.amount)}</span></span>
                <span className="font-mono text-slate-400">{Math.round(proposal.priceSuggestion.confidence * 100)}%</span>
              </div>
              <div className="text-[10px] text-slate-400">{proposal.priceSuggestion.basis}</div>
              {proposal.priceSuggestion.factors.map((f, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className={cn('w-1 h-1', f.effect === 'increase' ? 'bg-blue-600' : f.effect === 'decrease' ? 'bg-black' : 'bg-slate-300')} />
                  {f.label}
                </div>
              ))}
              {asset.editable.price === null && (
                <button onClick={() => dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field: 'price', value: proposal.priceSuggestion!.amount })} className="mt-1 text-[10px] font-bold text-blue-600 hover:underline">Accept price</button>
              )}
            </div>
          )}
        </Section>

        {/* ═══════ 10. PROVENANCE / METADATA SOURCES ═══════ */}
        {em && (
          <Section label="Provenance" icon={<Fingerprint size={10} />} collapsed>
            <div className="border border-slate-200 divide-y divide-slate-100 text-[10px]">
              {em.cameraMake && (
                <ProvenanceRow icon={<Camera size={10} />} label="Camera" value={`${em.cameraMake} ${em.cameraModel ?? ''}`} />
              )}
              {em.iso !== null && (
                <ProvenanceRow label="Settings" value={`ISO ${em.iso} · ${em.aperture} · ${em.shutterSpeed} · ${em.focalLength}`} />
              )}
              {em.gpsLat !== null && (
                <ProvenanceRow icon={<MapPin size={10} />} label="GPS" value={`${em.gpsLat.toFixed(4)}, ${em.gpsLon?.toFixed(4)} ${em.gpsLocationLabel ? `(${em.gpsLocationLabel})` : ''}`} />
              )}
              {em.iptcDateCreated && (
                <ProvenanceRow icon={<Calendar size={10} />} label="IPTC Date" value={em.iptcDateCreated} />
              )}
              {em.iptcByline && <ProvenanceRow label="Byline" value={em.iptcByline} />}
              {em.iptcCopyright && <ProvenanceRow label="Copyright" value={em.iptcCopyright} />}
              {em.iptcCredit && <ProvenanceRow label="Credit" value={em.iptcCredit} />}
              {em.iptcSource && <ProvenanceRow label="Source" value={em.iptcSource} />}
              {em.xmpCreatorTool && <ProvenanceRow label="Creator Tool" value={em.xmpCreatorTool} />}
              {em.c2paPresent && (
                <ProvenanceRow
                  icon={<ShieldCheck size={10} className={em.c2paValid ? 'text-blue-600' : 'text-slate-400'} />}
                  label="C2PA"
                  value={`v${em.c2paVersion} · ${em.c2paValid ? 'Valid' : 'Invalid'}${em.c2paSignerIdentity ? ` · ${em.c2paSignerIdentity}` : ''}`}
                />
              )}
              {em.colorSpace && <ProvenanceRow label="Color" value={em.colorSpace} />}
            </div>
          </Section>
        )}

        {/* Metadata source summary */}
        {Object.keys(asset.editable.metadataSource).length > 0 && (
          <Section label="Field Sources" collapsed>
            <div className="border border-slate-200 divide-y divide-slate-100 text-[10px]">
              {Object.entries(asset.editable.metadataSource).map(([field, source]) => source ? (
                <div key={field} className="flex items-center justify-between px-2 py-0.5">
                  <span className="text-slate-500 capitalize">{field}</span>
                  <SourceBadge source={source} />
                </div>
              ) : null)}
            </div>
          </Section>
        )}

        {/* ═══════ 11. DUPLICATES ═══════ */}
        {asset.duplicateStatus !== 'none' && (
          <Section label="Duplicate" icon={<Eye size={10} />}>
            <div className="border-2 border-dashed border-black px-2 py-1.5">
              <div className="text-[10px] font-bold">
                {asset.duplicateStatus === 'likely_duplicate' ? 'Possible duplicate detected' : 'Confirmed duplicate'}
              </div>
              {asset.duplicateOfId && (
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Matches: <span className="font-mono">{state.assetsById[asset.duplicateOfId]?.filename ?? asset.duplicateOfId}</span>
                </div>
              )}
              <div className="flex gap-1 mt-1.5">
                <button
                  onClick={() => dispatch({ type: 'CLEAR_DUPLICATE_STATUS', assetId: asset.id })}
                  className="flex-1 py-0.5 text-[9px] font-bold uppercase border-2 border-black hover:bg-black hover:text-white transition-colors"
                >Keep both</button>
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_ASSET_EXCLUDED', assetId: asset.id })}
                  className="flex-1 py-0.5 text-[9px] font-bold uppercase border-2 border-slate-300 hover:border-black transition-colors"
                >Exclude this</button>
              </div>
            </div>
          </Section>
        )}

        {/* ═══════ 12. PROPOSAL RATIONALE ═══════ */}
        {proposal && (
          <Section label="AI Analysis" collapsed>
            <div className="text-[10px] text-slate-500">{proposal.rationale}</div>
            <div className="mt-1 text-[10px] font-mono text-slate-400">
              Confidence: {Math.round(proposal.confidence * 100)}%
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ── Reusable Components ──

function Section({ label, icon, count, collapsed, children }: {
  label: string; icon?: React.ReactNode; count?: number; collapsed?: boolean; children: React.ReactNode
}) {
  return (
    <details open={!collapsed}>
      <summary className="text-[10px] font-bold uppercase tracking-widest text-slate-400 cursor-pointer flex items-center gap-1 select-none mb-1">
        {icon} {label}
        {count !== undefined && <span className="font-mono text-black bg-slate-100 px-1 ml-1">{count}</span>}
      </summary>
      <div className="space-y-1.5">{children}</div>
    </details>
  )
}

function FieldRow({ label, source, conflict, children }: {
  label: string; source?: string; conflict?: MetadataConflict; children: React.ReactNode
}) {
  return (
    <div className={cn('py-1', conflict && !conflict.resolvedBy && 'border-l-2 border-dashed border-black pl-2')}>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
        {source && source !== 'none' && <SourceBadge source={source as MetadataSource} />}
        {conflict && !conflict.resolvedBy && (
          <span className="text-[8px] font-bold uppercase bg-black text-white px-1 ml-auto">Conflict</span>
        )}
      </div>
      {children}
    </div>
  )
}

function ProposalHint({ asset, field, proposal, dispatch }: {
  asset: V2Asset; field: 'title' | 'description'; proposal: V2Asset['proposal']; dispatch: ReturnType<typeof useUploadV2>['dispatch']
}) {
  if (!proposal) return null
  const currentVal = asset.editable[field]
  const proposedVal = proposal[field]
  const embeddedVal = field === 'title' ? asset.extractedMetadata?.iptcHeadline : asset.extractedMetadata?.iptcCaption

  // Show embedded hint if different from current and source isn't embedded
  if (embeddedVal && embeddedVal !== currentVal && getFieldSource(asset, field) !== 'embedded') {
    return (
      <div className="text-[10px] mt-0.5 px-1 py-0.5 border border-dashed border-slate-300 flex items-center justify-between">
        <span className="text-slate-500 truncate"><SourceBadge source="embedded" /> <span className="ml-1">{embeddedVal}</span></span>
        <button onClick={() => dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field, value: embeddedVal })} className="text-[9px] font-bold text-blue-600 hover:underline shrink-0 ml-1">Use</button>
      </div>
    )
  }

  // Show AI hint if different from current
  if (proposedVal && proposedVal !== currentVal) {
    return (
      <div className="text-[10px] mt-0.5 px-1 py-0.5 border border-dashed border-slate-300 flex items-center justify-between">
        <span className="text-slate-500 truncate"><SourceBadge source="ai" /> <span className="ml-1">{proposedVal}</span></span>
        <button onClick={() => dispatch({ type: 'UPDATE_ASSET_FIELD', assetId: asset.id, field, value: proposedVal })} className="text-[9px] font-bold text-blue-600 hover:underline shrink-0 ml-1">Use</button>
      </div>
    )
  }

  return null
}

function ConflictCard({ conflict: c, assetId, dispatch }: {
  conflict: MetadataConflict; assetId: string; dispatch: ReturnType<typeof useUploadV2>['dispatch']
}) {
  return (
    <div className={cn(
      'border-2 px-2 py-1.5',
      c.resolvedBy ? 'border-slate-200 bg-slate-50' : 'border-dashed border-black bg-white',
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wide">{String(c.field)}</span>
        {c.resolvedBy && (
          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-0.5"><Check size={8} /> Resolved</span>
        )}
      </div>
      <div className="space-y-0.5">
        <div className="flex items-start gap-1 text-[10px]">
          <SourceBadge source="embedded" />
          <span className="text-black ml-1">{c.embeddedValue || '\u2014'}</span>
        </div>
        <div className="flex items-start gap-1 text-[10px]">
          <SourceBadge source="ai" />
          <span className="text-black italic ml-1">{c.aiValue} <span className="text-slate-400 font-mono">({Math.round(c.aiConfidence * 100)}%)</span></span>
        </div>
      </div>
      {!c.resolvedBy && (
        <div className="flex gap-1 mt-1.5">
          <button
            onClick={() => dispatch({ type: 'RESOLVE_CONFLICT', assetId, field: c.field, value: c.embeddedValue })}
            className="flex-1 py-0.5 text-[9px] font-bold uppercase border-2 border-black hover:bg-black hover:text-white transition-colors"
          >Use embedded</button>
          <button
            onClick={() => dispatch({ type: 'RESOLVE_CONFLICT', assetId, field: c.field, value: c.aiValue })}
            className="flex-1 py-0.5 text-[9px] font-bold uppercase border-2 border-slate-300 hover:border-black transition-colors"
          >Use AI</button>
        </div>
      )}
    </div>
  )
}

function DeclarationCard({ state: declState, em }: { state: string; em: V2Asset['extractedMetadata'] }) {
  const isValid = declState === 'fully_validated' || declState === 'corroborated'
  const isPending = declState === 'provenance_pending'
  const isInvalid = declState === 'manifest_invalid'

  return (
    <div className={cn(
      'border-2 px-3 py-2',
      isValid && 'border-blue-300',
      isPending && 'border-dashed border-black',
      isInvalid && 'border-black bg-slate-50',
    )}>
      <div className="flex items-center gap-2 mb-0.5">
        {isValid && <ShieldCheck size={12} className="text-blue-600" />}
        {isPending && <ShieldQuestion size={12} />}
        {isInvalid && <ShieldAlert size={12} />}
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Declaration</span>
      </div>
      <div className="text-xs font-bold">{DECLARATION_STATE_LABELS[declState as keyof typeof DECLARATION_STATE_LABELS] ?? declState}</div>
      {isInvalid && <div className="text-[10px] mt-0.5">Cannot publish. Declaration is invalid or corrupt.</div>}
      {isPending && <div className="text-[10px] text-slate-500 mt-0.5">Provenance verification in progress.</div>}
    </div>
  )
}

function ProvenanceRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      <span className="text-slate-500 shrink-0">{label}:</span>
      <span className="font-mono truncate">{value}</span>
    </div>
  )
}

function SourceBadge({ source }: { source: MetadataSource | string }) {
  const config: Record<string, { label: string; className: string }> = {
    embedded: { label: 'IPTC', className: 'bg-black text-white' },
    extracted: { label: 'Extr', className: 'bg-slate-600 text-white' },
    ai: { label: 'AI', className: 'bg-white text-black border border-dashed border-black' },
    creator: { label: 'Confirmed', className: 'bg-blue-600 text-white' },
  }
  const c = config[source] ?? config.ai
  return <span className={cn('px-1 py-0 text-[8px] font-bold uppercase tracking-wide inline-block leading-tight', c.className)}>{c.label}</span>
}
