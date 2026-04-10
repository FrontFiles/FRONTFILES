'use client'

import { cn } from '@/lib/utils'
import { useUploadV2 } from './UploadV2Context'
import {
  getPublishReadiness,
  getIncludedAssets,
  getAssignedAssets,
  getUnassignedAssets,
  getTotalListedValue,
  getAdvisoryExceptions,
  getBatchFieldAudit,
  centsToEur,
} from '@/lib/upload/v2-state'
import { AlertTriangle, Info, ArrowRight } from 'lucide-react'

export function PublishBar() {
  const { state, dispatch } = useUploadV2()
  const readiness = getPublishReadiness(state)
  const included = getIncludedAssets(state)
  const assigned = getAssignedAssets(state)
  const unassigned = getUnassignedAssets(state)
  const totalValue = getTotalListedValue(state)
  const advisoryCount = getAdvisoryExceptions(state).length
  const excluded = state.assetOrder.filter(id => state.assetsById[id]?.excluded).length
  const selectedCount = state.ui.selectedAssetIds.length
  const fieldAudit = getBatchFieldAudit(state)

  return (
    <div className="border-t-2 border-black bg-white px-4 py-2.5 flex items-center gap-4 flex-shrink-0">
      {/* Counts */}
      <div className="flex items-center gap-3 text-[10px] font-mono">
        <span className="text-slate-500">{included.length} files</span>
        <span className="text-[#0000ff]">{assigned.length} assigned</span>
        {unassigned.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'SET_FILTER_PRESET', preset: 'unassigned' })}
            className="text-black hover:underline"
          >
            {unassigned.length} unassigned
          </button>
        )}
        {excluded > 0 && <span className="text-slate-300">{excluded} excluded</span>}
        {selectedCount > 0 && (
          <span className="text-[#0000cc] bg-[#0000ff]/10 px-1.5 py-0.5">
            {selectedCount} selected
          </span>
        )}
      </div>

      {/* Field audit summary — shows empty field gaps */}
      {fieldAudit.length > 0 && (
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
          {fieldAudit.slice(0, 4).map(f => (
            <span key={f.field} className={cn(
              'px-1.5 py-0.5 border',
              f.filledPercent < 50 ? 'border-black text-black' : 'border-slate-200 text-slate-400',
            )}>
              {f.label}: {f.filledPercent}%
            </span>
          ))}
          {fieldAudit.length > 4 && (
            <span className="text-slate-300">+{fieldAudit.length - 4}</span>
          )}
        </div>
      )}

      {/* Blocker messages */}
      {readiness.blockerSummary.length > 0 && (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <AlertTriangle size={12} className="text-black shrink-0" />
          <div className="text-[10px] text-black truncate">
            {readiness.blockerSummary.join(' \u00B7 ')}
          </div>
        </div>
      )}

      {/* Advisory count */}
      {advisoryCount > 0 && readiness.blockerSummary.length === 0 && (
        <div className="flex items-center gap-1 flex-1">
          <Info size={12} className="text-slate-400" />
          <span className="text-[10px] text-slate-500">{advisoryCount} advisory notice{advisoryCount > 1 ? 's' : ''}</span>
        </div>
      )}

      {readiness.blockerSummary.length === 0 && advisoryCount === 0 && (
        <div className="flex-1" />
      )}

      {/* Total value */}
      {totalValue > 0 && (
        <div className="text-[10px] font-mono text-slate-500">
          Listed value: <span className="font-bold text-black">{centsToEur(totalValue)}</span>
        </div>
      )}

      {/* Publish button */}
      <button
        disabled={!readiness.ready}
        onClick={() => dispatch({ type: 'COMMIT_BATCH' })}
        className={cn(
          'px-5 py-2 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2',
          readiness.ready
            ? 'bg-black text-white hover:bg-slate-800'
            : 'bg-slate-100 text-slate-300 cursor-not-allowed',
        )}
      >
        Publish {readiness.readyCount > 0 ? `${readiness.readyCount} ` : ''}to Vault
        <ArrowRight size={12} />
      </button>
    </div>
  )
}
