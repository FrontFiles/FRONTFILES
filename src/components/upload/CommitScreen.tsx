'use client'

import { cn } from '@/lib/utils'
import type { BatchAsset } from '@/lib/upload/batch-types'
import type { BatchAction } from '@/lib/upload/batch-state'
import { getCommitSummary } from '@/lib/upload/batch-state'
import { formatFileSize } from '@/lib/upload/validation'
import { ASSET_FORMAT_LABELS, LICENCE_TYPE_LABELS } from '@/lib/upload/types'
import type { LicenceType, PrivacyState } from '@/lib/upload/types'

interface CommitScreenProps {
  assets: BatchAsset[]
  dispatch: (action: BatchAction) => void
}

export function CommitScreen({ assets, dispatch }: CommitScreenProps) {
  const summary = getCommitSummary(assets)
  const { readyAssets, heldAssets, blockedAssets } = summary

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">Commit to Vault</div>
          <div className="text-[10px] font-mono text-slate-400">
            Review and commit {readyAssets.length} asset{readyAssets.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'review' })}
          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-black hover:bg-black hover:text-white transition-colors"
        >
          Back to Review
        </button>
      </div>

      {/* Ready to commit */}
      <div className="border-2 border-[#0000ff] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-[#0000ff]">
            COMMITTING {readyAssets.length} ASSETS
          </span>
          <span className="text-sm font-mono font-bold">
            &euro;{(summary.totalPrice / 100).toFixed(0)} total listed value
          </span>
        </div>

        {/* Summary grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Formats */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">FORMATS</div>
            {Object.entries(summary.formatSummary).map(([format, count]) => (
              <div key={format} className="flex items-center justify-between text-[10px] font-mono">
                <span className="uppercase">{format}</span>
                <span className="text-slate-400">&times;{count}</span>
              </div>
            ))}
          </div>

          {/* Privacy */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PRIVACY</div>
            {(Object.entries(summary.privacySummary) as [PrivacyState, number][]).map(([privacy, count]) => (
              <div key={privacy} className="flex items-center justify-between text-[10px] font-mono">
                <span>{privacy}</span>
                <span className="text-slate-400">&times;{count}</span>
              </div>
            ))}
          </div>

          {/* Licences */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">LICENCES</div>
            {(Object.entries(summary.licenceSummary) as [LicenceType, number][]).map(([licence, count]) => (
              <div key={licence} className="flex items-center justify-between text-[10px] font-mono">
                <span>{LICENCE_TYPE_LABELS[licence]}</span>
                <span className="text-slate-400">&times;{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stories */}
        {summary.storySummary.length > 0 && (
          <div className="space-y-1 border-t border-[#0000ff]/15 pt-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">STORIES</div>
            {summary.storySummary.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                <span className="truncate">{s.title}</span>
                <span className="text-slate-400">&times;{s.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Asset list */}
        <div className="border-t border-[#0000ff]/15 pt-2 space-y-0.5 max-h-[250px] overflow-y-auto">
          {readyAssets.map(asset => (
            <div key={asset.id} className="flex items-center gap-2 py-1 text-[10px] font-mono border-b border-[#0000ff]/10">
              <span className="w-10 font-bold uppercase text-[#0000ff]">
                {asset.format ? ASSET_FORMAT_LABELS[asset.format]?.slice(0, 5) : '?'}
              </span>
              <span className="flex-1 truncate">{asset.title || asset.fileName}</span>
              <span className="text-slate-400">{asset.privacy}</span>
              <span className="font-bold">
                {asset.priceAmount ? `€${(asset.priceAmount / 100).toFixed(0)}` : ''}
              </span>
              <span className={cn(
                'px-1 py-0.5 text-[9px] uppercase',
                asset.declarationState === 'fully_validated' ? 'border border-[#0000ff] text-[#0000ff]' : 'border border-slate-300 text-slate-500'
              )}>
                {asset.declarationState?.replace(/_/g, ' ') ?? 'pending'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Held back */}
      {heldAssets.length > 0 && (
        <div className="border-2 border-slate-300 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              HELD BACK / {heldAssets.length} assets
            </span>
            <span className="text-[10px] font-mono text-slate-400">Will not be committed</span>
          </div>
          <div className="space-y-0.5">
            {heldAssets.map(a => (
              <div key={a.id} className="flex items-center gap-2 py-0.5 text-[10px] font-mono text-slate-500">
                <span className="flex-1 truncate">{a.title || a.fileName}</span>
                <span>held by creator</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked / not included */}
      {blockedAssets.length > 0 && (
        <div className="border border-slate-200 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              NOT INCLUDED / {blockedAssets.length} assets
            </span>
            <button
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'exceptions' })}
              className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] hover:underline"
            >
              Fix in Exception Queue
            </button>
          </div>
        </div>
      )}

      {/* Commit CTA */}
      <div className="flex gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'review' })}
          className="px-4 py-3 text-xs font-bold uppercase tracking-widest border-2 border-black text-black hover:bg-black hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => dispatch({ type: 'COMMIT_READY' })}
          disabled={readyAssets.length === 0}
          className={cn(
            'flex-1 py-3 text-sm font-bold uppercase tracking-widest border-2 transition-colors',
            readyAssets.length > 0
              ? 'border-[#0000ff] bg-[#0000ff] text-white hover:bg-[#0000cc]'
              : 'border-slate-200 text-slate-300 cursor-not-allowed'
          )}
        >
          Commit {readyAssets.length} Asset{readyAssets.length !== 1 ? 's' : ''} to Vault
        </button>
      </div>
    </div>
  )
}
